import os
import glob
import subprocess
from pathlib import Path

FFMPEG = r"C:\Users\Rishita Samanta\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg.Shared_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.1-full_build-shared\bin\ffmpeg.exe"
BASE_DIR = Path(r"C:\Users\Rishita Samanta\Desktop\Cybathon-SIH-")
REAL_OUT = BASE_DIR / "data" / "custom_dataset" / "real"
FAKE_OUT = BASE_DIR / "data" / "custom_dataset" / "fake"

REAL_OUT.mkdir(parents=True, exist_ok=True)
FAKE_OUT.mkdir(parents=True, exist_ok=True)

def convert_to_16k_mono(input_path, output_path):
    cmd = [
        FFMPEG, "-y", "-i", str(input_path),
        "-ar", "16000", "-ac", "1",
        "-c:a", "pcm_s16le",
        str(output_path)
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

real_candidates = [
    r"C:\Voice_shield\voice_cloning\reference_normalized.wav",
    r"C:\Voice_shield\voice_cloning\Studio_ref.wav",
    r"C:\Voice_shield\voice_cloning\priya2.opus",
    r"C:\Voice_shield\voice_cloning\priya3.opus",
    r"C:\Users\Rishita Samanta\Downloads\Mobile Devices\priya1.opus",
    r"C:\Voice_shield\voice_cloning\Isha1.mp3",
    r"C:\Voice_shield\voice_cloning\Isha2.mp3",
    r"C:\Voice_shield\voice_cloning\Isha3.mp3",
    r"C:\Users\Rishita Samanta\Downloads\Mobile Devices\s1con.opus",
    r"C:\Users\Rishita Samanta\Downloads\Mobile Devices\s2cras.opus",
    r"C:\Users\Rishita Samanta\Downloads\Mobile Devices\s3ml.opus",
    r"C:\Users\Rishita Samanta\Downloads\Mobile Devices\subs1consent.opus",
    r"C:\Users\Rishita Samanta\Downloads\Mobile Devices\subs2ml.opus",
    r"C:\Users\Rishita Samanta\Downloads\Mobile Devices\subs3sr.opus"
]

print("=== CONVERTING REAL SAMPLES (16kHz Mono) ===")
real_count = 0
for path_str in real_candidates:
    p = Path(path_str)
    if p.exists():
        out_file = REAL_OUT / f"real_{p.stem}.wav"
        try:
            convert_to_16k_mono(p, out_file)
            print(f"[REAL] {p.name} -> {out_file.name}")
            real_count += 1
        except Exception as e:
            print(f"[ERROR] {p.name}: {e}")

fake_dir = Path(r"C:\Voice_shield\voice_cloning\generated")
fake_files = [
    "test_C.wav",
    "shield_sample_2.wav",
    "clone_priya_perfect_fix.wav",
    "clone_priya2_natural.wav",
    "clone_priya3_biryani_fixed.wav",
    "clone_isha2_complete.wav",
    "clone_isha3_test.wav",
    "clone_s1con_shield.wav",
    "clone_subs1_dollars_complete.wav",
    "clone_subs3_urgent_money.wav",
    "clone_s2cras_emergency.wav",
    "clone_s3ml_human.wav"
]

print("\n=== CONVERTING FAKE / CLONED SAMPLES (16kHz Mono) ===")
fake_count = 0
for name in fake_files:
    p = fake_dir / name
    if p.exists():
        out_file = FAKE_OUT / f"fake_{p.stem}.wav"
        try:
            convert_to_16k_mono(p, out_file)
            print(f"[FAKE] {p.name} -> {out_file.name}")
            fake_count += 1
        except Exception as e:
            print(f"[ERROR] {p.name}: {e}")

print("\n" + "="*50)
print(f"DATASET READY: {real_count} Real Files, {fake_count} Fake Files")
print(f"Real folder: {REAL_OUT}")
print(f"Fake folder: {FAKE_OUT}")
print("="*50)
