from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from audio_routes import router as audio_router

import numpy as np
import torch
import torch.nn.functional as F

from prediction_service import predict_window


app = FastAPI()


# =========================================================
# CORS
# =========================================================

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# EXISTING UPLOAD ENDPOINT
# =========================================================

app.include_router(audio_router)


# =========================================================
# AUDIO SETTINGS
# =========================================================

SAMPLE_RATE = 16000

# PCM16 = 2 bytes per sample
BYTES_PER_SAMPLE = 2

# CNN requires 4 seconds of actual audio
WINDOW_SECONDS = 4

# After first prediction, move forward by 2 seconds
HOP_SECONDS = 2

WINDOW_SAMPLES = SAMPLE_RATE * WINDOW_SECONDS
HOP_SAMPLES = SAMPLE_RATE * HOP_SECONDS

WINDOW_BYTES = (
    SAMPLE_RATE
    * WINDOW_SECONDS
    * BYTES_PER_SAMPLE
)

HOP_BYTES = (
    SAMPLE_RATE
    * HOP_SECONDS
    * BYTES_PER_SAMPLE
)


# =========================================================
# PROCESS ONE 4-SECOND PCM WINDOW
# =========================================================

def process_pcm_window(pcm_bytes):
    """
    Process exactly one 4-second PCM audio window.

    Steps:
    - Convert PCM16 bytes to float audio
    - Ensure 64,000 samples
    - Normalize amplitude
    - Check RMS for silence
    - Run SpoofCNN
    - Return risk information
    """

    # -----------------------------------------------------
    # PCM16 bytes -> float32 [-1, 1]
    # -----------------------------------------------------

    audio = np.frombuffer(
        pcm_bytes,
        dtype=np.int16
    ).astype(np.float32)

    audio = audio / 32768.0

    waveform = torch.tensor(
        audio,
        dtype=torch.float32
    )


    # -----------------------------------------------------
    # Ensure exactly 4 seconds / 64,000 samples
    # -----------------------------------------------------

    if waveform.numel() < WINDOW_SAMPLES:

        waveform = F.pad(
            waveform,
            (
                0,
                WINDOW_SAMPLES - waveform.numel()
            )
        )

    elif waveform.numel() > WINDOW_SAMPLES:

        waveform = waveform[:WINDOW_SAMPLES]


    # -----------------------------------------------------
    # Peak normalization
    # -----------------------------------------------------

    peak = waveform.abs().max()

    if peak > 0:

        waveform = (
            waveform
            / peak
            * 0.92
        )


    # -----------------------------------------------------
    # RMS ENERGY
    # -----------------------------------------------------

    rms = torch.sqrt(
        torch.mean(
            waveform ** 2
        )
    ).item()


    # -----------------------------------------------------
    # Silence / very low energy
    # -----------------------------------------------------

    if rms < 0.005:

        spoof_probability = 0.05
        bonafide_probability = 0.95

        return (
            spoof_probability,
            bonafide_probability,
            "LOW",
            "likely_real",
            "real",
            0.95,
            rms,
            False
        )


    # -----------------------------------------------------
    # MODEL INFERENCE
    # -----------------------------------------------------

    (
        bonafide_probability,
        spoof_probability
    ) = predict_window(
        waveform
    )


    # -----------------------------------------------------
    # RISK LEVEL
    # -----------------------------------------------------

    if spoof_probability >= 0.80:

        status = "high_risk"
        risk = "HIGH"

    elif spoof_probability >= 0.50:

        status = "suspicious"
        risk = "MEDIUM"

    else:

        status = "likely_real"
        risk = "LOW"


    # -----------------------------------------------------
    # RESULT LABEL
    # -----------------------------------------------------

    result_label = (
        "spoof"
        if spoof_probability >= 0.50
        else "real"
    )


    # -----------------------------------------------------
    # CONFIDENCE
    # -----------------------------------------------------

    if result_label == "spoof":

        confidence = spoof_probability

    else:

        confidence = (
            1.0 - spoof_probability
        )


    return (
        spoof_probability,
        bonafide_probability,
        risk,
        status,
        result_label,
        confidence,
        rms,
        True
    )


# =========================================================
# REAL-TIME MICROPHONE WEBSOCKET
# =========================================================

@app.websocket("/audio-stream")
async def websocket_endpoint(
    websocket: WebSocket
):

    await websocket.accept()

    print(
        "\n" + "=" * 65,
        flush=True
    )

    print(
        "🎙️ LIVE MICROPHONE STREAM OPENED",
        flush=True
    )

    print(
        "Mode: 4-second window / 2-second hop",
        flush=True
    )

    print(
        "First prediction: 4s | "
        "Updates after that: every 2s",
        flush=True
    )

    print(
        "=" * 65,
        flush=True
    )


    # Raw PCM data arriving from browser
    audio_buffer = bytearray()

    # Number of completed predictions
    analysis_count = 0

    # Store probabilities for this session
    session_spoof_probs = []


    try:

        while True:

            # =================================================
            # RECEIVE AUDIO FROM FRONTEND
            # =================================================

            data = await websocket.receive_bytes()

            audio_buffer.extend(
                data
            )


            # =================================================
            # ONLY ANALYZE WHEN FULL 4 SEC WINDOW EXISTS
            # =================================================

            while (
                len(audio_buffer)
                >= WINDOW_BYTES
            ):

                # ---------------------------------------------
                # Take exactly 4 seconds of REAL audio
                # ---------------------------------------------

                window_bytes = bytes(
                    audio_buffer[
                        :WINDOW_BYTES
                    ]
                )


                # ---------------------------------------------
                # IMPORTANT:
                #
                # Remove only 2 seconds.
                #
                # This keeps the last 2 seconds so they are
                # reused in the next 4-second window.
                # ---------------------------------------------

                del audio_buffer[
                    :HOP_BYTES
                ]


                # ---------------------------------------------
                # RUN MODEL
                # ---------------------------------------------

                try:

                    (
                        spoof_probability,
                        bonafide_probability,
                        risk,
                        status,
                        result_label,
                        confidence,
                        rms,
                        is_speech
                    ) = process_pcm_window(
                        window_bytes
                    )


                    # -----------------------------------------
                    # Save session prediction
                    # -----------------------------------------

                    session_spoof_probs.append(
                        spoof_probability
                    )

                    analysis_count += 1


                    # -----------------------------------------
                    # Calculate timestamp
                    #
                    # Prediction times:
                    #
                    # 4, 6, 8, 10, 12...
                    # -----------------------------------------

                    elapsed_seconds = (
                        WINDOW_SECONDS
                        +
                        (
                            analysis_count - 1
                        )
                        * HOP_SECONDS
                    )


                    # -----------------------------------------
                    # Terminal badge
                    # -----------------------------------------

                    if spoof_probability >= 0.80:

                        badge = "🚨 AI DEEPFAKE"

                    elif spoof_probability >= 0.50:

                        badge = "⚠️ SUSPICIOUS"

                    else:

                        badge = "🛡️ BONAFIDE"


                    speech_tag = (
                        "SPEECH"
                        if is_speech
                        else "SILENCE"
                    )


                    # -----------------------------------------
                    # PRINT LIVE RESULT
                    # -----------------------------------------

                    print(
                        f"[{elapsed_seconds:02d}s] "
                        f"{badge} | "
                        f"Spoof: "
                        f"{spoof_probability * 100:5.1f}% | "
                        f"Conf: "
                        f"{confidence * 100:5.1f}% | "
                        f"RMS: "
                        f"{rms:.4f} "
                        f"({speech_tag})",
                        flush=True
                    )


                    # -----------------------------------------
                    # SEND RESULT TO FRONTEND
                    # -----------------------------------------

                    await websocket.send_json(
                        {
                            "type": "prediction",

                            "spoof_probability": round(
                                spoof_probability,
                                4
                            ),

                            "bonafide_probability": round(
                                bonafide_probability,
                                4
                            ),

                            "confidence": round(
                                confidence,
                                4
                            ),

                            "risk": risk,

                            "result": result_label,

                            "status": status,

                            "elapsed_seconds":
                                elapsed_seconds,

                            "is_speech":
                                is_speech,
                        }
                    )


                # =================================================
                # PREDICTION ERROR
                # =================================================

                except Exception as e:

                    print(
                        "❌ Prediction error:",
                        repr(e),
                        flush=True
                    )

                    await websocket.send_json(
                        {
                            "type": "error",
                            "message": str(e)
                        }
                    )


    # =====================================================
    # CLIENT CLOSED CONNECTION
    # =====================================================

    except WebSocketDisconnect:

        print(
            "🎙️ Live audio connection closed",
            flush=True
        )


    # =====================================================
    # WEBSOCKET ERROR
    # =====================================================

    except Exception as e:

        print(
            "❌ WebSocket error:",
            repr(e),
            flush=True
        )

        try:

            await websocket.close()

        except Exception:

            pass


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/")
def home():

    return {
        "message":
            "Voice Shield Backend is running",

        "live_detection":
            True,

        "window_seconds":
            WINDOW_SECONDS,

        "hop_seconds":
            HOP_SECONDS
    }