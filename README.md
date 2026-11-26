# Face-X-Detection: A Dual-Branch Framework for Synthetic Forgery Localization and Explainability
*(Product & Engine Codename: **VeriStream**)*

> **Can you trust what you see?** Modern generative AI and face-swap tools leave microscopic traces invisible to the naked eye—unnatural frequency patterns, depth inconsistencies, subtle jawline seams, and micro-expression asymmetries. **Face-X-Detection (VeriStream)** is a full-stack digital forensic platform that exposes synthetic manipulations, pinpoints *exactly where* the image was altered, and explains *why* in plain English.

> **Note:** This project is under active development and is still getting perfected day by day—models, forensic signals, thresholds, and UI workflows are continuously being refined and improved.

---

## Table of Contents
- [What Is Face-X-Detection?](#what-is-face-x-detection)
- [Why a Dual-Branch Architecture?](#why-a-dual-branch-architecture)
- [Key Features & Capabilities](#key-features--capabilities)
- [How It Works (End-to-End Workflow)](#how-it-works-end-to-end-workflow)
- [System Architecture (The 6-Layer Pipeline)](#system-architecture-the-6-layer-pipeline)
- [Quick Start (Entry-Level Setup)](#quick-start-entry-level-setup)
- [Running the Full-Stack App](#running-the-full-stack-app)
- [Advanced Usage: CLI, API Endpoints & Configuration](#advanced-usage-cli-api-endpoints--configuration)
- [Project Structure](#project-structure)

---

## What Is Face-X-Detection?

**Face-X-Detection** (internally engineered as **VeriStream**) is an end-to-end AI forensic and deepfake localization system combining a **6-layer PyTorch + FastAPI backend** with an interactive **React + TypeScript + Vite dashboard**.

Unlike traditional black-box detectors that merely output a single opaque *Real* or *Fake* label, Face-X-Detection acts like a **digital crime-scene investigator**:
- **Multi-Modal Evidence Gathering:** Cross-examines cryptographic metadata, 3D scene depth, skeletal proportions, high-pass camera sensor noise, frequency spectra, and 478-point facial landmarks.
- **Visual Forgery Localization:** Generates **Gradient-weighted Activation Relevance (GAR)** heatmaps and **Face X-Ray** boundary seam maps to highlight manipulated pixels directly on the image.
- **Human-Readable Explanations:** Translates complex neural and spectral telemetry into clear, actionable forensic reports via **Gemini Multimodal AI** (with an offline deterministic narrative fallback).

---

## Why a Dual-Branch Architecture?

Single-model classifiers often fail because different manipulations leave clues at completely different scales:
- **Full-Scene Synthesis & Background Edits** alter global lighting, shadow falloff, and 3D depth geometry across the whole frame.
- **Face-Swaps & Localized Inpainting** preserve the outer background while introducing subtle boundary seams along the jawline, unnatural skin pore noise, or asymmetric eye openings.

By decoupling analysis into two specialized branches—a **Global Macro-Scene Stream** and a **Local Micro-Identity Stream**—Face-X-Detection catches both full-image AI generations and subtle localized face edits without letting background clutter drown out fine facial artifacts.

---

## Key Features & Capabilities

- **Dual-Stream Deep Learning Core:** Combines a custom-trained **Swin Transformer V2** (global context) with a **CrossViT Dual-Patch Transformer** (multi-scale facial micro-features).
- **478-Point FaceMesh Anatomical Pinpointing:** Maps heatmap hotspots directly onto specific facial regions (eyes, eyebrows, nose bridge, lips, cheeks, and jawline) and measures Eye Aspect Ratio (EAR) asymmetry.
- **Physics & Signal Forensics:** Integrates **Depth Anything V2** (3D spatial discontinuity), **MediaPipe Pose** (skeletal/limb symmetry), **SRM high-pass filters** (inpainting noise residuals), **2D FFT** (GAN spectral artifacts), and **Face X-Ray** (blending boundary gradients).
- **C2PA & Metadata Provenance Audit:** Instantly flags embedded AI generator signatures (Midjourney, Stable Diffusion, ComfyUI) and inspects EXIF camera hardware tags before neural inference even begins.
- **Interactive Forensic Web Dashboard:** Upload images, inspect side-by-side heatmaps and spectral maps, review signal breakdowns, and download structured JSON/PDF forensic reports.

---

## How It Works (End-to-End Workflow)

1. **Upload & Pre-Scan:** When you drop an image into the web UI (or pass it via CLI), **Layer 0** inspects raw file bytes for EXIF camera tags and AI provenance manifests.
2. **Smart Subject Routing:** **Layer 1 (MTCNN)** detects human presence and extracts a calibrated `0.50`-margin facial crop for close-up inspection while forwarding the uncropped frame to the global stream.
3. **Parallel Macro & Micro Analysis:** **Layer 2 (Global)** and **Layer 3 (Local)** run concurrently—evaluating 3D depth, posture, global Swin V2 attention, local CrossViT attention, SRM noise residuals, FFT frequency tails, Face X-Ray seams, and 478-point FaceMesh geometry.
4. **Weighted Late Fusion Adjudication:** **Layer 4** aggregates all forensic signals into a calibrated **0%–100% Manipulation Probability** and assigns a clear verdict (`LIKELY_REAL`, `SUSPICIOUS_MANIPULATION`, `DEEPFAKE_DETECTED`, or `AI_GENERATED_PROVENANCE_MARKER`).
5. **Explainable Forensic Report:** **Layer 5** combines the visual heatmaps with anatomical red-zone findings to deliver a plain-English diagnosis alongside downloadable visual evidence.

---

## System Architecture (The 6-Layer Pipeline)

```text
Input Image
   |
   +--> [Layer 0] Metadata & C2PA Provenance Pre-Check (EXIF / AI Signatures)
   +--> [Layer 1] MTCNN Smart Face Router (Detects face & extracts 0.50-margin crop)
   |
   +--> [Layer 2: Global Stream -- Macro Scene Context]
   |       |-- Swin V2 Tiny (256x256) + Global GAR Attention Heatmap
   |       |-- Depth Anything V2 (3D Spatial Discontinuity & Depth Map)
   |       +-- MediaPipe Pose Landmarker (3D Skeletal & Limb Symmetry Audit)
   |
   +--> [Layer 3: Local Stream -- Micro Facial Identity]
   |       |-- CrossViT-Tiny (240x240) Dual-Patch Transformer + Local GAR Heatmap
   |       |-- Spatial Rich Model (SRM) High-Pass Noise Residual Filter
   |       |-- 2D FFT Radial Spectral Grid Analysis
   |       |-- 478-Point MediaPipe FaceMesh (EAR Eye Symmetry & Red-Zone Pinpointing)
   |       +-- Face X-Ray Boundary Seam Gradient Detector
   |
   +--> [Layer 4] Weighted Late Fusion Adjudicator (0%-100% Score + Verdict)
   +--> [Layer 5] Multimodal Gemini Forensic Explainer (Plain-English Summary + Fallback)
```

1. **Layer 0 — Metadata & Provenance Pre-Check (`veristream/metadata.py`):** Inspects raw file bytes for C2PA cryptographic manifests, EXIF camera hardware tags, and embedded generation workflows (Midjourney, Stable Diffusion, ComfyUI).
2. **Layer 1 — Smart Face Router (`veristream/router.py`):** Uses `MTCNN` to detect human subjects, crops the facial region with a calibrated `0.50` contextual margin for micro-inspection, and routes the full scene to the global branch.
3. **Layer 2 — Global Stream (`veristream/global_stream.py`):** Evaluates full-image lighting, background synthesis, and structural geometry using **Swin Transformer V2**, **Depth Anything V2**, and **MediaPipe Heavy Pose**.
4. **Layer 3 — Local Stream (`veristream/local_stream.py`):** Examines skin pore grain, blending boundaries, and spectral artifacts using **CrossViT**, **SRM high-pass filters**, **FFT**, **Face X-Ray**, and **478-point FaceMesh** red-zone mapping.
5. **Layer 4 — Late Fusion (`veristream/pipeline.py`):** Combines multi-stream scores into a unified probability and classifies inputs into `LIKELY_REAL`, `SUSPICIOUS_MANIPULATION`, `DEEPFAKE_DETECTED`, or `AI_GENERATED_PROVENANCE_MARKER`.
6. **Layer 5 — Multimodal Reporting (`veristream/gemini_engine.py`):** Synthesizes visual heatmaps and telemetry into plain-English explanations, with built-in IPv4 fallback and offline local narrative generation.

---

## Quick Start (Entry-Level Setup)

### Prerequisites
- **Python 3.10+** (Miniconda / Anaconda recommended)
- **Node.js 18+ & npm** (for the React + Vite frontend)
- *(Optional)* **NVIDIA GPU (CUDA)** for hardware-accelerated inference (automatically falls back to CPU if unavailable)

### 1. Clone the Repository
```bash
git clone https://github.com/Ishan-oza/Face-X-Detection.git
cd Face-X-Detection
```

### 2. Download the Pre-Trained Model Weights
Because model checkpoints exceed GitHubs 100 MB limit, download them manually from Google Drive:
- **Google Drive Folder:** [Face-X-Detection Model Checkpoints](https://drive.google.com/drive/folders/1xVFQWLqyRjNJHr747_ACxmBetBCvID4W?usp=sharing)
- Download **`swin_best.pth`**, **`crossvit_best_checkpoint.pth`**, and **`class_to_idx.json`** and place all three files directly in the **root folder** (`Face-X-Detection/`).

### 3. Install Backend Dependencies (Python)
**Linux & macOS:**
```bash
conda create -n facex python=3.10 -y
conda activate facex
pip install -r requirements.txt
```
**Windows (PowerShell):**
```powershell
conda create -n facex python=3.10 -y
conda activate facex
pip install -r requirements.txt
```

### 4. Install Frontend Dependencies (React + Vite)
```bash
cd frontend
npm install
cd ..
```

*(Optional)* Set your free [Google AI Studio](https://aistudio.google.com/apikey) Gemini API key for AI-generated plain-English forensic summaries (without it, deterministic local narratives are used automatically):
```bash
# Linux / macOS
export GEMINI_API_KEY="your_api_key_here"

# Windows (PowerShell)
$env:GEMINI_API_KEY="your_api_key_here"
```

---

## Running the Full-Stack App

Open **two terminals** inside the `Face-X-Detection` root directory:

### Terminal 1 — Start the FastAPI Forensic Backend (Port `8001`)
```bash
uvicorn app:app --host 127.0.0.1 --port 8001 --reload
```
Wait until you see `VERISTREAM ENGINE READY` and `Uvicorn running on http://127.0.0.1:8001`.

### Terminal 2 — Start the React + Vite Frontend (Port `5173`)
```bash
cd frontend
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser to upload images, inspect interactive heatmaps, and export PDF/JSON forensic reports.

> **Port Proxy Note:** By default, Vite proxies `/api` requests to `http://127.0.0.1:8000`. When running Uvicorn on port `8001`, copy `frontend/.env.example` to `frontend/.env.local` and set `API_PROXY_TARGET=http://127.0.0.1:8001`.

---

## Advanced Usage: CLI, API Endpoints & Configuration

### Command-Line Interface (Headless Testing)
```bash
python run_cli.py /path/to/image.jpg
```
All generated visual artifacts (`swin_gar.png`, `crossvit_gar.png`, `mesh_gar_overlay.png`, `xray_map.png`, `srm_residual.png`, `fft_spectrum.png`, `depth_map.png`, `pose.png`, and `report.json`) are saved under `veristream_output/<image_name>/`.

### FastAPI REST Endpoints
Interactive Swagger API docs are available at **`http://127.0.0.1:8001/docs`** while the backend is running:
- `GET /api/health` — Returns backend readiness, active compute device (`cuda` / `cpu`), and model status.
- `GET /api/models` — Lists loaded forensic streams and architecture metadata.
- `POST /api/analyze` — Accepts multipart image uploads and returns full JSON telemetry, verdict, plain-English diagnosis, and URLs to rendered `/outputs/...` heatmaps.

### Tuning Thresholds & Fusion Weights
All model paths, verdict cutoffs (`verdict_fake`, `verdict_suspicious`), and stream weights can be customized inside **`veristream/config.py`**.

---

## Project Structure

```text
Face-X-Detection/
|-- app.py                          # FastAPI backend server & static heatmap mount
|-- run_cli.py                      # Headless CLI runner for single-image diagnostics
|-- requirements.txt                # Python backend & ML dependencies
|-- class_to_idx.json               # Class label mapping for Swin V2 checkpoint
|-- swin_best.pth                   # (Download from Drive) Swin V2 Global weights
|-- crossvit_best_checkpoint.pth    # (Download from Drive) CrossViT Local weights
|-- LICENSE                         # MIT License
|-- veristream/                     # Core 6-layer modular forensic engine
|   |-- config.py                   # Device selection, paths, thresholds & weights
|   |-- metadata.py                 # Layer 0: EXIF & AI provenance scanner
|   |-- router.py                   # Layer 1: MTCNN face detection & crop routing
|   |-- global_stream.py            # Layer 2: Swin V2, Depth Anything V2 & Pose
|   |-- local_stream.py             # Layer 3: CrossViT, SRM, FFT, FaceMesh & X-Ray
|   |-- explainability.py           # GAR heatmap & 478-dot mesh overlay generators
|   |-- pipeline.py                 # Layer 4: Orchestrator & Late Fusion engine
|   +-- gemini_engine.py            # Layer 5: Gemini multimodal reporter & fallback
+-- frontend/                       # React + TypeScript + Vite + Tailwind web UI
    |-- src/                        # Components, pages, API services & PDF export
    |-- package.json                # Frontend dependencies & scripts
    +-- .env.example                # Backend proxy & API URL template
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

```text
MIT License

Copyright (c) 2026 Oza Ishan Pankaj (@Ishan-oza), KRISHNA SJ (@Krishna17ctrl), LOCHAN P ANCHALKAR (@lochan-22), PRATHIK M B MATH (@PrathikMath)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
