from pathlib import Path

import torch
import soundfile as sf
import torch.nn.functional as F
from torch import nn
from torch.utils.data import Dataset, DataLoader


# =========================
# PATHS
# =========================

AUDIO_DIR = Path(
    r"C:\Users\Rishita Samanta\Downloads\flac-20260829T073608Z-1-001\flac"
)

PROTOCOL_FILE = Path(
    "data/ASVspoof2019.LA.cm.train.trn.txt"
)


# =========================
# SETTINGS
# =========================

SAMPLE_RATE = 16000
NUM_SAMPLES = SAMPLE_RATE * 4

DEVICE = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

print("Device:", DEVICE)

if torch.cuda.is_available():
    print("GPU:", torch.cuda.get_device_name(0))


# =========================
# DATASET
# =========================

class ASVspoofDataset(Dataset):

    def __init__(self, audio_dir, protocol_file):

        self.samples = []

        with open(protocol_file, "r", encoding="utf-8") as f:

            for line in f:

                parts = line.strip().split()

                if len(parts) < 5:
                    continue

                audio_id = parts[1]
                label_name = parts[-1]

                audio_path = audio_dir / f"{audio_id}.flac"

                if audio_path.exists():

                    label = 0 if label_name == "bonafide" else 1

                    self.samples.append(
                        (audio_path, label)
                    )

                if len(self.samples) >= 50:
                    break

        print("Test samples:", len(self.samples))


    def __len__(self):
        return len(self.samples)


    def __getitem__(self, index):

        path, label = self.samples[index]

        # Read FLAC
        audio, sr = sf.read(
            str(path),
            dtype="float32"
        )

        waveform = torch.tensor(
            audio,
            dtype=torch.float32
        )

        # Stereo → mono
        if waveform.ndim > 1:
            waveform = waveform.mean(dim=1)

        # Check sample rate
        if sr != SAMPLE_RATE:
            raise RuntimeError(
                f"Unexpected sample rate {sr} "
                f"in {path.name}"
            )

        # Make exactly 4 seconds
        if waveform.numel() < NUM_SAMPLES:

            waveform = F.pad(
                waveform,
                (0, NUM_SAMPLES - waveform.numel())
            )

        else:

            waveform = waveform[:NUM_SAMPLES]

        # STFT
        window = torch.hann_window(1024)

        spectrogram = torch.stft(
            waveform,
            n_fft=1024,
            hop_length=512,
            window=window,
            return_complex=True
        )

        spectrogram = torch.abs(spectrogram)

        # Log scale
        spectrogram = torch.log(
            spectrogram + 1e-6
        )

        # CNN channel dimension
        spectrogram = spectrogram.unsqueeze(0)

        return (
            spectrogram,
            torch.tensor(label, dtype=torch.long)
        )


# =========================
# CNN
# =========================

class SpoofCNN(nn.Module):

    def __init__(self):

        super().__init__()

        self.features = nn.Sequential(

            nn.Conv2d(1, 32, 3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),

            nn.Conv2d(32, 64, 3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),

            nn.Conv2d(64, 128, 3, padding=1),
            nn.ReLU(),

            nn.AdaptiveAvgPool2d((1, 1))
        )

        self.classifier = nn.Sequential(

            nn.Flatten(),

            nn.Linear(128, 64),

            nn.ReLU(),

            nn.Linear(64, 2)
        )


    def forward(self, x):

        x = self.features(x)

        return self.classifier(x)


# =========================
# LOAD DATA
# =========================

dataset = ASVspoofDataset(
    AUDIO_DIR,
    PROTOCOL_FILE
)

loader = DataLoader(
    dataset,
    batch_size=4,
    shuffle=True,
    num_workers=0
)


# =========================
# MODEL
# =========================

model = SpoofCNN().to(DEVICE)

criterion = nn.CrossEntropyLoss()

optimizer = torch.optim.Adam(
    model.parameters(),
    lr=0.001
)


# =========================
# TEST TRAINING
# =========================

print("\nStarting GPU training test...\n")

model.train()

for epoch in range(2):

    total_loss = 0

    for features, labels in loader:

        features = features.to(DEVICE)

        labels = labels.to(DEVICE)

        optimizer.zero_grad()

        outputs = model(features)

        loss = criterion(
            outputs,
            labels
        )

        loss.backward()

        optimizer.step()

        total_loss += loss.item()

    average_loss = (
        total_loss / len(loader)
    )

    print(
        f"Epoch {epoch + 1}/2 "
        f"| Loss: {average_loss:.4f}"
    )


print()
print("======================================")
print("GPU TRAINING TEST SUCCESSFUL")
print("======================================")