# ChatGPT Images: canonical-anime character quality benchmark

## Purpose
Use ChatGPT Images through the owner's existing ChatGPT session for **manual/assisted** premium wallpaper creation. There is no ChatGPT Plus API key and there is NO unattended image-generation step inside GitHub Actions. Never automate login using cookies, browser scripting, unofficial ChatGPT endpoints, or other circumventions.

## Benchmark: Satoru Gojo (Jujutsu Kaisen)

Character *identity* is the primary acceptance criterion. Use the canonical anime design anchors—not vague descriptors such as "silver-haired anime hero."

### A. Adult Gojo with blindfold (preferred first test)
Canonical anchors:
- Short, upright, highly recognizable silver-white spikes, not long, loose silver fringe.
- Solid black blindfold across the eyes, not goggles or tinted sunglasses.
- Lean, confident adult face with the anime's distinctive jaw and nose lines.
- Dark navy-black, very high zip-up collar, uncluttered uniform.
- Single character only; 2D anime cel shading, intentional linework, not a photorealistic person.
- Two hands only; avoid unnatural finger or joint arrangements.
- One complete cinematic composition rather than a pasted character cutout.

**Suggested ChatGPT image-generation brief:**

> Create a completely newly composed portrait 9:16 cinematic 2D anime wallpaper depicting Satoru Gojo from Jujutsu Kaisen, faithfully recognizable by his canonical adult anime design: short upright silver-white spiky hair, black blindfold, lean expressive anime face, dark navy-black high-collar uniform. A midnight rooftop in Tokyo during rain, blue Limitless energy as atmospheric arcs around him, deep blue-black sky, controlled cyan rim lighting, exquisite hand-drawn anime linework, sophisticated anime-studio color design, detailed wet city environment, one cohesive illustrated scene. A dynamic but anatomically correct hand gesture. One person only. Full-height vertical composition intentionally built for mobile lock screens, clean clock area, richly illustrated depth, no text or watermark, no 3D or photorealism. Create the whole scene as an original painting; do not crop or composite official character-sheet images.

### B. Alternative premium direction
Use a subtle cinematic nighttime environmental look rather than filling every square inch with blue lightning. Strong Gojo silhouette, recognizably accurate hair and blindfold, and intentional negative space are higher priority than particle count. Review readability at phone-size.

### C. Companion 16:9 image
Generate a **new** wide scene: same variant, character design, lighting and theme, but genuinely different staging (wide city roof and environment). Not a crop, mirrored face, stretch or rotation of the 9:16 painting.

## Manual review rubric (record score 0–5)
| Axis | What a pass requires |
| --- | --- |
| Canon design fidelity | Hair, blindfold/glasses variant, face, clothes unmistakable |
| Composition | Appealing even as a phone thumbnail, no random extra people |
| 2D anime craft | Crisp cel lines, coherent perspective and shadows |
| Anatomy | Hands, fingers, body pose and face internally consistent |
| Background integration | Background and character share one camera, grade and light |
| Wallpaper usability | Safe-space for clock, uncluttered foreground and legibility |

**Do not approve if canon fidelity is below 4/5.** Passing file-format and contrast checks does not mean a candidate passed the artistic rubric.

## Process
1. Produce one 9:16 genuine ChatGPT Images candidate, judge it and iterate.
2. Once the mobile design is approved, make the paired 16:9 image.
3. Review privately and only then place user-approved output in a GitHub Actions intake, remembering the repository is public.
4. Do not publish a wallpaper using official anime footage or copied promotional cutouts without a separate rights review.
