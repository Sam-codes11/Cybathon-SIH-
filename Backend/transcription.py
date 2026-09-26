import json
from pathlib import Path
from vosk import Model, KaldiRecognizer

VOSK_MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "vosk-model"
_model = None


def get_model():
    global _model
    if _model is None:
        if not VOSK_MODEL_PATH.exists():
            raise FileNotFoundError(f"Vosk model not found at {VOSK_MODEL_PATH} -- download it first")
        _model = Model(str(VOSK_MODEL_PATH))
    return _model


def transcribe_pcm16(audio_bytes: bytes, sample_rate: int = 16000) -> str:
    """audio_bytes must be raw 16-bit PCM mono at sample_rate."""
    if not audio_bytes:
        return ""
    try:
        rec = KaldiRecognizer(get_model(), sample_rate)
        rec.AcceptWaveform(audio_bytes)
        result = json.loads(rec.FinalResult())
        return result.get("text", "")
    except Exception as e:
        print(f"[TRANSCRIPTION ERROR] {e}", flush=True)
        return ""
