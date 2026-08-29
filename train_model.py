from pathlib import Path

import soundfile as sf
import torch
import torch.nn.functional as F
from torch import nn
from torch.utils.data import Dataset, DataLoader


# ============================================================
# CONFIG
# ============================================================

TRAIN_AUDIO_DIR = Path(
    r"C:\Users\Rishita Samanta\Downloads\flac-20260829T073608Z-1-001\flac"
)

DEV_AUDIO_DIR = Path(
    r"C:\Users\Rishita Samanta\Downloads\LA\ASVspoof2019_LA_dev\flac"
)

EVAL_AUDIO_DIR = Path(
    r"C:\Users\Rishita Samanta\Downloads\LA\ASVspoof2019_LA_eval\flac"
)

TRAIN_PROTOCOL = Path(
    "data/ASVspoof2019.LA.cm.train.trn.txt"
)

DEV_PROTOCOL = Path(
    "data/ASVspoof2019.LA.cm.dev.trl.txt"
)

EVAL_PROTOCOL = Path(
    "data/ASVspoof2019.LA.cm.eval.trl.txt"
)

SAMPLE_RATE = 16000
AUDIO_SECONDS = 4
NUM_SAMPLES = SAMPLE_RATE * AUDIO_SECONDS

BATCH_SIZE = 16
EPOCHS = 5
LEARNING_RATE = 0.001

DEVICE = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)


# ============================================================
# DEVICE
# ============================================================

print("=" * 60)
print("ASVSPOOF VOICE SPOOF DETECTOR")
print("=" * 60)

print("Device:", DEVICE)

if torch.cuda.is_available():
    print(
        "GPU:",
        torch.cuda.get_device_name(0)
    )


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
        # Make every audio exactly 4 seconds
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

        # CNN expects:
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
# DATA
# ============================================================

print("\nLoading training dataset...")
train_dataset = ASVspoofDataset(
    TRAIN_AUDIO_DIR,
    TRAIN_PROTOCOL
)

print("\nLoading validation dataset...")

dev_dataset = ASVspoofDataset(
    DEV_AUDIO_DIR,
    DEV_PROTOCOL
)


if len(train_dataset) == 0:

    raise RuntimeError(
        "No training audio found."
    )


if len(dev_dataset) == 0:

    raise RuntimeError(
        "No development audio found."
    )


# ============================================================
# DATALOADERS
# ============================================================

train_loader = DataLoader(
    train_dataset,
    batch_size=BATCH_SIZE,
    shuffle=True,
    num_workers=0,
    pin_memory=torch.cuda.is_available()
)

dev_loader = DataLoader(
    dev_dataset,
    batch_size=BATCH_SIZE,
    shuffle=False,
    num_workers=0,
    pin_memory=torch.cuda.is_available()
)


# ============================================================
# MODEL
# ============================================================

model = SpoofCNN().to(DEVICE)

criterion = nn.CrossEntropyLoss()

optimizer = torch.optim.Adam(
    model.parameters(),
    lr=LEARNING_RATE
)


# ============================================================
# TRAINING
# ============================================================

print("\nStarting training...\n")

best_dev_accuracy = 0.0


for epoch in range(EPOCHS):

    # --------------------------------------------------------
    # TRAIN
    # --------------------------------------------------------

    model.train()

    total_loss = 0.0

    correct = 0

    total = 0


    for batch_index, (
        features,
        labels
    ) in enumerate(train_loader):

        features = features.to(
            DEVICE,
            non_blocking=True
        )

        labels = labels.to(
            DEVICE,
            non_blocking=True
        )

        optimizer.zero_grad()

        outputs = model(
            features
        )

        loss = criterion(
            outputs,
            labels
        )

        loss.backward()

        optimizer.step()

        total_loss += loss.item()

        predictions = outputs.argmax(
            dim=1
        )

        correct += (
            predictions == labels
        ).sum().item()

        total += labels.size(0)


        if batch_index % 100 == 0:

            print(
                f"Epoch {epoch + 1}/{EPOCHS} "
                f"| Batch "
                f"{batch_index}/{len(train_loader)} "
                f"| Loss {loss.item():.4f}"
            )


    train_accuracy = (
        correct / total
    )

    average_loss = (
        total_loss /
        len(train_loader)
    )


    # --------------------------------------------------------
    # VALIDATION
    # --------------------------------------------------------

    model.eval()

    dev_correct = 0

    dev_total = 0


    with torch.no_grad():

        for features, labels in dev_loader:

            features = features.to(
                DEVICE,
                non_blocking=True
            )

            labels = labels.to(
                DEVICE,
                non_blocking=True
            )

            outputs = model(
                features
            )

            predictions = outputs.argmax(
                dim=1
            )

            dev_correct += (
                predictions == labels
            ).sum().item()

            dev_total += labels.size(0)


    dev_accuracy = (
        dev_correct /
        dev_total
    )


    print("\n" + "-" * 60)

    print(
        f"Epoch {epoch + 1}/{EPOCHS}"
    )

    print(
        f"Training Loss: "
        f"{average_loss:.4f}"
    )

    print(
        f"Training Accuracy: "
        f"{train_accuracy * 100:.2f}%"
    )

    print(
        f"Dev Accuracy: "
        f"{dev_accuracy * 100:.2f}%"
    )

    print("-" * 60)


    # --------------------------------------------------------
    # SAVE BEST MODEL
    # --------------------------------------------------------

    if dev_accuracy > best_dev_accuracy:

        best_dev_accuracy = dev_accuracy

        Path("models").mkdir(
            exist_ok=True
        )

        torch.save(
            model.state_dict(),
            "models/spoof_cnn_best.pth"
        )

        print(
            "✓ New best model saved!"
        )


# ============================================================
# DONE
# ============================================================

print("\n" + "=" * 60)

print("TRAINING COMPLETE")

print(
    f"Best Dev Accuracy: "
    f"{best_dev_accuracy * 100:.2f}%"
)

print(
    "Model:"
    " models/spoof_cnn_best.pth"
)

print("=" * 60)