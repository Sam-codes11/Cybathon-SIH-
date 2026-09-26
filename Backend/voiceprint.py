import numpy as np
import torch
from prediction_service import model, create_spectrogram, DEVICE
import db
@torch.no_grad()
def extract_embedding(waveform: torch.Tensor) -> list:
    if waveform.ndim > 1:
        waveform = waveform.mean(dim=-1)

    # Standardize to 4-second input (64,000 samples at 16kHz) to match SpoofCNN input size
    if waveform.numel() < 64000:
        repeat_count = int(np.ceil(64000 / max(1, waveform.numel())))
        waveform = waveform.repeat(repeat_count)[:64000]
    elif waveform.numel() > 64000:
        waveform = waveform[:64000]

    peak = waveform.abs().max()
    if peak > 0:
        waveform = waveform / peak * 0.92
    spec = create_spectrogram(waveform).to(DEVICE)
    features = model.features(spec)          # [1, 128, 1, 1]
    return features.flatten().cpu().numpy().tolist()


def cosine_similarity(a, b):
    a, b = np.array(a), np.array(b)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8))


def enroll_speaker(speaker_id: str, waveform: torch.Tensor):
    embedding = extract_embedding(waveform)
    db.save_voiceprint(speaker_id, embedding)
    return embedding


def verify_speaker(waveform: torch.Tensor, claimed_speaker_id: str, threshold: float = 0.75):
    voiceprints = db.get_all_voiceprints()
    if claimed_speaker_id not in voiceprints:
        return False, 0.0, "NOT_ENROLLED"
    live_embedding = extract_embedding(waveform)
    similarity = cosine_similarity(live_embedding, voiceprints[claimed_speaker_id])
    is_match = bool(similarity >= threshold)
    status = "MATCH" if is_match else "MISMATCH"
    return is_match, float(similarity), status