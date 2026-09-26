import config
import db, session_manager
import voiceprint
import content_risk, transcription
from risk_engine import process_and_log
db.init_db()  # run once at startup, e.g. right after "app = FastAPI()"
import sys
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
    except Exception:
        pass

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, Query, HTTPException, Depends
from auth import require_api_key
from audio_routes import router as audio_router

import io
import os
import tempfile
from pathlib import Path
from typing import Optional
import numpy as np
import soundfile as sf
import torch
import torch.nn.functional as F
from pydub import AudioSegment

from prediction_service import (
    predict_audio,
    predict_window,
    assess_impersonation_threat,
    evaluate_window_threat,
    create_spectrogram,
)

import logging
from logging.handlers import RotatingFileHandler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        RotatingFileHandler("voiceguard_audit.log", maxBytes=10*1024*1024, backupCount=5),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("voiceguard")

app = FastAPI()


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# Existing upload endpoint
# ---------------------------------------------------------

app.include_router(audio_router)


# ---------------------------------------------------------
def process_pcm_window(pcm_bytes):
    """
    Takes a raw 16-bit PCM byte buffer, converts to a normalized float tensor,
    and performs calibrated dual-engine detection (direct neural CNN inference + loudspeaker acoustic forensics).

    Returns a 12-element tuple, the last element being the spectrogram as a
    plain nested list [freq_bins][time_bins] so it can be JSON-serialized and
    rendered by the frontend's SpectrogramCanvas.
    """
    audio = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    waveform = torch.tensor(audio, dtype=torch.float32)

    # Standardize to 4-second input (64,000 samples)
    if waveform.numel() < 64000:
        repeat_count = int(np.ceil(64000 / max(1, waveform.numel())))
        waveform = waveform.repeat(repeat_count)[:64000]
    elif waveform.numel() > 64000:
        waveform = waveform[:64000]

    raw_rms = torch.sqrt(torch.mean(waveform ** 2)).item()
    raw_peak = waveform.abs().max().item()

    # Spectrogram for the frontend's SpectrogramCanvas — computed once per
    # window regardless of which branch (silence/speech) runs below.
    with torch.no_grad():
        spec_tensor = create_spectrogram(waveform)

    # Compact downsampled spectrogram for WebSocket transmission (64 bins x 126 frames, 2 decimal places)
    # Prevents exceeding WebSocket 1MB frame limit (code 1009) and eliminates transmission lag
    spec_np = spec_tensor.squeeze().detach().cpu().numpy()
    if spec_np.shape[0] > 64:
        step = int(np.ceil(spec_np.shape[0] / 64))
        spec_np = spec_np[::step, :]
    spectrogram_list = np.round(spec_np, 2).tolist()

    if raw_rms < 0.005 and raw_peak < 0.025:
        # Ambient silence / room noise
        breakdown = {
            "spectral_score": 0.05,
            "prosody_score": 0.05,
            "final_score": 0.05,
            "flagged_spectral": False,
            "flagged_prosody": False,
            "dual_layer_flagged": False,
        }
        silence_forensics = {
            "p_sub": 0.0,
            "p_mid": 0.0,
            "sub_mid_ratio": 0.40,
            "reflection_prominence": 0.0,
            "replay_score": 0.05,
            "prosody_score": 0.05,
            "jitter": 0.055,
            "has_voiced": False,
        }
        return 0.05, 0.95, "LOW", "likely_real", "real", 0.95, raw_rms, False, "SILENCE", silence_forensics, breakdown, spectrogram_list

    sp, bp, risk, status, label, conf, detection_mode, forensics, score_breakdown = evaluate_window_threat(waveform, sr=16000)
    if not forensics:
        forensics = {
            "p_sub": 0.0,
            "p_mid": 0.0,
            "sub_mid_ratio": 0.40,
            "reflection_prominence": 0.0,
            "replay_score": 0.05,
            "prosody_score": 0.05,
            "jitter": 0.055,
            "has_voiced": False,
        }
    return sp, bp, risk, status, label, conf, raw_rms, True, detection_mode, forensics, score_breakdown, spectrogram_list


# ---------------------------------------------------------
# Real-time microphone WebSocket
# ---------------------------------------------------------

@app.websocket("/audio-stream")
async def websocket_endpoint(websocket: WebSocket):

    await websocket.accept()

    incoming_session_id = websocket.query_params.get("session_id")
    session = session_manager.get_or_create_session(incoming_session_id)
    session_id = session.session_id
    logger.info(f"Session started: {session_id} from client {websocket.client}")

    print("\n" + "=" * 65, flush=True)
    print("[MICROPHONE] LIVE STREAM OPENED", flush=True)
    print(f"Session ID: {session_id}", flush=True)
    print("Mode: Real-time Continuous Sliding Evaluation (4s Window / 2s Hop)", flush=True)
    print("=" * 65, flush=True)

    audio_buffer = bytearray()

    SAMPLE_RATE = 16000
    BYTES_PER_SAMPLE = 2

    WINDOW_SECONDS = 4
    HOP_SECONDS = 2

    WINDOW_BYTES = SAMPLE_RATE * WINDOW_SECONDS * BYTES_PER_SAMPLE
    HOP_BYTES = SAMPLE_RATE * HOP_SECONDS * BYTES_PER_SAMPLE

    analysis_count = 0
    session_spoof_probs = []
    recent_speech_scores = []
    session_max_spoof = 0.0
    threat_latched = False
    latched_mode = "LIVE_HUMAN"

    caller_id = websocket.query_params.get("caller_id") or websocket.headers.get("x-caller-id")
    number_risk_tier = None
    if config.ENABLE_NUMBER_RISK:
        import number_risk
        num_res = number_risk.check_number_risk(caller_id)
        number_risk_tier = num_res.get("number_risk_tier")

    # --- Race-condition guard -------------------------------------------
    # The client can close the socket at any moment (Cut Call button,
    # recording timer ending, tab closed) -- including mid-way through us
    # still processing the chunk it just sent. Without this guard, a
    # send_json() that lands after the client's close reaches us raises a
    # RuntimeError deep in uvicorn, which used to surface to the user as a
    # bare "Analysis failed" with no session summary ever saved.
    client_gone = False
    session_finalized = False

    async def safe_send(payload: dict) -> bool:
        nonlocal client_gone
        if client_gone:
            return False
        try:
            await websocket.send_json(payload)
            return True
        except (RuntimeError, WebSocketDisconnect):
            client_gone = True
            return False

    async def finalize_session():
        nonlocal session_finalized
        if session_finalized:
            return
        session_finalized = True

        if audio_buffer:
            try:
                raw_np = np.frombuffer(audio_buffer, dtype=np.int16).astype(np.float32) / 32768.0
                save_path = Path(__file__).resolve().parent.parent / "last_live_mic.wav"
                sf.write(str(save_path), raw_np, SAMPLE_RATE)
                print(f"\n[DEBUG] Saved live microphone audio to {save_path.name} ({len(raw_np)/SAMPLE_RATE:.2f}s)", flush=True)
            except Exception as e:
                print(f"Warning: Failed to save live microphone audio: {e}", flush=True)
        # Process remaining buffer if no segments were evaluated yet (e.g. short audio between 1s and 4s)
        if not session_spoof_probs and len(audio_buffer) >= SAMPLE_RATE * BYTES_PER_SAMPLE:
            try:
                sp, bp, risk, status, label, conf, rms, is_speech, mode, forensics, score_breakdown, spectrogram_list = process_pcm_window(bytes(audio_buffer))
                session_spoof_probs.append(sp)
                analysis_count += 1
            except Exception:
                pass

        max_spoof = max(session_spoof_probs) if session_spoof_probs else 0.0
        overall_verdict = (
            "[ALERT] AI DEEPFAKE DETECTED (HIGH RISK)"
            if max_spoof >= 0.70
            else ("[WARN] SUSPICIOUS VOICE DETECTED (MEDIUM RISK)" if max_spoof >= 0.50 else "[OK] GENUINE VOICE VERIFIED (LOW RISK)")
        )
        print("\n" + "=" * 65, flush=True)
        print("[MICROPHONE] LIVE AUDIO CONNECTION CLOSED", flush=True)
        print(f"Session ID: {session_id}", flush=True)
        print(f"Total Windows Evaluated: {analysis_count}", flush=True)
        print(f"Max Spoof Probability:   {max_spoof*100:.1f}%", flush=True)
        print(f"Session Verdict:         {overall_verdict}", flush=True)
        print("=" * 65 + "\n", flush=True)

        try:
            import time
            db.save_session_summary(
                session_id=session_id,
                started_at=session.created_at,
                ended_at=time.time(),
                peak_risk=overall_verdict,
                peak_spoof_score=max_spoof,
                segment_count=analysis_count
            )
        except Exception as e:
            print(f"Warning: Failed to save session summary: {e}")
        logger.info(
            f"Session ended: {session_id} segments={analysis_count} "
            f"peak_risk={overall_verdict} peak_spoof={max_spoof:.3f}"
        )
        session_manager.end_session(session_id)

    try:
        while True:
            if client_gone:
                break
            data = await websocket.receive_bytes()
            audio_buffer.extend(data)

            if analysis_count == 0 and len(audio_buffer) >= HOP_BYTES and len(audio_buffer) < WINDOW_BYTES:
                chunk_bytes = bytes(audio_buffer[:HOP_BYTES])
                sp, bp, risk, status, label, conf, rms, is_speech, mode, forensics, score_breakdown, spectrogram_list = process_pcm_window(chunk_bytes)
                session_spoof_probs.append(sp)
                analysis_count += 1

                if is_speech and (sp >= config.THREAT_LATCH_THRESHOLD or (mode in ("PHONE_REPLAY_AI", "DIRECT_AI") and sp >= config.MEDIUM_RISK_THRESHOLD)):
                    threat_latched = True
                    latched_mode = mode if mode != "LIVE_HUMAN" else "DIRECT_AI"
                    session_max_spoof = max(session_max_spoof, sp)

                if threat_latched:
                    effective_sp = max(session_max_spoof, sp, config.LATCHED_FLOOR)
                    effective_mode = latched_mode if latched_mode != "LIVE_HUMAN" else "DIRECT_AI"
                    effective_risk = "HIGH"
                    effective_status = "high_risk"
                    effective_label = "spoof"
                    badge = "[ALERT] AI DEEPFAKE (PHONE REPLAY)" if effective_mode == "PHONE_REPLAY_AI" else "[ALERT] AI DEEPFAKE"
                else:
                    if is_speech:
                        recent_speech_scores.append(sp)

                    if len(recent_speech_scores) > 1:
                        effective_sp = 0.40 * max(recent_speech_scores) + 0.60 * float(np.mean(recent_speech_scores))
                    elif recent_speech_scores:
                        effective_sp = recent_speech_scores[0]
                    else:
                        effective_sp = sp

                    effective_mode = "LIVE_HUMAN"
                    effective_risk = "HIGH" if effective_sp >= config.HIGH_RISK_THRESHOLD else ("MEDIUM" if effective_sp >= config.MEDIUM_RISK_THRESHOLD else "LOW")
                    effective_status = "high_risk" if effective_sp >= config.HIGH_RISK_THRESHOLD else ("suspicious" if effective_sp >= config.MEDIUM_RISK_THRESHOLD else "likely_real")
                    effective_label = "spoof" if effective_sp >= config.MEDIUM_RISK_THRESHOLD else "real"
                    badge = "[WARN]  SUSPICIOUS" if effective_sp >= config.MEDIUM_RISK_THRESHOLD else "[OK]    BONAFIDE"

                speech_tag = "SPEECH" if is_speech else "SILENCE"
                rep_sc = forensics.get("replay_score", 0)
                pros_sc = forensics.get("prosody_score", 0)
                spec_sc = score_breakdown.get("spectral_score", sp)
                print(
                    f"[02s] {badge} | Spoof: {effective_sp*100:5.1f}% (spec {spec_sc*100:5.1f}%, pros {pros_sc*100:5.1f}%) | Conf: {conf*100:5.1f}% | "
                    f"RMS: {rms:.4f} ({speech_tag}) | Mode: {effective_mode} | sm: {forensics.get('sub_mid_ratio', 0):.2f} | rep: {rep_sc:.2f}",
                    flush=True
                )

                try:
                    transcript = transcription.transcribe_pcm16(chunk_bytes, sample_rate=16000)
                    if transcript:
                        print(f"[STT 02s] Detected: '{transcript}'", flush=True)
                except Exception as e_stt:
                    print(f"[STT ERROR 02s] {repr(e_stt)}", flush=True)
                    transcript = None
                attack_type, flagged_phrases = content_risk.analyze_transcript(transcript)
                if attack_type and effective_risk == "LOW":
                    effective_risk = "MEDIUM"
                    effective_status = "suspicious"

                speaker_slot, turn_id = session.update_turn(is_speech)
                session.add_segment(effective_sp, effective_risk, effective_mode, speaker_slot, turn_id)
                action_info = process_and_log(
                    session_id, effective_sp, effective_risk, effective_mode,
                    transcript=transcript, content_risk_flags=flagged_phrases, attack_type=attack_type,
                    speaker_slot=speaker_slot, turn_id=turn_id, number_risk_tier=number_risk_tier
                )
                if effective_risk in ("HIGH", "MEDIUM"):
                    logger.warning(
                        f"Session {session_id} turn {turn_id} slot {speaker_slot}: "
                        f"RISK={effective_risk} action={action_info['action']} spoof={effective_sp:.3f} attack={attack_type}"
                    )

                is_early_4s = True
                impersonation_candidate = bool(effective_sp >= config.MEDIUM_RISK_THRESHOLD or attack_type is not None)
                sent_ok = await safe_send({
                    "type": "prediction",
                    "session_id": session_id,
                    "speaker_slot": speaker_slot,
                    "turn_id": turn_id,
                    "spoof_probability": round(effective_sp, 4),
                    "spectral_score": round(spec_sc, 4),
                    "prosody_score": round(pros_sc, 4),
                    "final_score": round(effective_sp, 4),
                    "score_breakdown": score_breakdown,
                    "forensics": forensics,
                    "spectrogram": spectrogram_list,
                    "confidence": round(conf, 4),
                    "risk": effective_risk,
                    "result": effective_label,
                    "status": effective_status,
                    "detection_mode": effective_mode,
                    "action": action_info["action"],
                    "action_message": action_info["message"],
                    "repeated_suspicious": action_info["repeated_suspicious"],
                    "transcript": transcript,
                    "attack_type": attack_type,
                    "flagged_phrases": flagged_phrases,
                    "elapsed_seconds": 2,
                    "is_speech": is_speech,
                    "early_4s_flagged": is_early_4s and impersonation_candidate,
                    "impersonation_candidate": impersonation_candidate,
                    "number_risk_tier": number_risk_tier if config.ENABLE_NUMBER_RISK else None,
                    "per_speaker_scores": session.get_per_speaker_scores() if config.ENABLE_PER_SPEAKER_SCORES else None,
                    "helpline": {
                        "number": "1930",
                        "label": "National Cyber Crime Helpline",
                        "portal": "https://cybercrime.gov.in",
                        "chakshu": "https://sancharsaathi.gov.in/sfc/"
                    }
                })
                if not sent_ok:
                    break

            while len(audio_buffer) >= WINDOW_BYTES:
                window_bytes = bytes(audio_buffer[:WINDOW_BYTES])
                del audio_buffer[:HOP_BYTES]

                sp, bp, risk, status, label, conf, rms, is_speech, mode, forensics, score_breakdown, spectrogram_list = process_pcm_window(window_bytes)
                session_spoof_probs.append(sp)
                analysis_count += 1
                elapsed = analysis_count * HOP_SECONDS

                if is_speech and (sp >= config.THREAT_LATCH_THRESHOLD or (mode in ("PHONE_REPLAY_AI", "DIRECT_AI") and sp >= config.MEDIUM_RISK_THRESHOLD)):
                    threat_latched = True
                    latched_mode = mode if mode != "LIVE_HUMAN" else "DIRECT_AI"
                    session_max_spoof = max(session_max_spoof, sp)

                if threat_latched:
                    effective_sp = max(session_max_spoof, sp, config.LATCHED_FLOOR)
                    effective_mode = latched_mode if latched_mode != "LIVE_HUMAN" else "DIRECT_AI"
                    effective_risk = "HIGH"
                    effective_status = "high_risk"
                    effective_label = "spoof"
                    badge = "[ALERT] AI DEEPFAKE (PHONE REPLAY)" if effective_mode == "PHONE_REPLAY_AI" else "[ALERT] AI DEEPFAKE"
                else:
                    if is_speech:
                        recent_speech_scores.append(sp)
                        if len(recent_speech_scores) > 3:
                            recent_speech_scores.pop(0)

                    if len(recent_speech_scores) > 1:
                        effective_sp = 0.40 * max(recent_speech_scores) + 0.60 * float(np.mean(recent_speech_scores))
                    elif recent_speech_scores:
                        effective_sp = recent_speech_scores[0]
                    else:
                        effective_sp = sp

                    effective_mode = "LIVE_HUMAN"
                    effective_risk = "HIGH" if effective_sp >= config.HIGH_RISK_THRESHOLD else ("MEDIUM" if effective_sp >= config.MEDIUM_RISK_THRESHOLD else "LOW")
                    effective_status = "high_risk" if effective_sp >= config.HIGH_RISK_THRESHOLD else ("suspicious" if effective_sp >= config.MEDIUM_RISK_THRESHOLD else "likely_real")
                    effective_label = "spoof" if effective_sp >= config.MEDIUM_RISK_THRESHOLD else "real"
                    badge = "[WARN]  SUSPICIOUS" if effective_sp >= config.MEDIUM_RISK_THRESHOLD else "[OK]    BONAFIDE"

                speech_tag = "SPEECH" if is_speech else "SILENCE"
                rep_sc = forensics.get("replay_score", 0)
                pros_sc = forensics.get("prosody_score", 0)
                spec_sc = score_breakdown.get("spectral_score", sp)
                print(
                    f"[{elapsed:02d}s] {badge} | Spoof: {effective_sp*100:5.1f}% (spec {spec_sc*100:5.1f}%, pros {pros_sc*100:5.1f}%) | Conf: {conf*100:5.1f}% | "
                    f"RMS: {rms:.4f} ({speech_tag}) | Mode: {effective_mode} | sm: {forensics.get('sub_mid_ratio', 0):.2f} | rep: {rep_sc:.2f}",
                    flush=True
                )

                try:
                    transcript = transcription.transcribe_pcm16(window_bytes, sample_rate=16000)
                    if transcript:
                        print(f"[STT {elapsed:02d}s] Detected: '{transcript}'", flush=True)
                except Exception as e_stt:
                    print(f"[STT ERROR {elapsed:02d}s] {repr(e_stt)}", flush=True)
                    transcript = None
                attack_type, flagged_phrases = content_risk.analyze_transcript(transcript)
                if attack_type and effective_risk == "LOW":
                    effective_risk = "MEDIUM"
                    effective_status = "suspicious"

                speaker_slot, turn_id = session.update_turn(is_speech)
                session.add_segment(effective_sp, effective_risk, effective_mode, speaker_slot, turn_id)
                action_info = process_and_log(
                    session_id, effective_sp, effective_risk, effective_mode,
                    transcript=transcript, content_risk_flags=flagged_phrases, attack_type=attack_type,
                    speaker_slot=speaker_slot, turn_id=turn_id, number_risk_tier=number_risk_tier
                )
                if effective_risk in ("HIGH", "MEDIUM"):
                    logger.warning(
                        f"Session {session_id} turn {turn_id} slot {speaker_slot}: "
                        f"RISK={effective_risk} action={action_info['action']} spoof={effective_sp:.3f} attack={attack_type}"
                    )

                is_early_4s = elapsed <= 4
                impersonation_candidate = bool(effective_sp >= config.MEDIUM_RISK_THRESHOLD or attack_type is not None)
                sent_ok = await safe_send({
                    "type": "prediction",
                    "session_id": session_id,
                    "speaker_slot": speaker_slot,
                    "turn_id": turn_id,
                    "spoof_probability": round(effective_sp, 4),
                    "spectral_score": round(spec_sc, 4),
                    "prosody_score": round(pros_sc, 4),
                    "final_score": round(effective_sp, 4),
                    "score_breakdown": score_breakdown,
                    "forensics": forensics,
                    "spectrogram": spectrogram_list,
                    "confidence": round(conf, 4),
                    "risk": effective_risk,
                    "result": effective_label,
                    "status": effective_status,
                    "detection_mode": effective_mode,
                    "action": action_info["action"],
                    "action_message": action_info["message"],
                    "repeated_suspicious": action_info["repeated_suspicious"],
                    "transcript": transcript,
                    "attack_type": attack_type,
                    "flagged_phrases": flagged_phrases,
                    "elapsed_seconds": elapsed,
                    "is_speech": is_speech,
                    "early_4s_flagged": is_early_4s and impersonation_candidate,
                    "impersonation_candidate": impersonation_candidate,
                    "number_risk_tier": number_risk_tier if config.ENABLE_NUMBER_RISK else None,
                    "per_speaker_scores": session.get_per_speaker_scores() if config.ENABLE_PER_SPEAKER_SCORES else None,
                    "helpline": {
                        "number": "1930",
                        "label": "National Cyber Crime Helpline",
                        "portal": "https://cybercrime.gov.in",
                        "chakshu": "https://sancharsaathi.gov.in/sfc/"
                    }
                })
                if not sent_ok:
                    break

            if client_gone:
                break

    except WebSocketDisconnect:
        if len(audio_buffer) >= SAMPLE_RATE * BYTES_PER_SAMPLE:
            sp, bp, risk, status, label, conf, rms, is_speech, mode, forensics, score_breakdown, spectrogram_list = process_pcm_window(bytes(audio_buffer))
            session_spoof_probs.append(sp)
            analysis_count += 1
            badge = "[ALERT] AI DEEPFAKE (PHONE REPLAY)" if (mode == "PHONE_REPLAY_AI" and sp >= 0.50) else ("[ALERT] AI DEEPFAKE" if sp >= 0.70 else ("[WARN]  SUSPICIOUS" if sp >= 0.50 else "[OK]    BONAFIDE"))
            print(
                f"[TAIL] {badge} | Spoof: {sp*100:5.1f}% | Conf: {conf*100:5.1f}% | RMS: {rms:.4f} | Mode: {mode}",
                flush=True
            )
        await finalize_session()

    except Exception as e:
        print(f"WebSocket error: {repr(e)}", flush=True)
        await finalize_session()
        try:
            await websocket.close()
        except Exception:
            pass

    else:
        # Loop exited via `break` because safe_send detected the client
        # had already gone away -- same cleanup as a normal disconnect,
        # just reached through the race-condition path instead.
        await finalize_session()


# ---------------------------------------------------------
# Dashboard / multi-call visibility endpoints (section 1.5)
# ---------------------------------------------------------

@app.get("/dashboard/stats", dependencies=[Depends(require_api_key)])
def dashboard_stats():
    return db.get_dashboard_stats()


@app.get("/sessions/active", dependencies=[Depends(require_api_key)])
def active_sessions():
    return session_manager.list_active_sessions()


@app.get("/sessions/history", dependencies=[Depends(require_api_key)])
async def get_session_history_endpoint(limit: int = 20):
    return {"history": db.get_session_history(limit=limit)}


# ---------------------------------------------------------
# Phase 2: Speaker Voiceprint / Trust Layer (section 2.1)
# ---------------------------------------------------------

async def load_audio_waveform(file: UploadFile) -> torch.Tensor:
    """
    Reads an uploaded audio file (WAV, WebM, MP3, etc.), normalizes it to
    16kHz mono PCM float32, and returns a 1D PyTorch tensor.
    """
    content = await file.read()
    if not content:
        raise ValueError("Uploaded audio file is empty")

    suffix = Path(file.filename or "recording.wav").suffix or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_in:
        temp_in.write(content)
        temp_in_path = temp_in.name

    temp_wav_path = temp_in_path + ".converted.wav"
    try:
        # First attempt: if it's already a 16kHz mono WAV, sf.read handles it fastest
        try:
            data, sr = sf.read(temp_in_path, dtype="float32")
            if sr == 16000:
                wf = torch.tensor(data, dtype=torch.float32)
                if wf.ndim > 1:
                    wf = wf.mean(dim=-1)
                return wf
        except Exception:
            pass

        # Robust fallback: use pydub to convert any audio container to 16kHz mono
        seg = AudioSegment.from_file(temp_in_path)
        seg = seg.set_frame_rate(16000).set_channels(1)
        seg.export(temp_wav_path, format="wav")

        audio_data, _ = sf.read(temp_wav_path, dtype="float32")
        wf = torch.tensor(audio_data, dtype=torch.float32)
        if wf.ndim > 1:
            wf = wf.mean(dim=-1)
        return wf
    finally:
        for p in (temp_in_path, temp_wav_path):
            if os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass


@app.post("/enroll", dependencies=[Depends(require_api_key)])
async def enroll(
    audio: UploadFile = File(...),
    speaker_id: Optional[str] = Form(None),
    speaker_id_query: Optional[str] = Query(None, alias="speaker_id"),
):
    target_speaker = speaker_id or speaker_id_query
    if not target_speaker:
        raise HTTPException(status_code=400, detail="speaker_id is required")
    try:
        waveform = await load_audio_waveform(audio)
        voiceprint.enroll_speaker(target_speaker, waveform)
        return {"status": "enrolled", "speaker_id": target_speaker}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Enrollment failed: {str(e)}")


@app.post("/verify", dependencies=[Depends(require_api_key)])
async def verify(
    audio: UploadFile = File(...),
    speaker_id: Optional[str] = Form(None),
    speaker_id_query: Optional[str] = Query(None, alias="speaker_id"),
):
    target_speaker = speaker_id or speaker_id_query
    if not target_speaker:
        raise HTTPException(status_code=400, detail="speaker_id is required")
    try:
        waveform = await load_audio_waveform(audio)
        is_match, similarity, status = voiceprint.verify_speaker(waveform, target_speaker)
        return {
            "is_match": bool(is_match),
            "similarity": round(float(similarity), 4),
            "status": status,
            "speaker_id": target_speaker,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Verification failed: {str(e)}")


@app.get("/voiceprints", dependencies=[Depends(require_api_key)])
def list_voiceprints():
    prints = db.get_all_voiceprints()
    return list(prints.keys())


# ---------------------------------------------------------
# Phase 2: Analytics summary endpoint (section 2.4 / 3.4)
# ---------------------------------------------------------

@app.get("/analytics/summary", dependencies=[Depends(require_api_key)])
def analytics_summary():
    return db.get_analytics_summary()


# ---------------------------------------------------------
# Health check
# ---------------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "Voice Shield Backend is running",
        "live_detection": True
    }