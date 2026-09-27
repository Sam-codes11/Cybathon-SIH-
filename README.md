# VoiceGuard: Real-Time AI Voice Clone and Impersonation Defense System

**Enterprise-Grade Acoustic Forensics, Threat Intelligence, and Incident Mitigation Platform**  
**Built for Smart India Hackathon (SIH)**  
**Problem Statement Alignment: AI-powered innovation that transforms technology through intelligent resource utilization and valuable insights.**

---

## 1. Executive Summary

VoiceGuard is an active, real-time cyber-defense system engineered to intercept generative AI voice clones, prevent telephonic impersonation scams, and protect citizens and financial institutions from automated extortion schemes.

Unlike legacy audio classifiers that provide passive probability scores after a phone call has concluded, VoiceGuard evaluates live audio streams within the first 2 to 4 seconds of speech. By combining a lightweight deep convolutional neural network with vocal-tract biomechanical DSP heuristics, physical loudspeaker transducer forensics, and localized speech-to-text pattern matching, VoiceGuard halts psychological coercion before financial loss occurs. The platform automates evidence collection, aligns with Indian statutory cyber-laws, and directly integrates with India's National Cyber Crime Helpline (1930).

---

## 2. Problem Statement and Critical Industry Gaps

### The Emerging Threat Landscape
Advancements in diffusion pipelines, variational autoencoders, and neural vocoders have reduced the reference audio threshold for high-fidelity voice cloning to just 3 to 5 seconds. Fraud syndicates harvest audio from public social media reels, YouTube shorts, and podcasts to execute targeted attacks:
- **Digital Arrest Scams**: Extortionists impersonate police commissioners, CBI officers, or customs officials over teleconference and phone lines, threatening arrest over fictitious courier shipments or money-laundering cases to demand urgent bank clearance deposits.
- **Virtual Kidnapping and Family Emergency Scams**: Attackers clone the voice of a child or family member claiming a life-threatening accident or police detainment, coercing relatives into instant UPI transfers.
- **Corporate Executive Impersonation (CEO Fraud)**: Synthesized executive voices target finance personnel during high-stress operational windows to authorize emergency wire disbursements.
- **Automated OTP and Credential Phishing**: Conversational bots mimic familiar banking representatives to solicit multi-factor authentication tokens.

### Critical Industry Gaps in Existing Defenses
1. **Passive and Retrospective Scoring**: Existing commercial and research models operate as offline post-processors. They output numbers (e.g., "Spoof Probability: 86%") only after an audio recording has completed, offering zero protection while the scam is actively unfolding.
2. **Absence of Scam Context**: Current tools treat voice cloning purely as an acoustic anomaly detection problem. They fail to correlate audio telemetry with conversational context, caller ID metadata, or social engineering intent.
3. **Lack of Incident Response Guidance**: Panicked victims under severe emotional and psychological duress are given no actionable defensive instructions during the call or within the critical initial Golden Hour when stolen funds can still be frozen in the inter-bank network.
4. **Prohibitive Compute Overhead**: State-of-the-art audio foundation models (such as multi-billion parameter transformers) demand substantial GPU memory and introduce latency unsuitable for real-time edge or telecom gateway processing.

---

## 3. The VoiceGuard Solution

VoiceGuard transforms voice spoof detection into an active, low-latency incident defense platform:

1. **4-Second Early Interception Engine**: Evaluates incoming audio streams using overlapping sliding Short-Time Fourier Transform (STFT) windows (4.0s window / 2.0s hop). A 2.0-second early-peek mechanism identifies synthetic acoustic markers within the opening seconds of a conversation, presenting an immediate warning before the victim is compromised.
2. **Contextual Impersonation Diagnosis**: Upon detecting synthetic audio, VoiceGuard correlates the threat with an interactive identity verification workflow ("Do you personally know this caller?"). Claims of authority or family distress are instantly flagged as targeted impersonation attacks rather than benign automated robocalls.
3. **Active Call Mitigation Control**:
   - **Immediate Call Termination**: Provides one-click controls to sever audio streams and transition the victim to an emergency playbook.
   - **Guided Verification Challenge**: Displays an interactive on-screen challenge script for the user (e.g., demanding a pre-agreed family safe-word, refusing instant UPI transactions, and enforcing an out-of-band verification callback).
4. **National Cyber Helpline (1930) Golden Hour Protocol**: Connects directly to India's Citizen Financial Cyber Fraud Reporting System (Ministry of Home Affairs), guiding victims through the emergency inter-bank freeze procedure.
5. **Automated Forensic Incident Dossier**: Generates a two-page, court-admissible PDF incident report incorporating spectrogram snapshots, acoustic biometrics, Vosk speech transcripts, and statutory references under Section 66D of the Information Technology Act, 2000.

---

## 4. Innovation and Problem Statement Alignment

VoiceGuard directly addresses the mandate: **"AI-powered innovation that transforms technology through intelligent resource utilization and valuable insights."**

### A. AI-Powered Innovation
- **Dual-Engine Calibrated Fusion**: Integrates a 2D Convolutional Neural Network (SpoofCNN) trained on spectrogram patterns with an independent biomechanical prosody analysis engine.
- **Physical Loudspeaker Transducer Detection**: Identifies physical hardware limitations inherent to smartphone and laptop speakers (acoustic high-pass roll-off below 220 Hz and chassis resonances between 1.2 kHz and 3.2 kHz), unmasking pre-recorded replay attacks even when synthetic vocoders generate near-flawless speech.
- **High-Frequency Pre-Emphasis Reconstruction**: Applies high-frequency pre-emphasis filtering ($y[t] = x[t] - 0.95 \times x[t-1]$) to unmask phase-discontinuity artifacts that are typically attenuated by room acoustics and consumer microphones.

### B. Intelligent Resource Utilization
- **Compact Neural Footprint**: Unlike large foundation models requiring gigabytes of VRAM, SpoofCNN comprises approximately 100,000 parameters across 3 convolutional stages, resulting in a model checkpoint of only ~416 KB.
- **Sub-Millisecond CPU Inference**: Operates efficiently on standard consumer-grade CPUs with sub-millisecond per-window execution times, eliminating the dependency on high-cost cloud GPUs.
- **Efficient Sliding-Window Scheduling**: The 4-second window with 2-second hop and 2-second early-peek terminates analysis as soon as a high-confidence threat is confirmed, conserving bandwidth and compute.
- **Offline, On-Device Speech Recognition**: Integrates an offline Vosk (Kaldi-based) speech recognition model executing locally. This removes third-party cloud transcription costs, eliminates external network latency, and preserves citizen privacy.
- **Heuristic Turn-Boundary Speaker Tracking**: Distinguishes conversational participants (Speaker Slot A / Slot B) using speech duty cycles and pause boundaries (~35ms compute per window) instead of resource-intensive deep neural diarization pipelines.
- **Container Footprint Optimization**: Uses multi-stage Docker builds with CPU-specific PyTorch wheels, keeping the backend container image under 800 MB (compared to 4+ GB for standard CUDA images).

### C. Valuable Insights
- **Granular Acoustic Forensics**: Provides transparent, explainable indicators including pitch jitter variance (vocal cord tremor), amplitude shimmer, fundamental frequency ($F_0$) dynamic range, and sub-to-mid frequency energy ratios.
- **Social Engineering Attack Categorization**: Extracts spoken phrases and categorizes attack vectors into Digital Arrest Scams, Authority Impersonation, Virtual Kidnapping, Financial Extortion, and Urgency Pressure via regex pattern matching.
- **Telecom Fraud Risk Intelligence (DoT / FRI)**: Cross-references caller ID strings against telecom fraud test blocklists, known international virtual spoofing prefixes (+92, +234, +880, +4470, +1876), and commercial 140-series prefixes.
- **Deterministic 4-Tier Policy Directives**: Maps complex mathematical probabilities into four clear, operational action tiers (ALLOW, VERIFY, ALERT, ESCALATE).
- **Legal and Evidentiary Enablement**: Formats telemetry into an exportable, two-page legal PDF dossier cited under Indian cyber law to expedite police FIR filings and bank disputes.

---

## 5. End-to-End System Architecture

[ Ingestion Tier: Microphone Stream (16 kHz PCM Mono) or File Upload (/analyze) ]
                                      │
                                      ▼
                      [ WebSocket Gateway: /audio-stream ]
                                      │
                      ┌───────────────┴───────────────┐
                      ▼                               ▼
               [ 2s Early-Peek ]              [ 4s Sliding Windows ]
                      │                       (50% Hop Overlap)
                      └───────────────┬───────────────┘
                                      ▼
            [ Stage 1: Digital Signal Processing & Feature Extraction ]
            ├── STFT Log-Magnitude Spectrogram (1024 FFT, 512 Hop, Hann)
            ├── Fast Bounded YIN Fundamental Frequency (F0: 65 - 500 Hz)
            ├── Biomechanical Micro-Jitter and Amplitude Shimmer
            └── Sub-Band Energy Ratio (70-220 Hz Sub vs 1200-3200 Hz Mid)
                                      │
                                      ▼
            [ Stage 2: Dual-Engine Neural & Acoustic Fusion Layer ]
            ├── Layer 1: SpoofCNN Inference (70% Spectral Weight)
            ├── Layer 2: Behavioral Prosody Dynamics (30% Weight)
            └── Layer 3: Physical Transducer Replay Gatekeeper
                                      │
                                      ▼
            [ Stage 3: Contextual Telemetry & Speech Intelligence ]
            ├── Turn-Boundary Attribution: Speaker Slot A / Slot B
            ├── Local Vosk Kaldi Speech-to-Text Transcription
            ├── Regex Social Engineering Attack Classifier
            └── Telecom Fraud Risk Intelligence (DoT / FRI Metadata)
                                      │
                                      ▼
            [ Stage 4: Four-Tier Policy Automation Engine ]
            ├── ALLOW    (Score < 0.50): Cleared human acoustics
            ├── VERIFY   (0.50 <= Score < 0.70): Suspicious pattern
            ├── ALERT    (0.70 <= Score < 0.85): High threat warning
            └── ESCALATE (Score >= 0.85 or Threat + Blocked Prefix):
                         Immediate call termination & 1930 dispatch
                                      │
                      ┌───────────────┴───────────────┐
                      ▼                               ▼
          [ Presentation Tier ]             [ Persistence & Compliance ]
          - React 19 / Vite UI              - SQLite Calls & Sessions DB
          - Live Canvas Spectrogram         - 10-Minute Repeated Scanner
          - 4s Early Interceptor Modal      - 2-Page Legal PDF Dossier
          - Guided Safe-Word Scripts        - IT Act Sec 66D Compliance
          - 1-Tap Dial 1930 Helpline        - OpenAPI 3.1 Swagger (/docs)


## 6. Machine Learning Pipeline, Acoustic Forensics, and Benchmark Performance

 SpoofCNN Architecture and Feature Extraction
The detection engine employs an ultra-compact 2D Convolutional Neural Network (`SpoofCNN`) designed specifically for spectrogram pattern classification. Operating on log-magnitude Short-Time Fourier Transform (STFT) spectrograms (1024-point FFT, 512 hop length, Hann window, 513 frequency bins), the model processes input tensors of shape `[Batch, 1, 513, 126]`:
- **Feature Extraction**: Three sequential 2D convolutional stages (`Conv2D` with kernel size 3 and padding 1 -> `BatchNorm2d` -> `ReLU` -> `MaxPool2d(2)`), scaling channel depth from 1 -> 32 -> 64 -> 128.
- **Pooling & Classification**: Adaptive Average Pooling `AdaptiveAvgPool2d((1, 1))` compresses spatial dimensions into a 128-dimensional latent vector, followed by a flattened dense classifier (`Linear(128 -> 64)` -> `ReLU` -> `Dropout(0.3)` -> `Linear(64 -> 2)`) emitting bonafide and spoof logits.
- **Model Efficiency**: Comprises only ~100,000 parameters with a checkpoint size of ~416 KB, executing in sub-milliseconds on consumer-grade CPUs.

 Dual-Engine Multimodal Fusion and Physical Replay Forensics
The final spoof determination fuses neural inference with digital signal processing heuristics and hardware acoustics:

$$\text{Fused Score} = (0.70 \times S_{\text{spectral}}) + (0.30 \times S_{\text{prosody}})$$

- **Spectral Layer ($S_{\text{spectral}}$)**: Peak-normalized CNN inference paired with high-frequency pre-emphasis filtering ($y[t] = x[t] - 0.95 \times x[t-1]$) to unmask vocoder phase-discontinuities attenuated by room acoustics.
- **Biomechanical Prosody Layer ($S_{\text{prosody}}$)**: Bounded YIN fundamental frequency estimation ($F_0 \in [65, 500]\text{ Hz}$), cycle-to-cycle micro-jitter, amplitude shimmer, and pause duration consistency (`pause_duration_std`). Biological vocal cords exhibit natural tremors ($0.006 \le \text{jitter} \le 0.030$), whereas neural text-to-speech models exhibit unnatural micro-jitter flatness ($< 0.004$).
- **Physical Loudspeaker Replay Engine**: Evaluates the sub-to-mid energy ratio ($E_{\text{sub}} / E_{\text{mid}}$) comparing sub-bass ($70\text{--}220\text{ Hz}$) against mid-range chassis resonance ($1200\text{--}3200\text{ Hz}$). Smartphone loudspeakers physically attenuate frequencies below 220 Hz by -18 dB/octave, exposing physical replay attacks even when synthetic vocoders mimic natural pitch.
- **Operating Modes**: Dynamically resolves calls into `DIRECT_AI`, `PHONE_REPLAY_AI` (elevating threat score to $\ge 0.74$), or verified `LIVE_HUMAN` (capping score at $\le 0.20$).

 Empirical Benchmarks (ASVspoof 2019 Logical Access)
Evaluated across 71,237 standardized test audio recordings from the ASVspoof 2019 LA evaluation benchmark:
- **Recall (Spoof Detection)**: 91.37% (a net improvement of +14.49 percentage points over the legacy fixed 4-second baseline).
- **F1 Score**: 90.91% (+4.18 point increase).
- **Precision**: 90.46% (+1.34 point increase).
- **Overall Accuracy**: 83.62% (+4.72 point increase).
- **False Negative Reduction**: Reduced missed spoof calls from 14,768 down to 5,513 (9,255 fewer missed attacks).
- **Operating Threshold**: Operating at a default threshold of $0.50$, with sensitivity tunable down to $0.10$ for high-security environments ($95.69\%$ recall).

---

## 7. Full-Stack Architecture, Codebase, APIs, and Containerized Deployment
*(Synthesizing Point 6: Technical Stack, Point 9: Repository Structure, Point 10: Installation, Point 11: Docker, and Point 12: API Specifications)*

 Modular Architecture and Repository Layout
The project follows a clean separation of concerns across backend, frontend, and modeling components:
- **Backend Service (`Backend/`)**: Built on Python 3.11 and FastAPI/Uvicorn. Encapsulates neural inference and DSP (`prediction_service.py`), a 4-tier policy automation engine (`risk_engine.py`), local offline Vosk Kaldi speech-to-text (`transcription.py`), regex social engineering classification (`content_risk.py`), telecom Fraud Risk Intelligence checks (`number_risk.py`), turn-boundary speaker attribution (`session_manager.py`), biometric voiceprints (`voiceprint.py`), and non-destructive SQLite persistence (`db.py`).
- **Interactive Presentation (`frontend/`)**: Single Page Application built on React 19, Vite 8, and Tailwind CSS. Features real-time Web Audio API capture, dynamic canvas spectrogram rendering, animated waveform verdicts, an interactive 4-second early interceptor modal, and client-side vector PDF generation via jsPDF (`generatePdfReport.js`).
- **Models and Evaluation (`models/`, root)**: Stores trained baseline and fine-tuned checkpoints (`spoof_cnn_best.pth`, `spoof_cnn_finetuned.pth`) alongside training pipelines (`train_model.py`, `finetune_custom.py`) and sliding-window benchmark harnesses (`evaluate_model.py`).

 High-Throughput Streaming and REST API Contracts
- **WebSocket Gateway (`/audio-stream`)**: Ingests continuous 16-bit PCM mono audio buffers (16 kHz) and emits structured JSON telemetry frames every 2 seconds:
  - Composite spoof probability, bonafide probability, and confidence score.
  - Risk tier (`LOW`, `MEDIUM`, `HIGH`) and operational action directive (`ALLOW`, `VERIFY`, `ALERT`, `ESCALATE`).
  - Early-alert flag (triggered within the opening 2 to 4 seconds).
  - Conversational turn attribution: independent threat tracking for Speaker Slot A and Speaker Slot B.
  - Offline Vosk transcript, attack categorization (e.g., `digital_arrest_scam`), and flagged coercive phrases.
  - Telecom Fraud Risk Intelligence (DoT / FRI) risk tier.
- **REST Analysis Interface (`POST /analyze`)**: Accepts multi-format audio files (WAV, MP3, FLAC) and caller ID metadata, executing complete sliding-window forensics and returning aggregated threat reports.

 Local Setup and Multi-Container Orchestration
- **Local Development**:
  - Backend: `python -m venv .venv`, install `requirements.txt`, and start with `uvicorn main:app --reload --host 0.0.0.0 --port 8000` (OpenAPI Swagger docs at `/docs`).
  - Frontend: `npm install` and `npm run dev` to launch the development UI at `http://localhost:5173`.
- **Multi-Container Docker Optimization**:
  - Backend Dockerfile builds on `python:3.11-slim` using CPU-optimized PyTorch wheels (`https://download.pytorch.org/whl/cpu`), eliminating CUDA overhead and reducing image size from >4 GB to <800 MB.
  - Frontend Dockerfile builds a static production bundle via Node 20 and serves it through an Alpine Nginx reverse proxy routing API and WebSocket traffic.
  - Orchestrated via `docker-compose.yml` with persistent volume mapping (`voiceguard_data`) for SQLite audit logs. Production blueprints are pre-configured for Render (`render.yaml`), Vercel (`vercel.json`), and Railway (`Procfile`).

---

## 8. Incident Mitigation, Legal Compliance, Future Roadmap, and National Impact
*(Synthesizing Point 13: Statutory Alignment, Point 14: Future Roadmap, and Point 15: Smart India Hackathon Alignment)*

 Active Call Mitigation and The Golden Hour Protocol
VoiceGuard converts passive detection into active citizen protection:
- **4-Second Early Interception**: Stops social engineering within the first 2 to 4 seconds of a call. When synthetic markers appear, an emergency modal prompts the user to either immediately terminate the call or proceed with an on-screen challenge script (e.g., demanding a family safe-word or refusing instant UPI transfers).
- **Direct 1-Tap Dial 1930**: Integrates direct one-click dialing to India's National Cyber Crime Helpline (**1930**), operated by the Citizen Financial Cyber Fraud Reporting System (Ministry of Home Affairs).
- **Golden Hour Fund Freezing**: Prominently guides victims to report fraud within the initial 1 to 2 hours, activating the automated inter-bank Financial Fraud Reporting and Management System (CFRMS) to freeze compromised beneficiary accounts before funds can be withdrawn at ATMs.

Statutory Alignment and Forensic Legal Dossier
- **Indian Cyber Jurisprudence Compliance**: System telemetry and evidence logs map directly to key provisions of Indian cyber law:
  - **Section 66D, Information Technology Act, 2000**: Cheating by personation using computer resources (punishable with imprisonment up to 3 years and fines).
  - **Section 66E / 43, Information Technology Act, 2000**: Privacy violations and unauthorized access to communication devices.
  - **Bharatiya Nyaya Sanhita (BNS) Provisions**: Criminal impersonation, extortion, and fraudulent inducement to deliver property.
- **Two-Page Court-Admissible PDF Incident Dossier**: Client-side document generation produces an official cyber-defense report containing session timestamps, caller ID metadata, spectrogram extracts, acoustic telemetry (jitter, shimmer, replay scores), Vosk speech transcripts, and direct reporting links to [cybercrime.gov.in](https://cybercrime.gov.in) and the Department of Telecommunications (DoT) Chakshu portal.

## 9. Future Roadmap and Smart India Hackathon Alignment
- **Strategic Roadmap**:
  - Multi-Lingual Regional Dialect Models: Expansion of offline transcription and prosody analysis across major Indian languages (Hindi, Tamil, Telugu, Bengali, Marathi, and Kannada).
  - Telecom Gateway SBC Integration: Embedding SIP/SS7 sidecar proxies within Telecom Service Provider (TSP) central exchanges for network-level caller verification before calls ring on user handsets.
  - On-Device Mobile SDK: Compiling `SpoofCNN` into lightweight ONNX Runtime mobile binaries for background call filtering within native Android/iOS dialers.
  - Live DoT FRI Integration: Transitioning from mock blocklists to authenticated Department of Telecommunications Fraud Risk Intelligence feeds.
  - Zero-Knowledge Biometric Vaults: Cryptographically protected on-device voiceprint storage.
- **Smart India Hackathon Mission Alignment**:
  - **Problem Statement**: *"AI-powered innovation that transforms technology through intelligent resource utilization and valuable insights."*
  - **National Impact**: VoiceGuard demonstrates that robust cyber defense does not require multi-billion parameter foundation models or continuous cloud GPU compute. By uniting a compact ~100k parameter neural network, lightweight DSP heuristics, and deterministic policy automation, VoiceGuard delivers an edge-viable, privacy-preserving defense shield designed to safeguard 1.4 billion citizens and critical telecom infrastructure against automated AI extortion.
