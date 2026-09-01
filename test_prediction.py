from pathlib import Path
from Backend.prediction_service import predict_audio


# ============================================================
# PATHS
# ============================================================

EVAL_AUDIO_DIR = Path(
    r"C:\Users\Rishita Samanta\Downloads\LA\ASVspoof2019_LA_eval\flac"
)

EVAL_PROTOCOL = Path(
    r"data\ASVspoof2019.LA.cm.eval.trl.txt"
)


# ============================================================
# FIND ONE REAL + ONE SPOOF SAMPLE
# ============================================================

real_file = None
spoof_file = None

with open(
    EVAL_PROTOCOL,
    "r",
    encoding="utf-8"
) as f:

    for line in f:

        parts = line.strip().split()

        if len(parts) < 5:
            continue

        audio_id = parts[1]
        label = parts[-1]

        audio_path = (
            EVAL_AUDIO_DIR /
            f"{audio_id}.flac"
        )

        if not audio_path.exists():
            continue

        if label == "bonafide" and real_file is None:

            real_file = audio_path

        elif label != "bonafide" and spoof_file is None:

            spoof_file = audio_path

        if real_file and spoof_file:
            break


# ============================================================
# TEST FUNCTION
# ============================================================

def test_file(audio_path, expected):

    print("\n" + "=" * 60)
    print("TESTING:", audio_path.name)
    print("EXPECTED:", expected)
    print("=" * 60)

    class TestFile:

        def __init__(self, path):

            self.filename = path.name
            self.file = open(
                path,
                "rb"
            )

    test_audio = TestFile(
        audio_path
    )

    result = predict_audio(
        test_audio
    )

    test_audio.file.close()

    print("\nMODEL RESULT:")

    for key, value in result.items():

        print(
            f"{key}: {value}"
        )


# ============================================================
# RUN TESTS
# ============================================================

if real_file is None:

    print(
        "Could not find a bonafide sample."
    )

else:

    test_file(
        real_file,
        "REAL / BONAFIDE"
    )


if spoof_file is None:

    print(
        "Could not find a spoof sample."
    )

else:

    test_file(
        spoof_file,
        "AI / SPOOF"
    )