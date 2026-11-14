"""Layer 4: Late Fusion, Module Health Tracking & Pipeline Orchestrator."""
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
        heat_swin = None
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

                # Locate exact anatomical parts where Local (CrossViT) & Global (Swin V2) heatmaps are RED
                red_zones = fm.locate_red_zones(
                    pts_240=pts,
                    local_heat=heat_cv,
                    global_heat=heat_swin,
                    crop_box=route["box"],
                    orig_size=img.size,
                )
                loc["facemesh_red_zones"] = red_zones

                if heat_cv is not None:
                    ov = fm.gar_overlap(heat_cv, regs)
                    loc["gar_mesh_overlap"] = ov
                    vis["mesh_gar_overlay"] = overlay_mesh_on_gar(c240, heat_cv, pts, OVAL)
                    base_p = p_cv if p_cv is not None else 0.5
                    ov_score = float(np.clip(base_p * (0.6 + 0.6 * ov["critical_zone_hot_concentration"]), 0.0, 1.0))
                    hot_parts_note = ", ".join(red_zones.get("local_red_parts", [])[:2]) or f"crit share={ov['critical_zone_hot_concentration']:.2f}"
                    sig.append(dict(
                        name="Mesh & GAR Coordinate Overlap Check",
                        stream="local",
                        key="gar_overlap",
                        score=ov_score,
                        note=f"Red zones: {hot_parts_note}",
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
