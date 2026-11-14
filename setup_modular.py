#!/usr/bin/env python3
"""
Run this script once inside your VeriStream/ folder:
    python setup_modular.py
It creates the entire modular `veristream/` package, `app.py`, `run_cli.py`, and `VeriStream_Modular.ipynb`.
"""
import json
from pathlib import Path

FILES = {}

# ---------------------------------------------------------------------
# 1. veristream/__init__.py
# ---------------------------------------------------------------------
FILES["veristream/__init__.py"] = '''"""VeriStream Modular Forensic Package."""
from .config import Config, DEVICE
from .pipeline import VeriStream

__all__ = ["Config", "DEVICE", "VeriStream"]
'''

# ---------------------------------------------------------------------
# 2. veristream/config.py
# ---------------------------------------------------------------------
FILES["veristream/config.py"] = '''"""Configuration, thresholds, fusion weights, and MediaPipe asset downloader."""
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

MP_URLS = {
    "pose_landmarker_heavy.task": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
    "face_landmarker.task": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
}


def _find_file(candidates: List[Path]) -> Path:
    for p in candidates:
        if p and p.exists():
            return p.resolve()
    return candidates[0]


@dataclass
class Config:
    base: Path = field(default_factory=lambda: Path(os.getenv("VS_BASE", str(Path.home() / "Downloads/01-project/01-deepfake"))))
    swin_ckpt: Optional[Path] = None
    swin_class_map: Optional[Path] = None
    crossvit_ckpt: Optional[Path] = None
    models_dir: Path = field(default_factory=lambda: Path(os.getenv("VS_MODELS", "./models")))
    out_dir: Path = field(default_factory=lambda: Path(os.getenv("VS_OUT", "./veristream_output")))
    depth_model: str = "depth-anything/Depth-Anything-V2-Small-hf"
    gemini_model: str = field(default_factory=lambda: os.getenv("GEMINI_MODEL", "gemini-2.5-flash"))

    # Architecture switches & tuned parameters
    use_faceguard: bool = False          # True -> Skin Texture branch | False -> Face X-ray branch
    faceguard_ts: Optional[Path] = None  # Optional TorchScript skin-texture model path
    face_margin: float = 0.50            # Tuned 0.50 margin matching CrossViT training scale
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
            self.swin_ckpt = _find_file([
                Path("./swin_best.pth"),
                sw_dir / "swin_best.pth",
                Path("./checkpoints/swin_best.pth"),
            ])

        if os.getenv("VS_SWIN_MAP"):
            self.swin_class_map = Path(os.getenv("VS_SWIN_MAP"))
        elif self.swin_class_map is None:
            self.swin_class_map = _find_file([
                Path("./class_to_idx.json"),
                sw_dir / "class_to_idx.json",
                Path("./checkpoints/class_to_idx.json"),
            ])

        if os.getenv("VS_CROSSVIT"):
            self.crossvit_ckpt = Path(os.getenv("VS_CROSSVIT"))
        elif self.crossvit_ckpt is None:
            self.crossvit_ckpt = _find_file([
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
'''

# ---------------------------------------------------------------------
# 3. veristream/metadata.py
# ---------------------------------------------------------------------
FILES["veristream/metadata.py"] = '''"""Layer 0: Metadata, C2PA, EXIF, and AI Generator Signature Pre-Check."""
import io
from pathlib import Path
from typing import Dict, Any
from PIL import Image


class MetadataLayer:
    AI_SIGS = [
        "midjourney", "dall-e", "dalle", "stable diffusion", "runway",
        "adobe firefly", "firefly", "ai-generated", "synthid",
        "trainedalgorithmicmedia", "compositewithtrainedalgorithmicmedia",
        "imagen", "gemini", "openai", "comfyui", "automatic1111",
        "novelai", "leonardo.ai", "ideogram"
    ]

    def evaluate(self, path: Path) -> Dict[str, Any]:
        import exifread
        raw = Path(path).read_bytes()
        low = raw[: 32 * 1024 * 1024].lower()
        c2pa_present = (b"c2pa" in low) or (b"jumbf" in low)
        sig_hit = [s for s in self.AI_SIGS if s.encode() in low]
        hardware, exif_ok = "None/Stripped", False

        try:
            tags = exifread.process_file(io.BytesIO(raw), details=False)
            make = str(tags.get("Image Make", "")).strip()
            model = str(tags.get("Image Model", "")).strip()
            if make or model:
                hardware = f"{make} {model}".strip()
                exif_ok = True
            for t in tags.values():
                val_low = str(t).lower()
                sig_hit.extend([s for s in self.AI_SIGS if s in val_low])
        except Exception:
            pass

        try:
            with Image.open(path) as im:
                for k, v in im.info.items():
                    val_low = str(v).lower()
                    sig_hit.extend([s for s in self.AI_SIGS if s in val_low])
                    if k.lower() in ("prompt", "workflow", "parameters"):
                        sig_hit.append(f"embedded_{k.lower()}_metadata")
        except Exception:
            pass

        sig_hit = sorted(set(sig_hit))
        score = 1.0 if sig_hit else 0.0

        if sig_hit:
            verdict = "AI/Manipulated (Generator Signature Found)"
        elif exif_ok:
            verdict = f"Camera EXIF Present ({hardware})"
        elif c2pa_present:
            verdict = "C2PA Manifest Present (No Explicit AI Tag)"
        else:
            verdict = "Clean / Stripped (Requires Deep Scan)"

        return {
            "hardware_exif": hardware,
            "c2pa_manifest_present": c2pa_present,
            "ai_signatures": sig_hit,
            "provenance_score": score,
            "verdict": verdict,
        }
'''

# ---------------------------------------------------------------------
# 4. veristream/router.py
# ---------------------------------------------------------------------
FILES["veristream/router.py"] = '''"""Layer 1: Ingestion & Smart Router (MTCNN Face Detection & Alignment)."""
from typing import Dict, Any
import numpy as np
from PIL import Image
from .config import Config, DEVICE


class Router:
    def __init__(self, cfg: Config):
        from facenet_pytorch import MTCNN
        self.cfg = cfg
        self.mtcnn = MTCNN(keep_all=True, device=DEVICE)

    def route(self, img: Image.Image) -> Dict[str, Any]:
        boxes, probs = self.mtcnn.detect(img)
        if boxes is None or probs is None:
            return {"human_present": False, "crop": None, "box": None, "conf": 0.0}

        areas = [
            (b[2] - b[0]) * (b[3] - b[1]) if (p is not None and p >= self.cfg.min_face_conf) else -1
            for b, p in zip(boxes, probs)
        ]
        i = int(np.argmax(areas))
        if areas[i] <= 0:
            best_p = float(max([p for p in probs if p is not None], default=0.0))
            return {"human_present": False, "crop": None, "box": None, "conf": best_p}

        x1, y1, x2, y2 = boxes[i]
        W, H = img.size
        w, h = x2 - x1, y2 - y1

        px, py = int(w * self.cfg.face_margin), int(h * self.cfg.face_margin)
        box = (
            max(0, int(x1 - px)),
            max(0, int(y1 - py)),
            min(W, int(x2 + px)),
            min(H, int(y2 + py)),
        )
        return {
            "human_present": True,
            "crop": img.crop(box),
            "box": list(box),
            "conf": round(float(probs[i]), 4),
        }
'''

# ---------------------------------------------------------------------
# 5. veristream/explainability.py
# ---------------------------------------------------------------------
FILES["veristream/explainability.py"] = '''"""GAR (Gradient-weighted Activation Relevance) Heatmaps & Visual Overlays."""
import math
from typing import Optional, Tuple, List
import cv2
import numpy as np
import torch
import torch.nn.functional as F


def _to_grid_cam(a: torch.Tensor, g: torch.Tensor) -> Optional[np.ndarray]:
    a, g = a.detach(), g.detach()
    if a.dim() == 4:
        if a.shape[-1] > a.shape[1]:
            a, g = a.permute(0, 3, 1, 2), g.permute(0, 3, 1, 2)
    elif a.dim() == 3:
        L = a.shape[1]
        s_exact = int(round(math.sqrt(L)))
        if s_exact * s_exact == L:
            tokens_a, tokens_g = a, g
            s = s_exact
        else:
            n = L - 1
            s = int(round(math.sqrt(n)))
            if s * s != n or s <= 0:
                return None
            tokens_a = a[:, 1 : 1 + s * s]
            tokens_g = g[:, 1 : 1 + s * s]
        a = tokens_a.transpose(1, 2).reshape(a.shape[0], -1, s, s)
        g = tokens_g.transpose(1, 2).reshape(g.shape[0], -1, s, s)
    else:
        return None

    weights = g.mean(dim=(2, 3), keepdim=True)
    cam = F.relu((weights * a).sum(dim=1))[0].cpu().numpy()
    return cam


def gar_heatmap(
    model: torch.nn.Module,
    layer: torch.nn.Module,
    x: torch.Tensor,
    target_idx: int,
    out_hw: Tuple[int, int],
) -> np.ndarray:
    store_a, store_g = {}, {}

    def fwd_hook(_m, _inp, out):
        outs = list(out) if isinstance(out, (list, tuple)) else [out]
        for k, t in enumerate(outs):
            if isinstance(t, torch.Tensor) and t.requires_grad:
                store_a[k] = t
                t.register_hook(lambda grad, k=k: store_g.__setitem__(k, grad))

    h = layer.register_forward_hook(fwd_hook)
    try:
        with torch.enable_grad():
            x_grad = x.detach().clone().requires_grad_(True)
            model.zero_grad(set_to_none=True)
            logits = model(x_grad)
            logits[0, target_idx].backward()
    except Exception as e:
        print(f"[warn] GAR heatmap backward failed: {e}")
    finally:
        h.remove()

    maps, weights = [], []
    for k in sorted(store_a.keys()):
        if k in store_g:
            c = _to_grid_cam(store_a[k], store_g[k])
            if c is not None and c.max() > 0:
                grid_res = c.shape[0]
                c_resized = cv2.resize(c, (out_hw[1], out_hw[0]), interpolation=cv2.INTER_CUBIC)
                c_norm = c_resized / (c_resized.max() + 1e-8)
                maps.append(c_norm)
                weights.append(float(grid_res))

    if not maps:
        return np.zeros(out_hw, np.float32)

    w_arr = np.array(weights, dtype=np.float32)
    w_arr /= w_arr.sum()
    cam = sum(m * w for m, w in zip(maps, w_arr))
    return np.clip(cam / (cam.max() + 1e-8), 0, 1).astype(np.float32)


def overlay_heat(rgb: np.ndarray, heat: np.ndarray, alpha: float = 0.45) -> np.ndarray:
    h = cv2.resize(heat, (rgb.shape[1], rgb.shape[0]))
    col = cv2.cvtColor(cv2.applyColorMap((h * 255).astype(np.uint8), cv2.COLORMAP_JET), cv2.COLOR_BGR2RGB)
    return (rgb * (1 - alpha) + col * alpha).astype(np.uint8)


def overlay_mesh_on_gar(rgb: np.ndarray, heat: np.ndarray, pts: Optional[np.ndarray], oval_idx: List[int]) -> np.ndarray:
    base = overlay_heat(rgb, heat, alpha=0.50)
    if pts is not None:
        poly_oval = pts[oval_idx].astype(np.int32).reshape((-1, 1, 2))
        cv2.polylines(base, [poly_oval], isClosed=True, color=(0, 255, 255), thickness=1)
        for q in pts.astype(int):
            cv2.circle(base, tuple(q), 1, (255, 255, 255), -1)
    return base
'''

# ---------------------------------------------------------------------
# 6. veristream/global_stream.py
# ---------------------------------------------------------------------
FILES["veristream/global_stream.py"] = '''"""Layer 2: Global Stream (Swin V2 Noise, Depth Anything V2, MediaPipe Pose Anatomy)."""
import json
from pathlib import Path
from typing import Dict, Any, Tuple
import cv2
import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from torchvision import transforms

from .config import Config, DEVICE, IMNET, fetch_task
from .explainability import gar_heatmap


class SwinGlobal:
    """Swin V2 Tiny (256x256) trained on full scenes. Class mapping: Fake=0, Real=1."""
    def __init__(self, cfg: Config):
        import timm
        self.cfg = cfg
        if cfg.swin_class_map and Path(cfg.swin_class_map).exists():
            cm = json.loads(Path(cfg.swin_class_map).read_text())
        else:
            cm = {"Fake": 0, "Real": 1}
        self.fake_idx = next(v for k, v in cm.items() if "fake" in k.lower())

        if not cfg.swin_ckpt or not Path(cfg.swin_ckpt).exists():
            raise FileNotFoundError(f"Swin V2 checkpoint not found at {cfg.swin_ckpt}")

        self.model = timm.create_model("swinv2_tiny_window16_256", pretrained=False, num_classes=2)
        self.model.load_state_dict(torch.load(cfg.swin_ckpt, map_location="cpu", weights_only=True))
        self.model.to(DEVICE).eval()
        self.tf = transforms.Compose([transforms.Resize((256, 256)), transforms.ToTensor(), IMNET])

    def run(self, img: Image.Image) -> Tuple[float, np.ndarray]:
        x = self.tf(img).unsqueeze(0).to(DEVICE)
        amp_dtype = torch.bfloat16 if (torch.cuda.is_available() and torch.cuda.is_bf16_supported()) else torch.float16
        with torch.no_grad():
            with torch.amp.autocast("cuda", dtype=amp_dtype, enabled=torch.cuda.is_available()):
                logits = self.model(x)
                p_fake = float(F.softmax(logits, dim=1)[0, self.fake_idx])
        target_layer = getattr(self.model, "norm", self.model.layers[-1])
        heat = gar_heatmap(self.model, target_layer, x, self.fake_idx, (256, 256))
        return p_fake, heat


class DepthGlobal:
    def __init__(self, cfg: Config):
        from transformers import pipeline
        self.cfg = cfg
        self.pipe = pipeline(
            "depth-estimation",
            model=cfg.depth_model,
            device=0 if torch.cuda.is_available() else -1,
        )

    def run(self, img: Image.Image) -> Tuple[Dict[str, Any], np.ndarray]:
        d = self.pipe(img)["depth"].convert("L")
        s = 512.0 / max(d.size)
        if s < 1.0:
            d = d.resize((int(d.width * s), int(d.height * s)))
        g = np.array(d)
        sx = cv2.Sobel(g, cv2.CV_64F, 1, 0, ksize=3)
        sy = cv2.Sobel(g, cv2.CV_64F, 0, 1, ksize=3)
        var = float(np.var(cv2.magnitude(sx, sy)))
        return {
            "discontinuity_variance": round(var, 2),
            "spatial_paradox_flag": bool(var > self.cfg.depth_thr),
        }, g


POSE_CONN = [
    (0, 1), (1, 2), (2, 3), (3, 7), (0, 4), (4, 5), (5, 6), (6, 8),
    (9, 10), (11, 12), (11, 13), (13, 15), (15, 17), (15, 19), (15, 21),
    (17, 19), (12, 14), (14, 16), (16, 18), (16, 20), (16, 22), (18, 20),
    (11, 23), (12, 24), (23, 24), (23, 25), (24, 26), (25, 27), (26, 28),
    (27, 29), (28, 30), (29, 31), (30, 32), (27, 31), (28, 32)
]


def _angle(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
    ba, bc = a - b, c - b
    n = np.linalg.norm(ba) * np.linalg.norm(bc)
    return 0.0 if n == 0 else float(np.degrees(np.arccos(np.clip(np.dot(ba, bc) / n, -1.0, 1.0))))


class PoseGlobal:
    def __init__(self, cfg: Config):
        from mediapipe.tasks import python as mpp
        from mediapipe.tasks.python import vision
        opts = vision.PoseLandmarkerOptions(
            base_options=mpp.BaseOptions(model_asset_path=fetch_task(cfg, "pose_landmarker_heavy.task")),
            running_mode=vision.RunningMode.IMAGE,
        )
        self.det = vision.PoseLandmarker.create_from_options(opts)

    def run(self, rgb: np.ndarray) -> Tuple[Dict[str, Any], np.ndarray]:
        import mediapipe as mp
        s = 1280.0 / max(rgb.shape[:2])
        work_rgb = cv2.resize(rgb, None, fx=s, fy=s) if s < 1.0 else rgb
        res = self.det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(work_rgb)))
        vis = work_rgb.copy()

        if not res.pose_landmarks:
            return {"status": "no_body_detected", "anatomical_anomaly_flag": False, "anomalies": []}, vis

        lm = res.pose_landmarks[0]
        wl = res.pose_world_landmarks[0] if res.pose_world_landmarks else lm
        h, w = work_rgb.shape[:2]

        for a, b in POSE_CONN:
            if lm[a].visibility > 0.5 and lm[b].visibility > 0.5:
                cv2.line(vis, (int(lm[a].x * w), int(lm[a].y * h)), (int(lm[b].x * w), int(lm[b].y * h)), (255, 255, 255), 2)
        for p in lm:
            if p.visibility > 0.5:
                cv2.circle(vis, (min(int(p.x * w), w - 1), min(int(p.y * h), h - 1)), 4, (0, 255, 0), -1)

        P = lambda i: np.array([wl[i].x, wl[i].y, wl[i].z])
        ok = lambda *ids: all(lm[i].visibility > 0.5 for i in ids)

        joints = {
            "left_elbow": (11, 13, 15),
            "right_elbow": (12, 14, 16),
            "left_knee": (23, 25, 27),
            "right_knee": (24, 26, 28),
        }
        angles, anomalies = {}, []
        for name, (a, b, c) in joints.items():
            if ok(a, b, c):
                ang = round(_angle(P(a), P(b), P(c)), 2)
                angles[name] = ang
                if ang < 12.0:
                    anomalies.append(f"{name.replace('_', ' ')} unnatural acute fold ({ang} deg)")

        limb_pairs = {
            "upper arm": ((11, 13), (12, 14)),
            "forearm": ((13, 15), (14, 16)),
            "thigh": ((23, 25), (24, 26)),
            "shin": ((25, 27), (26, 28)),
        }
        for nm, (l, r) in limb_pairs.items():
            if ok(*l, *r):
                ll = np.linalg.norm(P(l[0]) - P(l[1]))
                lr = np.linalg.norm(P(r[0]) - P(r[1]))
                if min(ll, lr) > 1e-4 and (max(ll, lr) / min(ll, lr)) > 1.35:
                    anomalies.append(f"left/right {nm} proportion mismatch (ratio {max(ll, lr) / min(ll, lr):.2f})")

        return {
            "status": "success",
            "angles": angles,
            "anatomical_anomaly_flag": bool(anomalies),
            "anomalies": anomalies,
        }, vis
'''

# ---------------------------------------------------------------------
# 7. veristream/local_stream.py
# ---------------------------------------------------------------------
FILES["veristream/local_stream.py"] = '''"""Layer 3: Local Stream (SRM, CrossViT, FaceMesh, EAR, FFT, Mesh-GAR Overlap, Face X-ray/Skin)."""
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import cv2
import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from torchvision import transforms

from .config import Config, DEVICE, IMNET, fetch_task
from .explainability import gar_heatmap


SRM_KERNELS = [
    np.array([[0, 0, 0, 0, 0], [0, -1, 2, -1, 0], [0, 2, -4, 2, 0], [0, -1, 2, -1, 0], [0, 0, 0, 0, 0]], np.float32) / 4.0,
    np.array([[-1, 2, -2, 2, -1], [2, -6, 8, -6, 2], [-2, 8, -12, 8, -2], [2, -6, 8, -6, 2], [-1, 2, -2, 2, -1]], np.float32) / 12.0,
    np.array([[0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 1, -2, 1, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]], np.float32) / 2.0,
]


def srm_residual(rgb: np.ndarray) -> Tuple[np.ndarray, float]:
    """SRM high-pass filter suppressing semantics to expose high-frequency synthesis / inpainting noise."""
    x = rgb.astype(np.float32)
    stack = np.stack([np.clip(cv2.filter2D(x[..., c], -1, k), -2.0, 2.0) for c in range(3) for k in SRM_KERNELS], axis=-1)
    mag = np.abs(stack).mean(axis=-1)
    h, w = mag.shape
    patch_stds = [
        mag[r : r + h // 4, c : c + w // 4].std()
        for r in range(0, h - h // 4 + 1, h // 4)
        for c in range(0, w - w // 4 + 1, w // 4)
    ]
    inconsistency = float(np.std(patch_stds) / (np.mean(patch_stds) + 1e-6))
    score = float(np.clip(inconsistency / 0.55, 0.0, 1.0))
    return mag, score


class CrossViTLocal:
    """CrossViT-tiny-240 trained on 28,518 balanced face crops. Class mapping: 0=Real, 1=Fake."""
    def __init__(self, cfg: Config):
        import timm
        if not cfg.crossvit_ckpt or not Path(cfg.crossvit_ckpt).exists():
            raise FileNotFoundError(f"CrossViT checkpoint not found at {cfg.crossvit_ckpt}")
        self.model = timm.create_model("crossvit_tiny_240.in1k", pretrained=False, num_classes=2)
        self.model.load_state_dict(torch.load(cfg.crossvit_ckpt, map_location="cpu", weights_only=True))
        self.model.to(DEVICE).eval()
        self.tf = transforms.Compose([transforms.Resize((240, 240)), transforms.ToTensor(), IMNET])

    def run(self, crop: Image.Image) -> Tuple[float, np.ndarray]:
        x = self.tf(crop).unsqueeze(0).to(DEVICE)
        with torch.no_grad():
            with torch.amp.autocast("cuda", enabled=torch.cuda.is_available()):
                logits = self.model(x)
                p_fake = float(F.softmax(logits, dim=1)[0, 1])
        layer = self.model.blocks[-2] if len(self.model.blocks) > 1 else self.model.blocks[-1]
        heat = gar_heatmap(self.model, layer, x, 1, (240, 240))
        return p_fake, heat


OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149,
        150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
L_EYE_C = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
R_EYE_C = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]
NOSE = [168, 129, 98, 2, 327, 358]
L_EYE_EAR = [33, 160, 158, 133, 153, 144]
R_EYE_EAR = [362, 385, 387, 263, 373, 380]


class FaceMeshLocal:
    def __init__(self, cfg: Config):
        from mediapipe.tasks import python as mpp
        from mediapipe.tasks.python import vision
        opts = vision.FaceLandmarkerOptions(
            base_options=mpp.BaseOptions(model_asset_path=fetch_task(cfg, "face_landmarker.task")),
            num_faces=1,
        )
        self.det = vision.FaceLandmarker.create_from_options(opts)

    def run(self, rgb: np.ndarray) -> Optional[np.ndarray]:
        import mediapipe as mp
        res = self.det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb)))
        if not res.face_landmarks:
            return None
        h, w = rgb.shape[:2]
        return np.array([[p.x * w, p.y * h] for p in res.face_landmarks[0]], np.float32)

    @staticmethod
    def ear(pts: np.ndarray, idx: List[int]) -> float:
        p = pts[idx]
        d = lambda a, b: float(np.linalg.norm(a - b))
        hor = d(p[0], p[3])
        return 0.0 if hor == 0 else (d(p[1], p[5]) + d(p[2], p[4])) / (2.0 * hor)

    @staticmethod
    def mask(pts: np.ndarray, idx: List[int], shape: Tuple[int, ...], hull: bool = False) -> np.ndarray:
        m = np.zeros(shape[:2], np.uint8)
        poly = pts[idx].astype(np.int32)
        cv2.fillPoly(m, [cv2.convexHull(poly) if hull else poly], 1)
        return m.astype(bool)

    def regions(self, pts: np.ndarray, shape: Tuple[int, ...]) -> Dict[str, np.ndarray]:
        face = self.mask(pts, OVAL, shape)
        size = int(np.sqrt(max(face.sum(), 1)))
        k = np.ones((max(3, int(size * 0.12)),) * 2, np.uint8)
        band = face & ~cv2.erode(face.astype(np.uint8), k).astype(bool)
        eyes = self.mask(pts, L_EYE_C, shape) | self.mask(pts, R_EYE_C, shape)
        mouth = self.mask(pts, LIPS, shape)
        nose = self.mask(pts, NOSE, shape, hull=True)
        skin = face & ~band & ~eyes & ~mouth & ~nose
        return {
            "face": face,
            "boundary_band": band,
            "eyes": eyes,
            "mouth": mouth,
            "nose": nose,
            "skin": skin,
        }

    def gar_overlap(self, heat: np.ndarray, regs: Dict[str, np.ndarray]) -> Dict[str, Any]:
        tot = float(heat.sum()) + 1e-8
        hot = heat >= np.percentile(heat, 85)
        hot_sum = max(int(hot.sum()), 1)
        out = {}
        for n, m in regs.items():
            out[n] = {
                "heat_share": round(float(heat[m].sum() / tot), 3),
                "hot_patch_share": round(float((hot & m).sum() / hot_sum), 3),
                "area_share": round(float(m.sum() / m.size), 3),
            }
        out["attention_outside_face"] = round(float(heat[~regs["face"]].sum() / tot), 3)
        critical_hot_share = (
            out["boundary_band"]["hot_patch_share"]
            + out["eyes"]["hot_patch_share"]
            + out["mouth"]["hot_patch_share"]
            + out["nose"]["hot_patch_share"]
        )
        out["critical_zone_hot_concentration"] = round(min(critical_hot_share, 1.0), 3)
        return out


def spectral_fft(face_rgb: np.ndarray) -> Tuple[float, np.ndarray]:
    g = cv2.resize(cv2.cvtColor(face_rgb, cv2.COLOR_RGB2GRAY), (224, 224)).astype(np.float32)
    mag = 20.0 * np.log(np.abs(np.fft.fftshift(np.fft.fft2(g))) + 1e-8)
    yy, xx = np.indices(g.shape)
    r = np.sqrt((xx - 112) ** 2 + (yy - 112) ** 2).astype(int)
    prof = np.bincount(r.ravel(), mag.ravel()) / np.maximum(np.bincount(r.ravel()), 1)
    tail_var = float(np.var(prof[len(prof) // 2 :]))
    vis = cv2.normalize(mag, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    return tail_var, vis


def face_xray_boundary(face_rgb: np.ndarray, regs: Dict[str, np.ndarray]) -> Tuple[float, float, np.ndarray]:
    res, _ = srm_residual(face_rgb)
    noise = cv2.GaussianBlur(res, (0, 0), 3)
    grad = cv2.magnitude(cv2.Sobel(noise, cv2.CV_32F, 1, 0), cv2.Sobel(noise, cv2.CV_32F, 0, 1))
    band, face = regs["boundary_band"], regs["face"]
    interior = face & ~band
    ratio = float(grad[band].mean() / (grad[interior].mean() + 1e-6)) if (band.any() and interior.any()) else 1.0
    score = float(np.clip((ratio - 0.95) / 1.5, 0.0, 1.0))
    xm = grad / (grad.max() + 1e-8)
    return score, ratio, xm


def skin_texture(face_rgb: np.ndarray, regs: Dict[str, np.ndarray]) -> Optional[Dict[str, float]]:
    g = cv2.cvtColor(face_rgb, cv2.COLOR_RGB2GRAY)
    m = regs["skin"]
    if m.sum() < 200:
        return None
    lap = float(cv2.Laplacian(g, cv2.CV_64F)[m].var())
    c = g[1:-1, 1:-1].astype(np.int16)
    offsets = [(-1, -1), (-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1)]
    code = sum(
        ((g[1 + dy : g.shape[0] - 1 + dy, 1 + dx : g.shape[1] - 1 + dx] >= c).astype(np.uint8) << i)
        for i, (dy, dx) in enumerate(offsets)
    )
    hist = np.bincount(code[m[1:-1, 1:-1]], minlength=256).astype(float)
    hist /= hist.sum() + 1e-8
    ent = float(-(hist[hist > 0] * np.log2(hist[hist > 0])).sum())
    score = float(np.clip(0.5 * (1.0 - lap / 120.0) + 0.5 * (1.0 - ent / 7.0), 0.0, 1.0))
    return {"laplacian_var": round(lap, 2), "lbp_entropy": round(ent, 3), "score": round(score, 3)}
'''

# ---------------------------------------------------------------------
# 8. veristream/gemini_engine.py
# ---------------------------------------------------------------------
FILES["veristream/gemini_engine.py"] = '''"""Layer 5: Fine-Tuned Gemini Forensic Engine & Local Fallback Narrative."""
import os
import json
from typing import Dict, Any, Optional, List
import numpy as np
from .config import Config, to_png_bytes

GEMINI_SYSTEM = (
    "You are the VeriStream Fine-Tuned Forensic Engine. You receive (a) a structured JSON score packet from a "
    "dual-stream (Global + Local) deepfake detector and (b) decoupled forensic heatmaps (Swin GAR, CrossViT GAR "
    "with Face Mesh overlay, Depth Map, Pose Skeleton, Face X-ray boundary map, SRM noise residual). "
    "Synthesize the mathematical telemetry and visual heatmaps into an authoritative forensic report. "
    "Do not invent metrics. Explicitly note if localized diffusion edits might evade global face-swap weights. "
    'Reply strictly as JSON: {"verdict": str, "confidence": number 0-100, "summary": str, '
    '"key_evidence": [str], "visual_observations": [str], "limitations": [str]}'
)


def gemini_report(payload: Dict[str, Any], images: Dict[str, np.ndarray], cfg: Config) -> Optional[Dict[str, Any]]:
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not key:
        return None
    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=key)
        clean_payload = {k: v for k, v in payload.items() if k != "forensic_narrative"}
        parts: List[Any] = [f"Forensic Score Packet:\\n{json.dumps(clean_payload, indent=2)[:30000]}"]
        for name, arr in images.items():
            parts.append(f"Decoupled Forensic Map: {name}")
            parts.append(types.Part.from_bytes(data=to_png_bytes(arr), mime_type="image/png"))
        r = client.models.generate_content(
            model=cfg.gemini_model,
            contents=parts,
            config=types.GenerateContentConfig(
                system_instruction=GEMINI_SYSTEM,
                temperature=0.2,
                response_mime_type="application/json",
            ),
        )
        return json.loads(r.text)
    except Exception as e:
        return {"error": f"Gemini API call failed: {e}"}


def local_narrative(report: Dict[str, Any]) -> Dict[str, Any]:
    ev = [f"{e['name']} [{e['stream']}]: score={e['score']:.3f} ({e['note']})" for e in report["evidence"]]
    loc = report.get("local_stream", {})
    vis_obs = []
    if "gar_mesh_overlap" in loc:
        ov = loc["gar_mesh_overlap"]
        vis_obs.append(
            f"Mesh-GAR Overlap: {ov.get('critical_zone_hot_concentration', 0)*100:.1f}% of top CrossViT attention "
            f"patches fall on critical facial regions (boundary/eyes/mouth/nose); "
            f"{ov.get('attention_outside_face', 0)*100:.1f}% falls outside the face oval."
        )
    if "face_xray" in loc:
        vis_obs.append(f"Face X-ray boundary seam-to-interior gradient ratio is {loc['face_xray']['boundary_noise_ratio']}.")
    return {
        "verdict": report["verdict"],
        "confidence": round(report["manipulation_probability"] * 100, 1),
        "summary": (
            f"VeriStream Late Fusion adjudicated this image as {report['verdict']} "
            f"with a {report['confidence_percentage']} manipulation probability across {len(ev)} active forensic signals."
        ),
        "key_evidence": ev,
        "visual_observations": vis_obs,
        "limitations": [
            "CrossViT excels at full-face swaps and GAN synthesis; localized diffusion inpainting (e.g., hair/glasses edits) relies more heavily on SRM, FFT, and Swin V2 global context.",
            "Set GEMINI_API_KEY to enable multimodal visual heatmap reasoning via Gemini.",
        ],
    }
'''

# ---------------------------------------------------------------------
# 9. veristream/pipeline.py
# ---------------------------------------------------------------------
FILES["veristream/pipeline.py"] = '''"""Layer 4: Late Fusion, Module Health Tracking & Pipeline Orchestrator."""
import json
import time
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import cv2
import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image, ImageOps
from torchvision import transforms

from .config import Config, DEVICE, IMNET
from .metadata import MetadataLayer
from .router import Router
from .explainability import overlay_heat, overlay_mesh_on_gar
from .global_stream import SwinGlobal, DepthGlobal, PoseGlobal
from .local_stream import (
    srm_residual, CrossViTLocal, FaceMeshLocal,
    spectral_fft, face_xray_boundary, skin_texture,
    L_EYE_EAR, R_EYE_EAR, OVAL
)
from .gemini_engine import gemini_report, local_narrative


class VeriStream:
    def __init__(self, cfg: Optional[Config] = None):
        self.cfg = cfg or Config()
        self._m: Dict[str, Any] = {}
        self.module_errors: Dict[str, str] = {}

    def _get(self, name: str, ctor):
        if name not in self._m:
            try:
                self._m[name] = ctor(self.cfg)
                self.module_errors.pop(name, None)
            except Exception as e:
                err_msg = f"{type(e).__name__}: {e}"
                print(f"[VeriStream Warning] Module '{name}' failed to load -> {err_msg}")
                self.module_errors[name] = err_msg
                self._m[name] = None
        return self._m[name]

    def fuse(self, sig: List[Dict[str, Any]]) -> float:
        w = self.cfg.weights
        use = [s for s in sig if s.get("score") is not None and s.get("key") in w]
        tw = sum(w[s["key"]] for s in use)
        return float(sum(w[s["key"]] * s["score"] for s in use) / tw) if tw > 0 else 0.0

    def analyze(self, path: str | Path, save: bool = True, use_gemini: bool = True) -> Tuple[Dict[str, Any], Dict[str, np.ndarray]]:
        cfg, t0 = self.cfg, time.time()
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(f"Image not found: {path}")

        img = ImageOps.exif_transpose(Image.open(path).convert("RGB"))
        rgb = np.array(img)
        vis: Dict[str, np.ndarray] = {}
        sig: List[Dict[str, Any]] = []
        rep: Dict[str, Any] = {"file": path.name, "size": list(img.size)}

        # --- LAYER 0: METADATA ---
        meta = MetadataLayer().evaluate(path)
        rep["metadata"] = meta

        # --- LAYER 1: SMART ROUTER ---
        router = self._get("router", Router)
        route = router.route(img) if router else {"human_present": False, "crop": None, "box": None, "conf": 0.0}
        rep["router"] = {k: route[k] for k in ("human_present", "box", "conf")}

        # --- LAYER 2: GLOBAL STREAM ---
        glob: Dict[str, Any] = {}
        swin = self._get("swin", SwinGlobal)
        if swin:
            p_swin, heat_swin = swin.run(img)
            glob["swin_p_fake"] = round(p_swin, 4)
            sig.append(dict(
                name="Swin V2 Noise/Global Transformer",
                stream="global",
                key="swin",
                score=p_swin,
                note=f"P(Fake)={p_swin:.3f}",
            ))
            vis["swin_gar"] = overlay_heat(cv2.resize(rgb, (256, 256)), heat_swin)

        dep = self._get("depth", DepthGlobal)
        if dep:
            d, dmap = dep.run(img)
            glob["depth"] = d
            s_depth = min(d["discontinuity_variance"] / (2.0 * cfg.depth_thr), 1.0)
            sig.append(dict(
                name="Depth Anything V2 Discontinuity",
                stream="global",
                key="depth",
                score=s_depth,
                note=f"var={d['discontinuity_variance']}, paradox={d['spatial_paradox_flag']}",
            ))
            vis["depth_map"] = cv2.cvtColor(dmap, cv2.COLOR_GRAY2RGB)

        pose = self._get("pose", PoseGlobal)
        if pose:
            a, pvis = pose.run(rgb)
            glob["anatomy"] = a
            if a["status"] == "success":
                sc_anat = min(0.35 + 0.35 * len(a["anomalies"]), 1.0) if a["anatomical_anomaly_flag"] else 0.05
                sig.append(dict(
                    name="MediaPipe Macro-Anatomy Pose",
                    stream="global",
                    key="anatomy",
                    score=sc_anat,
                    note="; ".join(a["anomalies"]) if a["anomalies"] else "3D joint angles & limb ratios normal",
                ))
                vis["pose"] = pvis

        glob["global_stream_suspicious"] = any(s["score"] >= 0.5 for s in sig if s["stream"] == "global")
        rep["global_stream"] = glob

        # --- LAYER 3: LOCAL STREAM ---
        loc: Dict[str, Any] = {}
        if route["human_present"] and route["crop"] is not None:
            crop = route["crop"]
            c240 = np.array(crop.resize((240, 240), Image.BICUBIC))
            vis["face_crop"] = c240

            res_mag, srm_score = srm_residual(c240)
            loc["srm"] = {
                "mean_abs_residual": round(float(res_mag.mean()), 4),
                "std": round(float(res_mag.std()), 4),
                "patch_inconsistency_score": round(srm_score, 4),
            }
            sig.append(dict(
                name="SRM High-Pass Noise Residual",
                stream="local",
                key="srm",
                score=srm_score,
                note=f"patch noise inconsistency={srm_score:.3f}",
            ))
            vis["srm_residual"] = cv2.applyColorMap(
                (np.clip(res_mag / (res_mag.max() + 1e-8), 0, 1) * 255).astype(np.uint8),
                cv2.COLORMAP_INFERNO,
            )[..., ::-1]

            cv_mod = self._get("crossvit", CrossViTLocal)
            heat_cv, p_cv = None, None
            if cv_mod:
                p_cv, heat_cv = cv_mod.run(crop)
                loc["crossvit_p_fake"] = round(p_cv, 4)
                sig.append(dict(
                    name="Cross-ViT Dual-Patch Transformer",
                    stream="local",
                    key="crossvit",
                    score=p_cv,
                    note=f"P(Fake)={p_cv:.3f} (margin={cfg.face_margin})",
                ))
                vis["crossvit_gar"] = overlay_heat(c240, heat_cv)

            var_fft, spec_img = spectral_fft(c240)
            loc["fft"] = {
                "high_freq_variance": round(var_fft, 2),
                "spectral_anomaly_flag": bool(var_fft > cfg.fft_thr),
            }
            sig.append(dict(
                name="FFT Spectral Grid Analysis",
                stream="local",
                key="fft",
                score=min(var_fft / (2.0 * cfg.fft_thr), 1.0),
                note=f"tail variance={var_fft:.1f}",
            ))
            vis["fft_spectrum"] = cv2.cvtColor(spec_img, cv2.COLOR_GRAY2RGB)

            fm = self._get("facemesh", FaceMeshLocal)
            pts = fm.run(c240) if fm else None
            if pts is not None:
                el, er = fm.ear(pts, L_EYE_EAR), fm.ear(pts, R_EYE_EAR)
                ear_diff = abs(el - er)
                loc["ear"] = {
                    "left": round(el, 3),
                    "right": round(er, 3),
                    "asymmetry": round(ear_diff, 3),
                    "structural_anomaly_flag": bool(ear_diff > cfg.ear_thr),
                }
                sig.append(dict(
                    name="MediaPipe Face Mesh (EAR Asymmetry)",
                    stream="local",
                    key="ear",
                    score=min(ear_diff / (2.0 * cfg.ear_thr), 1.0),
                    note=f"|dEAR|={ear_diff:.3f}",
                ))

                regs = fm.regions(pts, c240.shape)
                if heat_cv is not None:
                    ov = fm.gar_overlap(heat_cv, regs)
                    loc["gar_mesh_overlap"] = ov
                    vis["mesh_gar_overlay"] = overlay_mesh_on_gar(c240, heat_cv, pts, OVAL)
                    base_p = p_cv if p_cv is not None else 0.5
                    ov_score = float(np.clip(base_p * (0.6 + 0.6 * ov["critical_zone_hot_concentration"]), 0.0, 1.0))
                    sig.append(dict(
                        name="Mesh & GAR Coordinate Overlap Check",
                        stream="local",
                        key="gar_overlap",
                        score=ov_score,
                        note=f"critical-zone hot share={ov['critical_zone_hot_concentration']:.2f}",
                    ))

                mv = c240.copy()
                for q in pts.astype(int):
                    cv2.circle(mv, tuple(q), 1, (0, 255, 0), -1)
                vis["face_mesh"] = mv

                fg = None
                if cfg.use_faceguard:
                    if cfg.faceguard_ts and Path(cfg.faceguard_ts).exists():
                        ts = self._get("faceguard_ts", lambda c: torch.jit.load(str(c.faceguard_ts), map_location=DEVICE).eval())
                        if ts is not None:
                            x_ts = IMNET(transforms.ToTensor()(Image.fromarray(c240))).unsqueeze(0).to(DEVICE)
                            with torch.no_grad():
                                o = ts(x_ts)
                                pf = float(F.softmax(o, 1)[0, 1]) if o.shape[-1] == 2 else float(torch.sigmoid(o).flatten()[0])
                            fg = {"score": round(pf, 4), "source": "torchscript_model"}
                    if fg is None:
                        fg = skin_texture(c240, regs)
                        if fg:
                            fg["source"] = "lbp_laplacian_skin_texture"

                if fg:
                    loc["faceguard_skin_texture"] = fg
                    sig.append(dict(
                        name="Deep Faceguard Skin Texture",
                        stream="local",
                        key="skin",
                        score=fg["score"],
                        note=f"source={fg['source']}",
                    ))
                else:
                    xs, ratio, xmap = face_xray_boundary(c240, regs)
                    loc["face_xray"] = {
                        "boundary_noise_ratio": round(ratio, 3),
                        "score": round(xs, 3),
                    }
                    sig.append(dict(
                        name="Face X-ray Blending Boundaries",
                        stream="local",
                        key="xray",
                        score=xs,
                        note=f"seam/interior gradient ratio={ratio:.2f}",
                    ))
                    vis["xray_map"] = cv2.applyColorMap((xmap * 255).astype(np.uint8), cv2.COLORMAP_MAGMA)[..., ::-1]

        loc["local_stream_suspicious"] = any(s["score"] >= 0.5 for s in sig if s["stream"] == "local")
        rep["local_stream"] = loc

        # --- LAYER 4: LATE FUSION ---
        prob = self.fuse(sig)
        if meta["provenance_score"] >= 1.0:
            prob = max(prob, 0.95)
            verdict = "AI_GENERATED_PROVENANCE_MARKER"
        elif prob >= cfg.verdict_fake:
            verdict = "DEEPFAKE_DETECTED"
        elif prob >= cfg.verdict_suspicious:
            verdict = "SUSPICIOUS_MANIPULATION"
        else:
            verdict = "LIKELY_REAL"

        rep["module_warnings"] = self.module_errors.copy()
        rep.update(
            verdict=verdict,
            manipulation_probability=round(prob, 4),
            confidence_percentage=f"{prob * 100:.1f}%",
            evidence=[
                {k: (round(v, 4) if isinstance(v, float) else v) for k, v in s.items()}
                for s in sig
            ],
        )

        # --- LAYER 5: GEMINI FORENSIC ENGINE ---
        evidence_imgs = {
            "original": cv2.resize(rgb, (512, int(512 * rgb.shape[0] / rgb.shape[1]))) if rgb.shape[1] > 512 else rgb
        }
        for k in ("swin_gar", "crossvit_gar", "mesh_gar_overlay", "depth_map", "pose", "xray_map", "srm_residual"):
            if k in vis:
                evidence_imgs[k] = vis[k]

        g_rep = gemini_report(rep, evidence_imgs, cfg) if use_gemini else None
        rep["forensic_narrative"] = g_rep if (g_rep and "error" not in g_rep) else local_narrative(rep)
        if g_rep and "error" in g_rep:
            rep["gemini_error"] = g_rep["error"]
        rep["runtime_sec"] = round(time.time() - t0, 2)

        if save:
            d = cfg.out_dir / path.stem
            d.mkdir(parents=True, exist_ok=True)
            for k, v in vis.items():
                cv2.imwrite(str(d / f"{k}.png"), cv2.cvtColor(v, cv2.COLOR_RGB2BGR))
            (d / "report.json").write_text(json.dumps(rep, indent=2, default=str))
            rep["output_dir"] = str(d)

        return rep, vis
'''

# ---------------------------------------------------------------------
# 10. app.py (Streamlit Web UI)
# ---------------------------------------------------------------------
FILES["app.py"] = '''"""VeriStream Forensic Report Web UI. Run with: streamlit run app.py"""
import json
import tempfile
from pathlib import Path
import streamlit as st
from veristream import VeriStream, Config

st.set_page_config(page_title="VeriStream Forensic Engine", layout="wide")


@st.cache_resource
def get_engine(use_fg: bool, margin: float):
    cfg = Config(use_faceguard=use_fg, face_margin=margin)
    return VeriStream(cfg)


st.title("VeriStream: Dual-Stream Deepfake Forensic Engine")

with st.sidebar:
    st.header("Pipeline Controls")
    use_g = st.checkbox("Use Layer 5 Gemini Forensic Engine", value=True)
    use_fg = st.checkbox("Deep Faceguard Available? (Skin Texture vs Face X-ray)", value=False)
    margin = st.slider("MTCNN Face Crop Margin (CrossViT Scale)", 0.10, 0.80, 0.50, 0.05)

up = st.file_uploader("Upload a static image for forensic adjudication", type=["jpg", "jpeg", "png", "webp"])

if up:
    tmp = Path(tempfile.mkdtemp()) / up.name
    tmp.write_bytes(up.getvalue())

    engine = get_engine(use_fg, margin)
    with st.spinner("Executing Layer 0 -> Layer 5 Forensic Streams..."):
        rep, vis = engine.analyze(tmp, use_gemini=use_g)

    if rep.get("module_warnings"):
        for mod, msg in rep["module_warnings"].items():
            st.warning(f"Module `{mod}` warning: {msg}")

    color = {
        "DEEPFAKE_DETECTED": "red",
        "AI_GENERATED_PROVENANCE_MARKER": "red",
        "SUSPICIOUS_MANIPULATION": "orange",
    }.get(rep["verdict"], "green")

    c1, c2 = st.columns([1, 2])
    c1.image(up, caption=f"Uploaded: {up.name}", use_container_width=True)
    if "face_crop" in vis:
        c1.image(vis["face_crop"], caption=f"MTCNN Routed Face (Margin={margin})", width=220)

    c2.markdown(f"## Verdict: :{color}[{rep['verdict']}]")
    m1, m2, m3 = c2.columns(3)
    m1.metric("Manipulation Probability", rep["confidence_percentage"])
    m2.metric("Human Face Routed", "Yes" if rep["router"]["human_present"] else "No")
    m3.metric("Execution Time", f"{rep['runtime_sec']}s")
    c2.progress(min(max(float(rep["manipulation_probability"]), 0.0), 1.0))

    n = rep.get("forensic_narrative", {})
    c2.markdown("### Executive Forensic Summary")
    c2.write(n.get("summary", ""))
    for k in ("key_evidence", "visual_observations", "limitations"):
        if n.get(k):
            c2.markdown(f"**{k.replace('_', ' ').title()}**\\n" + "\\n".join(f"- {x}" for x in n[k]))

    st.subheader("Layer 4: Late Fusion Signal Breakdown")
    st.dataframe(
        [
            {
                "Stream": e["stream"].upper(),
                "Forensic Module": e["name"],
                "Normalized Score (0=Real, 1=Fake)": round(e["score"], 3),
                "Telemetry Note": e["note"],
            }
            for e in rep["evidence"]
        ],
        use_container_width=True,
    )

    st.subheader("Decoupled Forensic Heatmaps & Overlays")
    map_keys = [
        k for k in (
            "swin_gar", "crossvit_gar", "mesh_gar_overlay",
            "srm_residual", "xray_map", "fft_spectrum", "depth_map", "pose", "face_mesh"
        ) if k in vis
    ]
    if map_keys:
        cols = st.columns(min(len(map_keys), 4))
        for idx, k in enumerate(map_keys):
            cols[idx % len(cols)].image(vis[k], caption=k.replace("_", " ").upper(), use_container_width=True)

    if rep.get("gemini_error"):
        st.warning(rep["gemini_error"])

    with st.expander("Inspect Raw Telemetry Packet (JSON)"):
        st.json(rep)

    st.download_button(
        "Download Final Forensic Report (JSON)",
        json.dumps(rep, indent=2, default=str),
        file_name=f"veristream_{Path(up.name).stem}_report.json",
        mime="application/json",
    )
'''

# ---------------------------------------------------------------------
# 11. run_cli.py (Terminal Runner & Module Health Check)
# ---------------------------------------------------------------------
FILES["run_cli.py"] = '''#!/usr/bin/env python3
"""CLI Runner and Module Health Checker for VeriStream."""
import argparse
from pathlib import Path
from veristream import VeriStream, Config


def check_paths(cfg: Config):
    print("=== VeriStream Checkpoint & Asset Check ===")
    print(f" [Swin V2 Checkpoint]  : {cfg.swin_ckpt} -> {'FOUND' if cfg.swin_ckpt and cfg.swin_ckpt.exists() else 'MISSING'}")
    print(f" [Swin V2 Class Map]   : {cfg.swin_class_map} -> {'FOUND' if cfg.swin_class_map and cfg.swin_class_map.exists() else 'MISSING'}")
    print(f" [CrossViT Checkpoint] : {cfg.crossvit_ckpt} -> {'FOUND' if cfg.crossvit_ckpt and cfg.crossvit_ckpt.exists() else 'MISSING'}")
    print("=" * 43)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="VeriStream Modular Forensic CLI")
    ap.add_argument("images", nargs="*", help="Image paths to analyze")
    ap.add_argument("--no-gemini", action="store_true", help="Skip Gemini API narrative")
    ap.add_argument("--faceguard", action="store_true", help="Use Deep Faceguard Skin Texture branch")
    ap.add_argument("--margin", type=float, default=0.50, help="MTCNN face crop margin (default: 0.50)")
    args = ap.parse_args()

    cfg = Config(use_faceguard=args.faceguard, face_margin=args.margin)
    check_paths(cfg)
    vs = VeriStream(cfg)

    targets = args.images
    if not targets:
        inp = input("Enter full path to an image to test (or 'q' to quit): ").strip().strip("'\\"")
        if inp and inp.lower() != "q":
            targets = [inp]

    for p in targets:
        rep, _ = vs.analyze(p, use_gemini=not args.no_gemini)
        print("\\n" + "=" * 65)
        print(f"FILE      : {rep['file']}")
        print(f"VERDICT   : {rep['verdict']} (Manipulation Prob: {rep['confidence_percentage']})")
        print(f"ROUTER    : Human Present={rep['router']['human_present']} (Conf={rep['router']['conf']})")
        if rep.get("module_warnings"):
            print(f"WARNINGS  : {rep['module_warnings']}")
        print("-" * 65)
        for e in rep["evidence"]:
            print(f" [{e['stream'].upper():6s}] {e['name']:36s}: {e['score']:.3f} | {e['note']}")
        print("=" * 65)
        print(f"Saved artifacts to: {rep.get('output_dir')}\\n")
'''

# Write all Python files
for rel_path, content in FILES.items():
    p = Path(rel_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    print(f"✔ Created {p}")

# ---------------------------------------------------------------------
# 12. Generate VeriStream_Modular.ipynb (Clean Notebook Importing Modules)
# ---------------------------------------------------------------------
nb_cells = [
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "# VeriStream: Modular Deepfake Forensic Notebook\n",
            "This notebook imports directly from your modular `veristream/` package so each layer stays clean and easy to debug:\n",
            "- `veristream/config.py` — Paths, thresholds, and weights\n",
            "- `veristream/metadata.py` — Layer 0: C2PA & EXIF Pre-Check\n",
            "- `veristream/router.py` — Layer 1: MTCNN Smart Router (`face_margin=0.50`)\n",
            "- `veristream/global_stream.py` — Layer 2: Swin V2 + GAR, Depth Anything V2, MediaPipe Pose\n",
            "- `veristream/local_stream.py` — Layer 3: SRM, CrossViT + GAR, FaceMesh, EAR, FFT, Mesh-GAR Overlap, Face X-ray/Skin\n",
            "- `veristream/pipeline.py` — Layer 4: Late Fusion Orchestrator\n",
            "- `veristream/gemini_engine.py` — Layer 5: Gemini Forensic Narrative"
        ]
    },
    {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "from pathlib import Path\n",
            "import json\n",
            "import matplotlib.pyplot as plt\n",
            "from veristream import Config, VeriStream, DEVICE\n",
            "\n",
            "cfg = Config(face_margin=0.50, use_faceguard=False)\n",
            "print(f'Active Device         : {DEVICE}')\n",
            "print(f'Swin V2 Checkpoint    : {cfg.swin_ckpt} (Exists: {cfg.swin_ckpt.exists()})')\n",
            "print(f'CrossViT Checkpoint   : {cfg.crossvit_ckpt} (Exists: {cfg.crossvit_ckpt.exists()})')"
        ]
    },
    {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "# Initialize the modular orchestrator\n",
            "vs = VeriStream(cfg)\n",
            "\n",
            "target_image = input('Enter full path to an image to analyze: ').strip().strip(\"'\\\"\")\n",
            "if Path(target_image).exists():\n",
            "    rep, vis = vs.analyze(target_image)\n",
            "    print('\\n' + '='*65)\n",
            "    print(f\"VERDICT: {rep['verdict']} | Manipulation Probability: {rep['confidence_percentage']}\")\n",
            "    print('='*65)\n",
            "    for e in rep['evidence']:\n",
            "        print(f\"  [{e['stream'].upper():6s}] {e['name']:36s} -> score={e['score']:.3f} ({e['note']})\")\n",
            "    if rep.get('module_warnings'):\n",
            "        print('\\nModule Warnings:', rep['module_warnings'])\n",
            "    \n",
            "    if vis:\n",
            "        cols = min(len(vis), 4)\n",
            "        rows = (len(vis) + cols - 1) // cols\n",
            "        fig, axes = plt.subplots(rows, cols, figsize=(4 * cols, 4 * rows))\n",
            "        axes_flat = axes.flatten() if hasattr(axes, 'flatten') else [axes]\n",
            "        for ax, (k, arr) in zip(axes_flat, vis.items()):\n",
            "            ax.imshow(arr)\n",
            "            ax.set_title(k.replace('_', ' ').upper(), fontsize=10, fontweight='bold')\n",
            "            ax.axis('off')\n",
            "        for ax in axes_flat[len(vis):]:\n",
            "            ax.axis('off')\n",
            "        plt.tight_layout()\n",
            "        plt.show()\n",
            "else:\n",
            "    print(f'File not found: {target_image}')"
        ]
    }
]

nb = {
    "cells": nb_cells,
    "metadata": {
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
        "language_info": {"name": "python"}
    },
    "nbformat": 4,
    "nbformat_minor": 5
}

Path("VeriStream_Modular.ipynb").write_text(json.dumps(nb, indent=2), encoding="utf-8")
print("✔ Created VeriStream_Modular.ipynb")
print("\n🎉 Modular VeriStream package is ready! Run `python run_cli.py` or `streamlit run app.py`.")
