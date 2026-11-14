"""Layer 3: Local Stream (SRM, CrossViT, FaceMesh, 478-Dot Red-Zone Locator, EAR, FFT, Face X-ray/Skin)."""
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


# MediaPipe 478 FaceMesh Landmark Groups
OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149,
        150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
L_EYE_C = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
R_EYE_C = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
L_BROW = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46]
R_BROW = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276]
LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185,
        78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191]
NOSE = [168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 164, 0, 11, 12, 13, 14, 15, 16, 17, 18, 200, 199, 175,
        129, 98, 97, 326, 327, 358, 49, 279]
FOREHEAD = [10, 151, 9, 8, 107, 66, 105, 63, 70, 109, 67, 103, 54, 21, 338, 297, 332, 284, 251, 300, 293, 334, 296, 336]
L_CHEEK = [116, 117, 118, 119, 120, 121, 128, 245, 193, 55, 65, 52, 53, 46, 124, 35, 111, 123, 50, 101, 36, 205, 206, 207, 187, 147, 213, 192]
R_CHEEK = [345, 346, 347, 348, 349, 350, 357, 465, 417, 285, 295, 282, 283, 276, 353, 265, 340, 352, 280, 330, 266, 425, 426, 427, 411, 376, 433, 416]
JAWLINE = [152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454, 356, 389]

ANATOMICAL_DOT_GROUPS: Dict[str, List[int]] = {
    "Left Eye": L_EYE_C,
    "Right Eye": R_EYE_C,
    "Left Eyebrow": L_BROW,
    "Right Eyebrow": R_BROW,
    "Nose Bridge & Tip": NOSE,
    "Lips & Mouth": LIPS,
    "Forehead": FOREHEAD,
    "Left Cheek": L_CHEEK,
    "Right Cheek": R_CHEEK,
    "Jawline & Chin Boundary": JAWLINE,
}

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

    def locate_red_zones(
        self,
        pts_240: np.ndarray,
        local_heat: Optional[np.ndarray],
        global_heat: Optional[np.ndarray],
        crop_box: Optional[List[int]],
        orig_size: Tuple[int, int],
        red_thr: float = 0.55,
    ) -> Dict[str, Any]:
        """
        Uses the 478 FaceMesh dots to identify the exact anatomical parts where the
        Local (CrossViT) and Global (Swin V2) GAR heatmaps are RED (high activation >= red_thr).
        """
        result: Dict[str, Any] = {
            "local_red_parts": [],
            "local_part_scores": {},
            "global_red_parts": [],
            "global_part_scores": {},
            "summary_text": "",
        }

        def sample_dots_on_heatmap(pts_xy: np.ndarray, heat: np.ndarray) -> Tuple[List[str], Dict[str, float]]:
            H, W = heat.shape[:2]
            scores: Dict[str, float] = {}
            for part_name, indices in ANATOMICAL_DOT_GROUPS.items():
                valid_idx = [i for i in indices if i < len(pts_xy)]
                if not valid_idx:
                    continue
                vals = []
                for i in valid_idx:
                    x_i = int(np.clip(round(pts_xy[i, 0]), 0, W - 1))
                    y_i = int(np.clip(round(pts_xy[i, 1]), 0, H - 1))
                    # Sample 3x3 neighborhood around each landmark dot
                    patch = heat[max(0, y_i - 1) : min(H, y_i + 2), max(0, x_i - 1) : min(W, x_i + 2)]
                    vals.append(float(patch.max()) if patch.size else float(heat[y_i, x_i]))
                # Use 75th percentile of dots in that anatomical part to capture peak red hotspots
                scores[part_name] = round(float(np.percentile(vals, 75)), 3)

            # Check background / hair outside the face oval
            face_mask = self.mask(pts_xy, OVAL, (H, W))
            outside = heat[~face_mask]
            if outside.size > 0:
                scores["Background / Hair / Neck (Outside Face Oval)"] = round(float(np.percentile(outside, 90)), 3)

            ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
            red_parts = [f"{k} ({v*100:.0f}% heat)" for k, v in ranked if v >= red_thr][:4]
            if not red_parts and ranked:
                # Always report at least the top 2 highest-attention parts
                red_parts = [f"{k} ({v*100:.0f}% peak)" for k, v in ranked[:2]]
            return red_parts, dict(ranked)

        # 1. Local CrossViT Heatmap (240x240 crop space)
        if local_heat is not None:
            l_red, l_scores = sample_dots_on_heatmap(pts_240, local_heat)
            result["local_red_parts"] = l_red
            result["local_part_scores"] = l_scores

        # 2. Global Swin V2 Heatmap (256x256 full-scene space)
        if global_heat is not None and crop_box is not None and len(crop_box) == 4:
            x1, y1, x2, y2 = crop_box
            orig_W, orig_H = orig_size
            gh, gw = global_heat.shape[:2]
            box_w, box_h = max(x2 - x1, 1), max(y2 - y1, 1)

            # Project 240x240 face-crop dots -> original image -> 256x256 Swin global heatmap
            pts_global = np.zeros_like(pts_240)
            pts_global[:, 0] = ((x1 + (pts_240[:, 0] / 240.0) * box_w) / max(orig_W, 1)) * gw
            pts_global[:, 1] = ((y1 + (pts_240[:, 1] / 240.0) * box_h) / max(orig_H, 1)) * gh

            g_red, g_scores = sample_dots_on_heatmap(pts_global, global_heat)
            result["global_red_parts"] = g_red
            result["global_part_scores"] = g_scores

        parts_msg = []
        if result["local_red_parts"]:
            parts_msg.append("Local Face Heatmap (CrossViT) Red Zones: " + ", ".join(result["local_red_parts"]))
        if result["global_red_parts"]:
            parts_msg.append("Global Scene Heatmap (Swin V2) Red Zones: " + ", ".join(result["global_red_parts"]))
        result["summary_text"] = " | ".join(parts_msg)
        return result


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
