from fastapi import FastAPI
from audio_routes import router as audio_router

app=FastAPI()
app.include_router(audio_router)

@app.get("/")
def home():
    return {"message": "Backend is Running"}