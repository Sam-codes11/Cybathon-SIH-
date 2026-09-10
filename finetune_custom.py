from pathlib import Path
import soundfile as sf
import torch
import torch.nn.functional as F
from torch import nn
from torch.utils.data import Dataset, DataLoader
import numpy as np

BASE_DIR = Path(r"C:\Users\Rishita Samanta\Desktop\Cybathon-SIH-")
MODEL_PATH = BASE_DIR / "models" / "spoof_cnn_best.pth"
NEW_MODEL_PATH = BASE_DIR / "models" / "spoof_cnn_finetuned.pth"
REAL_DIR = BASE_DIR / "data" / "custom_dataset" / "real"
FAKE_DIR = BASE_DIR / "data" / "custom_dataset" / "fake"

SAMPLE_RATE = 16000
AUDIO_SECONDS = 4
NUM_SAMPLES = SAMPLE_RATE * AUDIO_SECONDS
BATCH_SIZE = 8
EPOCHS = 30
LEARNING_RATE = 3e-4  # Effective learning rate for 3-layer CNN adaptation

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

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
        x = self.features(x)
        return self.classifier(x)

def create_spectrogram(waveform):
    window = torch.hann_window(1024, device=waveform.device)
    spec = torch.stft(waveform, n_fft=1024, hop_length=512, window=window, return_complex=True)
    spec = torch.abs(spec)
    spec = torch.log(spec + 1e-6)
    return spec.unsqueeze(0)

class CustomAudioDataset(Dataset):
    def __init__(self, real_files, fake_files):
        self.windows = []
        for f in real_files:
            for w in self._extract_windows(f):
                self.windows.append((w, 0)) # Bonafide / Real
        for f in fake_files:
            for w in self._extract_windows(f):
                self.windows.append((w, 1)) # Spoof / AI

    def _extract_windows(self, path):
        audio, sr = sf.read(str(path), dtype="float32")
        waveform = torch.tensor(audio, dtype=torch.float32)
        if waveform.ndim > 1:
            waveform = waveform.mean(dim=1)

        peak = waveform.abs().max()
        if peak > 0:
            waveform = waveform / peak * 0.92

        total_samples = waveform.numel()
        if total_samples <= NUM_SAMPLES:
            padded = F.pad(waveform, (0, NUM_SAMPLES - total_samples))
            return [padded]

        res = []
        start = 0
        hop = 16000 * 2
        while start < total_samples:
            seg = waveform[start:start+NUM_SAMPLES]
            if seg.numel() < NUM_SAMPLES:
                seg = F.pad(seg, (0, NUM_SAMPLES - seg.numel()))
            res.append(seg)
            start += hop
            if start >= total_samples:
                break
        return res

    def __len__(self):
        return len(self.windows)

    def __getitem__(self, idx):
        waveform, label = self.windows[idx]
        spec = create_spectrogram(waveform)
        return spec, torch.tensor(label, dtype=torch.long)

def finetune():
    print("=" * 60)
    print("VOICE SHIELD — FINE-TUNING ON REAL-WORLD & F5-TTS SAMPLES")
    print(f"Device: {DEVICE} | LR: {LEARNING_RATE} | Epochs: {EPOCHS}")
    print("=" * 60)

    model = SpoofCNN().to(DEVICE)
    model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
    print(f"Loaded base model: {MODEL_PATH}")

    real_files = sorted(list(REAL_DIR.glob("*.wav")))
    fake_files = sorted(list(FAKE_DIR.glob("*.wav")))
    print(f"Training set: {len(real_files)} Real voices + {len(fake_files)} AI clones")

    dataset = CustomAudioDataset(real_files, fake_files)
    num_real = sum(1 for _, l in dataset.windows if l == 0)
    num_fake = sum(1 for _, l in dataset.windows if l == 1)
    print(f"Extracted Windows: {num_real} Real windows, {num_fake} Fake windows (Total: {len(dataset)})")

    loader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)

    # Balanced class weights based on actual window frequency
    fake_weight = float(num_real) / float(num_fake) if num_fake > 0 else 1.0
    weights = torch.tensor([1.0, fake_weight], device=DEVICE)
    print(f"Class weights: [Real: 1.0, Fake: {fake_weight:.2f}]")
    criterion = nn.CrossEntropyLoss(weight=weights)
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE, weight_decay=1e-4)

    for epoch in range(EPOCHS):
        model.train()
        total_loss = 0.0
        correct = 0
        total = 0
        for specs, labels in loader:
            specs = specs.to(DEVICE)
            labels = labels.to(DEVICE)

            optimizer.zero_grad()
            outputs = model(specs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            total_loss += loss.item() * specs.size(0)
            preds = outputs.argmax(dim=1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)

        epoch_loss = total_loss / total
        epoch_acc = correct / total * 100
        if (epoch + 1) % 5 == 0 or epoch == 0:
            print(f"Epoch {epoch+1:2d}/{EPOCHS} -> Loss: {epoch_loss:.4f} | Accuracy: {epoch_acc:.1f}%")

    torch.save(model.state_dict(), NEW_MODEL_PATH)
    print("\n" + "=" * 60)
    print(f"SUCCESS: Fine-tuned model saved to: {NEW_MODEL_PATH}")
    print("=" * 60)

if __name__ == "__main__":
    finetune()
