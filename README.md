# Face-X-Detection: A Dual-Branch Framework for Synthetic Forgery Localization and Explainability
*(Internal Project Name: VeriStream)*

Face-X-Detection is an end-to-end digital forensic pipeline designed to detect AI-generated imagery, deepfake face-swaps, and localized diffusion manipulations. By decoupling global scene context from local facial micro-identity, the system utilizes a weighted dual-branch architecture to cross-examine cryptographic, spatial, anatomical, and spectral evidence.

## System Architecture (The 6-Layer Pipeline)
1. **Layer 0 - Metadata Pre-Check:** Scans raw bytes for C2PA cryptographic manifests, EXIF hardware data, and embedded JSON workflows or legacy AI signatures (Midjourney, Stable Diffusion, ComfyUI).
2. **Layer 1 - MTCNN Smart Routing:** Detects human presence and extracts an aligned facial crop using a tuned 0.50 scale margin for micro-analysis, while parallel-routing the uncropped scene for macro-analysis.
3. **Layer 2 - Global Stream (Macro-Context):** A custom-trained **Swin V2 Tiny** transformer evaluates global noise patterns. A **Depth Anything V2** pipeline computes Sobel gradient variances to flag spatial paradoxes. Concurrently, a **MediaPipe Pose** landmarker maps 3D skeletal joints to detect biological anomalies.
4. **Layer 3 - Local Stream (Micro-Identity):** A Spatial Rich Model (**SRM**) high-pass filter exposes localized inpainting noise. A trained **CrossViT** Dual-Patch transformer flags generation artifacts, while **FFT** grids identify GAN synthesis patterns. A 478-point **FaceMesh** checks EAR asymmetry and maps anatomical red-zones against Gradient-weighted Activation Relevance (GAR) heatmaps.
5. **Layer 4 - Late Fusion Adjudication:** An orchestrator aggregates scores, calculating a unified manipulation probability from 0% to 100% (Likely Real, Suspicious Manipulation, or Deepfake Detected).
6. **Layer 5 - Multimodal Forensic Reporting:** A fine-tuned **Gemini 2.5 Flash** engine synthesizes the numerical telemetry and FaceMesh red-zones to generate a plain-English executive summary.

---

## 🚀 Setup & Installation

### 1. Download the Pre-trained Weights
Because the model checkpoints exceed GitHub's file size limits, you must download them manually.
* **Download Link:** [Google Drive - Face-X-Detection Weights](https://drive.google.com/drive/folders/1xVFQWLqyRjNJHr747_ACxmBetBCvID4W?usp=sharing)
* **Action:** Download `swin_best.pth`, `class_to_idx.json`, and `crossvit_best_checkpoint.pth` and place them directly in the root of this project folder.

### 2. Environment Setup
We recommend using [Miniconda](https://docs.conda.io/en/latest/miniconda.html) or a standard Python virtual environment (Python 3.10+).

**Linux & macOS:**
```bash
# Clone the repository
git clone [https://github.com/Ishan-oza/Face-X-Detection.git](https://github.com/Ishan-oza/Face-X-Detection.git)
cd Face-X-Detection

# Create and activate a Conda environment
conda create -n facex python=3.10 -y
conda activate facex

# Install dependencies
pip install -r requirements.txt
```

**Windows:**
```PowerShell
# Clone the repository
git clone [https://github.com/Ishan-oza/Face-X-Detection.git](https://github.com/Ishan-oza/Face-X-Detection.git)
cd Face-X-Detection
```

# Create and activate a Conda environment
```bash
conda create -n facex python=3.10 -y
conda activate facex
```

# Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Running the Engine

Command Line Interface (CLI):
Runs a fast health check and executes the pipeline in the terminal.

```bash
python run_cli.py /path/to/test_image.jpg
```

### Interactive Web UI (Streamlit):
Launches the full visual dashboard to inspect the 9 decoupled forensic heatmaps.
```bash
streamlit run app.py
```

