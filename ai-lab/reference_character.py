"""Official-character reference intake for PRIVATE image-quality experiments.

Never commits, embeds, publishes or uploads raw official art to the repository,
public website or GitHub Actions artifacts. URLs are explicitly allowlisted and
the images are used only temporarily in a manually armed GitHub runner.
"""
from __future__ import annotations

import io
import json
from pathlib import Path
from urllib.parse import urlparse

import requests
from PIL import Image, ImageOps, UnidentifiedImageError

ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT / "reference-character" / "official-gojo.json"
MAX_BYTES = 5_000_000
REFERENCE_SIZE = (512, 512)
APPROVED_HOST = "jujutsukaisen.jp"
APPROVED_PREFIX = "/images/chara_"


def load_pack(pack_id: str) -> dict:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for pack in manifest["packs"]:
        if pack["id"] == pack_id:
            if len(pack["references"]) != 2:
                raise ValueError("A pack must contain exactly two official references")
            for source in pack["references"]:
                validate_url(source["url"])
            return pack
    raise ValueError(f"Unknown official reference pack: {pack_id}")


def validate_url(url: str) -> None:
    parsed = urlparse(url)
    if (parsed.scheme != "https" or parsed.hostname != APPROVED_HOST or
            parsed.port not in (None, 443) or
            not parsed.path.startswith(APPROVED_PREFIX) or
            not parsed.path.lower().endswith((".png", ".jpg", ".jpeg")) or
            parsed.username is not None or parsed.password is not None or
            parsed.query or parsed.fragment):
        raise ValueError("Source URL must be an approved Jujutsu Kaisen character image")


def prepare_reference(raw: bytes) -> bytes:
    if len(raw) > MAX_BYTES:
        raise RuntimeError("Reference file exceeds the maximum allowed size")
    try:
        source = Image.open(io.BytesIO(raw))
        source.load()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise RuntimeError("Source was not a valid image") from exc
    if source.width < 100 or source.height < 100:
        raise RuntimeError("Reference image is too small to guide character identity")
    if source.width * source.height > 20_000_000:
        raise RuntimeError("Reference image has excessive dimensions")
    source.thumbnail((480, 480), Image.Resampling.LANCZOS)
    if source.mode not in ("RGBA", "RGB"):
        source = source.convert("RGBA")
    canvas = Image.new("RGBA", REFERENCE_SIZE, (245, 245, 249, 255))
    x = (512 - source.width) // 2
    y = (512 - source.height) // 2
    if source.mode == "RGBA":
        canvas.alpha_composite(source, (x, y))
    else:
        canvas.paste(source, (x, y))
    buffer = io.BytesIO()
    canvas.convert("RGB").save(buffer, format="PNG")
    return buffer.getvalue()


def fetch_reference_images(pack: dict, *, session=None) -> list[bytes]:
    getter = (session or requests).get
    results = []
    for source in pack["references"]:
        url = source["url"]
        validate_url(url)
        response = getter(
            url,
            timeout=18,
            allow_redirects=False,
            headers={"User-Agent": "DarkAnimeWalls-PrivateCharacterBenchmark/1.0"},
        )
        if not 200 <= response.status_code < 300:
            raise RuntimeError(f"Official reference unavailable: HTTP {response.status_code}")
        if "image/" not in response.headers.get("Content-Type", "").lower():
            raise RuntimeError("Official reference did not return an image content type")
        if len(response.content) > MAX_BYTES:
            raise RuntimeError("Official reference download exceeded size limit")
        results.append(prepare_reference(response.content))
    return results


def identity_prompt(pack: dict, orientation: str) -> str:
    if orientation not in ("mobile", "desktop"):
        raise ValueError("Only mobile and desktop are supported")
    layout = (
        "Compose vertically for a full 9:16 wallpaper, clear focal point and clean upper third."
        if orientation == "mobile"
        else "Compose a genuinely wide 16:9 scene rather than cropping or stretching."
    )
    anchors = "; ".join(pack["identity_anchors"])
    return (
        f"Create a NEW polished cinematic 2D cel-animated anime wallpaper featuring exactly "
        f"one character: {pack['character']} ({pack['variant']}) from {pack['anime']}. "
        "Reference image 0 is the complete official character design, reference image 1 "
        "is the official face design. Keep the exact character identity consistent "
        "between those two references. Signature design anchors: "
        f"{anchors}. "
        "Anime screen-accurate linework, confident pose, refined clean outlines, "
        "cinematic depth, sophisticated luminous blue energy and night atmosphere. "
        "No photorealistic human appearance; this must look like a polished 2D anime still. "
        "Full clothing, one person, clear face and hairstyle, no additional background people. "
        "Create a new composition; do not duplicate the source frame or its layout. "
        f"{layout}"
    )
