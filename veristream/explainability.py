"""GAR (Gradient-weighted Activation Relevance) Heatmaps & Visual Overlays."""
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
