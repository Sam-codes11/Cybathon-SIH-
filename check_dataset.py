from pathlib import Path

data_folder = Path("data")

print("DATA FOLDER:")
for item in data_folder.iterdir():
    print(" -", item)