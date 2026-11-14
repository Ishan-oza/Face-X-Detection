"""VeriStream Forensic Report Web UI. Run with: streamlit run app.py"""
import os
import json
import tempfile
from pathlib import Path
import streamlit as st
from veristream import VeriStream, Config
from veristream.gemini_engine import validate_gemini_key

st.set_page_config(page_title="VeriStream Forensic Engine", layout="wide")

if "gemini_authenticated" not in st.session_state:
    st.session_state.gemini_authenticated = False
if "gemini_api_key" not in st.session_state:
    st.session_state.gemini_api_key = ""


@st.cache_resource
def get_engine(use_fg: bool, margin: float):
    cfg = Config(use_faceguard=use_fg, face_margin=margin)
    return VeriStream(cfg)


# =====================================================================
# PAGE 1: WELCOME & GEMINI API KEY GATE
# =====================================================================
if not st.session_state.gemini_authenticated:
    st.title("Welcome to VeriStream Forensic Engine")
    st.markdown(
        """
        **VeriStream** is a multi-stream deepfake and AI-image forensic system.
        To generate human-readable forensic explanations, please enter your free **Google AI Studio Gemini API Key** below.
        """
    )

    with st.form("api_key_form"):
        user_key = st.text_input(
            "Enter your Gemini API Key",
            type="password",
            placeholder="AIzaSy...",
            help="Get a free API key from https://aistudio.google.com/app/apikey",
        )
        submitted = st.form_submit_button("Verify & Continue to Testing Page")

        if submitted:
            with st.spinner("Verifying your Gemini API key with Google AI Studio..."):
                is_valid, msg = validate_gemini_key(user_key)
            if is_valid:
                clean_k = user_key.strip()
                os.environ["GEMINI_API_KEY"] = clean_k
                st.session_state.gemini_api_key = clean_k
                st.session_state.gemini_authenticated = True
                st.success(msg)
                st.rerun()
            else:
                st.error(f"❌ Verification Failed!\n\n{msg}")

    st.stop()


# =====================================================================
# PAGE 2: MAIN FORENSIC TESTING DASHBOARD
# =====================================================================
os.environ["GEMINI_API_KEY"] = st.session_state.gemini_api_key

st.title("VeriStream: Dual-Stream Deepfake Forensic Engine")

with st.sidebar:
    st.success("✔ Gemini API Key Active")
    if st.button("Change API Key / Log Out"):
        st.session_state.gemini_authenticated = False
        st.session_state.gemini_api_key = ""
        os.environ.pop("GEMINI_API_KEY", None)
        st.rerun()

    st.divider()
    st.header("Pipeline Controls")
    use_g = st.checkbox("Use Layer 5 Gemini Forensic Engine", value=True)
    use_fg = st.checkbox("Deep Faceguard Available? (Skin Texture vs Face X-ray)", value=False)
    margin = st.slider("MTCNN Face Crop Margin (CrossViT Scale)", 0.10, 0.80, 0.50, 0.05)

up = st.file_uploader("Upload a static image for forensic adjudication", type=["jpg", "jpeg", "png", "webp"])

if up:
    tmp = Path(tempfile.mkdtemp()) / up.name
    tmp.write_bytes(up.getvalue())

    engine = get_engine(use_fg, margin)
    with st.spinner("Executing Layer 0 -> Layer 5 Forensic Streams & Mapping FaceMesh Red Zones..."):
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

    # --- FACEMESH RED-ZONE ANATOMICAL CALLOUT ---
    rz = rep.get("local_stream", {}).get("facemesh_red_zones", {})
    if rz and (rz.get("local_red_parts") or rz.get("global_red_parts")):
        c2.markdown("### 🎯 FaceMesh Heatmap Red-Zone Pinpoint")
        rz_cols = c2.columns(2)
        if rz.get("local_red_parts"):
            rz_cols[0].warning("**Local Face (CrossViT) Red Zones:**\n- " + "\n- ".join(rz["local_red_parts"]))
        if rz.get("global_red_parts"):
            rz_cols[1].warning("**Global Scene (Swin V2) Red Zones:**\n- " + "\n- ".join(rz["global_red_parts"]))

    n = rep.get("forensic_narrative", {})

    # --- NON-TECHNICAL HUMAN-READABLE EXPLANATION ---
    c2.markdown("### What Does This Mean? (Plain-English Explanation)")
    plain_text = n.get("plain_english_explanation") or n.get("summary", "")
    c2.info(plain_text)

    # --- TECHNICAL EXECUTIVE SUMMARY ---
    with c2.expander("View Technical Forensic Details & Evidence", expanded=True):
        if n.get("summary") and n.get("summary") != plain_text:
            st.markdown(f"**Technical Summary:** {n.get('summary')}")
        for k in ("key_evidence", "visual_observations", "limitations"):
            if n.get(k):
                st.markdown(f"**{k.replace('_', ' ').title()}**\n" + "\n".join(f"- {x}" for x in n[k]))

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
