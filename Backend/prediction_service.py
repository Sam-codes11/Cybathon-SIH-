from pathlib import Path
import tempfile

import soundfile as sf
import torch
import torch.nn.functional as F
from torch import nn


# ============================================================
# CONFIG
# ============================================================

MODEL_PATH = (
    Path(__file__).resolve().parent.parent
    / "models"
    / "spoof_cnn_best.pth"
)

SAMPLE_RATE = 16000
AUDIO_SECONDS = 4
NUM_SAMPLES = SAMPLE_RATE * AUDIO_SECONDS

DEVICE = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)


# ============================================================
# MODEL
# EXACT SAME ARCHITECTURE USED DURING TRAINING
# ============================================================

class SpoofCNN(nn.Module):

    def __init__(self):
        super().__init__()

        self.features = nn.Sequential(
            nn.Conv2d(
                1,
                32,
                kernel_size=3,
                padding=1
            ),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(2),

            nn.Conv2d(
                32,
                64,
                kernel_size=3,
                padding=1
            ),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.MaxPool2d(2),

            nn.Conv2d(
                64,
                128,
                kernel_size=3,
                padding=1
            ),
            nn.BatchNorm2d(128),
            nn.ReLU(),

            nn.AdaptiveAvgPool2d((1, 1))
        )

        self.classifier = nn.Sequential(
            nn.Flatten(),

            nn.Linear(
                128,
                64
            ),

            nn.ReLU(),

            nn.Dropout(0.3),

            nn.Linear(
                64,
                2
            )
        )

    def forward(self, x):
        x = self.features(x)
        return self.classifier(x)


# ============================================================
# LOAD MODEL ONCE
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
# PREDICTION
# ============================================================

def predict_audio(file):

    # --------------------------------------------------------
    # Save uploaded file temporarily
    # --------------------------------------------------------

    suffix = Path(
        file.filename or ".wav"
    ).suffix

    temp_path = None

    try:

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix
        ) as temp_file:

            temp_path = Path(
                temp_file.name
            )

            # UploadFile from FastAPI is async,
            # but your current route calls this
            # function synchronously.
            #
            # Therefore we use the underlying file object.

            file.file.seek(0)

            data = file.file.read()

            temp_file.write(data)

        # ----------------------------------------------------
        # Load audio
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
        # Stereo → mono
        # ----------------------------------------------------

        if waveform.ndim > 1:
            waveform = waveform.mean(dim=1)

        # ----------------------------------------------------
        # Sample rate
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
        # Exactly 4 seconds
        # SAME AS TRAINING
        # ----------------------------------------------------

        if waveform.numel() < NUM_SAMPLES:

            waveform = F.pad(
                waveform,
                (
                    0,
                    NUM_SAMPLES - waveform.numel()
                )
            )

        else:

            waveform = waveform[
                :NUM_SAMPLES
            ]

        # ----------------------------------------------------
        # STFT
        # SAME AS TRAINING
        # ----------------------------------------------------

        window = torch.hann_window(
            1024
        )

        spectrogram = torch.stft(
            waveform,
            n_fft=1024,
            hop_length=512,
            window=window,
            return_complex=True
        )

        # Magnitude

        spectrogram = torch.abs(
            spectrogram
        )

        # Log scale

        spectrogram = torch.log(
            spectrogram + 1e-6
        )

        # ----------------------------------------------------
        # CNN expects:
        #
        # [batch, channel, frequency, time]
        # ----------------------------------------------------

        spectrogram = spectrogram.unsqueeze(0)
        spectrogram = spectrogram.unsqueeze(0)

        spectrogram = spectrogram.to(
            DEVICE
        )

        # ----------------------------------------------------
        # MODEL INFERENCE
        # ----------------------------------------------------

        with torch.no_grad():

            outputs = model(
                spectrogram
            )

            probabilities = torch.softmax(
                outputs,
                dim=1
            )

        # Class 0 = bonafide
        # Class 1 = spoof

        bonafide_probability = (
            probabilities[0][0].item()
        )

        spoof_probability = (
            probabilities[0][1].item()
        )

        prediction = (
            "spoof"
            if spoof_probability >= 0.5
            else "real"
        )

        confidence = max(
            bonafide_probability,
            spoof_probability
        )

        # ----------------------------------------------------
        # Risk level
        # ----------------------------------------------------

        if spoof_probability >= 0.80:

            risk = "HIGH"

        elif spoof_probability >= 0.50:

            risk = "MEDIUM"

        else:

            risk = "LOW"

        # ----------------------------------------------------
        # RESPONSE
        # ----------------------------------------------------

        return {
            "filename": file.filename,
            "result": prediction,
            "confidence": round(
                confidence,
                4
            ),
            "spoof_probability": round(
                spoof_probability,
                4
            ),
            "bonafide_probability": round(
                bonafide_probability,
                4
            ),
            "risk": risk
        }

    finally:

        # ----------------------------------------------------
        # Delete temporary file
        # ----------------------------------------------------

        if temp_path is not None:

            try:
                temp_path.unlink(
                    missing_ok=True
                )
            except Exception:
                pass