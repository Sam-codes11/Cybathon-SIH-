from fastapi import FastAPI
from audio_routes import router as audio_router

app = FastAPI()

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(audio_router)

@app.get("/")
def home():
    return {"message": "Backend is running"}