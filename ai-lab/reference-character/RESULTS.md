# Official Gojo character-accuracy benchmark — 23 Nov 2026

## Sources (official anime website)
- Season 1 adult Gojo: https://jujutsukaisen.jp/character/index_1st.php
  - https://jujutsukaisen.jp/images/chara_detail4.png (full-character sheet)
  - https://jujutsukaisen.jp/images/chara_category1/chara_face7.jpg (face)
- Hidden Inventory young Gojo: https://jujutsukaisen.jp/character/index_2nd.php
  - https://jujutsukaisen.jp/images/chara_detail1_2nd.png (full-character sheet)
  - https://jujutsukaisen.jp/images/chara_face1_2nd.jpg (face)

Both are explicitly different canonical character variants. NEVER mix blindfolded adult and sunglasses-wearing teen design while trying to match a single reference. Source images are official copyrighted art, not licensed assets for public redistribution.

## Experiment A — two official references into FLUX.2 Klein 4B
- GitHub run: https://github.com/anshdeepofficial1/darkanimewalls/actions/runs/45130585239
- Official URLs successfully retrieved and processed into 512×512 reference inputs on the runner.
- Cloudflare rejected the output with HTTP 400: `Your output has been flagged. Please choose another prompt / input image combination`.
- **No generated image was returned.** Do not bypass filters or repeatedly retry this rejected combination. No charges or remaining quota are asserted because Cloudflare usage was not independently inspected.

## Experiment B — preserve official source art, generate only custom wallpaper backdrop in Python
- GitHub run: https://github.com/anshdeepofficial1/darkanimewalls/actions/runs/45131041296
- Both **9:16 (864×1536)** and **16:9 (1536×864)** outputs rendered successfully.
- GitHub review artifact: https://github.com/anshdeepofficial1/darkanimewalls/actions/runs/45131041296/artifacts/14797936777
- Exact character identity is retained because the character pixels come from the official source art, NOT an AI redraw.
- Visual assessment: identity/hairstyle are correct; background is minimalist and NOT yet competitive with premium cinematic wallpapers. This is an internal technical proof-of-concept, **not an approved wallpaper release**.

## Next work
1. Improve background atmosphere, lighting and framing without corrupting the character identity.
2. Explore original, cleared-to-use character artwork when designing public releases; an official anime character cutout does not confer publication/distribution rights.
3. Compare character fidelity and overall compositional quality separately; never label a file premium solely because dimensions/contrast checks pass.
4. Keep raw official source images ephemeral (not committed to Git). Derived test previews must not be deployed or promoted to the public website without rights review.
5. Keep all prompts, code and tests on branch `lab/premium-wallpaper-engine`. Both live request files default to disabled; no Instagram or Cloudinary code is present in the isolated experiments.

## Status
- Official references sourced by the assistant: **YES**.
- Successful reference-based AI redraw: **NO — Cloudflare output filter**.
- Identity-preserving composite prototype: **YES — two formats**.
- User action needed to provide images: **NONE**.
- Production site changed: **NO**.
