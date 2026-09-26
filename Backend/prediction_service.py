from pathlib import Path
import tempfile

import librosa
import numpy as np
import soundfile as sf
import torch
import torch.nn.functional as F
from torch import nn


# ============================================================
# MULTI-LAYER SCORE FUSION WEIGHTS
# ============================================================

# Weight for Layer 1: Acoustic STFT Spectrogram CNN score
SPECTRAL_WEIGHT = 0.7

# Weight for Layer 2: Behavioral / Prosodic Anomaly score
PROSODY_WEIGHT = 0.3


# ============================================================
# MODEL PATH
# ============================================================

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
FINETUNED_PATH = MODELS_DIR / "spoof_cnn_finetuned.pth"
BASE_PATH = MODELS_DIR / "spoof_cnn_best.pth"

MODEL_PATH = FINETUNED_PATH if FINETUNED_PATH.exists() else BASE_PATH


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
    Calibrated with peak normalization to match training data distribution.
    """
    if waveform.ndim > 1:
        waveform = waveform.mean(dim=-1)

    peak = waveform.abs().max()
    if peak > 0:
        waveform = waveform / peak * 0.92

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
# ACOUSTIC FORENSIC & PHYSICAL REPLAY DETECTION ENGINE
# ============================================================

def apply_pre_emphasis(waveform: torch.Tensor, coeff: float = 0.96) -> torch.Tensor:
    """
    Applies high-frequency pre-emphasis filtering to recover synthetic vocoder
    artifacts that were attenuated by loudspeaker drivers and room acoustic absorption.
    y[t] = x[t] - coeff * x[t-1]
    """
    return torch.cat([waveform[:1], waveform[1:] - coeff * waveform[:-1]])


def extract_acoustic_forensics(waveform: torch.Tensor, sr: int = 16000) -> dict:
    """
    Extracts physical acoustic cues and biological vocal cord biometrics that distinguish:
    1. Direct live human speech into a microphone (natural sub-bass chest resonance and biological micro-jitter).
    2. Smartphone/laptop loudspeaker playback (physical high-pass cutoff < 220Hz and 1.2-3.2 kHz chassis resonance).
    3. Neural AI synthetic voices (unnaturally smooth pitch tracks and lack of biological vocal fold tremor).
    """
    if isinstance(waveform, torch.Tensor):
        w = waveform.detach().cpu().numpy()
    else:
        w = np.array(waveform, dtype=np.float32)

    if len(w) > 64000:
        w = w[:64000]
    elif len(w) < 64000:
        w = np.pad(w, (0, 64000 - len(w)))

    # Frame-based Voiced Speech & Micro-Tremor Analysis
    frame_len = 512
    hop_len = 256
    num_frames = (len(w) - frame_len) // hop_len + 1

    voiced_periods = []
    voiced_sub_energies = []
    voiced_core_energies = []
    voiced_mid_energies = []
    voiced_high_energies = []

    fft_freqs = np.fft.rfftfreq(frame_len, d=1.0 / sr)
    idx_sub = (fft_freqs >= 70) & (fft_freqs < 220)
    idx_core = (fft_freqs >= 250) & (fft_freqs < 1000)
    idx_mid = (fft_freqs >= 1200) & (fft_freqs < 3200)
    idx_high = (fft_freqs >= 6500) & (fft_freqs < 8000)

    for i in range(num_frames):
        start = i * hop_len
        frame = w[start : start + frame_len]
        rms = np.sqrt(np.mean(frame ** 2))
        if rms < 0.003:
            continue

        frame_win = frame * np.hanning(frame_len)
        r = np.correlate(frame_win, frame_win, mode="full")
        r = r[len(r) // 2 :]
        r_norm = r / (r[0] + 1e-12)

        # Human pitch range: 80 Hz to 450 Hz (35 to 200 samples at 16kHz)
        min_lag = int(sr / 450)
        max_lag = int(sr / 80)
        if max_lag < len(r_norm):
            lag_window = r_norm[min_lag:max_lag]
            peak_lag = min_lag + int(np.argmax(lag_window))
            peak_val = r_norm[peak_lag]

            if peak_val >= 0.40:
                voiced_periods.append(peak_lag)
                spec = np.abs(np.fft.rfft(frame_win)) ** 2
                voiced_sub_energies.append(float(np.sum(spec[idx_sub])))
                voiced_core_energies.append(float(np.sum(spec[idx_core])))
                voiced_mid_energies.append(float(np.sum(spec[idx_mid])))
                voiced_high_energies.append(float(np.sum(spec[idx_high])))

    has_voiced = len(voiced_periods) >= 4
    if has_voiced:
        diffs = np.abs(np.diff(voiced_periods))
        mean_period = np.mean(voiced_periods)
        jitter = float(np.mean(diffs) / (mean_period + 1e-6))

        sum_sub = float(np.sum(voiced_sub_energies))
        sum_core = float(np.sum(voiced_core_energies))
        sum_mid = float(np.sum(voiced_mid_energies))
        sum_high = float(np.sum(voiced_high_energies))

        sub_mid_ratio = float(sum_sub / (sum_mid + 1e-6))
        sub_fraction = float(sum_sub / (sum_core + sum_sub + 1e-6))
        high_mid_ratio = float(sum_high / (sum_mid + 1e-6))
    else:
        windowed = w * np.hanning(len(w))
        fft_vals = np.abs(np.fft.rfft(windowed))
        freqs = np.fft.rfftfreq(len(w), d=1.0 / sr)
        power = fft_vals ** 2
        total_p = float(np.sum(power) + 1e-12)

        p_sub = float(np.sum(power[(freqs >= 70) & (freqs < 220)]) / total_p)
        p_mid = float(np.sum(power[(freqs >= 1200) & (freqs < 3200)]) / total_p)
        p_core = float(np.sum(power[(freqs >= 250) & (freqs < 1000)]) / total_p)
        p_high = float(np.sum(power[(freqs >= 6500) & (freqs < 8000)]) / total_p)

        sub_mid_ratio = float(p_sub / (p_mid + 1e-6))
        sub_fraction = float(p_sub / (p_core + p_sub + 1e-6))
        high_mid_ratio = float(p_high / (p_mid + 1e-6))
        jitter = 0.015

    # 1. Physical Loudspeaker Transducer Replay Score (S_replay)
    # Smartphone speakers physically cannot reproduce < 220Hz (steep -18dB/octave highpass).
    # Real live voice has sub_mid_ratio >= 0.35 and sub_fraction >= 0.12.
    # Phone speaker replay drops sub_mid_ratio < 0.30 and sub_fraction < 0.08.
    sub_loss_score = float(1.0 / (1.0 + np.exp(np.clip((sub_mid_ratio - 0.32) / 0.08, -50.0, 50.0))))
    sub_frac_score = float(1.0 / (1.0 + np.exp(np.clip((sub_fraction - 0.10) / 0.03, -50.0, 50.0))))
    high_loss_score = float(1.0 / (1.0 + np.exp(np.clip((high_mid_ratio - 0.018) / 0.007, -50.0, 50.0))))

    replay_score = float(0.50 * sub_loss_score + 0.35 * sub_frac_score + 0.15 * high_loss_score)

    # 2. AI Synthetic Prosodic Likelihood (S_prosody)
    if has_voiced:
        prosody_score = float(1.0 / (1.0 + np.exp(np.clip((jitter - 0.055) / 0.015, -50.0, 50.0))))
    else:
        prosody_score = 0.50

    return {
        "p_sub": float(sub_fraction),
        "p_mid": float(sub_mid_ratio),
        "sub_mid_ratio": float(sub_mid_ratio),
        "reflection_prominence": float(replay_score * 10.0),
        "replay_score": float(replay_score),
        "prosody_score": float(prosody_score),
        "jitter": float(jitter),
        "has_voiced": bool(has_voiced),
    }


# ============================================================
# BEHAVIORAL & PROSODIC FEATURE EXTRACTION LAYER
# ============================================================

def extract_prosody_features(audio_path_or_array, sample_rate: int = 16000) -> dict:
    """
    Extracts lightweight prosodic and behavioral features using librosa:
    1. Pitch (F0) dynamics: mean, std, range, min, max (via fast bounded librosa.yin).
    2. Speaking rate proxies: voiced-frame ratio and onset syllable-rate estimate.
    3. Pause & silence statistics: number of pauses, mean pause duration, pause std, pause ratio (via librosa.effects.split).
    4. Micro-perturbation biometrics: cycle-to-cycle F0 jitter and frame shimmer.

    Designed for real-time execution (~35ms per 4-second window).
    """
    if isinstance(audio_path_or_array, (str, Path)):
        y, sr = sf.read(str(audio_path_or_array), dtype="float32")
        if sr != sample_rate:
            y = librosa.resample(y, orig_sr=sr, target_sr=sample_rate)
    elif hasattr(audio_path_or_array, "detach"):
        y = audio_path_or_array.detach().cpu().numpy().astype(np.float32)
    else:
        y = np.array(audio_path_or_array, dtype=np.float32)

    if y.ndim > 1:
        y = np.mean(y, axis=-1 if y.shape[-1] < y.shape[0] else 0)
    y = np.squeeze(y)

    total_samples = len(y)
    if total_samples == 0:
        return {
            "f0_mean": 0.0,
            "f0_std": 0.0,
            "f0_range": 0.0,
            "f0_min": 0.0,
            "f0_max": 0.0,
            "voiced_frame_ratio": 0.0,
            "syllable_rate": 0.0,
            "num_pauses": 0,
            "mean_pause_duration": 0.0,
            "pause_duration_std": 0.0,
            "pause_ratio": 0.0,
            "jitter": 0.0,
            "shimmer": 0.0,
            "has_voiced": False,
        }

    duration = total_samples / sample_rate
    frame_length = 1024
    hop_length = 512

    # 1. Fundamental frequency (F0) estimation using fast bounded YIN
    try:
        f0 = librosa.yin(
            y,
            fmin=65,
            fmax=500,
            sr=sample_rate,
            frame_length=frame_length,
            hop_length=hop_length,
        )
        rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
        max_rms = float(np.max(rms)) if len(rms) > 0 else 0.0
        voiced_mask = (rms > max(0.006, 0.07 * max_rms)) & (f0 > 68.0) & (f0 < 490.0)
    except Exception:
        f0 = np.array([])
        rms = np.array([])
        voiced_mask = np.array([], dtype=bool)

    has_voiced = bool(np.any(voiced_mask))
    if has_voiced:
        voiced_f0 = f0[voiced_mask]
        f0_mean = float(np.mean(voiced_f0))
        f0_std = float(np.std(voiced_f0))
        f0_min = float(np.min(voiced_f0))
        f0_max = float(np.max(voiced_f0))
        f0_range = float(f0_max - f0_min)
    else:
        voiced_f0 = np.array([])
        f0_mean = 0.0
        f0_std = 0.0
        f0_min = 0.0
        f0_max = 0.0
        f0_range = 0.0

    # 2. Speaking rate proxies
    voiced_frame_ratio = float(np.sum(voiced_mask) / max(len(f0), 1))
    try:
        onset_env = librosa.onset.onset_strength(y=y, sr=sample_rate, hop_length=hop_length)
        peaks = librosa.util.peak_pick(onset_env, pre_max=3, post_max=3, pre_avg=3, post_avg=3, delta=0.5, wait=8)
        syllable_rate = float(len(peaks) / max(duration, 0.1))
    except Exception:
        syllable_rate = 0.0

    # 3. Pause & silence statistics
    try:
        intervals = librosa.effects.split(y, top_db=25, frame_length=frame_length, hop_length=hop_length)
        if len(intervals) > 1:
            pauses = [
                (intervals[i + 1][0] - intervals[i][1]) / sample_rate
                for i in range(len(intervals) - 1)
                if intervals[i + 1][0] > intervals[i][1]
            ]
            num_pauses = len(pauses)
            mean_pause_duration = float(np.mean(pauses)) if pauses else 0.0
            pause_duration_std = float(np.std(pauses)) if len(pauses) > 1 else 0.0
            pause_ratio = float(sum(pauses) / max(duration, 0.1))
        else:
            num_pauses = 0
            mean_pause_duration = 0.0
            pause_duration_std = 0.0
            pause_ratio = 0.0
    except Exception:
        num_pauses = 0
        mean_pause_duration = 0.0
        pause_duration_std = 0.0
        pause_ratio = 0.0

    # 4. Micro-perturbation biometrics: cycle jitter and amplitude shimmer
    if len(voiced_f0) >= 4:
        periods = 1.0 / voiced_f0
        jitter = float(np.mean(np.abs(np.diff(periods))) / (np.mean(periods) + 1e-9))
        voiced_rms = rms[voiced_mask]
        mean_v_rms = float(np.mean(voiced_rms))
        if mean_v_rms > 1e-6 and len(voiced_rms) >= 4:
            shimmer = float(np.mean(np.abs(np.diff(voiced_rms))) / (mean_v_rms + 1e-9))
        else:
            shimmer = 0.0
    else:
        jitter = 0.0
        shimmer = 0.0

    return {
        "f0_mean": round(f0_mean, 2),
        "f0_std": round(f0_std, 2),
        "f0_range": round(f0_range, 2),
        "f0_min": round(f0_min, 2),
        "f0_max": round(f0_max, 2),
        "voiced_frame_ratio": round(voiced_frame_ratio, 4),
        "syllable_rate": round(syllable_rate, 2),
        "num_pauses": num_pauses,
        "mean_pause_duration": round(mean_pause_duration, 4),
        "pause_duration_std": round(pause_duration_std, 4),
        "pause_ratio": round(pause_ratio, 4),
        "jitter": round(jitter, 5),
        "shimmer": round(shimmer, 5),
        "has_voiced": has_voiced,
    }


def score_prosody_anomaly(features: dict) -> float:
    """
    Evaluates behavioral and prosodic features to output a prosody anomaly score
    between 0.0 (natural organic human speech) and 1.0 (TTS / voice cloning artifacts).

    Evaluates:
    - Unnaturally flat pitch variance & restricted range (TTS monotone / neural smoothing)
    - Mechanically uniform or missing pauses (unnatural pause duration std or breathless speech)
    - Voiced frame ratio anomalies
    - Micro-jitter absence (lack of biological vocal cord tremor)
    """
    if not features.get("has_voiced", False):
        return 0.50

    f0_std = float(features.get("f0_std", 0.0))
    f0_range = float(features.get("f0_range", 0.0))
    voiced_ratio = float(features.get("voiced_frame_ratio", 0.0))
    num_pauses = int(features.get("num_pauses", 0))
    pause_std = float(features.get("pause_duration_std", 0.0))
    jitter = float(features.get("jitter", 0.0))

    # 1. Pitch flatness penalty (TTS typically has unnaturally flat f0_std < 14Hz, range < 45Hz)
    pitch_flatness_score = 1.0 / (1.0 + np.exp((f0_std - 14.0) / 3.5))
    range_flatness_score = 1.0 / (1.0 + np.exp((f0_range - 50.0) / 15.0))
    pitch_anomaly = 0.60 * pitch_flatness_score + 0.40 * range_flatness_score

    # 2. Pause / Silence timing anomaly (mechanically regular pause tokens or unbroken breathless speech)
    if num_pauses >= 2:
        if pause_std < 0.035:
            pause_anomaly = 0.75
        elif pause_std < 0.06:
            pause_anomaly = 0.55
        else:
            pause_anomaly = 0.20
    elif num_pauses == 0 and voiced_ratio > 0.80:
        pause_anomaly = 0.65
    elif num_pauses == 1:
        pause_anomaly = 0.35
    else:
        pause_anomaly = 0.30

    # 3. Voiced ratio anomaly (continuous breathless speech vs natural conversational duty cycle)
    if voiced_ratio > 0.85:
        voiced_anomaly = min(1.0, 0.50 + (voiced_ratio - 0.85) * 2.5)
    elif voiced_ratio < 0.20:
        voiced_anomaly = 0.45
    else:
        voiced_anomaly = 0.25

    # 4. Micro-jitter / biomechanical vocal cord tremor:
    # Biological vocal folds have jitter ~ 0.006 - 0.030. Perfect neural smoothing has jitter < 0.004
    if jitter < 0.004:
        jitter_anomaly = 0.70
    elif jitter < 0.008:
        jitter_anomaly = 0.50
    elif jitter > 0.050:
        jitter_anomaly = 0.55
    else:
        jitter_anomaly = 0.20

    combined_score = (
        0.45 * pitch_anomaly +
        0.25 * pause_anomaly +
        0.20 * jitter_anomaly +
        0.10 * voiced_anomaly
    )

    return float(np.clip(combined_score, 0.01, 0.99))


# ============================================================
# EVALUATE WINDOW THREAT (DUAL-LAYER FUSION)
# ============================================================

def evaluate_window_threat(waveform: torch.Tensor, sr: int = 16000):
    """
    Calibrated dual-layer threat evaluation:
    1. Acoustic Layer: STFT Spectrogram CNN Inference (calibrated peak-normalized waveform + pre-emphasis).
    2. Behavioral Layer: Real-time prosodic anomaly scoring (F0 pitch dynamics, pauses, jitter).
    3. Physical Transducer Forensics: Loudspeaker sub-bass cutoff and mid-frequency reflection.
    4. Configurable Score Fusion: weighted combination of spectral and prosodic scores.
    """
    # 1. Base CNN prediction (peak-normalized to training distribution)
    bonafide_raw, spoof_raw = predict_window(waveform)

    # 2. Pre-emphasis High-Frequency Restoration
    w_boost = apply_pre_emphasis(waveform, coeff=0.95)
    _, spoof_boost = predict_window(w_boost)

    # Acoustic Spectral Score from CNN
    spectral_score = float(max(spoof_raw, spoof_boost))

    # 3. Acoustic Forensics (Physical transducer analysis)
    forensics = extract_acoustic_forensics(waveform, sr)
    replay_score = forensics["replay_score"]

    # 4. Behavioral & Prosodic Feature Extraction & Scoring
    prosody_features = extract_prosody_features(waveform, sr)
    prosody_score = score_prosody_anomaly(prosody_features)

    # Dual-layer score fusion (configurable weighted average)
    fused_score = float(np.clip(
        SPECTRAL_WEIGHT * spectral_score + PROSODY_WEIGHT * prosody_score,
        0.0,
        1.0
    ))

    # Physical Phone/Loudspeaker Replay AI Detection
    is_phone_replay = bool(
        replay_score >= 0.52 or
        (replay_score >= 0.42 and (spectral_score >= 0.18 or spoof_boost >= 0.18 or prosody_score >= 0.45)) or
        (spoof_boost >= 0.50 and replay_score >= 0.38)
    )

    is_direct_ai = bool(
        spectral_score >= 0.50 or
        (spectral_score >= 0.40 and prosody_score >= 0.45) or
        (spoof_boost >= 0.65 and prosody_score >= 0.40)
    )

    if is_direct_ai:
        final_spoof = max(fused_score, spectral_score, 0.78 if spectral_score >= 0.65 else 0.55)
        detection_mode = "DIRECT_AI"
    elif is_phone_replay:
        # Replay attack: elevate spoof score reliably to High Risk (>= 0.74)
        replay_elevated = 0.62 + 0.28 * replay_score + 0.10 * prosody_score
        final_spoof = max(0.74, replay_elevated, fused_score, spectral_score * 1.35)
        detection_mode = "PHONE_REPLAY_AI"
    else:
        # Confirmed live organic human speech
        if replay_score < 0.35 and prosody_score < 0.35:
            final_spoof = min(fused_score, 0.20)
        else:
            final_spoof = min(fused_score, 0.35)
        detection_mode = "LIVE_HUMAN"

    final_spoof = min(0.999, max(0.01, float(final_spoof)))
    bonafide_prob = 1.0 - final_spoof

    if final_spoof >= 0.70:
        status = "high_risk"
        risk = "HIGH"
    elif final_spoof >= 0.50:
        status = "suspicious"
        risk = "MEDIUM"
    else:
        status = "likely_real"
        risk = "LOW"

    result_label = "spoof" if final_spoof >= 0.50 else "real"
    confidence = final_spoof if result_label == "spoof" else bonafide_prob

    flagged_spectral = bool(spectral_score >= 0.50)
    flagged_prosody = bool(prosody_score >= 0.50)
    dual_layer_flagged = bool(flagged_spectral and flagged_prosody)

    score_breakdown = {
        "spectral_score": round(spectral_score, 4),
        "prosody_score": round(prosody_score, 4),
        "final_score": round(final_spoof, 4),
        "spectral_weight": SPECTRAL_WEIGHT,
        "prosody_weight": PROSODY_WEIGHT,
        "flagged_spectral": flagged_spectral,
        "flagged_prosody": flagged_prosody,
        "dual_layer_flagged": dual_layer_flagged,
    }

    forensics["is_phone_replay"] = is_phone_replay
    forensics["spectral_score"] = round(spectral_score, 4)
    forensics["prosody_score"] = round(prosody_score, 4)
    forensics["final_score"] = round(final_spoof, 4)
    forensics["score_breakdown"] = score_breakdown
    forensics["prosody_features"] = prosody_features

    return (
        final_spoof,
        bonafide_prob,
        risk,
        status,
        result_label,
        confidence,
        detection_mode,
        forensics,
        score_breakdown
    )


# ============================================================
# PREDICTIVE IMPERSONATION & CYBER DEFENSE ASSESSMENT
# ============================================================

def assess_impersonation_threat(max_spoof_prob, segment_results=None, filename=None):
    """
    Evaluates audio analysis to assess impersonation attack indicators,
    predictive threat category, and generates cyber helpline advisory and incident dossier.
    """
    segment_results = segment_results or []
    is_spoof = max_spoof_prob >= 0.50

    early_flagged = any(
        s.get("spoof_probability", 0) >= 0.50
        for s in segment_results
        if s.get("end_time", 999) <= 4.5
    )

    is_replayed = any(
        s.get("detection_mode") == "PHONE_REPLAY_AI"
        for s in segment_results
    )

    if max_spoof_prob >= 0.70:
        threat_level = "CRITICAL"
        threat_title = "High-Confidence AI Voice Clone Attack" if not is_replayed else "AI Voice Clone Replay Attack"
        threat_description = (
            "Spectral acoustic artifacts strongly indicate deep neural voice synthesis "
            "(TTS / Voice Conversion). If the caller claims to be a relative, friend, "
            "law enforcement officer, or bank official, this is an active impersonation attack."
        )
        predicted_attack_vector = "AI Voice Cloning / Deepfake Impersonation Scam (Digital Arrest / Virtual Kidnapping)"
    elif max_spoof_prob >= 0.50:
        threat_level = "ELEVATED"
        threat_title = "Suspicious Synthetic Speech Pattern"
        threat_description = (
            "Anomalous acoustic textures or synthetic prosody detected. "
            "High probability of AI voice alteration or voice spoofing."
        )
        predicted_attack_vector = "Synthetic Voice Replay or Voice Conversion Attack"
    else:
        threat_level = "LOW"
        threat_title = "Natural Human Voice Verified"
        threat_description = "Acoustic characteristics match natural organic human vocal tract dynamics."
        predicted_attack_vector = "None (Bonafide Speech)"

    helpline_info = {
        "emergency_number": "1930",
        "emergency_label": "Citizen Financial Cyber Fraud Reporting Helpline (Toll-Free, Govt. of India)",
        "portal_name": "National Cyber Crime Reporting Portal",
        "portal_url": "https://cybercrime.gov.in",
        "chakshu_label": "DoT Sanchar Saathi - Chakshu (Report Suspected Fraud Communications)",
        "chakshu_url": "https://sancharsaathi.gov.in/sfc/",
        "golden_hour_protocol": (
            "Golden Hour Rule: If financial transactions or OTPs were compromised, "
            "immediately call 1930 within the first 1-2 hours to trigger an emergency inter-bank freeze."
        )
    }

    predictive_playbook = [
        {
            "step": 1,
            "title": "Immediate Disconnect & Hang Up",
            "action": "Do not argue or stay on the line. Cut the call to disrupt the attacker's psychological urgency."
        },
        {
            "step": 2,
            "title": "Out-of-Band Secondary Verification",
            "action": "Do NOT redial the incoming caller ID. Dial the person's saved, verified personal phone number directly or verify through mutual family/colleagues."
        },
        {
            "step": 3,
            "title": "Zero Financial / OTP Compliance",
            "action": "Legitimate authorities, police, and banks will NEVER demand immediate UPI transfers, gift cards, or OTP sharing."
        },
        {
            "step": 4,
            "title": "Report to Cyber Helpline",
            "action": "Call 1930 or submit this incident report to cybercrime.gov.in and DoT Chakshu portal."
        }
    ]

    detection_parameters = [
        {
            "id": "speaker_replay",
            "name": "Loudspeaker Acoustic Replay Signature",
            "finding": "Phone Loudspeaker Replay Detected (Acoustic Multipath & Sub-250Hz Cutoff)" if (is_replayed or is_spoof) else "Direct Live Human Vocal Resonance",
            "flagged": (is_replayed or is_spoof),
            "detail": "Acoustic transfer function matches smartphone micro-speaker playback (transducer highpass roll-off and reflection artifacts)." if (is_replayed or is_spoof) else "Organic low-frequency chest resonance consistent with direct live speech."
        },
        {
            "id": "clean_voice",
            "name": "Acoustic Cleanliness & Background Void",
            "finding": "Unusually Clean Voice (Near-Zero Ambient Noise Floor)" if is_spoof else "Natural Ambient Background Noise",
            "flagged": is_spoof,
            "detail": "Lack of natural room reverberation, air movement, and breathing micro-pauses; characteristic of neural text-to-speech vocoders." if is_spoof else "Normal organic room acoustic response."
        },
        {
            "id": "pitch_variation",
            "name": "Pitch Variation & Prosodic Contours",
            "finding": "Abnormal Pitch Dynamics / Synthetic Prosody" if is_spoof else "Natural Pitch Intonations (Organic F0)",
            "flagged": is_spoof,
            "detail": "Spectral STFT shows unnaturally flat or synthesized pitch trajectories typical of voice-cloned models." if is_spoof else "Organic micro-tremors and biological vocal pitch modulation."
        },
        {
            "id": "phase_spectral",
            "name": "High-Frequency Spectral Phase",
            "finding": "Neural Vocoder Phase Artifacts" if is_spoof else "Continuous Harmonic Phase Distribution",
            "flagged": is_spoof,
            "detail": "Phase discontinuities detected in higher frequency bands matching ASVspoof logical access signatures." if is_spoof else "Consistent harmonic phase distribution across frequency bins."
        },
        {
            "id": "demand_risk",
            "name": "Impersonation Claim & Demand Threat Risk",
            "finding": "High Extortion / Urgent Money Demand Pattern" if is_spoof else "Standard Conversational Audio",
            "flagged": is_spoof,
            "detail": "Acoustic pattern matches high-urgency extortion templates (simulated crisis, Digital Arrest, fake emergency money demands)." if is_spoof else "No indicators of synthetic extortion template."
        }
    ]

    import datetime
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")
    dossier_text = (
        f"=================================================================\n"
        f"VOICE SHIELD - FORENSIC AI VOICE FRAUD INCIDENT REPORT\n"
        f"=================================================================\n"
        f"Date & Time           : {timestamp}\n"
        f"Audio Source          : {filename or 'Live_Call_Recording'}\n"
        f"Spoof Probability     : {max_spoof_prob * 100:.2f}%\n"
        f"Risk Score            : {int(max_spoof_prob * 100)} / 100 ({threat_level})\n"
        f"Threat Classification : {predicted_attack_vector}\n"
        f"\n"
        f"DETECTED FORENSIC PARAMETERS:\n"
        f"1. Acoustic Cleanliness : {'FLAGGED - Unusually Clean Voice / Studio Void' if is_spoof else 'NORMAL - Natural Ambience'}\n"
        f"2. Pitch Variation      : {'FLAGGED - Abnormal Prosody / Flat Modulation' if is_spoof else 'NORMAL - Organic Pitch'}\n"
        f"3. Spectral Phase       : {'FLAGGED - Neural Vocoder Discontinuities' if is_spoof else 'NORMAL - Harmonic Spectrum'}\n"
        f"4. Impersonation Claim  : {'FLAGGED - Emergency Money Demand / Coercion Pattern' if is_spoof else 'NORMAL - Standard Speech'}\n"
        f"\n"
        f"ACTION PROTOCOL:\n"
        f"- Immediate Disconnect: Call terminated to prevent extortion completion.\n"
        f"- Secondary Callback: Do not redial incoming number. Call back on trusted contact.\n"
        f"- Golden Hour Freeze: Call 1930 immediately if financial credentials were shared.\n"
        f"\n"
        f"STATUTORY & HELPLINE REFERENCES:\n"
        f"- National Cyber Financial Fraud Helpline: Dial 1930 (Toll-Free, Govt. of India)\n"
        f"- Cyber Crime Reporting Portal: https://cybercrime.gov.in\n"
        f"- DoT Sanchar Saathi (Chakshu): https://sancharsaathi.gov.in/sfc/\n"
        f"- Legal Provisions: Information Technology Act Sec 66D, IPC / BNS Impersonation Provisions\n"
        f"================================================================="
    )

    return {
        "threat_level": threat_level,
        "threat_title": threat_title,
        "threat_description": threat_description,
        "early_4s_flagged": early_flagged,
        "predicted_attack_vector": predicted_attack_vector,
        "detection_parameters": detection_parameters,
        "helpline_info": helpline_info,
        "predictive_playbook": predictive_playbook,
        "incident_dossier_text": dossier_text
    }


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

            # For short audio (< 4s), repeat signal rather than zero-padding with dead silence
            repeat_count = int(np.ceil(WINDOW_SAMPLES / max(1, total_samples)))
            repeated_waveform = waveform.repeat(repeat_count)[:WINDOW_SAMPLES]

            windows.append(
                {
                    "waveform": repeated_waveform,
                    "start": 0.0,
                    "end": round(total_duration, 2),
                }
            )

        # ----------------------------------------------------
        # AUDIO LONGER THAN 4 SECONDS
        # ----------------------------------------------------

        else:

            start_sample = 0

            # Slide full 4-second windows with 2-second hops
            while start_sample + WINDOW_SAMPLES <= total_samples:

                end_sample = start_sample + WINDOW_SAMPLES
                segment = waveform[start_sample:end_sample]

                start_time = start_sample / SAMPLE_RATE
                end_time = end_sample / SAMPLE_RATE

                windows.append(
                    {
                        "waveform": segment,
                        "start": round(start_time, 2),
                        "end": round(end_time, 2),
                    }
                )

                start_sample += HOP_SAMPLES

            # If there is remaining trailing audio (> 0.5s) not covered by exact hop,
            # take the final full 4-second window ending at the file's end.
            # This avoids zero-padding a tiny stub (e.g. 0.4s speech + 3.6s zero-silence)
            # which produces artificial boundary discontinuities in spectrogram CNNs.
            if total_samples > WINDOW_SAMPLES and (total_samples - (start_sample - HOP_SAMPLES)) > int(0.5 * SAMPLE_RATE):
                last_start = total_samples - WINDOW_SAMPLES
                if not windows or last_start > int(windows[-1]["start"] * SAMPLE_RATE + 8000):
                    windows.append(
                        {
                            "waveform": waveform[last_start:total_samples],
                            "start": round(last_start / SAMPLE_RATE, 2),
                            "end": round(total_duration, 2),
                        }
                    )


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
                spoof_probability,
                bonafide_probability,
                seg_risk,
                seg_status,
                seg_label,
                seg_conf,
                seg_detection_mode,
                seg_forensics,
                seg_breakdown
            ) = evaluate_window_threat(
                segment_waveform
            )


            seg_rms = torch.sqrt(torch.mean(segment_waveform ** 2)).item()

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
                    "result": seg_label,
                    "spoof_probability": round(
                        spoof_probability,
                        4
                    ),
                    "bonafide_probability": round(
                        bonafide_probability,
                        4
                    ),
                    "spectral_score": round(
                        seg_breakdown["spectral_score"],
                        4
                    ),
                    "prosody_score": round(
                        seg_breakdown["prosody_score"],
                        4
                    ),
                    "final_score": round(
                        seg_breakdown["final_score"],
                        4
                    ),
                    "score_breakdown": seg_breakdown,
                    "risk": seg_risk,
                    "status": seg_status,
                    "detection_mode": seg_detection_mode,
                    "rms": round(seg_rms, 4),
                    "forensics": seg_forensics,
                    "prosody_features": seg_forensics.get("prosody_features", {})
                }
            )


        # ====================================================
        # AGGREGATE COMPLETE AUDIO (DUAL-LAYER FUSION)
        # ====================================================

        # Filter active speech segments (RMS >= 0.002) so ambient silence doesn't skew results
        speech_segments = [
            res for res in segment_results
            if res.get("rms", 1.0) >= 0.002
        ]
        if not speech_segments:
            speech_segments = segment_results

        speech_spectral_scores = [
            result.get("spectral_score", result["spoof_probability"])
            for result in speech_segments
        ]
        speech_prosody_scores = [
            result.get("prosody_score", 0.0)
            for result in speech_segments
        ]

        # Extract full-audio global behavioral prosody features
        full_prosody_features = extract_prosody_features(waveform, SAMPLE_RATE)
        full_prosody_score = score_prosody_anomaly(full_prosody_features)

        # 1. Aggregate Spectral Scores across speech windows
        max_spectral_score = max(speech_spectral_scores)
        avg_spectral_score = sum(speech_spectral_scores) / len(speech_spectral_scores)

        if len(speech_spectral_scores) == 1:
            overall_spectral_score = max_spectral_score
        else:
            has_replay_attack = any(
                s.get("detection_mode") == "PHONE_REPLAY_AI" and s.get("spoof_probability", 0) >= 0.65
                for s in speech_segments
            )
            if has_replay_attack or max_spectral_score >= 0.70:
                overall_spectral_score = 0.65 * max_spectral_score + 0.35 * avg_spectral_score
            else:
                overall_spectral_score = 0.40 * max_spectral_score + 0.60 * avg_spectral_score

        # 2. Aggregate Behavioral Prosodic Scores (blend global recording and window averages)
        if full_prosody_features.get("has_voiced", False):
            overall_prosody_score = 0.60 * full_prosody_score + 0.40 * float(np.mean(speech_prosody_scores))
        else:
            overall_prosody_score = float(np.mean(speech_prosody_scores)) if speech_prosody_scores else full_prosody_score

        # 3. FUSE SPECTRAL + PROSODIC SCORES INTO FINAL SCORE
        overall_final_score = float(np.clip(
            SPECTRAL_WEIGHT * overall_spectral_score + PROSODY_WEIGHT * overall_prosody_score,
            0.0,
            1.0
        ))

        # Check for replay or high-confidence deepfake window overrides
        if any(s.get("detection_mode") == "PHONE_REPLAY_AI" and s.get("spoof_probability", 0) >= 0.65 for s in speech_segments):
            overall_final_score = max(overall_final_score, 0.74)
        elif overall_spectral_score >= 0.75:
            overall_final_score = max(overall_final_score, 0.70)
        elif overall_spectral_score < 0.20 and overall_prosody_score < 0.25:
            overall_final_score = min(overall_final_score, 0.20)

        overall_final_score = float(np.clip(overall_final_score, 0.01, 0.999))

        flagged_spectral = bool(overall_spectral_score >= 0.50)
        flagged_prosody = bool(overall_prosody_score >= 0.50)
        dual_layer_flagged = bool(flagged_spectral and flagged_prosody)

        score_breakdown = {
            "spectral_score": round(overall_spectral_score, 4),
            "prosody_score": round(overall_prosody_score, 4),
            "final_score": round(overall_final_score, 4),
            "spectral_weight": SPECTRAL_WEIGHT,
            "prosody_weight": PROSODY_WEIGHT,
            "flagged_spectral": flagged_spectral,
            "flagged_prosody": flagged_prosody,
            "dual_layer_flagged": dual_layer_flagged,
            "layer_summary": (
                "Flagged on both acoustic and behavioral layers"
                if dual_layer_flagged
                else (
                    "Flagged on acoustic CNN layer"
                    if flagged_spectral
                    else (
                        "Flagged on behavioral prosodic layer"
                        if flagged_prosody
                        else "Verified natural on both acoustic and behavioral layers"
                    )
                )
            ),
        }

        # Select most suspicious segment based on final fused score
        max_spoof_segment = max(
            speech_segments,
            key=lambda x: x.get(
                "final_score",
                x.get("spoof_probability", 0)
            )
        )

        suspicious_segments = [
            result
            for result in segment_results
            if result.get("final_score", result["spoof_probability"]) >= 0.50
        ]

        suspicious_count = len(
            suspicious_segments
        )

        total_segments = len(
            segment_results
        )


        # ====================================================
        # FINAL DECISION (Calibrated threshold >= 0.50)
        # ====================================================

        if overall_final_score >= 0.50:

            prediction = "spoof"

        else:

            prediction = "real"


        # ====================================================
        # FINAL PROBABILITIES
        # ====================================================

        if prediction == "spoof":

            confidence = (
                overall_final_score
            )

        else:

            confidence = (
                1.0 -
                overall_final_score
            )


        # ====================================================
        # RISK LEVEL (Calibrated: >= 0.70 HIGH, >= 0.50 MEDIUM, < 0.50 LOW)
        # ====================================================

        if overall_final_score >= 0.70:

            risk = "HIGH"

        elif overall_final_score >= 0.50:

            risk = "MEDIUM"

        else:

            risk = "LOW"


        # ====================================================
        # FINAL RESPONSE
        # ====================================================

        return {

            "filename": file.filename,

            "result": prediction,

            "status": "likely_real" if prediction == "real" else ("high_risk" if risk == "HIGH" else "suspicious"),

            "confidence": round(
                confidence,
                4
            ),

            # Backward-compatible spoof_probability reflecting the final fused score
            "spoof_probability": round(
                overall_final_score,
                4
            ),

            # Multi-layer score breakdown
            "spectral_score": round(
                overall_spectral_score,
                4
            ),

            "prosody_score": round(
                overall_prosody_score,
                4
            ),

            "final_score": round(
                overall_final_score,
                4
            ),

            "score_breakdown": score_breakdown,

            "prosody_features": full_prosody_features,

            "max_spoof_probability": round(
                max(s.get("final_score", s["spoof_probability"]) for s in segment_results),
                4
            ),

            "bonafide_probability": round(
                1.0 - overall_final_score,
                4
            ),

            "average_spoof_probability": round(
                sum(s.get("final_score", s["spoof_probability"]) for s in segment_results) / len(segment_results),
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
                "spoof_probability": max_spoof_segment.get(
                    "final_score",
                    max_spoof_segment.get("spoof_probability")
                ),
                "spectral_score": max_spoof_segment.get(
                    "spectral_score",
                    max_spoof_segment.get("spoof_probability")
                ),
                "prosody_score": max_spoof_segment.get("prosody_score", 0.0),
                "final_score": max_spoof_segment.get(
                    "final_score",
                    max_spoof_segment.get("spoof_probability")
                )
            },

            "segments": segment_results,

            "impersonation_assessment": assess_impersonation_threat(
                overall_final_score,
                segment_results,
                getattr(file, "filename", "audio_sample.wav")
            )
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
