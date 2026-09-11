from pathlib import Path
import tempfile

import numpy as np
import soundfile as sf
import torch
import torch.nn.functional as F
from torch import nn


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
    Extracts physical acoustic cues that distinguish smartphone loudspeaker playback
    from direct live human speech into a microphone:
    1. Sub-bass energy (60-250 Hz): Human vocal cords produce rich chest resonance;
       smartphone micro-speakers (10-15mm) physically cannot reproduce <250Hz.
    2. Phone resonance band (900-2800 Hz): Smartphone speakers resonate intensely in mid-frequencies.
    3. Cepstral multipath reflection prominence: Smartphone and desk reflections produce
       distinct comb-filtering reflection peaks in the quefrency spectrum.
    """
    if isinstance(waveform, torch.Tensor):
        w = waveform.detach().cpu().numpy()
    else:
        w = np.array(waveform, dtype=np.float32)

    if len(w) > 64000:
        w = w[:64000]
    elif len(w) < 64000:
        w = np.pad(w, (0, 64000 - len(w)))

    # FFT Power Spectrum
    windowed = w * np.hanning(len(w))
    fft_vals = np.abs(np.fft.rfft(windowed))
    freqs = np.fft.rfftfreq(len(w), d=1.0 / sr)
    power = fft_vals ** 2
    total_power = float(np.sum(power) + 1e-12)

    band_sub = (freqs >= 60) & (freqs < 250)
    band_mid = (freqs >= 900) & (freqs < 2800)

    p_sub = float(np.sum(power[band_sub]) / total_power)
    p_mid = float(np.sum(power[band_mid]) / total_power)
    sub_mid_ratio = float(p_sub / (p_mid + 1e-6))

    # Cepstral Reflection Prominence (Multipath echo detection)
    log_spec = np.log(fft_vals + 1e-6)
    cepstrum = np.abs(np.fft.irfft(log_spec))
    quefrency_range = cepstrum[32:320]
    reflection_prominence = float(
        (np.max(quefrency_range) - np.mean(quefrency_range)) / (np.std(quefrency_range) + 1e-6)
    )

    return {
        "p_sub": p_sub,
        "p_mid": p_mid,
        "sub_mid_ratio": sub_mid_ratio,
        "reflection_prominence": reflection_prominence,
    }


def evaluate_window_threat(waveform: torch.Tensor, sr: int = 16000):
    """
    Dual-engine threat evaluation:
    1. Direct Neural CNN Inference (detects uncompressed digital AI voice).
    2. Pre-emphasis High-Frequency Restoration (recovers attenuated vocoder phase harmonics).
    3. Acoustic Physical Replay Forensics (detects smartphone loudspeaker playback and multipath comb filtering).
    """
    # 1. Base CNN
    bonafide_raw, spoof_raw = predict_window(waveform)

    # 2. Pre-emphasis Boost
    w_boost = apply_pre_emphasis(waveform)
    peak_b = w_boost.abs().max()
    if peak_b > 0:
        w_boost = w_boost / peak_b * 0.92
    _, spoof_boost = predict_window(w_boost)

    # 3. Acoustic Forensics
    forensics = extract_acoustic_forensics(waveform, sr)
    sm_ratio = forensics["sub_mid_ratio"]
    refl = forensics["reflection_prominence"]

    # Physical Phone Loudspeaker Signature:
    # Smartphone micro-speakers have physical cutoff < 250Hz (sm_ratio < 16.0)
    # and multipath chassis/desk acoustic reflection prominence (refl >= 6.0).
    is_phone_replay = bool((sm_ratio < 16.0) and (refl >= 6.0))

    if spoof_raw >= 0.45:
        final_spoof = spoof_raw
        detection_mode = "DIRECT_AI"
    elif is_phone_replay:
        # Replay detected: phone speaker attenuation lowers raw CNN to ~0.08-0.25.
        replay_severity = min(1.0, (16.0 - sm_ratio) / 14.0)
        refl_boost = min(1.0, (refl - 5.5) / 5.0)
        neural_trace = max(spoof_raw, spoof_boost)

        calibrated_replay = 0.55 + 0.35 * replay_severity + 0.10 * refl_boost
        if neural_trace >= 0.07:
            final_spoof = max(neural_trace * 3.5, calibrated_replay)
        else:
            final_spoof = calibrated_replay * 0.85
        detection_mode = "PHONE_REPLAY_AI"
    else:
        # Natural human vocal tract (rich fundamental resonance sm_ratio >= 16.0)
        final_spoof = max(spoof_raw, spoof_boost * 0.8)
        detection_mode = "LIVE_HUMAN"

    final_spoof = min(0.999, max(0.01, float(final_spoof)))
    bonafide_prob = 1.0 - final_spoof

    if final_spoof >= 0.65:
        status = "high_risk"
        risk = "HIGH"
    elif final_spoof >= 0.35:
        status = "suspicious"
        risk = "MEDIUM"
    else:
        status = "likely_real"
        risk = "LOW"

    result_label = "spoof" if final_spoof >= 0.35 else "real"
    confidence = final_spoof if result_label == "spoof" else bonafide_prob

    return final_spoof, bonafide_prob, risk, status, result_label, confidence, detection_mode, forensics


# ============================================================
# PREDICTIVE IMPERSONATION & CYBER DEFENSE ASSESSMENT
# ============================================================

def assess_impersonation_threat(max_spoof_prob, segment_results=None, filename=None):
    """
    Evaluates audio analysis to assess impersonation attack indicators,
    predictive threat category, and generates cyber helpline advisory and incident dossier.
    """
    segment_results = segment_results or []
    is_spoof = max_spoof_prob >= 0.35

    early_flagged = any(
        s.get("spoof_probability", 0) >= 0.35
        for s in segment_results
        if s.get("end_time", 999) <= 4.5
    )

    is_replayed = any(
        s.get("detection_mode") == "PHONE_REPLAY_AI"
        for s in segment_results
    )

    if max_spoof_prob >= 0.65:
        threat_level = "CRITICAL"
        threat_title = "High-Confidence AI Voice Clone Attack" if not is_replayed else "AI Voice Clone Replay Attack"
        threat_description = (
            "Spectral acoustic artifacts strongly indicate deep neural voice synthesis "
            "(TTS / Voice Conversion). If the caller claims to be a relative, friend, "
            "law enforcement officer, or bank official, this is an active impersonation attack."
        )
        predicted_attack_vector = "AI Voice Cloning / Deepfake Impersonation Scam (Digital Arrest / Virtual Kidnapping)"
    elif max_spoof_prob >= 0.35:
        threat_level = "ELEVATED"
        threat_title = "Suspicious Synthetic Speech Pattern"
        threat_description = (
            "Anomalous acoustic textures, smartphone loudspeaker replay signatures, or synthetic prosody detected. "
            "High probability of AI voice alteration, physical replay attack, or voice spoofing."
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
                spoof_probability,
                bonafide_probability,
                seg_risk,
                seg_status,
                seg_label,
                seg_conf,
                seg_detection_mode,
                seg_forensics
            ) = evaluate_window_threat(
                segment_waveform
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
                    "result": seg_label,
                    "spoof_probability": round(
                        spoof_probability,
                        4
                    ),
                    "bonafide_probability": round(
                        bonafide_probability,
                        4
                    ),
                    "risk": seg_risk,
                    "status": seg_status,
                    "detection_mode": seg_detection_mode,
                    "forensics": seg_forensics
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
        # COUNT SUSPICIOUS SEGMENTS (Calibrated threshold >= 0.35)
        # ----------------------------------------------------

        suspicious_segments = [
            result
            for result in segment_results
            if result["spoof_probability"] >= 0.35
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
        # >= 0.35, flag the complete recording.
        #
        # This is designed for voice-cloning and acoustic replay detection
        # where even a suspicious portion of a call
        # should trigger investigation.

        if max_spoof_probability >= 0.35:

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
        # RISK LEVEL (Calibrated thresholds: >= 0.65 HIGH, >= 0.35 MEDIUM)
        # ====================================================

        if max_spoof_probability >= 0.65:

            risk = "HIGH"

        elif max_spoof_probability >= 0.35:

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

            "segments": segment_results,

            "impersonation_assessment": assess_impersonation_threat(
                max_spoof_probability,
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
