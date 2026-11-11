# DarkAnimeWalls Autopilot — operator runbook

**Safe state:** all scheduled generation and publication jobs are disabled until their respective GitHub Actions variables are explicitly enabled. Deploying code does NOT grant Instagram access or bill an image model.

## What is implemented

- Paged Cloudinary catalog instead of silently truncating the gallery at 100 assets.
- Releases respect `draft` and `publishAt`, with extra `dropId`, `pairId` fields for matching 9:16 and 16:9 originals.
- One run can research currently airing anime/character popularity using fresh Jikan results, cross-check Google Trends RSS mentions where possible, and cite source URLs. **Popularity proxies are not actual Google search counts.**
- Optional Images API generator creates 10 distinct 9:16 artworks, image-vision QA, 10 16:9 outpaints, and a manifest. To preserve the center *exactly*, the 9:16 artwork is composited over the AI-generated extension. Outpainting seam quality still requires visual QA.
- Importer checks exactly 10 unique, visually approved pairs, file dimensions, schedule validity, captions, and audio rights before any uploads. Video Reels and originals are stored in Cloudinary as drafts; releases happen only after Instagram publication.
- Publisher checks due times, posts 9:16 Reels via the official Instagram professional API, tracks statuses, and then releases corresponding website pairs. Failed or uncertain publishes remain embargoed and appear as failures, not success.
- Licensed music can be selected through Meta's Instagram Audio API when the account uses **Facebook Login**, the app has correct permissions and `IG_AUDIO_API_ENABLED=true`. Only Meta-authorized tracks are selected; missing or blocked music fails closed.
- User-owned licensed audio files are also supported; the audio-rights checkbox in the batch manifest is mandatory. No copyrighted track is downloaded or embedded without permission.
- CI runs Node tests and syntax checks. Job scheduling uses GitHub Actions; its execution time is best effort, **not exact to the second**.

## What is NOT yet connected or verified

1. The production Vercel team's authorization is missing; verify the connected deployment, production environment, and custom domain after granting team access.
2. Instagram professional API credentials/OAuth permissions have not been supplied; no account has been connected to this automation. No Instagram post was sent.
3. Cloudinary account quota and real production credentials could not be verified here. No new Cloudinary asset was uploaded.
4. ChatGPT Plus does **not** include unattended Images API generation/edits. Automated generation needs a separately billed API key and explicit opt-in. By default it is **OFF**, preserving the zero-extra-cost rule.
5. The image-vision QA model is probabilistic and cannot guarantee correct canonical identity, perfect hands or flawless outpainting; reviewing early packs is strongly recommended.
6. Custom release windows currently use initial testing slots in India, not verified Instagram audience insights. To optimize them, obtain authorized owner analytics and implement learn-from-results ranking.

## Secret setup (never commit or paste credentials into chat)

In **GitHub repository → Settings → Secrets and variables → Actions**, add these encrypted secrets:
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `IG_ACCOUNT_ID`, `IG_ACCESS_TOKEN` (Meta professional account; permissions to publish; preferably long-lived with a documented refresh process)
- `OPENAI_API_KEY` only if deliberately choosing **separate paid API generation**

Optional Actions variables:
- `CLOUDINARY_FOLDER=dark-anime-walls`, `CLOUDINARY_TAG=dark-anime-walls`, `META_GRAPH_VERSION=v24.0`
- `IG_AUDIO_API_ENABLED=true` only after Meta Facebook Login audio access is tested
- `AUTOPILOT_ENABLED=true` enables the 5-minute publishing poll **after** verified credentials and a successful real end-to-end test.
- `AUTOPILOT_GENERATION_ENABLED=true` and `PAID_IMAGE_API_OPT_IN=true` together explicitly enable the optional daily paid-image generation job. Do **not** enable them expecting ChatGPT Plus to cover API charges.

Credentials used by the Vercel app are separate from GitHub Actions secrets. Cloudinary access must be provisioned in both places if both components need it.

## Run / test

1. `npm test && npm run check:automation`
2. `node scripts/trend-research.mjs > research.json` (sourced popularity proxy, not guaranteed character search-volume statistics).
3. To create with the **paid** OpenAI Images API, set the API key and `ENABLE_PAID_IMAGE_API=I_ACCEPT_SEPARATE_API_CHARGES`, then `node scripts/generate-batch.mjs research.json generated`. This is billable and intentionally disabled normally.
4. Alternatively, create images using ChatGPT Plus manually, then prepare the same `batch.json` with 10 validated pairs (mobile, desktop, release times, caption, legal audio and verified QA).
5. With Cloudinary credentials set, `CONFIRM_BATCH_IMPORT=true node scripts/import-batch.mjs generated/batch.json`. Uploads 20 wallpapers and 10 Reel videos as unreleased drafts.
6. Run `node scripts/publish-due.mjs` only after Instagram API access is proven, or let the disabled-by-default GitHub workflow pick up due drafts every five minutes.
7. Verify actual Instagram media ID and public image URLs before enabling unattended use. Keep Vercel production on a tested commit.

### Format of `batch.json`

```json
{
  "dropId": "daw-20261112",
  "character": "Selected character from verified fresh research",
  "pairs": [
    {
      "pairId": "01",
      "title": "Cinematic Portrait",
      "mood": "Rain",
      "description": "Distinct composition and setting",
      "mobileFile": "01-mobile.png",
      "desktopFile": "01-desktop.png",
      "caption": "Original and specific caption with appropriate hashtags.",
      "scheduledAt": "2026-11-12T13:30:00.000Z",
      "qaApproved": true,
      "musicQuery": "dreamy cinematic piano"
    }
  ]
}
```

The example demonstrates fields only: **a real import requires ten fully populated pairs**. `qaApproved` must reflect a genuine visual check. Optional `audioId` directly selects an authorized Meta audio ID, or use `audioFile` plus `audioRightsConfirmed:true`; without music `ALLOW_SILENT_REELS=true` is required and should only be set intentionally.

## Scheduling and failure behavior

- Import always marks assets as drafts; `publishAt` is a **not-before** date, never a signal to bypass a failed Instagram publish.
- Publisher checks original and desktop pair IDs and matching release timestamps.
- The 9:16 original becomes an 8-second MP4 Reel; it stays full 9:16. Instagram feed image posts do not accept that tall 9:16 shape.
- A successful Instagram publication releases both wallpaper originals. If Instagram fails, website content remains private; an uncertain mid-publish result needs reconciliation to avoid duplicates.
- GitHub Actions cron can run late, and Vercel cache has a short lifetime. True exactly-at-the-same-second publication requires an external dedicated scheduler and platform-level confirmation that isn't available in the free plan.
- A failed partial batch is not silently retried as if all 20 files were complete. Inspect Cloudinary drafts and logs to repair safely.
- Backend secrets stay server-side. Never expose admin tokens or Cloudinary API secrets to browser code.
- Cloudinary's free tier includes 25 monthly credits covering storage, bandwidth, and transformations. Monitor your actual 30-day usage; 600 images plus 300 Reel videos monthly may exhaust a free quota.
