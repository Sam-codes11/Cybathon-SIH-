from fastapi import APIRouter, UploadFile, File
from prediction_service import predict_audio

router = APIRouter()

@router.post("/analyze")
async def analyze_audio(file: UploadFile = File(...)):
    result = predict_audio(file)
    return result