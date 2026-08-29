from fastapi import FastAPI, WebSocket
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

@app.websocket("/audio-stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        data = await websocket.receive_bytes()
        # Process and handle audio streaming data here
        await websocket.send_text("Audio chunk received")

@app.get("/")
def home():
    return {"message": "Backend is running"}
