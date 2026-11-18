"""
VeriStream FastAPI Backend

Run:
    uvicorn app:app --host 127.0.0.1 --port 8001 --reload
"""

import os
import shutil
import tempfile
import time
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from veristream import VeriStream, Config


# ============================================================
# APP CONFIG
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "veristream_output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="Face-X Detection — VeriStream Forensic API",
    description="Multi-stream AI-generated image and deepfake forensic analysis API",
    version="1.0.0",
)

# React/Vite frontend
_raw_origins = os.getenv("ALLOWED_ORIGINS", "*").strip()
_origins = ["*"] if _raw_origins == "*" else [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False if _origins == ["*"] else True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Generated forensic images
app.mount(
    "/outputs",
    StaticFiles(directory=str(OUTPUT_DIR)),
    name="outputs",
)


# ============================================================
# SINGLE VERISTREAM ENGINE
# ============================================================

_engine: Optional[VeriStream] = None


def get_engine() -> VeriStream:
    """
    Create VeriStream only once.

    This is important because the models are expensive to initialize.
    Subsequent requests reuse the same loaded models.
    """
    global _engine

    if _engine is None:
        print("\n" + "=" * 60)
        print("INITIALIZING VERISTREAM FORENSIC ENGINE")
        print("=" * 60)

        cfg = Config(
            use_faceguard=False,
            face_margin=0.50,
        )

        _engine = VeriStream(cfg)

        print("=" * 60)
        print("VERISTREAM ENGINE READY")
        print("=" * 60 + "\n")

    return _engine


# ============================================================
# HEALTH
# ============================================================

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "service": "Face-X Detection / VeriStream",
        "device": str(get_engine().cfg.__dict__.get("device", "")),
        "models_ready": True,
    }


# ============================================================
# MODELS
# ============================================================

@app.get("/api/models")
async def models():
    engine = get_engine()

    return {
        "models": [
            {
                "id": "veristream",
                "name": "VeriStream Forensic Engine",
                "architecture": "Multi-stream forensic fusion",
                "status": "ready",
                "is_default": True,
                "note": "Runs all available forensic streams in one analysis.",
            },
            {
                "id": "swin_v2",
                "name": "Swin V2",
                "architecture": "Swin Transformer V2",
                "status": "ready",
            },
            {
                "id": "crossvit",
                "name": "Cross-ViT",
                "architecture": "CrossViT Tiny 240",
                "status": "ready",
            },
            {
                "id": "srm",
                "name": "SRM",
                "architecture": "Spatial Rich Model High-Pass Filter",
                "status": "ready",
            },
            {
                "id": "depth_anything_v2",
                "name": "Depth Anything V2",
                "architecture": "Depth estimation",
                "status": "ready",
            },
            {
                "id": "mediapipe",
                "name": "MediaPipe Forensic Analysis",
                "architecture": "FaceMesh + Pose + EAR",
                "status": "ready",
            },
            {
                "id": "fft",
                "name": "FFT Spectral Analysis",
                "architecture": "Frequency-domain analysis",
                "status": "ready",
            },
            {
                "id": "face_xray",
                "name": "Face X-ray",
                "architecture": "Boundary blending analysis",
                "status": "ready",
            },
        ]
    }


# ============================================================
# ANALYZE IMAGE
# ============================================================

@app.post("/api/analyze")
async def analyze_image(
    file: UploadFile = File(...),
    use_gemini: bool = True,
    gemini_api_key: Optional[str] = None,
):
    """
    Run the complete VeriStream forensic pipeline.

    One request executes:
      Metadata
      Router
      Swin V2
      Depth Anything V2
      Pose / Anatomy
      SRM
      CrossViT
      FaceMesh / EAR
      GAR
      FFT
      Face X-ray
      Gemini forensic narrative
      Late fusion
    """

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No filename supplied.",
        )

    allowed_extensions = {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
        ".bmp",
        ".tif",
        ".tiff",
    }

    extension = Path(file.filename).suffix.lower()

    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported image format. "
                "Supported formats: JPG, JPEG, PNG, WEBP, BMP, TIFF."
            ),
        )

    # --------------------------------------------------------
    # Save uploaded image temporarily
    # --------------------------------------------------------

    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=extension,
        ) as temp_file:

            temp_path = Path(temp_file.name)

            shutil.copyfileobj(
                file.file,
                temp_file,
            )

        print("\n" + "=" * 60)
        print(f"ANALYZING IMAGE: {file.filename}")
        print("=" * 60)

        start_time = time.time()

        if gemini_api_key and gemini_api_key.strip():
            os.environ["GEMINI_API_KEY"] = gemini_api_key.strip()

        # ----------------------------------------------------
        # Run complete VeriStream pipeline
        # ----------------------------------------------------

        engine = get_engine()

        report, _visualizations = engine.analyze(
            temp_path,
            save=True,
            use_gemini=use_gemini,
        )

        api_runtime = round(time.time() - start_time, 2)

        # ----------------------------------------------------
        # Build public visualization URLs
        # ----------------------------------------------------

        output_dir = report.get("output_dir")

        visualization_urls = {}

        if output_dir:
            output_path = Path(output_dir)

            if output_path.exists():
                for image_path in output_path.glob("*.png"):
                    visualization_urls[
                        image_path.stem
                    ] = f"/outputs/{output_path.name}/{image_path.name}"

        # ----------------------------------------------------
        # Add API metadata
        # ----------------------------------------------------

        report["api_runtime_sec"] = api_runtime
        report["original_filename"] = file.filename
        report["visualizations"] = visualization_urls

        print("=" * 60)
        print(
            f"ANALYSIS COMPLETE: "
            f"{report.get('verdict', 'UNKNOWN')}"
        )
        print(
            f"Manipulation probability: "
            f"{report.get('manipulation_probability', 0)}"
        )
        print(
            f"Pipeline runtime: "
            f"{report.get('runtime_sec', api_runtime)} sec"
        )
        print("=" * 60 + "\n")

        return {
            "success": True,
            "report": report,
            "visualizations": visualization_urls,
        }

    except Exception as e:
        print("\n[API ERROR]")
        print(f"{type(e).__name__}: {e}")

        raise HTTPException(
            status_code=500,
            detail=f"VeriStream analysis failed: {type(e).__name__}: {e}",
        )

    finally:
        # Remove temporary uploaded file.
        if temp_path and temp_path.exists():
            try:
                temp_path.unlink()
            except Exception:
                pass


# ============================================================
# ROOT
# ============================================================

@app.get("/")
async def root():
    return {
        "service": "Face-X Detection",
        "engine": "VeriStream",
        "status": "running",
        "docs": "/docs",
    }