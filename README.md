<div align="center">

# 🌌 Dark Anime Walls

**A responsive anime wallpaper gallery with original-quality downloads and a private creator studio.**

![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Cloudinary](https://img.shields.io/badge/Media-Cloudinary-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Frontend-F7DF1E?style=for-the-badge&logo=javascript&logoColor=000)
![Stars](https://img.shields.io/github/stars/anshdeepofficial/darkanimewalls?style=for-the-badge&logo=github)

<a href="https://github.com/sponsors/anshdeepofficial"><img src="https://img.shields.io/badge/Sponsor-%E2%9D%A4-EA4AAA?style=for-the-badge&logo=githubsponsors&logoColor=white" alt="Sponsor on GitHub" /></a>
<a href="https://buymeacoffee.com/anshdeepofficial"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=000" alt="Buy Me a Coffee" /></a>

</div>

---

## ✨ Overview

Dark Anime Walls combines a public wallpaper gallery with a private studio used to manage uploads. Visitors can browse, search, preview, randomize, and directly download wallpapers while the owner manages media through a protected workflow backed by Cloudinary.

## 🚀 Visitor Experience

- Browse desktop and mobile wallpapers
- Search and filter the gallery
- Open large responsive previews
- Download original-quality images directly
- Discover a random wallpaper
- Submit wallpaper requests
- Access collaboration/contact options
- Enjoy a responsive animated interface

## 🔐 Private Studio

The project includes `studio.html` for owner-only upload and delete operations. Keep the studio URL and password private and never expose Cloudinary secrets in client-side code.

## 🛠️ Tech Stack

| Area | Technology |
| --- | --- |
| Frontend | HTML, CSS, JavaScript |
| Media storage | Cloudinary |
| Hosting / serverless | Vercel |
| Owner access | Password-protected studio workflow |

## ⚡ Local Development

Install the Vercel CLI and run the project locally:

```bash
npm i -g vercel
vercel dev
```

Then open:

```text
http://localhost:3000
http://localhost:3000/studio.html
```

## ⚙️ Environment Variables

Configure these securely in Vercel:

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
STUDIO_PASSWORD
CLOUDINARY_TAG
CLOUDINARY_FOLDER
```

Do not commit real secrets to the repository.

## 🚀 Deployment

1. Push changes to GitHub.
2. Import the repository into Vercel.
3. Add the required environment variables.
4. Deploy.
5. Use the private studio to manage wallpaper content.

## 🤝 Contributing

Contributions that improve responsiveness, gallery performance, accessibility, download behavior, or creator tooling are welcome.

---

<div align="center">
Built by <a href="https://github.com/anshdeepofficial">Anshdeep Singh</a>
</div>
