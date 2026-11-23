# Scheduled ChatGPT Images → GitHub Actions: verified boundary

Last reviewed: 2026-11-23 (IST)

## Scheduled generation task
- Task title: Dark Anime Premium Daily Images
- Existing task reused (not duplicated): `6a999313f29c819191b0a1b92f9fe21b`
- Start: **2026-11-24 07:00 IST**; recurrence daily.
- Goal: 10 original premium concepts × (9:16 + 16:9) = **20 separate images**, subject to ChatGPT image-tool availability and the account's usage limits.
- Prior historical daily task created only 15 candidates in one run and stopped at a quality gate. Do not assume it will always reach 20.
- Art must be a completely composed cinematic painting with recognizable character design; **never** an official anime cutout pasted onto a generated background.
- Production website, Cloudinary and Instagram publication all DISABLED.

## What works already
1. ChatGPT Images produces artwork in a ChatGPT conversation.
2. `ai-lab/chatgpt-studio/review.py` technically validates authentic 9:16 / 16:9 generated assets against a manifest.
3. `.github/workflows/ai-lab-chatgpt-studio.yml` runs the lab validator on branch changes and retains QA artifacts.
4. GitHub Actions fails on a supplied batch containing rejected or missing assets (zero-image / code-only check remains a legitimate smoke test).

## Missing automated bridge
**There is not yet a verified automated binary upload path from scheduled ChatGPT Images output into the public GitHub repository or its GitHub Actions artifact storage.** Existing connected GitHub file actions work for UTF-8 text and Git blobs but do not automatically transfer a newly generated ChatGPT Images attachment. A scheduled task may attempt a suitable connected binary-transfer mechanism if one is supported at execution time, but never claim upload success until actual image bytes and the corresponding Actions artifact are verified.

Until a supported, authorized bridge is tested, use the assisted intake:
1. Save ChatGPT image candidates to a device or an authorized file-transfer destination.
2. Import genuinely approved original images as files under `ai-lab/chatgpt-studio/inbox/` on branch `lab/premium-wallpaper-engine`, with matching `manifest.json` entries.
3. Do not put secret/unauthorized references or tokens in the repo; it is public.
4. GitHub Actions automatically runs the validator. Review the resulting artifact; no publication.

**Do not** turn the user's ChatGPT Plus login into a fake API by scraping browser cookies or relying on unofficial endpoints. ChatGPT Plus and OpenAI API billing are separate. No paid API, card, or subscription upgrade is assumed.

## Go-live gate
Image generation & file transfer → verified QA → manual character fidelity and rights review → separate explicit authorization for public posting.
