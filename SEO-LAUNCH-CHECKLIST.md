# Dark Anime Walls — SEO & release checks

This branch is **preview only**. Production `main` must not be changed without explicit approval.

## Preview isolation
- The HTML pages on this branch intentionally contain `<meta name="robots" content="noindex,nofollow,noarchive">`.
- Vercel preview deployments also send `X-Robots-Tag: noindex` and may require a share link to view.
- Canonical links and sitemap URLs point at the **future production hostname** `https://darkanimewalls.vercel.app`, not the preview hostname.
- Do not submit preview URLs or sitemaps to Search Console.

## On approval for production only
1. Review all public pages visually at desktop, tablet and phone sizes; verify keyboard menu navigation, image preview, download, search, pagination and forms.
2. Review the Privacy, Cookie, Terms and Copyright wording for legal accuracy and your real content rights. These are project templates, not legal advice or a verified claim of ownership over fan art.
3. Remove preview-only `noindex,nofollow,noarchive` tags from **public** pages at launch. Keep `studio.html` `noindex`, and do not expose it in navigation or sitemaps.
4. Verify the chosen canonical public hostname. All currently use `https://darkanimewalls.vercel.app`. If a custom domain becomes primary, update canonical and Open Graph URLs, site schema, sitemap URLs and `robots.txt`.
5. Publish the site and check that public pages have **no** `X-Robots-Tag: noindex` from hosting. Do not remove preview protection just to test it.
6. In Google Search Console, verify the final production property, submit `/sitemap.xml` and `/image-sitemap.xml`, and inspect representative URLs.
7. Verify image crawlability in Search Console. Original images are served from `res.cloudinary.com` and may require additional CDN ownership/crawl-error review.
8. Run PageSpeed Insights or Lighthouse on production, then improve real-world Core Web Vitals if needed. The gallery uses optimized display transformations; downloads still use original files.
9. Validate breadcrumbs and metadata with Google Rich Results Test / URL Inspection. No rich-result or ranking outcome is guaranteed.
10. Monitor indexed pages, image coverage, crawl errors, and broken links after launch.

## Current multi-page architecture
Primary navigation: Home, Explore, Phone, Desktop, Requests.
Secondary pages: About, Collaborations, Contact, FAQ, Privacy, Terms, Copyright & Usage, Cookies & External Services.
Public sitemap: `/sitemap.xml`.
Dynamic published-only Cloudinary image sitemap: `/image-sitemap.xml` (Vercel rewrite to `/api/image-sitemap`).
App/site metadata: `/site.webmanifest`.
The private studio remains at `/studio.html` and is intentionally not part of either sitemap.

## Search and image discovery notes
- An XML sitemap aids discovery but does not guarantee indexing or search rank.
- Don't fabricate ratings, licenses, reviews, or image ownership in structured data.
- The existing public Cloudinary API currently returns up to 100 resources, by design. If the collection grows past this cap, implement proper Cloudinary cursor pagination before claiming comprehensive catalog/image-sitemap coverage.
- Google image metadata needs accurate licensable artwork rights; avoid claiming them for fan art without permission.

Reference: https://developers.google.com/search/docs/
