import sys
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
    except Exception:
        pass

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from audio_routes import router as audio_router

import io
import numpy as np
import soundfile as sf
import torch
import torch.nn.functional as F

from prediction_service import (
    predict_audio,
    predict_window,
    assess_impersonation_threat,
    evaluate_window_threat,
)

app = FastAPI()


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

    if raw_rms < 0.005 and raw_peak < 0.025:
        # Ambient silence / room noise
        return 0.05, 0.95, "LOW", "likely_real", "real", 0.95, raw_rms, False, "SILENCE", {}

    sp, bp, risk, status, label, conf, detection_mode, forensics = evaluate_window_threat(waveform, sr=16000)
    return sp, bp, risk, status, label, conf, raw_rms, True, detection_mode, forensics


# ---------------------------------------------------------
# Real-time microphone WebSocket
# ---------------------------------------------------------

@app.websocket("/audio-stream")
async def websocket_endpoint(websocket: WebSocket):

    await websocket.accept()
    print("\n" + "=" * 65, flush=True)
    print("[MICROPHONE] LIVE STREAM OPENED", flush=True)
    print("Mode: Real-time Continuous Sliding Evaluation (4s Window / 2s Hop)", flush=True)
    print("=" * 65, flush=True)

    audio_buffer = bytearray()

    # 16 kHz, mono, 16-bit PCM (2 bytes per sample)
    SAMPLE_RATE = 16000
    BYTES_PER_SAMPLE = 2

    WINDOW_SECONDS = 4
    HOP_SECONDS = 2

    WINDOW_BYTES = SAMPLE_RATE * WINDOW_SECONDS * BYTES_PER_SAMPLE  # 128,000 bytes
    HOP_BYTES = SAMPLE_RATE * HOP_SECONDS * BYTES_PER_SAMPLE        # 64,000 bytes

    analysis_count = 0
    session_spoof_probs = []
    recent_speech_scores = []
    session_max_spoof = 0.0
    threat_latched = False
    latched_mode = "LIVE_HUMAN"

    try:
        while True:
            data = await websocket.receive_bytes()
            audio_buffer.extend(data)

            # Early Feedback: evaluate first 2s immediately if user just started speaking
            if analysis_count == 0 and len(audio_buffer) >= HOP_BYTES and len(audio_buffer) < WINDOW_BYTES:
                chunk_bytes = bytes(audio_buffer[:HOP_BYTES])
                sp, bp, risk, status, label, conf, rms, is_speech, mode, forensics = process_pcm_window(chunk_bytes)
                session_spoof_probs.append(sp)
                analysis_count += 1

                # Update stateful threat latch
                if sp >= 0.65 or mode == "PHONE_REPLAY_AI" or mode == "DIRECT_AI":
                    threat_latched = True
                    latched_mode = mode if mode != "LIVE_HUMAN" else "PHONE_REPLAY_AI"
                    session_max_spoof = max(session_max_spoof, sp)

                if threat_latched:
                    effective_sp = max(session_max_spoof, sp, 0.76)
                    effective_mode = latched_mode if latched_mode != "LIVE_HUMAN" else "PHONE_REPLAY_AI"
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
                    effective_risk = "HIGH" if effective_sp >= 0.70 else ("MEDIUM" if effective_sp >= 0.50 else "LOW")
                    effective_status = "high_risk" if effective_sp >= 0.70 else ("suspicious" if effective_sp >= 0.50 else "likely_real")
                    effective_label = "spoof" if effective_sp >= 0.50 else "real"
                    badge = "[WARN]  SUSPICIOUS" if effective_sp >= 0.50 else "[OK]    BONAFIDE"

                speech_tag = "SPEECH" if is_speech else "SILENCE"
                rep_sc = forensics.get("replay_score", 0)
                pros_sc = forensics.get("prosody_score", 0)
                print(
                    f"[02s] {badge} | Spoof: {effective_sp*100:5.1f}% (raw {sp*100:5.1f}%) | Conf: {conf*100:5.1f}% | "
                    f"RMS: {rms:.4f} ({speech_tag}) | Mode: {effective_mode} | sm: {forensics.get('sub_mid_ratio', 0):.2f} | rep: {rep_sc:.2f} | pros: {pros_sc:.2f}",
                    flush=True
                )
                is_early_4s = True
                impersonation_candidate = bool(effective_sp >= 0.50)
                await websocket.send_json({
                    "type": "prediction",
                    "spoof_probability": round(effective_sp, 4),
                    "confidence": round(conf, 4),
                    "risk": effective_risk,
                    "result": effective_label,
                    "status": effective_status,
                    "detection_mode": effective_mode,
                    "elapsed_seconds": 2,
                    "is_speech": is_speech,
                    "early_4s_flagged": is_early_4s and impersonation_candidate,
                    "impersonation_candidate": impersonation_candidate,
                    "helpline": {
                        "number": "1930",
                        "label": "National Cyber Crime Helpline",
                        "portal": "https://cybercrime.gov.in",
                        "chakshu": "https://sancharsaathi.gov.in/sfc/"
                    }
                })

            # Full sliding 4-second windows with 2-second hops
            while len(audio_buffer) >= WINDOW_BYTES:
                window_bytes = bytes(audio_buffer[:WINDOW_BYTES])
                del audio_buffer[:HOP_BYTES]

                sp, bp, risk, status, label, conf, rms, is_speech, mode, forensics = process_pcm_window(window_bytes)
                session_spoof_probs.append(sp)
                analysis_count += 1
                elapsed = analysis_count * HOP_SECONDS

                # Update stateful threat latch
                if sp >= 0.65 or mode == "PHONE_REPLAY_AI" or mode == "DIRECT_AI":
                    threat_latched = True
                    latched_mode = mode if mode != "LIVE_HUMAN" else "PHONE_REPLAY_AI"
                    session_max_spoof = max(session_max_spoof, sp)

                if threat_latched:
                    # Attack confirmed on this line! Hold alert state rock-solid without flickering.
                    effective_sp = max(session_max_spoof, sp, 0.76)
                    effective_mode = latched_mode if latched_mode != "LIVE_HUMAN" else "PHONE_REPLAY_AI"
                    effective_risk = "HIGH"
                    effective_status = "high_risk"
                    effective_label = "spoof"
                    badge = "[ALERT] AI DEEPFAKE (PHONE REPLAY)" if effective_mode == "PHONE_REPLAY_AI" else "[ALERT] AI DEEPFAKE"
                else:
                    # Genuine live speech evaluation
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
                    effective_risk = "HIGH" if effective_sp >= 0.70 else ("MEDIUM" if effective_sp >= 0.50 else "LOW")
                    effective_status = "high_risk" if effective_sp >= 0.70 else ("suspicious" if effective_sp >= 0.50 else "likely_real")
                    effective_label = "spoof" if effective_sp >= 0.50 else "real"
                    badge = "[WARN]  SUSPICIOUS" if effective_sp >= 0.50 else "[OK]    BONAFIDE"

                speech_tag = "SPEECH" if is_speech else "SILENCE"
                rep_sc = forensics.get("replay_score", 0)
                pros_sc = forensics.get("prosody_score", 0)
                print(
                    f"[{elapsed:02d}s] {badge} | Spoof: {effective_sp*100:5.1f}% (raw {sp*100:5.1f}%) | Conf: {conf*100:5.1f}% | "
                    f"RMS: {rms:.4f} ({speech_tag}) | Mode: {effective_mode} | sm: {forensics.get('sub_mid_ratio', 0):.2f} | rep: {rep_sc:.2f} | pros: {pros_sc:.2f}",
                    flush=True
                )
                is_early_4s = elapsed <= 4
                impersonation_candidate = bool(effective_sp >= 0.50)
                await websocket.send_json({
                    "type": "prediction",
                    "spoof_probability": round(effective_sp, 4),
                    "confidence": round(conf, 4),
                    "risk": effective_risk,
                    "result": effective_label,
                    "status": effective_status,
                    "detection_mode": effective_mode,
                    "elapsed_seconds": elapsed,
                    "is_speech": is_speech,
                    "early_4s_flagged": is_early_4s and impersonation_candidate,
                    "impersonation_candidate": impersonation_candidate,
                    "helpline": {
                        "number": "1930",
                        "label": "National Cyber Crime Helpline",
                        "portal": "https://cybercrime.gov.in",
                        "chakshu": "https://sancharsaathi.gov.in/sfc/"
                    }
                })

    except WebSocketDisconnect:
        # Save last recorded live audio to disk for forensic debugging
        if audio_buffer:
            try:
                from pathlib import Path
                raw_np = np.frombuffer(audio_buffer, dtype=np.int16).astype(np.float32) / 32768.0
                save_path = Path(__file__).resolve().parent.parent / "last_live_mic.wav"
                sf.write(str(save_path), raw_np, SAMPLE_RATE)
                print(f"\n[DEBUG] Saved live microphone audio to {save_path.name} ({len(raw_np)/SAMPLE_RATE:.2f}s)", flush=True)
            except Exception as e_save:
                pass

        # Process any remaining speech tail if at least 1 second of audio remains
        if len(audio_buffer) >= SAMPLE_RATE * BYTES_PER_SAMPLE:
            sp, bp, risk, status, label, conf, rms, is_speech, mode, forensics = process_pcm_window(bytes(audio_buffer))
            session_spoof_probs.append(sp)
            analysis_count += 1
            badge = "[ALERT] AI DEEPFAKE (PHONE REPLAY)" if (mode == "PHONE_REPLAY_AI" and sp >= 0.50) else ("[ALERT] AI DEEPFAKE" if sp >= 0.70 else ("[WARN]  SUSPICIOUS" if sp >= 0.50 else "[OK]    BONAFIDE"))
            print(
                f"[TAIL] {badge} | Spoof: {sp*100:5.1f}% | Conf: {conf*100:5.1f}% | RMS: {rms:.4f} | Mode: {mode}",
                flush=True
            )

        max_spoof = max(session_spoof_probs) if session_spoof_probs else 0.0
        overall_verdict = (
            "[ALERT] AI DEEPFAKE DETECTED (HIGH RISK)"
            if max_spoof >= 0.70
            else ("[WARN] SUSPICIOUS VOICE DETECTED (MEDIUM RISK)" if max_spoof >= 0.50 else "[OK] GENUINE VOICE VERIFIED (LOW RISK)")
        )
        print("\n" + "=" * 65, flush=True)
        print("[MICROPHONE] LIVE AUDIO CONNECTION CLOSED", flush=True)
        print(f"Total Windows Evaluated: {analysis_count}", flush=True)
        print(f"Max Spoof Probability:   {max_spoof*100:.1f}%", flush=True)
        print(f"Session Verdict:         {overall_verdict}", flush=True)
        print("=" * 65 + "\n", flush=True)

    except Exception as e:
        print(f"WebSocket error: {repr(e)}", flush=True)
        try:
            await websocket.close()
        except:
            pass


# ---------------------------------------------------------
# Health check
# ---------------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "Voice Shield Backend is running",
        "live_detection": True
    }
