#!/usr/bin/env python3
"""Isolated Dark Anime Walls image benchmark. ZERO public uploads or publishing."""
from __future__ import annotations

import argparse
import base64
import html
import io
import json
import math
import os
from pathlib import Path
from typing import Any

import requests
from PIL import Image, ImageOps, ImageStat, UnidentifiedImageError

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "out"
CONCEPTS = ROOT / "concepts.json"
FREE_DAILY_NEURONS = 10_000
MODEL_IDS = {
    "klein": "@cf/black-forest-labs/flux-2-klein-4b",
    "lucid": "@cf/leonardo/lucid-origin",
}
DIMENSIONS = {"mobile": (864, 1536), "desktop": (1536, 864)}

BASE_STYLE = (
    "Museum-quality cinematic 2D anime key visual, deliberately composed for a "
    "premium downloadable wallpaper, exceptional focal hierarchy, expressive "
    "accurate eyes, anatomically coherent hands, clean contours, precise layered "
    "linework, complex richly painted background, detailed materials, dramatic "
    "Hollywood-grade rim lighting, deep but readable shadows, tasteful film grain, "
    "crisp high-quality illustration, gorgeous refined color grading. "
    "No text, letters, captions, logos, signatures, watermarks, collages, "
    "extra people, duplicated limbs, or floating body parts. "
    "Respect familiar character identity where specified; create original "
    "compositions, never recreate another artist's exact artwork. "
)

COMPOSITIONS = {
    "mobile": (
        "VERTICAL 9:16 MOBILE wallpaper. Full-height cinematic composition; "
        "main subject prominent near middle third, striking face visible, "
        "deliberate atmospheric negative space near clock/widget zones, "
        "no cropping of key anatomy."
    ),
    "desktop": (
        "HORIZONTAL 16:9 DESKTOP wallpaper. A freshly composed wide establishing "
        "shot with the SAME character identity, clothes, mood, and key palette. "
        "Do not merely rotate, stretch or crop the vertical image. "
        "Rich cinematic environmental storytelling, generous clean desktop negative space."
    ),
}


def load_concepts() -> list[dict[str, str]]:
    data = json.loads(CONCEPTS.read_text(encoding="utf-8"))
    ids = [c["id"] for c in data]
    if len(ids) != len(set(ids)) or not all(c.get("description") for c in data):
        raise ValueError("Concepts need unique IDs and descriptions")
    return data


def prompt_for(concept: dict[str, str], orientation: str) -> str:
    if orientation not in DIMENSIONS:
        raise ValueError(f"Unsupported orientation: {orientation}")
    return (
        f"THEME: {concept['name']}. Character and scene: {concept['description']}. "
        f"Creative mood: {concept['mood']}. {BASE_STYLE} {COMPOSITIONS[orientation]}"
    )


def tiles(width: int, height: int) -> int:
    if width <= 0 or height <= 0:
        raise ValueError("Image dimensions must be positive")
    return math.ceil(width / 512) * math.ceil(height / 512)


def estimate_neurons(
    model: str, width: int, height: int, *,
    steps: int = 28, input_tiles: int = 0,
) -> float:
    count = tiles(width, height)
    if model == "klein":
        # November 2026 published output/input 512x512 tile pricing.
        return round(count * 26.05 + input_tiles * 5.37, 2)
    if model == "lucid":
        return round(count * 636.0 + steps * 12.0, 2)
    raise ValueError(f"Unknown model: {model}")


def plan(model: str, count: int, *, paired: bool = True) -> dict[str, Any]:
    concepts = load_concepts()
    if count < 1 or count > len(concepts):
        raise ValueError(f"count must be 1..{len(concepts)}")
    if model not in MODEL_IDS:
        raise ValueError(f"Unknown model {model}")
    jobs = []
    for index, concept in enumerate(concepts[:count]):
        for orientation in ("mobile", "desktop") if paired else ("mobile",):
            width, height = DIMENSIONS[orientation]
            reference_tiles = tiles(*DIMENSIONS["mobile"]) if (
                paired and orientation == "desktop" and model == "klein"
            ) else 0
            jobs.append({
                "concept": concept["id"],
                "name": concept["name"],
                "orientation": orientation,
                "width": width,
                "height": height,
                "model": MODEL_IDS[model],
                "seed": 20261123 + index * 271 + (1 if orientation == "desktop" else 0),
                "reference_from_mobile": reference_tiles > 0,
                "estimated_neurons": estimate_neurons(
                    model, width, height, input_tiles=reference_tiles
                ),
                "prompt": prompt_for(concept, orientation),
            })
    total = round(sum(job["estimated_neurons"] for job in jobs), 2)
    return {
        "status": "PLAN_ONLY_NO_NETWORK",
        "model": model,
        "candidate_count": len(jobs),
        "estimated_neurons": total,
        "free_daily_neurons": FREE_DAILY_NEURONS,
        "within_free_allowance_if_no_other_usage": total < FREE_DAILY_NEURONS,
        "note": "Estimate not a billing guarantee; existing account usage is unknown.",
        "website_uploads_enabled": False,
        "instagram_publishing_enabled": False,
        "requires_manual_visual_approval": True,
        "jobs": jobs,
    }


def extract_image(response: requests.Response) -> bytes:
    content_type = response.headers.get("content-type", "").lower()
    if content_type.startswith("image/"):
        return response.content
    try:
        payload = response.json()
    except ValueError as exc:
        raise RuntimeError("AI returned neither an image nor valid JSON") from exc
    if payload.get("success") is False:
        raise RuntimeError(f"Cloudflare inference failed: {payload.get('errors', [])}")
    result = payload.get("result", payload)
    if isinstance(result, dict):
        encoded = result.get("image") or (result.get("images") or [{}])[0].get("image")
    else:
        encoded = None
    if not isinstance(encoded, str) or not encoded:
        raise RuntimeError("Cloudflare response is missing base64 result.image")
    if encoded.startswith("data:"):
        encoded = encoded.split(",", 1)[-1]
    try:
        return base64.b64decode(encoded, validate=True)
    except ValueError as exc:
        raise RuntimeError("Invalid base64 image returned") from exc


def infer(
    job: dict[str, Any], account_id: str, token: str,
    *, reference_image: bytes | None = None, timeout: int = 180,
) -> bytes:
    model = job["model"]
    if model not in MODEL_IDS.values():
        raise ValueError("Model not on allowed list")
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}"
    fields = {
        "prompt": job["prompt"],
        "width": str(job["width"]),
        "height": str(job["height"]),
        "seed": str(job["seed"]),
    }
    headers = {"Authorization": f"Bearer {token}"}
    try:
        if model == MODEL_IDS["klein"]:
            # Cloudflare requires multipart/form-data even without a reference.
            files = {key: (None, value) for key, value in fields.items()}
            if reference_image is not None:
                files["input_image_0"] = ("reference.png", reference_image, "image/png")
            response = requests.post(url, files=files, headers=headers, timeout=timeout)
        else:
            if reference_image is not None:
                raise ValueError("Lucid Origin endpoint has no reference image parameter")
            fields["num_steps"] = 28
            response = requests.post(url, json=fields, headers=headers, timeout=timeout)
        if response.status_code == 403:
            raise RuntimeError("Cloudflare denied model access (possibly paid-plan-only); stopping.")
        if response.status_code == 429:
            raise RuntimeError("Cloudflare rate/free quota reached; stopping without retry.")
        response.raise_for_status()
        return extract_image(response)
    except requests.RequestException as exc:
        raise RuntimeError(
            f"Cloudflare inference HTTP/network error: {type(exc).__name__}"
        ) from exc


def dhash(image: Image.Image) -> int:
    img = ImageOps.grayscale(image).resize((9, 8), Image.Resampling.LANCZOS)
    pixels = list(img.getdata())
    bits = 0
    for y in range(8):
        for x in range(8):
            bits = (bits << 1) | int(pixels[y * 9 + x] > pixels[y * 9 + x + 1])
    return bits


def inspect_image(
    raw: bytes, expected: tuple[int, int],
    prior_hashes: list[int] | None = None,
) -> dict[str, Any]:
    try:
        image = Image.open(io.BytesIO(raw))
        image.load()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        return {"accepted": False, "reasons": ["unreadable_image"], "error": type(exc).__name__}
    width, height = image.size
    reasons = []
    if (width, height) != expected:
        reasons.append("wrong_dimensions")
    gray = ImageOps.grayscale(image).resize((128, 128))
    contrast = round(ImageStat.Stat(gray).stddev[0], 2)
    if contrast < 7:
        reasons.append("near_blank_or_flat")
    hash_value = dhash(image)
    if any((hash_value ^ previous).bit_count() <= 4 for previous in (prior_hashes or [])):
        reasons.append("near_duplicate")
    return {
        "accepted": not reasons,
        "reasons": reasons,
        "actual_dimensions": [width, height],
        "contrast_stddev": contrast,
        "dhash": f"{hash_value:016x}",
        "manual_visual_approval": False,
        "note": "Automated checks do NOT verify anatomy, originality, or artistic quality.",
    }


def make_review(records: list[dict[str, Any]], output: Path) -> None:
    cards = []
    for item in records:
        label = html.escape(f"{item['concept']} · {item['orientation']} · {item['model']}")
        file_name = html.escape(item["file"], quote=True)
        verdict = "Machine-screen pass · human review needed" if item["quality"]["accepted"] else "REJECTED"
        cards.append(
            f'<article><img src="{file_name}" alt="{label}">'
            f'<div class="meta"><strong>{label}</strong><p>{html.escape(verdict)}</p></div></article>'
        )
    document = (
        '<!doctype html><html lang="en"><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>Dark Anime Walls — Private AI Lab</title>'
        '<style>body{background:#070910;color:#f6f6fb;font:16px system-ui;margin:28px}'
        'h1{font-size:2rem}p{color:#b3b3c2}.grid{display:grid;grid-template-columns:'
        'repeat(auto-fit,minmax(240px,1fr));gap:18px}article{background:#151724;'
        'border:1px solid #34354b;border-radius:14px;overflow:hidden}'
        'img{display:block;max-height:540px;width:100%;object-fit:contain;background:#090a11}'
        '.meta{padding:14px}strong{font-size:14px}p{font-size:13px}</style>'
        '<h1>Dark Anime Walls — AI Lab</h1>'
        '<p>UNPUBLISHED · All images are candidates pending human review.</p>'
        f'<main class="grid">{"".join(cards)}</main></html>'
    )
    (output / "review.html").write_text(document, encoding="utf-8")


def run_generate(args: argparse.Namespace) -> int:
    if not args.confirm_free_quota:
        raise RuntimeError("Live inference requires --confirm-free-quota")
    account_id = os.environ.get("CF_ACCOUNT_ID", "").strip()
    token = os.environ.get("CF_API_TOKEN", "").strip()
    if not account_id or not token:
        raise RuntimeError(
            "Missing CF_ACCOUNT_ID or CF_API_TOKEN: add GitHub Secrets; do not paste tokens here"
        )
    chosen = plan(args.model, args.count, paired=not args.mobile_only)
    if chosen["estimated_neurons"] > args.max_neurons:
        raise RuntimeError(
            f"Planned {chosen['estimated_neurons']} estimated Neurons exceed "
            f"this run's {args.max_neurons} limit; no requests sent"
        )
    if chosen["estimated_neurons"] >= FREE_DAILY_NEURONS:
        raise RuntimeError("Plan exceeds daily free allowance; no requests sent")
    OUT.mkdir(parents=True, exist_ok=True)
    records, previous_hashes, reference = [], {"mobile": [], "desktop": []}, {}
    for job in chosen["jobs"]:
        if job["reference_from_mobile"] and job["concept"] not in reference:
            raise RuntimeError("Mobile image failed automated checks; refusing to generate an unpaired desktop candidate")
        source_bytes = reference.get(job["concept"]) if job["reference_from_mobile"] else None
        raw = infer(job, account_id, token, reference_image=source_bytes)
        quality = inspect_image(
            raw, (job["width"], job["height"]), previous_hashes[job["orientation"]]
        )
        # Never feed an automatically rejected portrait to the matching landscape generation.
        if job["orientation"] == "mobile" and quality["accepted"]:
            reference[job["concept"]] = raw
        if quality["accepted"]:
            previous_hashes[job["orientation"]].append(int(quality["dhash"], 16))
        image = Image.open(io.BytesIO(raw))
        image.load()
        file_name = f"{job['concept']}-{job['orientation']}.png"
        image.convert("RGB").save(OUT / file_name, format="PNG", optimize=True)
        records.append({
            "concept": job["concept"],
            "orientation": job["orientation"],
            "model": job["model"],
            "seed": job["seed"],
            "file": file_name,
            "quality": quality,
            "website_published": False,
            "instagram_published": False,
        })
        # Keep partial output recoverable if a later call fails.
        (OUT / "manifest.json").write_text(
            json.dumps({"status": "UNREVIEWED", "records": records}, indent=2),
            encoding="utf-8",
        )
        make_review(records, OUT)
        print(f"Saved local candidate {file_name}; machine-screen={quality['accepted']}", flush=True)
    print(f"PRIVATE LAB RESULT: {len(records)} candidates; no publishing or uploads")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Dark Anime Walls isolated AI quality lab")
    sub = parser.add_subparsers(dest="command", required=True)
    for action in ("plan", "generate"):
        subparser = sub.add_parser(action)
        subparser.add_argument("--model", choices=tuple(MODEL_IDS), default="klein")
        subparser.add_argument("--count", type=int, default=1)
        subparser.add_argument("--mobile-only", action="store_true")
        if action == "generate":
            subparser.add_argument("--confirm-free-quota", action="store_true")
            subparser.add_argument("--max-neurons", type=float, default=900)
    args = parser.parse_args()
    if args.command == "plan":
        report = plan(args.model, args.count, paired=not args.mobile_only)
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT / "plan.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(
            f"PLAN ONLY: {report['candidate_count']} image candidates, "
            f"{report['estimated_neurons']} estimated Neurons, "
            "no API calls, no publishing."
        )
        if not report["within_free_allowance_if_no_other_usage"]:
            print("WARNING: Planned request count exceeds free daily allowance")
        return 0
    return run_generate(args)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, RuntimeError) as exc:
        raise SystemExit(f"Lab stopped safely: {exc}")
