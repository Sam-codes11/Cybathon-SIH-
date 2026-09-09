from pathlib import Path
import tempfile

import soundfile as sf
import torch
import torch.nn.functional as F
from torch import nn


# ============================================================
# MODEL PATH
# ============================================================

MODEL_PATH = (
    Path(__file__).resolve().parent.parent
    / "models"
    / "spoof_cnn_best.pth"
)


# ============================================================
# AUDIO SETTINGS
# ============================================================

SAMPLE_RATE = 16000

# IMPORTANT:
# The model was trained using 4-second audio inputs,
# so we keep the model input size at 4 seconds.
WINDOW_SECONDS = 4
WINDOW_SAMPLES = SAMPLE_RATE * WINDOW_SECONDS

# Analyze a new window every 2 seconds.
# This creates 50% overlap between windows.
HOP_SECONDS = 2
HOP_SAMPLES = SAMPLE_RATE * HOP_SECONDS


# ============================================================
# DEVICE
# ============================================================

DEVICE = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)


# ============================================================
# MODEL
# ============================================================

class SpoofCNN(nn.Module):

    def __init__(self):
        super().__init__()

        self.features = nn.Sequential(
            nn.Conv2d(1, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(2),

            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.MaxPool2d(2),

            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(),

            nn.AdaptiveAvgPool2d((1, 1))
        )

        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(64, 2)
        )

    def forward(self, x):
        x = self.features(x)
        return self.classifier(x)


# ============================================================
# LOAD MODEL
# ============================================================

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Model not found at: {MODEL_PATH}"
    )


model = SpoofCNN().to(DEVICE)

model.load_state_dict(
    torch.load(
        MODEL_PATH,
        map_location=DEVICE
    )
)

model.eval()


print("=" * 60)
print("VOICE SPOOF MODEL LOADED")
print("Model:", MODEL_PATH)
print("Device:", DEVICE)

if torch.cuda.is_available():
    print(
        "GPU:",
        torch.cuda.get_device_name(0)
    )

print("=" * 60)


# ============================================================
# SPECTROGRAM CREATION
# ============================================================

def create_spectrogram(waveform):
    """
    Convert a 4-second waveform into the spectrogram
    format expected by the CNN.
    """

    window = torch.hann_window(
        1024,
        device=waveform.device
    )

    spectrogram = torch.stft(
        waveform,
        n_fft=1024,
        hop_length=512,
        window=window,
        return_complex=True
    )

    # Magnitude
    spectrogram = torch.abs(spectrogram)

    # Log compression
    spectrogram = torch.log(
        spectrogram + 1e-6
    )

    # Shape:
    # [frequency, time]
    #
    # CNN expects:
    # [batch, channel, frequency, time]

    spectrogram = spectrogram.unsqueeze(0)
    spectrogram = spectrogram.unsqueeze(0)

    return spectrogram


# ============================================================
# PREDICT ONE 4-SECOND WINDOW
# ============================================================

def predict_window(waveform):
    """
    Run the CNN on exactly one 4-second waveform.
    """

    spectrogram = create_spectrogram(
        waveform
    )

    spectrogram = spectrogram.to(DEVICE)

    with torch.no_grad():

        outputs = model(
            spectrogram
        )

        probabilities = torch.softmax(
            outputs,
            dim=1
        )

    bonafide_probability = (
        probabilities[0][0].item()
    )

    spoof_probability = (
        probabilities[0][1].item()
    )

    return (
        bonafide_probability,
        spoof_probability
    )


# ============================================================
# PREDICT COMPLETE AUDIO
# ============================================================

def predict_audio(file):

    suffix = Path(
        file.filename or ".wav"
    ).suffix

    temp_path = None

    try:

        # ----------------------------------------------------
        # SAVE UPLOADED FILE TEMPORARILY
        # ----------------------------------------------------

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix
        ) as temp_file:

            temp_path = Path(
                temp_file.name
            )

            file.file.seek(0)

            data = file.file.read()

            temp_file.write(data)


        # ----------------------------------------------------
        # LOAD AUDIO
        # ----------------------------------------------------

        audio, sample_rate = sf.read(
            str(temp_path),
            dtype="float32"
        )


        waveform = torch.tensor(
            audio,
            dtype=torch.float32
        )


        # ----------------------------------------------------
        # CONVERT STEREO → MONO
        # ----------------------------------------------------

        if waveform.ndim > 1:

            waveform = waveform.mean(
                dim=1
            )
        

        # ----------------------------------------------------
        # CHECK SAMPLE RATE
        # ----------------------------------------------------

        if sample_rate != SAMPLE_RATE:

            return {
                "filename": file.filename,
                "result": "error",
                "message": (
                    f"Expected {SAMPLE_RATE} Hz audio, "
                    f"but received {sample_rate} Hz."
                )
            }


        # ----------------------------------------------------
        # CHECK EMPTY AUDIO
        # ----------------------------------------------------

        if waveform.numel() == 0:

            return {
                "filename": file.filename,
                "result": "error",
                "message": "Audio file is empty."
            }


        # ----------------------------------------------------
        # NORMALIZE AUDIO LENGTH
        # ----------------------------------------------------

        total_samples = waveform.numel()

        total_duration = (
            total_samples / SAMPLE_RATE
        )


        # ====================================================
        # CREATE OVERLAPPING WINDOWS
        # ====================================================

        windows = []


        # ----------------------------------------------------
        # AUDIO SHORTER THAN 4 SECONDS
        # ----------------------------------------------------

        if total_samples <= WINDOW_SAMPLES:

            padded_waveform = F.pad(
                waveform,
                (
                    0,
                    WINDOW_SAMPLES - total_samples
                )
            )

            windows.append(
                {
                    "waveform": padded_waveform,
                    "start": 0.0,
                    "end": total_duration
                }
            )


        # ----------------------------------------------------
        # AUDIO LONGER THAN 4 SECONDS
        # ----------------------------------------------------

        else:

            start_sample = 0

            while start_sample < total_samples:

                end_sample = (
                    start_sample +
                    WINDOW_SAMPLES
                )

                segment = waveform[
                    start_sample:end_sample
                ]

                actual_segment_length = (
                    segment.numel()
                )

                # Pad final segment if necessary
                if actual_segment_length < WINDOW_SAMPLES:

                    segment = F.pad(
                        segment,
                        (
                            0,
                            WINDOW_SAMPLES -
                            actual_segment_length
                        )
                    )

                start_time = (
                    start_sample /
                    SAMPLE_RATE
                )

                end_time = min(
                    (
                        start_sample +
                        actual_segment_length
                    ) / SAMPLE_RATE,
                    total_duration
                )

                windows.append(
                    {
                        "waveform": segment,
                        "start": start_time,
                        "end": end_time
                    }
                )

                # Move forward by 2 seconds
                start_sample += HOP_SAMPLES

                # Stop once the last real part of
                # the recording has been covered.
                if start_sample >= total_samples:
                    break


        # ====================================================
        # RUN MODEL ON EVERY WINDOW
        # ====================================================

        segment_results = []


        for index, window_data in enumerate(
            windows
        ):

            segment_waveform = (
                window_data["waveform"]
            )

            start_time = (
                window_data["start"]
            )

            end_time = (
                window_data["end"]
            )


            (
                bonafide_probability,
                spoof_probability
            ) = predict_window(
                segment_waveform
            )


            segment_prediction = (
                "spoof"
                if spoof_probability >= 0.5
                else "real"
            )


            segment_results.append(
                {
                    "segment": index + 1,
                    "start_time": round(
                        start_time,
                        2
                    ),
                    "end_time": round(
                        end_time,
                        2
                    ),
                    "result": segment_prediction,
                    "spoof_probability": round(
                        spoof_probability,
                        4
                    ),
                    "bonafide_probability": round(
                        bonafide_probability,
                        4
                    )
                }
            )


        # ====================================================
        # AGGREGATE COMPLETE AUDIO
        # ====================================================

        spoof_probabilities = [
            result["spoof_probability"]
            for result in segment_results
        ]


        bonafide_probabilities = [
            result["bonafide_probability"]
            for result in segment_results
        ]


        # ----------------------------------------------------
        # MOST SUSPICIOUS PART OF THE RECORDING
        # ----------------------------------------------------

        max_spoof_probability = max(
            spoof_probabilities
        )


        max_spoof_segment = max(
            segment_results,
            key=lambda x: x[
                "spoof_probability"
            ]
        )


        # ----------------------------------------------------
        # AVERAGE SPOOF PROBABILITY
        # ----------------------------------------------------

        average_spoof_probability = (
            sum(spoof_probabilities)
            /
            len(spoof_probabilities)
        )


        # ----------------------------------------------------
        # COUNT SUSPICIOUS SEGMENTS
        # ----------------------------------------------------

        suspicious_segments = [
            result
            for result in segment_results
            if result["spoof_probability"] >= 0.5
        ]


        suspicious_count = len(
            suspicious_segments
        )

        total_segments = len(
            segment_results
        )


        # ====================================================
        # FINAL DECISION
        # ====================================================

        # IMPORTANT:
        #
        # If ANY segment has a spoof probability
        # >= 0.50, flag the complete recording.
        #
        # This is designed for voice-cloning detection
        # where even a suspicious portion of a call
        # should trigger investigation.

        if max_spoof_probability >= 0.5:

            prediction = "spoof"

        else:

            prediction = "real"


        # ====================================================
        # FINAL PROBABILITIES
        # ====================================================

        if prediction == "spoof":

            confidence = (
                max_spoof_probability
            )

        else:

            confidence = (
                1.0 -
                max_spoof_probability
            )


        # ====================================================
        # RISK LEVEL
        # ====================================================

        if max_spoof_probability >= 0.80:

            risk = "HIGH"

        elif max_spoof_probability >= 0.50:

            risk = "MEDIUM"

        else:

            risk = "LOW"


        # ====================================================
        # FINAL RESPONSE
        # ====================================================

        return {

            "filename": file.filename,

            "result": prediction,

            "confidence": round(
                confidence,
                4
            ),

            "spoof_probability": round(
                max_spoof_probability,
                4
            ),

            "bonafide_probability": round(
                1.0 - max_spoof_probability,
                4
            ),

            "average_spoof_probability": round(
                average_spoof_probability,
                4
            ),

            "risk": risk,

            "total_segments": total_segments,

            "suspicious_segments": suspicious_count,

            "most_suspicious_segment": {
                "segment": max_spoof_segment[
                    "segment"
                ],
                "start_time": max_spoof_segment[
                    "start_time"
                ],
                "end_time": max_spoof_segment[
                    "end_time"
                ],
                "spoof_probability": max_spoof_segment[
                    "spoof_probability"
                ]
            },

            "segments": segment_results
        }


    # ========================================================
    # ERROR HANDLING
    # ========================================================

    except Exception as e:

        return {
            "filename": file.filename,
            "result": "error",
            "message": str(e)
        }


    # ========================================================
    # CLEANUP TEMPORARY FILE
    # ========================================================

    finally:

        if temp_path is not None:

            try:

                temp_path.unlink(
                    missing_ok=True
                )

            except Exception:

                pass
