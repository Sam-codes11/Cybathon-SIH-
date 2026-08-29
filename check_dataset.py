from pathlib import Path

# Your ASVspoof train audio
AUDIO_DIR = Path(
    r"C:\Users\Rishita Samanta\Downloads\flac-20260829T073608Z-1-001\flac"
)

# Your train protocol
PROTOCOL_FILE = Path(
    "data/ASVspoof2019.LA.cm.train.trn.txt"
)

print("Checking dataset...")
print("Audio folder:", AUDIO_DIR)
print("Protocol:", PROTOCOL_FILE)

# Check folders/files exist
if not AUDIO_DIR.exists():
    print("\nERROR: Audio folder not found!")
    exit()

if not PROTOCOL_FILE.exists():
    print("\nERROR: Protocol file not found!")
    exit()

# Count audio files
audio_files = list(AUDIO_DIR.glob("*.flac"))

print(f"\nFLAC files found: {len(audio_files)}")

# Create quick lookup
audio_names = {f.stem for f in audio_files}

# Read protocol
with open(PROTOCOL_FILE, "r", encoding="utf-8") as f:
    lines = [line.strip() for line in f if line.strip()]

print(f"Protocol entries: {len(lines)}")

# Check first 20
found = 0
missing = 0

print("\nChecking first 20 entries:\n")

for line in lines[:20]:
    parts = line.split()

    audio_id = parts[1]
    label = parts[-1]

    if audio_id in audio_names:
        print(f"FOUND   {audio_id}.flac   -> {label}")
        found += 1
    else:
        print(f"MISSING {audio_id}.flac   -> {label}")
        missing += 1

print("\n-----------------------------")
print("Found:", found)
print("Missing:", missing)
print("-----------------------------")