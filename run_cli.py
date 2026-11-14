#!/usr/bin/env python3
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
        inp = input("Enter full path to an image to test (or 'q' to quit): ").strip().strip("'\"")
        if inp and inp.lower() != "q":
            targets = [inp]

    for p in targets:
        rep, _ = vs.analyze(p, use_gemini=not args.no_gemini)
        print("\n" + "=" * 65)
        print(f"FILE      : {rep['file']}")
        print(f"VERDICT   : {rep['verdict']} (Manipulation Prob: {rep['confidence_percentage']})")
        print(f"ROUTER    : Human Present={rep['router']['human_present']} (Conf={rep['router']['conf']})")
        if rep.get("module_warnings"):
            print(f"WARNINGS  : {rep['module_warnings']}")
        print("-" * 65)
        for e in rep["evidence"]:
            print(f" [{e['stream'].upper():6s}] {e['name']:36s}: {e['score']:.3f} | {e['note']}")
        print("=" * 65)
        print(f"Saved artifacts to: {rep.get('output_dir')}\n")
