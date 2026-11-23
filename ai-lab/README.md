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

## Live GitHub Actions test (initially DISARMED)
1. Open Cloudflare **Workers AI → Use REST API → Create a Workers AI API Token**. Copy its Account ID and API token. Cloudflare says a custom token needs Workers AI **Read** and **Edit** permissions. Never paste the token into an issue, a GitHub file, or chat.
2. At https://github.com/anshdeepofficial1/darkanimewalls/settings/secrets/actions create the repository secrets `CF_ACCOUNT_ID` and `CF_API_TOKEN`.
3. On branch `lab/premium-wallpaper-engine`, edit **only** `ai-lab/live-request.json`: change `"enabled": false` to `"enabled": true`, then commit. The separate **Dark Anime AI Lab — isolated image test** workflow runs on that explicit file change and uploads candidates to GitHub Actions artifacts only.
4. Download the Action artifact and open its `review.html` beside the PNGs to inspect the real model quality. Once done, switch `enabled` back to `false`; this causes a safe no-inference run. Nothing uploads to the public site.

Initial safe test: `"model": "klein", "count": 1, "mobile_only": false, "max_neurons": 900` creates at most one mobile+desktop pair. For a **separately approved**, higher-cost premium comparison, use `"model": "lucid", "count": 1, "mobile_only": true, "max_neurons": 5200` for **one vertical portrait**. Both attempts will still fail if the Cloudflare account lacks model access or has used its daily free quota. Requests are not retried with a paid provider.

Note: The branch-only GitHub Actions test runs from a changed request file. GitHub only exposes `workflow_dispatch` workflow buttons when the workflow exists on the repository default branch. We deliberately avoid modifying the default branch during this laboratory phase.

## Benchmark acceptance criteria
- Native 9:16 / 16:9 output dimensions, supported model response, no duplicates, and non-flat contrast are **automated checks**.
- Recognizable character anatomy, rich lighting, premium polish, uniqueness, and parity with competitor art require **manual image review**.
- The lab has no Instagram, Cloudinary or Vercel credentials and will never publish.
