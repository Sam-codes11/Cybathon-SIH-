from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from audio_routes import router as audio_router

import io
import numpy as np
import soundfile as sf
import torch
import torch.nn.functional as F

from prediction_service import predict_audio, predict_window


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
# Real-time microphone WebSocket
# ---------------------------------------------------------

def process_pcm_window(pcm_bytes):
    """
    Process a PCM byte segment:
    - Normalizes to [-1, 1]
    - Pads to 4 seconds (64,000 samples) if needed
    - Checks RMS energy for speech vs ambient silence
    - Runs SpoofCNN on GPU in sub-millisecond time
    """
    audio = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    waveform = torch.tensor(audio, dtype=torch.float32)

    # Standardize to 4-second input (64,000 samples)
    if waveform.numel() < 64000:
        waveform = F.pad(waveform, (0, 64000 - waveform.numel()))
    elif waveform.numel() > 64000:
        waveform = waveform[:64000]

    peak = waveform.abs().max()
    if peak > 0:
        waveform = waveform / peak * 0.92

    rms = torch.sqrt(torch.mean(waveform ** 2)).item()

    if rms < 0.005:
        # Ambient silence / room noise
        return 0.05, 0.95, "LOW", "likely_real", "real", 0.95, rms, False

    bonafide_prob, spoof_prob = predict_window(waveform)

    if spoof_prob >= 0.80:
        status = "high_risk"
        risk = "HIGH"
    elif spoof_prob >= 0.50:
        status = "suspicious"
        risk = "MEDIUM"
    else:
        status = "likely_real"
        risk = "LOW"

    result_label = "spoof" if spoof_prob >= 0.50 else "real"
    confidence = spoof_prob if result_label == "spoof" else 1.0 - spoof_prob
    return spoof_prob, bonafide_prob, risk, status, result_label, confidence, rms, True


# ---------------------------------------------------------
# Real-time microphone WebSocket
# ---------------------------------------------------------

@app.websocket("/audio-stream")
async def websocket_endpoint(websocket: WebSocket):

    await websocket.accept()
    print("\n" + "=" * 65, flush=True)
    print("🎙️ LIVE MICROPHONE STREAM OPENED", flush=True)
    print("Mode: Real-time Continuous Sliding Evaluation (4s Window / 2s Hop)", flush=True)
    print("=" * 65, flush=True)

    audio_buffer = bytearray()

    # 16 kHz, mono, 16-bit PCM (2 bytes per sample)
    SAMPLE_RATE = 16000
    BYTES_PER_SAMPLE = 2

    WINDOW_SECONDS = 4
    HOP_SECONDS = 4

    WINDOW_BYTES = SAMPLE_RATE * WINDOW_SECONDS * BYTES_PER_SAMPLE  # 128,000 bytes
    HOP_BYTES = SAMPLE_RATE * HOP_SECONDS * BYTES_PER_SAMPLE        # 64,000 bytes

    analysis_count = 0
    session_spoof_probs = []

    try:
        while True:
            data = await websocket.receive_bytes()
            audio_buffer.extend(data)

            # Early Feedback: evaluate first 2s immediately if user just started speaking
            if analysis_count == 0 and len(audio_buffer) >= HOP_BYTES and len(audio_buffer) < WINDOW_BYTES:
                chunk_bytes = bytes(audio_buffer[:HOP_BYTES])
                sp, bp, risk, status, label, conf, rms, is_speech = process_pcm_window(chunk_bytes)
                session_spoof_probs.append(sp)
                analysis_count += 1
                badge = "🚨 AI DEEPFAKE" if sp >= 0.80 else ("⚠️  SUSPICIOUS" if sp >= 0.50 else "🛡️  BONAFIDE")
                speech_tag = "SPEECH" if is_speech else "SILENCE"
                print(
                    f"[02s] {badge} | Spoof: {sp*100:5.1f}% | Conf: {conf*100:5.1f}% | "
                    f"RMS: {rms:.4f} ({speech_tag})",
                    flush=True
                )
                await websocket.send_json({
                    "type": "prediction",
                    "spoof_probability": round(sp, 4),
                    "confidence": round(conf, 4),
                    "risk": risk,
                    "result": label,
                    "status": status,
                    "elapsed_seconds": 2,
                    "is_speech": is_speech
                })

            # Full sliding 4-second windows with 2-second hops
            while len(audio_buffer) >= WINDOW_BYTES:
                window_bytes = bytes(audio_buffer[:WINDOW_BYTES])
                del audio_buffer[:HOP_BYTES]

                sp, bp, risk, status, label, conf, rms, is_speech = process_pcm_window(window_bytes)
                session_spoof_probs.append(sp)
                analysis_count += 1
                elapsed = analysis_count * HOP_SECONDS

                badge = "🚨 AI DEEPFAKE" if sp >= 0.80 else ("⚠️  SUSPICIOUS" if sp >= 0.50 else "🛡️  BONAFIDE")
                speech_tag = "SPEECH" if is_speech else "SILENCE"
                print(
                    f"[{elapsed:02d}s] {badge} | Spoof: {sp*100:5.1f}% | Conf: {conf*100:5.1f}% | "
                    f"RMS: {rms:.4f} ({speech_tag})",
                    flush=True
                )
                await websocket.send_json({
                    "type": "prediction",
                    "spoof_probability": round(sp, 4),
                    "confidence": round(conf, 4),
                    "risk": risk,
                    "result": label,
                    "status": status,
                    "elapsed_seconds": elapsed,
                    "is_speech": is_speech
                })

    except WebSocketDisconnect:
        # Process any remaining speech tail if at least 1 second of audio remains
        if len(audio_buffer) >= SAMPLE_RATE * BYTES_PER_SAMPLE:
            sp, bp, risk, status, label, conf, rms, is_speech = process_pcm_window(bytes(audio_buffer))
            session_spoof_probs.append(sp)
            analysis_count += 1
            badge = "🚨 AI DEEPFAKE" if sp >= 0.80 else ("⚠️  SUSPICIOUS" if sp >= 0.50 else "🛡️  BONAFIDE")
            print(
                f"[TAIL] {badge} | Spoof: {sp*100:5.1f}% | Conf: {conf*100:5.1f}% | RMS: {rms:.4f}",
                flush=True
            )

        max_spoof = max(session_spoof_probs) if session_spoof_probs else 0.0
        overall_verdict = (
            "🚨 AI DEEPFAKE DETECTED (HIGH RISK)"
            if max_spoof >= 0.80
            else ("⚠️ SUSPICIOUS VOICE DETECTED (MEDIUM RISK)" if max_spoof >= 0.50 else "🛡️ GENUINE VOICE VERIFIED (LOW RISK)")
        )
        print("\n" + "=" * 65, flush=True)
        print("🎙️ LIVE AUDIO CONNECTION CLOSED", flush=True)
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
