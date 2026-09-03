
from pathlib import Path
import soundfile as sf
import torch
import torch.nn.functional as F
from torch import nn
import numpy as np


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

# Model expects 4-second audio
WINDOW_SAMPLES = 16000 * 4

# Move window by 2 seconds
HOP_SAMPLES = 16000 * 2

THRESHOLD = 0.50

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
            nn.Conv2d(1, 32, 3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(2),

            nn.Conv2d(32, 64, 3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.MaxPool2d(2),

            nn.Conv2d(64, 128, 3, padding=1),
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
        return self.classifier(
            self.features(x)
        )


# ============================================================
# LOAD MODEL
# ============================================================

print("=" * 60)
print("WHOLE-AUDIO ASVSPOOF EVALUATION")
print("=" * 60)

print("Device:", DEVICE)

if torch.cuda.is_available():
    print("GPU:", torch.cuda.get_device_name(0))

model = SpoofCNN().to(DEVICE)

model.load_state_dict(
    torch.load(
        MODEL_PATH,
        map_location=DEVICE
    )
)

model.eval()

print("✓ Model loaded")


# ============================================================
# READ PROTOCOL
# ============================================================

samples = []

with open(
    EVAL_PROTOCOL,
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
            EVAL_AUDIO_DIR /
            f"{audio_id}.flac"
        )

        if audio_path.exists():

            label = (
                0
                if label_name == "bonafide"
                else 1
            )

            samples.append(
                (audio_path, label)
            )


print(
    f"Usable files: {len(samples):,}"
)


# ============================================================
# PREDICT ONE 4-SECOND WINDOW
# ============================================================

def predict_window(waveform):

    # Pad if shorter than 4 seconds
    if len(waveform) < WINDOW_SAMPLES:

        waveform = F.pad(
            waveform,
            (0, WINDOW_SAMPLES - len(waveform))
        )

    # Take exactly 4 seconds
    waveform = waveform[:WINDOW_SAMPLES]

    # STFT
    window = torch.hann_window(
        1024,
        device=DEVICE
    )

    spectrogram = torch.stft(
        waveform.to(DEVICE),
        n_fft=1024,
        hop_length=512,
        window=window,
        return_complex=True
    )

    spectrogram = torch.abs(
        spectrogram
    )

    spectrogram = torch.log(
        spectrogram + 1e-6
    )

    # [Frequency, Time]
    # -> [Batch, Channel, Frequency, Time]

    spectrogram = spectrogram.unsqueeze(0).unsqueeze(0)

    with torch.no_grad():

        output = model(
            spectrogram
        )

        probability = torch.softmax(
            output,
            dim=1
        )

    # Probability of SPOOF
    return probability[0, 1].item()


# ============================================================
# PREDICT WHOLE AUDIO
# ============================================================

def predict_audio(audio_path):

    audio, sr = sf.read(
        str(audio_path),
        dtype="float32"
    )

    if sr != SAMPLE_RATE:
        raise RuntimeError(
            f"Wrong sample rate: {sr}"
        )

    waveform = torch.tensor(
        audio,
        dtype=torch.float32
    )

    # Stereo -> mono
    if waveform.ndim > 1:
        waveform = waveform.mean(dim=1)

    # --------------------------------------------------------
    # SPLIT ENTIRE AUDIO INTO OVERLAPPING WINDOWS
    # --------------------------------------------------------

    probabilities = []

    start = 0

    while start < len(waveform):

        segment = waveform[
            start:start + WINDOW_SAMPLES
        ]

        spoof_probability = predict_window(
            segment
        )

        probabilities.append(
            spoof_probability
        )

        start += HOP_SAMPLES

    # --------------------------------------------------------
    # FILE-LEVEL SCORE
    # --------------------------------------------------------

    # Highest spoof probability anywhere
    # in the entire audio

    max_spoof_probability = max(
        probabilities
    )

    return max_spoof_probability


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
all_labels = []


print("\nEvaluating...\n")


for index, (audio_path, label) in enumerate(
    samples,
    start=1
):

    try:

        spoof_probability = predict_audio(
            audio_path
        )

        # Final file-level prediction
        prediction = (
            1
            if spoof_probability >= THRESHOLD
            else 0
        )

        # Save for threshold sweep
        all_probabilities.append(
            spoof_probability
        )

        all_labels.append(
            label
        )

        # Accuracy
        if prediction == label:
            correct += 1

        total += 1

        # Confusion matrix
        if prediction == 1 and label == 1:
            true_positive += 1

        elif prediction == 0 and label == 0:
            true_negative += 1

        elif prediction == 1 and label == 0:
            false_positive += 1

        elif prediction == 0 and label == 1:
            false_negative += 1

        # Progress
        if index % 100 == 0:
            print(
                f"Processed {index:,}/{len(samples):,}"
            )

    except Exception as e:

        print(
            f"ERROR: {audio_path.name}: {e}"
        )


# ============================================================
# METRICS
# ============================================================

accuracy = correct / total

precision = (
    true_positive /
    (true_positive + false_positive)
    if true_positive + false_positive > 0
    else 0
)

recall = (
    true_positive /
    (true_positive + false_negative)
    if true_positive + false_negative > 0
    else 0
)

f1 = (
    2 * precision * recall /
    (precision + recall)
    if precision + recall > 0
    else 0
)


# ============================================================
# RESULTS
# ============================================================

print("\n")
print("=" * 60)
print("WHOLE-AUDIO EVALUATION RESULTS")
print("=" * 60)

print(f"Total files : {total:,}")
print(f"Correct     : {correct:,}")
print(f"Accuracy    : {accuracy * 100:.2f}%")
print(f"Precision   : {precision * 100:.2f}%")
print(f"Recall      : {recall * 100:.2f}%")
print(f"F1 Score    : {f1 * 100:.2f}%")

print("\nConfusion Matrix")
print("-" * 40)

print(f"True Negative  : {true_negative:,}")
print(f"False Positive : {false_positive:,}")
print(f"False Negative : {false_negative:,}")
print(f"True Positive  : {true_positive:,}")

print("=" * 60)


# ============================================================
# THRESHOLD SWEEP
# ============================================================

probs = np.array(all_probabilities)
labels = np.array(all_labels)

print("\nTHRESHOLD SWEEP")
print("-" * 60)

print(
    f"{'Threshold':>10}"
    f"{'Precision':>12}"
    f"{'Recall':>12}"
    f"{'F1':>10}"
    f"{'FN':>10}"
    f"{'FP':>10}"
)

for threshold in [
    0.50,
    0.40,
    0.30,
    0.25,
    0.20,
    0.15,
    0.10
]:

    predictions = (
        probs >= threshold
    ).astype(int)

    tp = (
        (predictions == 1) &
        (labels == 1)
    ).sum()

    fp = (
        (predictions == 1) &
        (labels == 0)
    ).sum()

    fn = (
        (predictions == 0) &
        (labels == 1)
    ).sum()

    precision_t = (
        tp / (tp + fp)
        if tp + fp > 0
        else 0
    )

    recall_t = (
        tp / (tp + fn)
        if tp + fn > 0
        else 0
    )

    f1_t = (
        2 * precision_t * recall_t /
        (precision_t + recall_t)
        if precision_t + recall_t > 0
        else 0
    )

    print(
        f"{threshold:>10.2f}"
        f"{precision_t * 100:>11.2f}%"
        f"{recall_t * 100:>11.2f}%"
        f"{f1_t * 100:>9.2f}%"
        f"{fn:>10,}"
        f"{fp:>10,}"
    )


# ============================================================
# EER
# ============================================================

thresholds = np.linspace(
    0,
    1,
    1001
)

bonafide_scores = probs[
    labels == 0
]

spoof_scores = probs[
    labels == 1
]

frr = []
far = []

for threshold in thresholds:

    # Bonafide incorrectly detected as spoof
    frr.append(
        (bonafide_scores >= threshold).mean()
    )

    # Spoof incorrectly detected as real
    far.append(
        (spoof_scores < threshold).mean()
    )

frr = np.array(frr)
far = np.array(far)

eer_index = np.argmin(
    np.abs(frr - far)
)

eer = (
    frr[eer_index] +
    far[eer_index]
) / 2

eer_threshold = thresholds[
    eer_index
]


print("\nEER")
print("-" * 40)

print(
    f"EER         : {eer * 100:.2f}%"
)

print(
    f"Threshold   : {eer_threshold:.3f}"
)

print("=" * 60)
