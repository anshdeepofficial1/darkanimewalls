"""Private proof-of-concept: preserve exact official anime character art.

Public source assets belong to their respective rightsholders.
NEVER PUBLISH THESE COMPOSITES ON THE WEBSITE/INSTAGRAM OR MERGE TO main.
This is a noncommercial/internal identity-fidelity benchmark, not a licensed asset.
"""
from __future__ import annotations
import io
import json
import math
import random
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageFilter, ImageOps

from reference_character import load_pack, validate_url, MAX_BYTES
import lab

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "out"
SUPPORTED_PACK = "gojo-adult-s1"


def load_full_body(pack_id=SUPPORTED_PACK, *, session=None) -> Image.Image:
    pack = load_pack(pack_id)
    url = next(x["url"] for x in pack["references"] if x["role"] == "full_body_design")
    validate_url(url)
    response = (session or requests).get(
        url, timeout=25, allow_redirects=False,
        headers={"User-Agent": "DarkAnimeWalls-PrivateReferenceTest/1.0"}
    )
    if response.status_code != 200:
        raise RuntimeError(f"Official source unavailable: HTTP {response.status_code}")
    if "image/" not in response.headers.get("Content-Type", "").lower():
        raise RuntimeError("Official source did not return an image")
    if len(response.content) > MAX_BYTES:
        raise RuntimeError("Official source exceeds size cap")
    character = Image.open(io.BytesIO(response.content)).convert("RGBA")
    # The source design must have a real alpha silhouette. Never try to
    # strip a plain-black background that might also erase Gojo's uniform.
    if character.getextrema()[3][0] > 5:
        raise RuntimeError("Official character cutout lacks transparency; no automatic erasure")
    return character


def backdrop(size: tuple[int, int], seed=20261123) -> Image.Image:
    w, h = size
    # Deterministic blue-black cinematic gradient with a celestial glow;
    # no downloaded or unlicensed backdrop textures are used.
    small_w, small_h = max(1, w // 4), max(1, h // 4)
    raw = Image.new("RGB", (small_w, small_h))
    p = raw.load()
    for y in range(small_h):
        for x in range(small_w):
            xx, yy = (x + .5) / small_w, (y + .5) / small_h
            eclipse = math.exp(-(((xx - .5) / .31)**2 + ((yy - .40)/.27)**2) * 1.45)
            edge = math.exp(-(((xx - .5)/.65)**2+((yy-.6)/.92)**2))
            p[x,y] = (
                int(5 + 8*eclipse + 3*edge),
                int(8 + 39*eclipse + 3*edge),
                int(21 + 82*eclipse + 6*edge),
            )
    image = raw.resize(size, Image.Resampling.BILINEAR).convert("RGBA")
    glow = Image.new("RGBA", size)
    paint = ImageDraw.Draw(glow)
    center = (int(w*.52), int(h*.40))
    radius = int(min(w, h) * .40)
    for i in range(18, 0, -1):
        r = radius + 2*i
        paint.ellipse((center[0]-r,center[1]-r,center[0]+r,center[1]+r),
                      outline=(38, 170, 245, max(8, 45-i*2)), width=max(1,i//6))
    image = Image.alpha_composite(image, glow.filter(ImageFilter.GaussianBlur(24)))
    stars = Image.new("RGBA", size)
    d = ImageDraw.Draw(stars)
    rng = random.Random(seed)
    for i in range(int(w*h/2300)):
        x, y = rng.randrange(w), rng.randrange(h)
        rad = rng.choice([0,0,1,1,2])
        d.ellipse((x-rad,y-rad,x+rad,y+rad), fill=(120,205,255,rng.randrange(20,95)))
    return Image.alpha_composite(image, stars)


def compose_character(character: Image.Image, orientation: str) -> Image.Image:
    if orientation not in lab.DIMENSIONS:
        raise ValueError("Unknown orientation")
    w,h = lab.DIMENSIONS[orientation]
    base = backdrop((w,h))
    art = character.convert("RGBA")
    # Preserve ALL pixels from the original anime art; only scale/place.
    if orientation == "mobile":
        target_height = int(h*.86)
        center_x = int(w*.50)
        bottom = int(h*.98)
    else:
        target_height = int(h*.91)
        center_x = int(w*.64)
        bottom = int(h*.96)
    scale = target_height / art.height
    art = art.resize((round(art.width*scale),target_height),Image.Resampling.LANCZOS)
    x = center_x - art.width//2
    y = bottom - art.height
    silhouette = Image.new("RGBA",(w,h))
    silhouette.alpha_composite(art,(x,y))
    alpha = silhouette.getchannel("A")
    glow=Image.new("RGBA",(w,h),(38,145,255,0))
    glow.putalpha(alpha.filter(ImageFilter.GaussianBlur(24)).point(lambda a:int(a*.60)))
    base=Image.alpha_composite(base,glow)
    base=Image.alpha_composite(base,silhouette)
    # Atmospheric border vignette: applied to scene only in empty regions.
    return base.convert("RGB")


def run() -> int:
    request_file=ROOT/"reference-character"/"layout-request.json"
    config=json.loads(request_file.read_text(encoding="utf-8"))
    if config != {"enabled":True,"pack":SUPPORTED_PACK}:
        print("Layout benchmark DISARMED: no source download and no output")
        return 0
    image=load_full_body()
    OUT.mkdir(parents=True, exist_ok=True)
    entries=[]
    for orientation in ("mobile","desktop"):
        composed=compose_character(image,orientation)
        filename=f"gojo-s1-authentic-layout-{orientation}.png"
        composed.save(OUT/filename,"PNG",optimize=True)
        entries.append({"file":filename, "orientation":orientation,
                        "size":list(composed.size),
                        "status":"UNPUBLISHED",
                        "source":"Official Jujutsu Kaisen character art; copyright retained",
                        "not_licensed_for_public_distribution":True})
        print(f"Prepared unpublished character-preserving {orientation} composition.")
    (OUT/"authentic-layout-manifest.json").write_text(
        json.dumps({"status":"INTERNAL_Copyrighted_ART_REFERENCE_TEST",
                    "no_publication":True,"outputs":entries},indent=2),
        encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
