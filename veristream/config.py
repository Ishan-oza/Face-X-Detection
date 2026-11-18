"""Configuration, thresholds, fusion weights, and cloud asset downloader."""
import os
import urllib.request
import warnings
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

import cv2
import numpy as np
import torch
from torchvision import transforms

warnings.filterwarnings("ignore")
logging.getLogger("exifread").setLevel(logging.ERROR)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
IMNET = transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])

HF_WEIGHTS_BASE = os.getenv(
    "VS_HF_WEIGHTS_URL",
    "https://huggingface.co/ishanoza666/face-x-detection-weights/resolve/main",
)

MP_URLS = {
    "pose_landmarker_heavy.task": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
    "face_landmarker.task": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
}


def _find_or_download_weight(filename: str, candidates: List[Path]) -> Path:
    for p in candidates:
        if p and p.exists():
            return p.resolve()
    target = Path(f"./{filename}")
    url = f"{HF_WEIGHTS_BASE}/{filename}"
    print(f"[VeriStream] Downloading {filename} from Hugging Face Hub...")
    tmp = target.with_suffix(target.suffix + ".part")
    urllib.request.urlretrieve(url, tmp)
    tmp.rename(target)
    print(f"[VeriStream] Downloaded {filename} ({target.stat().st_size / (1024*1024):.1f} MB)")
    return target.resolve()


@dataclass
class Config:
    base: Path = field(default_factory=lambda: Path(os.getenv("VS_BASE", str(Path.home() / "Downloads/01-project/01-deepfake"))))
    swin_ckpt: Optional[Path] = None
    swin_class_map: Optional[Path] = None
    crossvit_ckpt: Optional[Path] = None
    models_dir: Path = field(default_factory=lambda: Path(os.getenv("VS_MODELS", "./models")))
    out_dir: Path = field(default_factory=lambda: Path(os.getenv("VS_OUT", "./veristream_output")))
    depth_model: str = "depth-anything/Depth-Anything-V2-Small-hf"
    gemini_model: str = field(default_factory=lambda: os.getenv("GEMINI_MODEL", "gemini-3.8-flash"))

    # Architecture switches & tuned parameters
    use_faceguard: bool = False
    faceguard_ts: Optional[Path] = None
    face_margin: float = 0.50
    min_face_conf: float = 0.90

    # Heuristic Thresholds
    depth_thr: float = 5000.0
    fft_thr: float = 150.0
    ear_thr: float = 0.15
    srm_thr: float = 0.45

    # Late-Fusion Weights
    weights: Dict[str, float] = field(default_factory=lambda: {
        "swin": 0.25,
        "crossvit": 0.28,
        "srm": 0.06,
        "gar_overlap": 0.06,
        "depth": 0.08,
        "anatomy": 0.08,
        "fft": 0.05,
        "ear": 0.04,
        "xray": 0.10,
        "skin": 0.10,
    })
    verdict_fake: float = 0.50
    verdict_suspicious: float = 0.30

    def __post_init__(self):
        sw_dir = self.base / "09-swin-training/checkpoints"

        if os.getenv("VS_SWIN"):
            self.swin_ckpt = Path(os.getenv("VS_SWIN"))
        elif self.swin_ckpt is None:
            self.swin_ckpt = _find_or_download_weight("swin_best.pth", [
                Path("./swin_best.pth"),
                sw_dir / "swin_best.pth",
                Path("./checkpoints/swin_best.pth"),
            ])

        if os.getenv("VS_SWIN_MAP"):
            self.swin_class_map = Path(os.getenv("VS_SWIN_MAP"))
        elif self.swin_class_map is None:
            self.swin_class_map = _find_or_download_weight("class_to_idx.json", [
                Path("./class_to_idx.json"),
                sw_dir / "class_to_idx.json",
                Path("./checkpoints/class_to_idx.json"),
            ])

        if os.getenv("VS_CROSSVIT"):
            self.crossvit_ckpt = Path(os.getenv("VS_CROSSVIT"))
        elif self.crossvit_ckpt is None:
            self.crossvit_ckpt = _find_or_download_weight("crossvit_best_checkpoint.pth", [
                Path("./crossvit_best_checkpoint.pth"),
                self.base / "crossvit_best_checkpoint.pth",
                Path.home() / "Downloads/crossvit_best_checkpoint.pth",
                Path.home() / "Downloads/extracted/crossvit_best_checkpoint.pth",
            ])

        self.models_dir = Path(self.models_dir)
        self.out_dir = Path(self.out_dir)
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self.out_dir.mkdir(parents=True, exist_ok=True)


def fetch_task(cfg: Config, name: str) -> str:
    local_p = Path(name)
    if local_p.exists():
        return str(local_p.resolve())
    p = cfg.models_dir / name
    if not p.exists():
        print(f"[VeriStream] Downloading MediaPipe asset: {name} ...")
        tmp = p.with_suffix(".part")
        urllib.request.urlretrieve(MP_URLS[name], tmp)
        tmp.rename(p)
    return str(p)


def to_png_bytes(arr_rgb: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".png", cv2.cvtColor(arr_rgb, cv2.COLOR_RGB2BGR))
    return buf.tobytes() if ok else b""
