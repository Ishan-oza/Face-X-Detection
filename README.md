# Face-X-Detection: A Dual-Branch Framework for Synthetic Forgery Localization and Explainability
*(Product / Engine Codename: **VeriStream**)*

**Face-X-Detection** is a full-stack digital forensic platform built to detect AI-generated imagery, deepfake face-swaps, and localized synthetic manipulations. Powered by a modular **6-layer dual-branch Python engine (FastAPI + PyTorch)** and a modern **React + TypeScript + Vite dashboard**, the system decouples global scene context from local facial micro-identity to localize forgery seams and explain them in plain English.

---

## Table of Contents
- [Quick Start (Entry-Level Setup)](#quick-start-entry-level-setup)
- [Running the Full-Stack App](#running-the-full-stack-app)
- [System Architecture (The 6-Layer Pipeline)](#system-architecture-the-6-layer-pipeline)
- [Advanced Usage: CLI, API Endpoints & Configuration](#advanced-usage-cli-api-endpoints--configuration)
- [Project Structure](#project-structure)

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
