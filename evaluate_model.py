from pathlib import Path
import soundfile as sf
import torch
import torch.nn.functional as F
from torch import nn
from torch.utils.data import Dataset, DataLoader

# ============================================================
# CONFIG
# ============================================================

EVAL_AUDIO_DIR = Path(
    r"C:\Users\Rishita Samanta\Downloads\LA\ASVspoof2019_LA_eval\flac"
)

EVAL_PROTOCOL = Path(
    "data/ASVspoof2019.LA.cm.eval.trl.txt"
)

MODEL_PATH = Path(
    "models/spoof_cnn_best.pth"
)

SAMPLE_RATE = 16000
AUDIO_SECONDS = 4
NUM_SAMPLES = SAMPLE_RATE * AUDIO_SECONDS
BATCH_SIZE = 16

DEVICE = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

# ============================================================
# DEVICE
# ============================================================

print("=" * 60)
print("ASVSPOOF EVALUATION")
print("=" * 60)

print("Device:", DEVICE)

if torch.cuda.is_available():
    print("GPU:", torch.cuda.get_device_name(0))

# ============================================================
# DATASET
# ============================================================

class ASVspoofDataset(Dataset):

    def __init__(self, audio_dir, protocol_file):

        self.samples = []

        with open(
            protocol_file,
            "r",
            encoding="utf-8"
        ) as f:

            for line in f:

                parts = line.strip().split()

                if len(parts) < 5:
                    continue

                audio_id = parts[1]
                label_name = parts[-1]

                audio_path = (
                    audio_dir /
                    f"{audio_id}.flac"
                )

                if audio_path.exists():

                    # 0 = bonafide
                    # 1 = spoof

                    label = (
                        0
                        if label_name == "bonafide"
                        else 1
                    )

                    self.samples.append(
                        (
                            audio_path,
                            label
                        )
                    )

        print(
            f"{protocol_file.name}: "
            f"{len(self.samples)} usable files"
        )

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, index):

        path, label = self.samples[index]

        # ----------------------------------------------------
        # Load FLAC
        # ----------------------------------------------------

        audio, sample_rate = sf.read(
            str(path),
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

            waveform = waveform.mean(
                dim=1
            )

        # ----------------------------------------------------
        # Verify sample rate
        # ----------------------------------------------------

        if sample_rate != SAMPLE_RATE:

            raise RuntimeError(
                f"Unexpected sample rate "
                f"{sample_rate} in {path.name}"
            )

        # ----------------------------------------------------
        # Exactly 4 seconds
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
        # EXACTLY SAME AS TRAINING
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

        # CNN input:
        # [channel, frequency, time]

        spectrogram = spectrogram.unsqueeze(0)

        return (
            spectrogram,
            torch.tensor(
                label,
                dtype=torch.long
            )
        )


# ============================================================
# CNN
# EXACT SAME ARCHITECTURE AS TRAINING
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

            nn.AdaptiveAvgPool2d(
                (1, 1)
            )
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
# LOAD DATA
# ============================================================

print("\nLoading evaluation dataset...")

eval_dataset = ASVspoofDataset(
    EVAL_AUDIO_DIR,
    EVAL_PROTOCOL
)

if len(eval_dataset) == 0:

    raise RuntimeError(
        "No evaluation audio found."
    )

eval_loader = DataLoader(
    eval_dataset,
    batch_size=BATCH_SIZE,
    shuffle=False,
    num_workers=0,
    pin_memory=torch.cuda.is_available()
)

# ============================================================
# LOAD MODEL
# ============================================================

print("\nLoading trained model...")

model = SpoofCNN().to(DEVICE)

model.load_state_dict(
    torch.load(
        MODEL_PATH,
        map_location=DEVICE
    )
)

model.eval()

print("✓ Model loaded successfully")

# ============================================================
# EVALUATION
# ============================================================

correct = 0
total = 0

true_positive = 0
true_negative = 0
false_positive = 0
false_negative = 0

all_probabilities = []

print("\nEvaluating...\n")

with torch.no_grad():

    for batch_index, (features, labels) in enumerate(
        eval_loader
    ):

        features = features.to(
            DEVICE,
            non_blocking=True
        )

        labels = labels.to(
            DEVICE,
            non_blocking=True
        )

        outputs = model(features)

        probabilities = torch.softmax(
            outputs,
            dim=1
        )

        predictions = outputs.argmax(
            dim=1
        )

        # ----------------------------------------------
        # Accuracy
        # ----------------------------------------------

        correct += (
            predictions == labels
        ).sum().item()

        total += labels.size(0)

        # ----------------------------------------------
        # Confusion matrix
        # ----------------------------------------------

        true_positive += (
            ((predictions == 1) & (labels == 1))
        ).sum().item()

        true_negative += (
            ((predictions == 0) & (labels == 0))
        ).sum().item()

        false_positive += (
            ((predictions == 1) & (labels == 0))
        ).sum().item()

        false_negative += (
            ((predictions == 0) & (labels == 1))
        ).sum().item()

        # Probability of spoof
        all_probabilities.extend(
            probabilities[:, 1].cpu().tolist()
        )

        if batch_index % 100 == 0:

            print(
                f"Processed "
                f"{batch_index * BATCH_SIZE}/"
                f"{len(eval_dataset)}"
            )

# ============================================================
# METRICS
# ============================================================

accuracy = correct / total

precision = (
    true_positive /
    (true_positive + false_positive)
    if (true_positive + false_positive) > 0
    else 0
)

recall = (
    true_positive /
    (true_positive + false_negative)
    if (true_positive + false_negative) > 0
    else 0
)

f1 = (
    2 * precision * recall /
    (precision + recall)
    if (precision + recall) > 0
    else 0
)

# ============================================================
# RESULTS
# ============================================================

print("\n")
print("=" * 60)
print("EVALUATION RESULTS")
print("=" * 60)

print(
    f"Total samples : {total}"
)

print(
    f"Correct       : {correct}"
)

print(
    f"Accuracy      : {accuracy * 100:.2f}%"
)

print(
    f"Precision     : {precision * 100:.2f}%"
)

print(
    f"Recall        : {recall * 100:.2f}%"
)

print(
    f"F1 Score      : {f1 * 100:.2f}%"
)

print("\nConfusion Matrix")
print("-" * 40)

print(
    f"True Negative  : {true_negative}"
)

print(
    f"False Positive : {false_positive}"
)

print(
    f"False Negative : {false_negative}"
)

print(
    f"True Positive  : {true_positive}"
)

print("=" * 60)

print("\nInterpretation:")

print(
    "0 = BONAFIDE (real human speech)"
)

print(
    "1 = SPOOF (AI/generated/manipulated speech)"
)

print("=" * 60)