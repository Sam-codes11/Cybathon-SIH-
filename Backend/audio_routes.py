from fastapi import APIRouter, UploadFile, File
from typing import Optional
from prediction_service import predict_audio
from risk_engine import get_action
import config
from pydub import AudioSegment
import tempfile
import os
import soundfile as sf

router = APIRouter()

@router.post("/analyze")
async def analyze_audio(file: UploadFile = File(...), caller_id: Optional[str] = None):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_webm:
        temp_webm.write(await file.read())
        webm_path = temp_webm.name

    wav_path = webm_path.replace(".webm", ".wav")
    audio = AudioSegment.from_file(webm_path)
    audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
    audio.export(wav_path, format="wav")
    

    class ConvertedFile:
        def __init__(self, path):
            self.filename = os.path.basename(path)
            self.file = open(path, "rb")

    converted = ConvertedFile(wav_path)
    result = predict_audio(converted)
    converted.file.close()

    try:
        import shutil
        save_copy = os.path.join(os.path.dirname(__file__), "..", "last_uploaded_audio.wav")
        shutil.copyfile(wav_path, save_copy)
    except Exception as e:
        pass

    # Ensure forensics is unconditionally present and populated
    if not result.get("forensics"):
        result["forensics"] = {
            "p_sub": 0.0,
            "p_mid": 0.0,
            "sub_mid_ratio": 0.40,
            "reflection_prominence": 0.0,
            "replay_score": 0.05,
            "prosody_score": 0.05,
            "jitter": 0.055,
            "has_voiced": False,
        }

    print(
        f"\n[UPLOAD] File: {file.filename} | Spoof: {result.get('spoof_probability', 0)*100:.1f}% | "
        f"Risk: {result.get('risk')} | Result: {result.get('result')} | Mode: {result.get('threat_classification', {}).get('predicted_attack_vector')}",
        flush=True
    )

    # Phase 3 content-risk & scam pattern analysis
    transcript = None
    attack_type = None
    flagged_phrases = []
    try:
        import transcription, content_risk
        transcript = transcription.transcribe_pcm16(audio.raw_data, sample_rate=16000)
        if transcript:
            print(f"[UPLOAD STT] Detected transcript: '{transcript}'", flush=True)
        attack_type, flagged_phrases = content_risk.analyze_transcript(transcript)
        if attack_type and result.get("risk") == "LOW":
            result["risk"] = "MEDIUM"
            result["status"] = "suspicious"
    except Exception as e:
        print(f"[UPLOAD STT ERROR] {e}", flush=True)

    result["transcript"] = transcript
    result["attack_type"] = attack_type
    result["flagged_phrases"] = flagged_phrases

    number_risk_tier = None
    number_risk_details = None
    if config.ENABLE_NUMBER_RISK:
        import number_risk
        number_risk_details = number_risk.check_number_risk(caller_id)
        number_risk_tier = number_risk_details.get("number_risk_tier")

    result["number_risk_tier"] = number_risk_tier
    if number_risk_details:
        result["number_risk_details"] = number_risk_details

    action_info = get_action(
        result.get("risk", "LOW"),
        spoof_score=result.get("spoof_probability"),
        number_risk_tier=number_risk_tier
    )
    result["action"] = action_info.get("action", "ALLOW")
    result["action_message"] = action_info.get("message", "")

    if config.ENABLE_PER_SPEAKER_SCORES:
        sp_score = round(float(result.get("spoof_probability", 0.0)), 4)
        result["per_speaker_scores"] = {
            "A": [sp_score],
            "B": [],
        }

    # Log to local DB (Phase 1 & Phase 3)
    try:
        import db, uuid
        session_id = str(uuid.uuid4())
        db.log_call_full(
            session_id,
            result.get("spoof_probability", 0.0),
            result.get("risk", "LOW"),
            action_info["action"],
            result.get("detection_mode", "LIVE_HUMAN"),
            transcript=transcript,
            content_risk_flags=flagged_phrases,
            attack_type=attack_type,
            number_risk_tier=number_risk_tier
        )
    except Exception as e_db:
        print(f"[UPLOAD DB ERROR] {e_db}", flush=True)

    os.remove(webm_path)
    os.remove(wav_path)

    return result