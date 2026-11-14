"""Layer 5: Gemini forensic engine, API-key validator, network diagnosis & FaceMesh red-zone narrative."""
from __future__ import annotations
import json
import os
import re
import socket
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from .config import Config
try:
    from .utils import to_png_bytes
except ImportError:
    from .config import to_png_bytes

GEMINI_HOST = "generativelanguage.googleapis.com"
TIMEOUT_MS = 25_000

GEMINI_SYSTEM = (
    "You are the VeriStream Forensic Engine. You receive (a) a structured JSON score packet from a "
    "dual-stream (Global + Local) deepfake detector, including 'facemesh_red_zones' which lists the exact "
    "anatomical facial parts (e.g., Left Eye, Right Eye, Lips & Mouth, Nose Bridge & Tip, Cheeks, Forehead, "
    "Jawline & Chin Boundary, or Background/Hair) where the Local CrossViT and Global Swin V2 heatmaps are RED, "
    "and (b) decoupled forensic heatmaps. "
    "Synthesize the mathematical telemetry, the FaceMesh red-zone anatomical part names, and the visual heatmaps "
    "into an authoritative forensic report. Do not invent metrics. "
    "CRITICAL: You must include a 'plain_english_explanation' field written in warm, simple, everyday language "
    "for a non-technical person. In 'plain_english_explanation', explicitly name the exact facial parts or areas "
    "where the Local and Global heatmaps turned red (from 'facemesh_red_zones') and explain in simple terms why "
    "suspicious activity on those specific facial features (e.g. eye asymmetry, mouth/lip blending, jawline seam, "
    "or background noise) indicates why the image might be fake or real. "
    'Reply strictly as JSON: {"verdict": str, "confidence": number 0-100, '
    '"plain_english_explanation": str, "summary": str, '
    '"key_evidence": [str], "visual_observations": [str], "limitations": [str]}'
)

# --------------------------------------------------------------------------------------
# Network helpers (Preserved from working fix)
# --------------------------------------------------------------------------------------
_ORIG_GAI = socket.getaddrinfo
_IPV4_FORCED = False


def force_ipv4() -> None:
    """Make this process resolve hostnames to IPv4 only."""
    global _IPV4_FORCED
    if _IPV4_FORCED:
        return

    def v4_only(host, port, family=0, type=0, proto=0, flags=0):
        return _ORIG_GAI(host, port, socket.AF_INET, type, proto, flags)

    socket.getaddrinfo = v4_only
    _IPV4_FORCED = True


if os.getenv("VS_FORCE_IPV4", "").lower() in ("1", "true", "yes"):
    force_ipv4()


def diagnose_network(host: str = GEMINI_HOST, timeout: float = 5.0) -> Dict[str, str]:
    """Try a raw TCP connection to Google over IPv4 and IPv6 separately."""
    out = {}
    for fam, label in ((socket.AF_INET, "IPv4"), (socket.AF_INET6, "IPv6")):
        try:
            infos = _ORIG_GAI(host, 443, fam, socket.SOCK_STREAM)
            s = socket.socket(fam, socket.SOCK_STREAM)
            s.settimeout(timeout)
            try:
                s.connect(infos[0][4])
            finally:
                s.close()
            out[label] = "reachable"
        except Exception as e:
            out[label] = f"{type(e).__name__}: {e}"
    return out


def _classify(e: BaseException) -> str:
    chain, cur = [], e
    while cur is not None and len(chain) < 6:
        chain.append(cur)
        cur = cur.__cause__ or cur.__context__
    text = " | ".join(f"{type(x).__name__}: {x}" for x in chain)
    code = next((getattr(x, "code", None) or getattr(x, "status_code", None) for x in chain
                 if isinstance(getattr(x, "code", None) or getattr(x, "status_code", None), int)), None)
    low = text.lower()
    if code in (401, 403) or (code == 400 and ("api key not valid" in low or "api_key_invalid" in low)):
        return "bad_key"
    if code == 404 or "not_found" in low:
        return "model_not_found"
    if code == 429 or "resource_exhausted" in low:
        return "quota"
    if code in (500, 502, 503, 504) or "unavailable" in low:
        return "busy"
    if any(isinstance(x, (OSError, ConnectionError, TimeoutError)) for x in chain) or any(
            k in low for k in ("connecterror", "network is unreachable", "errno 101", "name or service not known",
                               "temporary failure in name resolution", "timed out", "timeout", "connection refused",
                               "connection reset", "proxy", "ssl", "getaddrinfo")):
        return "network"
    return "other"


def _network_help() -> str:
    d = diagnose_network()
    lines = [f"Cannot reach Google's Gemini server ({GEMINI_HOST}). This is a NETWORK problem, not a bad key.",
             f"  IPv4: {d['IPv4']}", f"  IPv6: {d['IPv6']}"]
    if d["IPv4"] == "reachable" and d["IPv6"] != "reachable":
        lines.append("Fix: your IPv6 is broken but IPv4 works. Set VS_FORCE_IPV4=1 before starting "
                     "(export VS_FORCE_IPV4=1; streamlit run app.py), or run: sudo sysctl -w net.ipv6.conf.all.disable_ipv6=1")
    elif d["IPv4"] != "reachable":
        lines.append("Fix: check internet / Wi-Fi, turn off VPN, and check HTTPS_PROXY / HTTP_PROXY env vars and firewall. "
                     "Test in a terminal:  curl -I https://generativelanguage.googleapis.com")
    return "\n".join(lines)


def _client(key: str):
    from google import genai
    from google.genai import types
    return genai.Client(api_key=key.strip(), http_options=types.HttpOptions(timeout=TIMEOUT_MS)), types


# --------------------------------------------------------------------------------------
# Key validation
# --------------------------------------------------------------------------------------
def _validate_once(key: str) -> Tuple[bool, str]:
    client, _ = _client(key)
    first = next(iter(client.models.list(config={"page_size": 5})), None)
    if first is None:
        return False, "Key accepted but no models were returned for it."
    return True, "API key verified successfully!"


def validate_gemini_key(api_key: str) -> Tuple[bool, str]:
    key = (api_key or "").strip()
    if len(key) < 20:
        return False, "That does not look like a Gemini API key (too short). Get one at https://aistudio.google.com/apikey"
    try:
        return _validate_once(key)
    except Exception as e:
        kind = _classify(e)
        if kind == "network":
            d = diagnose_network()
            if d["IPv4"] == "reachable" and d["IPv6"] != "reachable" and not _IPV4_FORCED:
                force_ipv4()
                try:
                    ok, msg = _validate_once(key)
                    return ok, msg + " (IPv4-only mode was enabled automatically because IPv6 is broken on this machine.)"
                except Exception as e2:
                    e, kind = e2, _classify(e2)
            if kind == "network":
                return False, _network_help()
        if kind == "bad_key":
            return False, "Google rejected this API key (wrong, deleted, or restricted). Create a new one at https://aistudio.google.com/apikey"
        if kind == "quota":
            return True, "Key is valid, but its quota is currently exhausted (HTTP 429). Try again later."
        if kind == "busy":
            return False, f"Google's servers are temporarily busy (HTTP 5xx). Try again in a minute. Details: {e}"
        return False, f"Unexpected error while validating the key: {type(e).__name__}: {e}"


# --------------------------------------------------------------------------------------
# Report generation
# --------------------------------------------------------------------------------------
def _fallback_models(client, exclude: List[str]) -> List[str]:
    found = []
    try:
        for m in client.models.list(config={"page_size": 100}):
            name = (m.name or "").replace("models/", "")
            acts = getattr(m, "supported_actions", None) or []
            if "flash" in name and "generateContent" in acts and not any(
                    x in name for x in ("image", "tts", "live", "audio", "embed", "thinking-exp", "robotics", "computer")):
                v = re.search(r"gemini-(\d+(?:\.\d+)?)", name)
                found.append((float(v.group(1)) if v else 0.0, "lite" not in name, name))
    except Exception:
        pass
    found.sort(reverse=True)
    return [n for _, _, n in found if n not in exclude][:4]


def _parse_json(text: str) -> Dict[str, Any]:
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", (text or "").strip())
    obj = json.loads(t)
    if isinstance(obj, list) and obj:
        obj = obj[0]
    if not isinstance(obj, dict):
        raise ValueError("Gemini did not return a JSON object")
    return obj


def gemini_report(payload: Dict[str, Any], images: Dict[str, np.ndarray], cfg: Config) -> Optional[Dict[str, Any]]:
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not key:
        return None
    try:
        client, types = _client(key)
        clean = {k: v for k, v in payload.items() if k != "forensic_narrative"}
        red_zones = clean.get("local_stream", {}).get("facemesh_red_zones", {})
        red_summary = red_zones.get("summary_text", "No face mesh red-zone data available.")

        prompt_header = (
            f"IMPORTANT FACEMESH RED-ZONE HOTSPOTS:\n{red_summary}\n\n"
            f"Full Forensic Score Packet:\n{json.dumps(clean, indent=2, default=str)[:30000]}"
        )
        parts: List[Any] = [prompt_header]
        for name, arr in images.items():
            parts += [f"Decoupled Forensic Map: {name}", types.Part.from_bytes(data=to_png_bytes(arr), mime_type="image/png")]
        conf = types.GenerateContentConfig(system_instruction=GEMINI_SYSTEM, temperature=0.2,
                                           response_mime_type="application/json")
        tried, last, queue = [], None, [cfg.gemini_model]
        while queue:
            model = queue.pop(0)
            tried.append(model)
            try:
                r = client.models.generate_content(model=model, contents=parts, config=conf)
                return _parse_json(r.text)
            except Exception as e:
                last, kind = e, _classify(e)
                if kind == "network" and not _IPV4_FORCED:
                    d = diagnose_network()
                    if d["IPv4"] == "reachable" and d["IPv6"] != "reachable":
                        force_ipv4()
                        queue.insert(0, model)
                        tried.pop()
                        continue
                if kind in ("model_not_found", "busy", "quota") or isinstance(e, (ValueError, json.JSONDecodeError)):
                    if len(tried) == 1:
                        queue += _fallback_models(client, tried)
                    continue
                if kind == "network":
                    return {"error": _network_help()}
                if kind == "bad_key":
                    return {"error": "Google rejected the API key. Re-enter a valid key."}
                return {"error": f"Gemini call failed ({type(e).__name__}): {e}"}
        return {"error": f"No Gemini model worked (tried {tried}). Last error: {last}"}
    except Exception as e:
        return {"error": f"Gemini setup failed ({type(e).__name__}): {e}"}


def local_narrative(report: Dict[str, Any]) -> Dict[str, Any]:
    ev = [f"{e['name']} [{e['stream']}]: score={e['score']:.3f} ({e['note']})" for e in report["evidence"]]
    loc = report.get("local_stream", {})
    vis_obs = []
    rz = loc.get("facemesh_red_zones", {})
    l_parts = rz.get("local_red_parts", [])
    g_parts = rz.get("global_red_parts", [])

    if l_parts:
        vis_obs.append(f"Local Heatmap (CrossViT) Red Hotspots mapped via FaceMesh dots: {', '.join(l_parts)}.")
    if g_parts:
        vis_obs.append(f"Global Heatmap (Swin V2) Red Hotspots mapped via FaceMesh dots: {', '.join(g_parts)}.")
    if "gar_mesh_overlap" in loc:
        ov = loc["gar_mesh_overlap"]
        vis_obs.append(
            f"Mesh-GAR Overlap: {ov.get('critical_zone_hot_concentration', 0)*100:.1f}% of top CrossViT attention "
            f"patches fall on critical facial regions (boundary/eyes/mouth/nose)."
        )
    if "face_xray" in loc:
        vis_obs.append(f"Face X-ray boundary seam-to-interior gradient ratio is {loc['face_xray']['boundary_noise_ratio']}.")

    verdict = report["verdict"]
    pct = report["confidence_percentage"]
    hotspot_sentence = ""
    if l_parts or g_parts:
        hot_str = "; ".join(
            ([f"local face heatmap focused on {', '.join(l_parts)}"] if l_parts else []) +
            ([f"global scene heatmap focused on {', '.join(g_parts)}"] if g_parts else [])
        )
        hotspot_sentence = f" Using 478 facial landmark dots, our heatmaps pinpointed the strongest red zones on: {hot_str}."

    if verdict in ("DEEPFAKE_DETECTED", "AI_GENERATED_PROVENANCE_MARKER"):
        plain = (
            f"Our system flagged this image as likely AI-generated or digitally altered ({pct} manipulation score)."
            f"{hotspot_sentence} These specific facial areas showed unnatural digital noise or blending seams that "
            "typically happen when a face is swapped or edited by AI."
        )
    elif verdict == "SUSPICIOUS_MANIPULATION":
        plain = (
            f"This image shows some unusual digital signs ({pct} manipulation score) and should be treated with caution."
            f"{hotspot_sentence} While parts of the photo look normal, those highlighted regions triggered our forensic sensors."
        )
    else:
        plain = (
            f"This photo appears to be authentic ({pct} manipulation score)."
            f"{hotspot_sentence} The lighting, 3D body proportions, and natural camera grain look consistent across the picture."
        )

    return {
        "verdict": verdict,
        "confidence": round(report["manipulation_probability"] * 100, 1),
        "plain_english_explanation": plain,
        "summary": (
            f"VeriStream Late Fusion adjudicated this image as {verdict} "
            f"with a {pct} manipulation probability across {len(ev)} active forensic signals."
        ),
        "key_evidence": ev,
        "visual_observations": vis_obs,
        "limitations": [
            "CrossViT excels at full-face swaps and GAN synthesis; localized diffusion inpainting relies more heavily on SRM, FFT, and Swin V2 global context.",
        ],
    }
