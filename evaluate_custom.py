from pathlib import Path
import soundfile as sf
import torch
import torch.nn.functional as F
from torch import nn
import numpy as np

BASE_DIR = Path(r"C:\Users\Rishita Samanta\Desktop\Cybathon-SIH-")
BASE_MODEL_PATH = BASE_DIR / "models" / "spoof_cnn_best.pth"
FINETUNED_MODEL_PATH = BASE_DIR / "models" / "spoof_cnn_finetuned.pth"
REAL_DIR = BASE_DIR / "data" / "custom_dataset" / "real"
FAKE_DIR = BASE_DIR / "data" / "custom_dataset" / "fake"

SAMPLE_RATE = 16000
WINDOW_SAMPLES = 16000 * 4
HOP_SAMPLES = 16000 * 2
THRESHOLD = 0.50

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
    return spec.unsqueeze(0).unsqueeze(0)

def predict_file(file_path, model):
    audio, sr = sf.read(str(file_path), dtype="float32")
    waveform = torch.tensor(audio, dtype=torch.float32)
    if waveform.ndim > 1:
        waveform = waveform.mean(dim=1)
    if sr != SAMPLE_RATE:
        return 0.0, 0.0

    peak = waveform.abs().max()
    if peak > 0:
        waveform = waveform / peak * 0.92

    total_samples = waveform.numel()
    if total_samples <= WINDOW_SAMPLES:
        padded = F.pad(waveform, (0, WINDOW_SAMPLES - total_samples))
        windows = [padded]
    else:
        windows = []
        start = 0
        while start < total_samples:
            seg = waveform[start:start+WINDOW_SAMPLES]
            if seg.numel() < WINDOW_SAMPLES:
                seg = F.pad(seg, (0, WINDOW_SAMPLES - seg.numel()))
            windows.append(seg)
            start += HOP_SAMPLES
            if start >= total_samples:
                break

    spoof_probs = []
    with torch.no_grad():
        for win in windows:
            spec = create_spectrogram(win).to(DEVICE)
            out = model(spec)
            probs = torch.softmax(out, dim=1)
            spoof_probs.append(probs[0][1].item())

    max_prob = max(spoof_probs) if spoof_probs else 0.0
    avg_prob = sum(spoof_probs) / len(spoof_probs) if spoof_probs else 0.0
    return max_prob, avg_prob

def evaluate_single_model(model_path, name):
    if not model_path.exists():
        print(f"\nModel {name} not found at {model_path}, skipping.")
        return None

    model = SpoofCNN().to(DEVICE)
    model.load_state_dict(torch.load(model_path, map_location=DEVICE))
    model.eval()

    real_files = sorted(list(REAL_DIR.glob("*.wav")))
    fake_files = sorted(list(FAKE_DIR.glob("*.wav")))

    tp, fp, tn, fn = 0, 0, 0, 0

    print(f"\n--- Evaluating {name} ({len(real_files)} Real, {len(fake_files)} Fake) ---")
    for f in real_files:
        max_p, avg_p = predict_file(f, model)
        is_spoof = (max_p >= THRESHOLD)
        if is_spoof:
            fp += 1
        else:
            tn += 1

    for f in fake_files:
        max_p, avg_p = predict_file(f, model)
        is_spoof = (max_p >= THRESHOLD)
        if is_spoof:
            tp += 1
        else:
            fn += 1

    total = tp + fp + tn + fn
    acc = (tp + tn) / total * 100 if total > 0 else 0
    rec_spoof = tp / (tp + fn) * 100 if (tp + fn) > 0 else 0
    rec_real = tn / (tn + fp) * 100 if (tn + fp) > 0 else 0
    prec = tp / (tp + fp) * 100 if (tp + fp) > 0 else 0
    f1 = 2 * (prec * rec_spoof) / (prec + rec_spoof) if (prec + rec_spoof) > 0 else 0

    return {
        "name": name,
        "acc": acc,
        "real_recall": rec_real,
        "spoof_recall": rec_spoof,
        "prec": prec,
        "f1": f1,
        "tp": tp, "fp": fp, "tn": tn, "fn": fn
    }

def main():
    print("=" * 65)
    print("VOICE SHIELD — CUSTOM DATASET BEFORE vs AFTER EVALUATION")
    print("=" * 65)

    base_res = evaluate_single_model(BASE_MODEL_PATH, "Base ASVspoof Model")
    ft_res = evaluate_single_model(FINETUNED_MODEL_PATH, "Fine-Tuned Real-World Model")

    print("\n" + "=" * 65)
    print("COMPARISON SUMMARY MATRIX FOR SIH REPORT")
    print("=" * 65)
    print(f"{'Metric':<25} | {'Base ASVspoof Model':<20} | {'Fine-Tuned Model':<20}")
    print("-" * 65)

    if base_res and ft_res:
        print(f"{'Overall Accuracy':<25} | {base_res['acc']:>18.2f}% | {ft_res['acc']:>18.2f}%")
        print(f"{'Real Voice Pass Rate':<25} | {base_res['real_recall']:>18.2f}% | {ft_res['real_recall']:>18.2f}%")
        print(f"{'AI Spoof Detection Rate':<25} | {base_res['spoof_recall']:>18.2f}% | {ft_res['spoof_recall']:>18.2f}%")
        print(f"{'Precision':<25} | {base_res['prec']:>18.2f}% | {ft_res['prec']:>18.2f}%")
        print(f"{'F1-Score':<25} | {base_res['f1']:>18.2f}% | {ft_res['f1']:>18.2f}%")
        print("-" * 65)
        print(f"{'False Positives (Real->AI)':<25} | {base_res['fp']:>19} | {ft_res['fp']:>19}")
        print(f"{'False Negatives (AI->Real)':<25} | {base_res['fn']:>19} | {ft_res['fn']:>19}")
    elif base_res:
        print(f"{'Overall Accuracy':<25} | {base_res['acc']:>18.2f}%")
        print(f"{'Real Voice Pass Rate':<25} | {base_res['real_recall']:>18.2f}%")
        print(f"{'AI Spoof Detection Rate':<25} | {base_res['spoof_recall']:>18.2f}%")

    print("=" * 65)

if __name__ == "__main__":
    main()
