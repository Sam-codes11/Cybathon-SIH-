from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from audio_routes import router as audio_router

import io
import numpy as np
import soundfile as sf

from prediction_service import predict_audio


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

@app.websocket("/audio-stream")
async def websocket_endpoint(websocket: WebSocket):

    await websocket.accept()

    print("🎙️ Live audio connection established")

    audio_buffer = bytearray()

    # 16 kHz, mono, 16-bit PCM
    SAMPLE_RATE = 16000
    BYTES_PER_SAMPLE = 2

    # Analyze each two-second window so the frontend can show a live report.
    WINDOW_SECONDS = 2
    analysis_count = 0

    WINDOW_BYTES = (
        SAMPLE_RATE
        * WINDOW_SECONDS
        * BYTES_PER_SAMPLE
    )

    try:

        while True:

            # Receive raw PCM bytes from browser
            data = await websocket.receive_bytes()

            audio_buffer.extend(data)

            print(
                f"Received {len(data)} bytes | "
                f"Buffer: {len(audio_buffer)} bytes"
            )

            # -------------------------------------------------
            # Once we have ~4 seconds, run inference
            # -------------------------------------------------

            while len(audio_buffer) >= WINDOW_BYTES:

                # Take exactly 4 seconds
                window_bytes = bytes(
                    audio_buffer[:WINDOW_BYTES]
                )

                # Remove processed audio from buffer
                del audio_buffer[:WINDOW_BYTES]

                # -------------------------------------------------
                # Convert PCM bytes → numpy audio
                # -------------------------------------------------

                audio = np.frombuffer(
                    window_bytes,
                    dtype=np.int16
                ).astype(np.float32)

                # Normalize int16 → [-1, 1]
                audio = audio / 32768.0

                # -------------------------------------------------
                # Convert numpy → WAV in memory
                # -------------------------------------------------

                wav_buffer = io.BytesIO()

                sf.write(
                    wav_buffer,
                    audio,
                    SAMPLE_RATE,
                    format="WAV",
                    subtype="PCM_16"
                )

                wav_buffer.seek(0)

                # -------------------------------------------------
                # File-like object for prediction_service
                # -------------------------------------------------

                class StreamFile:

                    def __init__(self, buffer):
                        self.filename = "live_stream.wav"
                        self.file = buffer

                stream_file = StreamFile(wav_buffer)

                # -------------------------------------------------
                # Run existing model
                # -------------------------------------------------

                try:

                    result = predict_audio(stream_file)
                    print("🔍 LIVE PREDICTION RESULT:", result)

                    # Extract information from existing result
                    spoof_probability = result.get(
                        "spoof_probability",
                        0.0
                    )

                    if spoof_probability >= 0.80:
                        status = "high_risk"
                        risk = "HIGH"
                    elif spoof_probability >= 0.50:
                        status = "suspicious"
                        risk = "MEDIUM"
                    else:
                        status = "likely_real"
                        risk = "LOW"

                    result_label = (
                        "spoof"
                        if spoof_probability >= 0.50
                        else "real"
                    )
                    confidence = (
                        spoof_probability
                        if result_label == "spoof"
                        else 1.0 - spoof_probability
                    )
                    analysis_count += 1

                    await websocket.send_json({
                        "type": "prediction",
                        "spoof_probability": round(spoof_probability, 4),
                        "confidence": round(confidence, 4),
                        "risk": risk,
                        "result": result_label,
                        "status": status,
                        "elapsed_seconds": analysis_count * WINDOW_SECONDS,
                    })

                    print(
                        f"🧠 Live prediction: "
                        f"{spoof_probability:.4f} "
                        f"→ {status}"
                    )

                except Exception as e:

                    print(
                        "Prediction error:",
                        repr(e)
                    )

                    await websocket.send_json({
                        "type": "error",
                        "message": str(e)
                    })

    except WebSocketDisconnect:

        print("🎙️ Live audio connection closed")

    except Exception as e:

        print(
            "WebSocket error:",
            repr(e)
        )

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
