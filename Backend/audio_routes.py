from fastapi import APIRouter, UploadFile, File
from prediction_service import predict_audio
from pydub import AudioSegment
import tempfile
import os
import soundfile as sf

router = APIRouter()

@router.post("/analyze")
async def analyze_audio(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_webm:
        temp_webm.write(await file.read())
        webm_path = temp_webm.name

    wav_path = webm_path.replace(".webm", ".wav")
    audio = AudioSegment.from_file(webm_path)
    audio = audio.set_frame_rate(16000).set_channels(1)
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

    print(
        f"\n[UPLOAD] File: {file.filename} | Spoof: {result.get('spoof_probability', 0)*100:.1f}% | "
        f"Risk: {result.get('risk')} | Result: {result.get('result')} | Mode: {result.get('threat_classification', {}).get('predicted_attack_vector')}",
        flush=True
    )

    os.remove(webm_path)
    os.remove(wav_path)

    return result