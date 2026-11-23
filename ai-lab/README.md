# Dark Anime Walls — Premium AI Lab

**Status: isolated experiment; NOT a production publisher.**

This directory lives on the `lab/premium-wallpaper-engine` branch. It must not be merged into `main` or deployed without explicit review. It does not call the website, Cloudinary, Instagram, or any Vercel endpoint.

## Goal
Benchmark original, premium cinematic anime wallpapers in **native 9:16 (864×1536)** and **native 16:9 (1536×864)**. The user's high-performing Gojo post is the creative starting point, not a claim about measured analytics. Test candidates are **not** approved to publish.

## What the lab does
- Makes an auditable JSON plan of model, prompts, sizes, seeds, and estimated *Cloudflare Workers AI* Neuron usage.
- Can generate real image candidates using `@cf/black-forest-labs/flux-2-klein-4b` or, when explicitly selected, `@cf/leonardo/lucid-origin`.
- Checks image decoding, dimensions, suspiciously blank outputs, and perceptual near-duplicates; it never asserts facial/anatomical quality without human inspection.
- Creates a static review gallery and a JSON report; results stay in **GitHub Actions artifacts**, not the public website.

## Run locally / from a GitHub runner
```bash
python -m pip install -r ai-lab/requirements.txt
python ai-lab/lab.py plan --count 3 --model klein
python -m unittest discover -s ai-lab/tests -v
```
After setting GitHub Actions secrets `CF_ACCOUNT_ID` and `CF_API_TOKEN`:
```bash
python ai-lab/lab.py generate --model klein --count 1 --confirm-free-quota --max-neurons 900
```
By default there are **zero inference requests**. Real generation requires all three: credentials, `generate` command, and `--confirm-free-quota`. No payment API, paid plan, or fallback paid provider is used. Model/account access and the actual free allowance must be checked with a real request. Workers Free enforces its own daily allocation; our Neuron estimate is only a conservative planning tool.

The initial workflow deliberately runs **tests and planning only** on pushes to its lab branch. A manual image-generation workflow is not added to `main` until the first source review, because GitHub requires a `workflow_dispatch` workflow to exist on the default branch to show its button. We will not change `main` just to make the button appear.

## Output
`ai-lab/out/plan.json`, or `ai-lab/out/manifest.json`, `review.html` and images for live runs. This folder is ignored by Git and only uploaded as a private GitHub Actions artifact, subject to GitHub artifact access.

## Cost and quality
Pricing checked November 2026: Workers AI has 10,000 free Neurons/day, model-specific pricing, and may update access rules. Exact utilization is visible in the Cloudflare dashboard. A strong free model may still not match a premium reference; review real generated images before any scheduling or publishing work.

## Security and release gates
1. No production modifications and no public gallery uploads.
2. GitHub token permissions: `contents: read`.
3. Credentials only via Actions secrets; never put tokens in YAML, prompts, output, or logs.
4. Fail closed on quota estimates, bad images, API errors, or missing credentials.
5. Manual visual approval required before any upload or publishing integration.
6. Future publication workflow must be separately reviewed and explicitly enabled.

References:
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/workers-ai/models/flux-2-klein-4b/
- https://developers.cloudflare.com/workers-ai/models/lucid-origin/
