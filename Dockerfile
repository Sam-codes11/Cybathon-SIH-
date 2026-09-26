# VoiceGuard Enterprise Backend Dockerfile
FROM python:3.11-slim

# Install system audio dependencies (ffmpeg, libsndfile) and compilation tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install CPU PyTorch first to optimize image size and prevent CUDA bloat on cloud hosts
RUN pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# Install application python dependencies
COPY Backend/requirements.txt /app/Backend/requirements.txt
RUN pip install --no-cache-dir -r /app/Backend/requirements.txt

# Copy backend application source and models
COPY Backend /app/Backend
COPY models /app/models

WORKDIR /app/Backend

ENV PYTHONUNBUFFERED=1
ENV PORT=8000
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
