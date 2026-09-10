<div align="center">

# 🛡️ Voice Shield
### Real-Time AI Voice Clone & Impersonation Attack Defense System
**Built for Smart India Hackathon (SIH)**

[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.1+-EE4C2C?logo=pytorch&logoColor=white)](https://pytorch.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Model Recall](https://img.shields.io/badge/Model_Recall-91.37%25-success)](./AI_BASELINE_UPDATED.md)

*An active, predictive cyber-defense system that detects AI voice clones within the first 4 seconds of a call, prevents impersonation extortion, and integrates directly with India's National Cyber Helpline (1930).*

</div>

---

## 📌 Problem Statement & The Critical Industry Gap

Recent advancements in generative audio and diffusion models have made realistic voice cloning accessible to cybercriminals using as little as **3 to 5 seconds of reference audio** scraped from social media (reels, YouTube, podcasts).

Criminal syndicates across India and globally exploit this technology to execute high-damage extortion schemes:
- **"Digital Arrest" Scams:** Scammers clone voices of police commissioners, CBI officers, or customs officials to intimidate victims into transferring funds.
- **Virtual Kidnapping & Emergency Scams:** Callers impersonate children or parents claiming to be in an accident or under arrest, demanding urgent UPI ransoms.
- **Corporate CEO Fraud:** Cloned voices of senior executives ordering urgent wire transfers.

### ⚠️ Why Existing Solutions Fail
Current commercial detectors and research tools operate as **passive classifiers**:
1. **Passive Percentages:** They output numbers like *"AI Probability: 88%"* after an audio file is uploaded or after the call has already finished.
2. **Zero Scam Context:** They do not differentiate between harmless automated robocalls and dangerous targeted impersonation of family members.
3. **No Victim Guidance:** Panicked victims under high psychological pressure are left alone with no idea of what immediate defensive actions to take.

---

## 🚀 Key Innovations in Voice Shield

Voice Shield transforms voice spoof detection from a passive test into an **active, real-time incident defense platform**:

### 1. ⚡ 4-Second Early Interception Engine
- Evaluates incoming audio streams using overlapping sliding STFT windows (4s window / 2s hop).
- An early-peek mechanism analyzes the first **2 to 4 seconds** of speech.
- If synthetic markers or anomalous phase dynamics are detected within the first 4 seconds, an emergency interceptor alert triggers immediately before the victim can be socially engineered.

### 2. 🔍 Contextual Impersonation Attack Diagnosis
- When synthetic audio is flagged, Voice Shield presents an interactive identity check:
  > *"Do you personally know this caller? Are they claiming to be a family member, police, or bank manager?"*
- **Known Caller Claim:** Instantly flags the call as an **Active AI Impersonation Attack (Digital Arrest / Virtual Kidnapping)**.
- **Unknown Caller:** Categorizes the threat as an **Automated Synthetic Spam / Robocall**.

### 3. 🛑 Active Call Mitigation Control
- **"Cut the Call Immediately" (Recommended):** Safely terminates the audio connection, halts the conversation, and takes the victim to the emergency incident response hub.
- **"Continue Call with Caution & Verification Challenge":** Keeps streaming while overlaying a real-time challenge script for the user (e.g. asking for a family secret safe-word, refusing OTP/UPI transfers, demanding an out-of-band callback).

### 4. 🇮🇳 National Cyber Helpline & Government Portal Integration
- **Direct 1-Tap Dial 1930:** Connects immediately to the **Citizen Financial Cyber Fraud Reporting System** (Ministry of Home Affairs, Govt. of India).
- **Golden Hour Rule Protection:** Prominently guides victims to call 1930 within the first 1–2 hours to initiate an immediate inter-bank freeze before stolen funds are withdrawn.
- **Direct Portal Links:** Integrated one-click links to [cybercrime.gov.in](https://cybercrime.gov.in) and Department of Telecommunications (DoT) [Chakshu / Sanchar Saathi](https://sancharsaathi.gov.in/sfc/).
- **1-Click Legal Incident Dossier Generator:** Formats a forensic report (timestamps, spoof confidence, acoustic indicators, IT Act Section 66D references) ready to paste into police FIRs or cybercrime complaints.

---

## 🏗️ System Architecture

```
[ Incoming Audio / Microphone Stream (16 kHz PCM) ]
                       │
                       ▼
       [ WebSocket Streaming: /audio-stream ]
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
 [ 2s Early Peek ]             [ 4s Sliding Windows (2s Hop) ]
       │                               │
       └───────────────┬───────────────┘
                       ▼
            [ STFT Feature Extraction ]
            - Hann window: 1024
            - Hop length: 512
            - Log magnitude spectrogram
                       │
                       ▼
       [ Deep SpoofCNN Inference (GPU/CUDA) ]
       - 2D Convolutional Layers + BatchNorm + ReLU
       - Adaptive Average Pooling + Dropout Classifier
                       │
                       ▼
    [ Real-Time Spoof Probability: P(spoof) ]
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
 P(spoof) < 0.50                 P(spoof) >= 0.50
 (Natural Voice)                 (Synthetic Voice Flagged)
                                       │
                      ┌────────────────┴────────────────┐
                      ▼                                 ▼
              Within First 4s                     After 4s Window
                      │                                 │
                      ▼                                 ▼
         [ 4s Early Interceptor Modal ]         [ High-Risk Report ]
         - "Do you know this person?"                   │
         - Cut Call vs Continue                         ▼
         - 1930 Helpline Dial           [ Predictive Response Hub ]
                                        - Step-by-Step Playbook
                                        - 1930 Golden Hour Freeze
                                        - 1-Click Incident Dossier
```

---

## 📊 Model Performance & Benchmarks

The core detection engine was evaluated on the gold-standard **ASVspoof 2019 Logical Access (LA)** evaluation benchmark:

| Metric | Whole-Audio Sliding Window (Voice Shield) | Previous Fixed 4s Baseline | Net Improvement |
|:---|:---:|:---:|:---:|
| **Recall** | **91.37%** | 76.88% | **+14.49%** |
| **F1 Score** | **90.91%** | 86.73% | **+4.18%** |
| **Precision** | **90.46%** | 89.12% | **+1.34%** |
| **Accuracy** | **83.62%** | 78.90% | **+4.72%** |
| **False Negatives** | **5,513** | 14,768 | **9,255 fewer missed spoof calls** |

*Evaluation conducted across 71,237 audio files from the ASVspoof 2019 LA evaluation dataset.*

---

## 📁 Repository Structure

```
Cybathon-SIH-/
├── Backend/
│   ├── main.py                     # FastAPI app with WebSocket audio streaming & 4s flags
│   ├── prediction_service.py       # SpoofCNN model, STFT pipeline & impersonation threat assessment
│   ├── audio_routes.py             # REST endpoints for audio file upload & analysis
│   └── requirements.txt            # Backend Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ImpersonationAlertModal.jsx # 4s early interception modal & helpline triggers
│   │   │   ├── Navbar.jsx                  # Header navigation
│   │   │   ├── WaveformVerdict.jsx         # Dynamic audio waveform visualization
│   │   │   ├── WavyBackground.jsx          # Ambient canvas animation
│   │   │   └── Toast.jsx                   # Notification toast for clipboard actions
│   │   ├── pages/
│   │   │   ├── Home.jsx                    # Landing page with SIH problem overview
│   │   │   ├── Analyzing.jsx               # Real-time WebSocket streaming & 4s interceptor
│   │   │   ├── Result.jsx                  # Predictive response playbook & 1930 helpline hub
│   │   │   ├── Dashboard.jsx               # Call logs & demo activity
│   │   │   └── CallDetail.jsx              # Single call forensics & cybercrime escalation
│   │   ├── App.jsx                         # React Router configuration
│   │   └── main.jsx                        # React entry point
│   ├── package.json                        # Frontend dependencies (React 19, Vite, Tailwind)
│   └── vite.config.js                      # Vite bundler configuration
├── models/
│   ├── spoof_cnn_best.pth                  # Base trained SpoofCNN checkpoint
│   └── spoof_cnn_finetuned.pth             # Fine-tuned high-accuracy model checkpoint
├── AI_BASELINE_UPDATED.md                  # Comprehensive ASVspoof benchmark results
├── CUSTOM_EVALUATION_REPORT.md             # Custom dataset evaluation report
└── README.md                               # Project documentation
```

---

## 🛠️ Quick Start Guide

### Prerequisites
- Python 3.10 or higher
- Node.js 18+ and npm
- (Optional) NVIDIA GPU with CUDA support for sub-millisecond inference

### 1. Backend Setup
```bash
# Navigate to the Backend directory
cd Backend

# Create & activate a virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install required dependencies
pip install -r requirements.txt

# Start the FastAPI server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
*The backend will start at `http://127.0.0.1:8000`.*

### 2. Frontend Setup
```bash
# In a new terminal, navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```
*The web interface will open at `http://localhost:5173`.*

---

## ⚖️ Legal & Statutory Alignment

Voice Shield assists law enforcement and citizens under relevant provisions of the **Information Technology Act, 2000** and the **Bharatiya Nyaya Sanhita (BNS)**:
- **Section 66D, IT Act:** Punishment for cheating by personation by using computer resource (up to 3 years imprisonment).
- **Section 66E / 43, IT Act:** Privacy violation and unauthorized computer access.
- **BNS Sections on Personation & Extortion:** Criminal impersonation to commit financial extortion.

---

## 👥 Smart India Hackathon Team

- **Project:** Voice Shield (AI Voice Authentication & Predictive Defense)
- **Problem Statement:** Real-Time AI Voice Cloning & Impersonation Attack Prevention
- **Focus Area:** Cyber Security, Citizen Protection & Law Enforcement Assistance

<div align="center">
  <sub>Built with ❤️ for a safer digital India 🇮🇳</sub>
</div>
