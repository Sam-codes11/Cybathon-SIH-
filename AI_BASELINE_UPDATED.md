# AI Baseline — Whole-Audio Spoof Detection

## Overview

Voice Shield uses a CNN-based audio spoof detection model trained on the ASVspoof2019 LA dataset.

The evaluation pipeline was improved from evaluating only a fixed 4-second portion of each audio file to analyzing the **complete audio using overlapping 4-second windows**.

For each window, the model produces a spoof probability. The final audio-level prediction is based on the most suspicious window.

---

## Dataset Evaluation

**Dataset:** ASVspoof2019 LA Evaluation Set

**Total usable files:** 71,237

### Results

| Metric    |     Result |
| --------- | ---------: |
| Accuracy  | **83.62%** |
| Precision | **90.46%** |
| Recall    | **91.37%** |
| F1 Score  | **90.91%** |

### Confusion Matrix

|                 | Predicted Bonafide | Predicted Spoof |
| --------------- | -----------------: | --------------: |
| Actual Bonafide |         1,197 (TN) |      6,158 (FP) |
| Actual Spoof    |         5,513 (FN) |     58,369 (TP) |

---

## Improvement Over Previous Evaluation

The previous evaluation analyzed only a fixed 4-second portion of each audio file.

| Metric          | Previous | Whole-Audio |                  Improvement |
| --------------- | -------: | ----------: | ---------------------------: |
| Recall          |   76.88% |  **91.37%** | **+14.49 percentage points** |
| F1              |   86.73% |  **90.91%** |             **+4.18 points** |
| Accuracy        |   78.90% |  **83.62%** |             **+4.72 points** |
| False Negatives |   14,768 |   **5,513** |              **9,255 fewer** |

The whole-audio approach substantially reduces missed spoof samples.

---

## Whole-Audio Inference Strategy

Each audio file is divided into overlapping windows:

* Window length: **4 seconds**
* Hop length: **2 seconds**
* Overlap: **2 seconds**

Example for a 7-second recording:

```text
0s ───────── 4s
      2s ───────── 6s
            4s ───────── 7s
                  6s ───── 7s
```

Each segment is independently classified.

The final audio-level spoof probability is determined by the **maximum spoof probability across the analyzed segments**.

This allows the system to detect suspicious content occurring anywhere in the recording instead of relying only on its first few seconds.

---

## Threshold Analysis

| Threshold | Precision |     Recall |         F1 |
| --------: | --------: | ---------: | ---------: |
|      0.50 |    90.46% |     91.37% |     90.91% |
|      0.40 |    90.17% |     92.44% |     91.29% |
|      0.30 |    89.94% |     93.39% |     91.63% |
|      0.25 |    89.84% |     93.91% |     91.83% |
|      0.20 |    89.78% |     94.42% |     92.04% |
|      0.15 |    89.71% |     94.97% |     92.27% |
|      0.10 |    89.63% | **95.69%** | **92.56%** |

The default operating threshold remains **0.50** until real-world microphone and robustness testing is completed.

---

## Important Limitation

These results are based on the **ASVspoof2019 evaluation dataset**.

The model has not yet been specifically trained or fine-tuned on real-world microphone recordings.

Therefore, these results establish the model's performance on the benchmark dataset but do not yet represent real-world microphone performance.

The next validation stage is:

```text
ASVspoof Benchmark
        ↓
Real Human Voice
        ↓
Consented Cloned Voice
        ↓
Noisy / Compressed / Re-recorded Audio
        ↓
Robustness Evaluation
```

---

## Current AI Baseline

**Baseline Recall: 91.37%**

**Baseline F1: 90.91%**

**Baseline Accuracy: 83.62%**

**Baseline Precision: 90.46%**

The whole-audio inference strategy is now established as the current AI baseline for subsequent real-world and robustness experiments.
