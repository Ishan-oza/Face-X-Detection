"""Layer 0: Metadata, C2PA, EXIF, and AI Generator Signature Pre-Check."""
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
