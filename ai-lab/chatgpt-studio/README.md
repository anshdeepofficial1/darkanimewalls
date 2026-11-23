# ChatGPT Studio — Premium anime-image review (PRIVATE LAB)

This is the **ChatGPT Images route** for Dark Anime Walls. It does **not** pretend that ChatGPT Plus supplies an API key for unattended GitHub Actions.

## How it works

1. Use ChatGPT Images to generate a complete **new** premium anime wallpaper (not an official-character cutout pasted onto a background).
2. Save the original generated PNG. For **private preliminary review**, keep it in the ChatGPT conversation or on your device. Never post official frames or unlicensed source artwork.
3. When ready to run GitHub Actions image QA, add the generated file under `ai-lab/chatgpt-studio/inbox/` **on branch `lab/premium-wallpaper-engine`**, and add an entry to `manifest.json`. **The repository is public, so committing the image makes it publicly visible in GitHub even though it does not publish on the website.** Only add artwork you want visible in the repo. If you need an entirely private workflow, don't commit images; use the offline reviewer until a private storage option is implemented.
4. The lab-only Action checks file integrity, ratio, duplicates, visual contrast, and records a review gallery as an Actions artifact. **It cannot certify exact anime identity, copyright clearance, or premium aesthetics.** Those require manual review.
5. Both 9:16 and 16:9 should be independently composed and generated. An upscale does not turn a low-resolution image into genuine high-detail artwork.

## One-time test

```bash
python -m pip install -r ai-lab/requirements.txt
python -m unittest discover -s ai-lab/chatgpt-studio/tests -v
python ai-lab/chatgpt-studio/review.py
```

By default `manifest.json` has no entries, so the Action only verifies tooling. No images are generated through GitHub Actions, and no ChatGPT account login, OpenAI API key, payment method, Instagram token, Cloudinary secret or public website access is required.

## Manifest schema

Add entries to `manifest.json`, for example:

```json
{
  "batch": "gojo-cinematic-01",
  "images": [
    {
      "id": "gojo-night-rooftop-mobile",
      "filename": "gojo-night-rooftop-mobile.png",
      "format": "9:16",
      "concept": "Satoru Gojo — cinematic night rooftop",
      "source": "chatgpt-images",
      "prompt": "Original ChatGPT Images generation prompt ...",
      "identity_notes": "Spiky white hair, dark blindfold, high collar; manually inspect face and hands."
    }
  ]
}
```

**Required:** Real files, not sample/placeholder images. No mock data is submitted to the website. The next step is to review genuine ChatGPT-generated candidate images and compare them to the user's benchmark @lucidai_x.

## Safe release barriers

- Work confined to `lab/premium-wallpaper-engine`; do not merge into `main`.
- GitHub job uses `contents: read`. No deployment, Instagram or Cloudinary upload steps.
- Import is manual/assisted while using the existing ChatGPT Plus plan. **Fully automatic ChatGPT image generation in GitHub Actions would require separately billed API access or a specifically supported integration**, neither of which is enabled here.
- Keep the user-visible images and the GitHub repo unpublished until final approval and rights review.
