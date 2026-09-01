from fastapi import APIRouter, UploadFile, File
from .prediction_service import predict_audio
from pydub import AudioSegment
import tempfile
import os

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

    os.remove(webm_path)
    os.remove(wav_path)

    return result