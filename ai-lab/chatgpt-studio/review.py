#!/usr/bin/env python3
"""Review user-approved ChatGPT-generated files in isolation. Never publish."""
from __future__ import annotations
import html
import json
import re
import shutil
from pathlib import Path

from PIL import Image, ImageOps, ImageStat, UnidentifiedImageError

ROOT = Path(__file__).resolve().parent
INBOX = ROOT / "inbox"
MANIFEST = ROOT / "manifest.json"
OUT = ROOT / "out"
RATIOS = {"9:16": 9 / 16, "16:9": 16 / 9}
MAX_ITEMS = 20
MAX_BYTES = 22_000_000
FILENAME_PATTERN = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}\.(png|jpg|jpeg|webp)$")
ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{0,79}$")


def read_manifest(path: Path = MANIFEST) -> dict:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if set(payload) != {"batch", "images"}:
        raise ValueError("Manifest must contain only batch and images")
    if not isinstance(payload["batch"], str) or not ID_PATTERN.fullmatch(payload["batch"]):
        raise ValueError("Invalid batch id")
    items = payload["images"]
    if not isinstance(items, list) or len(items) > MAX_ITEMS:
        raise ValueError("images must be an array of at most 20 items")
    if len({item.get("id") for item in items if isinstance(item, dict)}) != len(items):
        raise ValueError("Duplicate or invalid image id")
    for item in items:
        validate_entry(item)
    return payload


def validate_entry(item: dict) -> None:
    if not isinstance(item, dict):
        raise ValueError("Image entries must be objects")
    required = {"id", "filename", "format", "concept", "source", "prompt", "identity_notes"}
    if set(item) != required:
        raise ValueError("Image entry schema invalid")
    if not isinstance(item["id"], str) or not ID_PATTERN.fullmatch(item["id"]):
        raise ValueError("Image id invalid")
    if not isinstance(item["filename"], str) or not FILENAME_PATTERN.fullmatch(item["filename"]):
        raise ValueError("Invalid filename or disallowed path")
    if item["format"] not in RATIOS:
        raise ValueError("format must be exactly 9:16 or 16:9")
    if item["source"] != "chatgpt-images":
        raise ValueError("Only ChatGPT Images-generated artwork is accepted")
    for key, minimum in (("concept", 4), ("prompt", 12), ("identity_notes", 12)):
        if not isinstance(item[key], str) or not minimum <= len(item[key].strip()) <= 3500:
            raise ValueError(f"Image field {key} must contain meaningful text")


def fingerprint(image: Image.Image) -> int:
    im = ImageOps.grayscale(image).resize((9, 8), Image.Resampling.LANCZOS)
    px = list(im.getdata())
    result = 0
    for y in range(8):
        for x in range(8):
            result = (result << 1) | int(px[y * 9 + x] > px[y * 9 + x + 1])
    return result


def inspect_image(file: Path, expected_format: str, hashes: list[int] | None = None) -> dict:
    reasons = []
    if not file.is_file() or file.is_symlink() or file.stat().st_size > MAX_BYTES:
        return {"accepted": False, "reasons": ["missing_symlink_or_oversize"]}
    try:
        with Image.open(file) as im:
            im.load()
            im = ImageOps.exif_transpose(im)
            width, height = im.size
            image_format = im.format
            rgb = im.convert("RGB")
    except (OSError, ValueError, UnidentifiedImageError):
        return {"accepted": False, "reasons": ["invalid_image"]}
    ratio_error = abs(width / height - RATIOS[expected_format]) / RATIOS[expected_format]
    if ratio_error > 0.012:
        reasons.append("wrong_aspect_ratio")
    if (expected_format == "9:16" and (width < 768 or height < 1200)):
        reasons.append("resolution_too_low")
    if (expected_format == "16:9" and (width < 1200 or height < 675)):
        reasons.append("resolution_too_low")
    gray = ImageOps.grayscale(rgb).resize((128, 128))
    contrast = float(ImageStat.Stat(gray).stddev[0])
    if contrast < 7:
        reasons.append("near_blank")
    fp = fingerprint(rgb)
    if any((fp ^ old).bit_count() <= 4 for old in (hashes or [])):
        reasons.append("near_duplicate")
    return {
        "accepted": not reasons,
        "reasons": reasons,
        "width": width,
        "height": height,
        "actual_ratio": round(width / height, 5),
        "ratio_error_percent": round(ratio_error * 100, 3),
        "contrast_stddev": round(contrast, 2),
        "fingerprint": f"{fp:016x}",
        "manual_identity_approved": False,
        "manual_art_direction_approved": False,
        "publish_enabled": False,
        "note": "Technical QA is not a substitute for manually reviewing character identity and visual quality.",
    }


def write_review(records: list[dict], folder: Path, batch: str) -> None:
    cards = []
    for entry in records:
        name = html.escape(entry["id"])
        src = html.escape(entry["asset"], quote=True) if entry.get("asset") else ""
        image = f'<img src="{src}" loading="lazy" alt="{name}">' if src else ""
        status = "TECHNICAL PASS / ART REVIEW REQUIRED" if entry["technical"]["accepted"] else "TECHNICAL REJECT"
        reasons = html.escape(", ".join(entry["technical"]["reasons"]) or "none")
        cards.append(f'<article>{image}<div class="details"><strong>{name}</strong>'
                     f'<p>{status}</p><p>Checks: {reasons}</p></div></article>')
    content = ('<!doctype html><html lang="en"><meta charset="utf-8">'
               '<meta name="viewport" content="width=device-width,initial-scale=1">'
               '<title>ChatGPT Studio — No publishing</title>'
               '<style>body{margin:24px;background:#090b12;color:#f3f5ff;font-family:system-ui}'
               'h1{font-size:1.6rem}.warn{color:#aab5d8}main{display:grid;gap:16px;'
               'grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}article{background:#191d2a;'
               'border:1px solid #35394a;border-radius:12px;overflow:hidden}img{width:100%;'
               'max-height:680px;object-fit:contain;background:#08080c}.details{padding:12px}'
               'p{color:#aab5d8;font-size:12px}</style>'
               f'<h1>ChatGPT Studio — {html.escape(batch)}</h1>'
               '<p class="warn">Unpublished review only. Do not infer artistic approval from technical pass.</p>'
               f'<main>{"".join(cards)}</main></html>')
    (folder / "review.html").write_text(content, encoding="utf-8")


def run(manifest_path: Path | None = None, inbox: Path | None = None, out: Path | None = None) -> dict:
    path = manifest_path or MANIFEST
    inbox = inbox or INBOX
    out = out or OUT
    payload = read_manifest(path)
    out.mkdir(parents=True, exist_ok=True)
    (out / "assets").mkdir(exist_ok=True)
    results = []
    hashes = []
    accepted_count = 0
    for item in payload["images"]:
        source = inbox / item["filename"]
        # It is not possible to reach a path outside inbox via the allowed basename schema.
        audit = inspect_image(source, item["format"], hashes)
        if audit["accepted"]:
            hashes.append(int(audit["fingerprint"], 16))
            accepted_count += 1
        asset_path = None
        if source.is_file() and not source.is_symlink() and source.stat().st_size <= MAX_BYTES:
            dest = out / "assets" / item["filename"]
            shutil.copyfile(source, dest)
            asset_path = f"assets/{item['filename']}"
        results.append({
            "id": item["id"], "filename": item["filename"], "format": item["format"],
            "concept": item["concept"], "source": item["source"],
            "identity_notes": item["identity_notes"],
            "technical": audit, "asset": asset_path,
            "website_published": False, "instagram_published": False,
        })
    status = "NO_ASSETS" if not results else "REVIEW_REQUIRED"
    output = {
        "batch": payload["batch"], "status": status,
        "image_count": len(results), "technical_pass_count": accepted_count,
        "manual_artistic_approval": False,
        "website_publishing_enabled": False, "instagram_publishing_enabled": False,
        "records": results,
    }
    (out / "review-manifest.json").write_text(json.dumps(output, indent=2), encoding="utf-8")
    write_review(results, out, payload["batch"])
    print(f"ChatGPT Studio QA: {accepted_count}/{len(results)} technical passes; publishing DISABLED")
    return output


if __name__ == "__main__":
    run()
