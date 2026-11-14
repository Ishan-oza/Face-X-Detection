"""Layer 2: Global Stream (Swin V2 Noise, Depth Anything V2, MediaPipe Pose Anatomy)."""
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
