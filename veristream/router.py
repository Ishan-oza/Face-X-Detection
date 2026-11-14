"""Layer 1: Ingestion & Smart Router (MTCNN Face Detection & Alignment)."""
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
