# AI Voice Spoof Detection — Baseline

## Current Model

* Model: SpoofCNN
* Dataset: ASVspoof2019 LA
* Input: Log-magnitude STFT
* Sample rate: 16 kHz
* Processing window: 4 seconds
* Device tested: NVIDIA RTX 3050 Laptop GPU

## Current Evaluation

| Metric    | Result |
| --------- | -----: |
| Accuracy  | 78.90% |
| Precision | 99.46% |
| Recall    | 76.88% |
| F1 Score  | 86.73% |

### Confusion Matrix

|                 | Predicted Bonafide | Predicted Spoof |
| --------------- | -----------------: | --------------: |
| Actual Bonafide |              7,090 |             265 |
| Actual Spoof    |             14,768 |          49,114 |

## Current Status

* [x] CNN trained
* [x] Model checkpoint integrated
* [x] Backend prediction service integrated
* [x] GPU inference verified
* [x] ASVspoof2019 evaluation completed
* [ ] Real-world phone audio testing
* [ ] Input preprocessing for arbitrary audio formats
* [ ] Real voice vs cloned voice testing
* [ ] Telephony/degraded audio testing
* [ ] Final frontend-backend-AI integration

## Next AI Milestone

Test the complete prediction pipeline using ordinary phone-recorded human speech before beginning cloned-voice testing.

This will verify that the inference pipeline is not dependent on ASVspoof-specific audio formatting.
