# AI Lab — Real test findings (2026-11-23)

All work is isolated on `lab/premium-wallpaper-engine`. No edits to `main`, no Cloudinary uploads, no Instagram publication, and no Vercel deployment.

## Verified success: FLUX.2 Klein 4B
- GitHub Actions run: https://github.com/anshdeepofficial1/darkanimewalls/actions/runs/45128905603
- One genuine generated image: `gojo-six-eyes-mobile.png`, 864x1536 (9:16), seed 20261123.
- GitHub Actions artifact: https://github.com/anshdeepofficial1/darkanimewalls/actions/runs/45128905603/artifacts/14797180542
- Technical checks passed (decoding, dimensions, nonblank contrast). Runtime ~14 seconds of inference step. No claims of editorial/artistic approval.
- Visual review: attractive crisp cyan anime portrait, but noticeably **not yet at the benchmark**. The white-haired character has long swept bangs and lacks Gojo's more iconic short, raised/spiky white hair; 2 unwanted background figures are present; setting/pose are generic compared with the premium cinematic reference. Do not publish this candidate automatically.
- Usage estimate: one output at 864x1536 = 6 output 512px tiles x 26.05 = 156.3 Neurons (estimate, not verified invoice).

## Lucid Origin comparison — NOT GENERATED
- Initial run: https://github.com/anshdeepofficial1/darkanimewalls/actions/runs/45129107172
- Cause: invalid JSON parameter types (numbers serialized as strings). Corrected in `ai-lab/lab.py`, with tests.
- Retry: https://github.com/anshdeepofficial1/darkanimewalls/actions/runs/45129280419
- Result: Cloudflare HTTP 400, with API error `Input prompt contains NSFW content`. No output image was returned. Do not try to evade filters; next safety-compliant test can start with short, clearly benign original character descriptions and remove ambiguous negative phrases.
- Estimate: Lucid would cost ~4152 Neurons for 864x1536 plus 28 steps, so it is not suitable for all 20 daily images within the free daily quota. Actual charges/quota impact for failed requests were not measured.

## Next quality improvements
1. More faithful iconic short silver-haired Gojo composition with one subject only and no background faces, using a clear, simple benign prompt.
2. Compare original fully clothed character prompts across available free models and retain genuine quality results.
3. Test 16:9 paired composition separately, rather than simply cropping.
4. Review subject anatomy, environment, focal hierarchy and lighting manually (automated checker is not an art critic).
5. Keep `ai-lab/live-request.json` **disabled** between explicit real-generation tests and observe free allowance.

## Security / cost gates
- GitHub Actions credentials are available through repository secrets only.
- No user payment card entered through this workflow.
- No paid provider fallback; inference attempts are explicitly capped.
- The user's website and Instagram are untouched.
