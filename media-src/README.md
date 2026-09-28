# media-src: raw hero media (gitignored)

Put the AI-generated renders here (ChatGPT images, Google Flow / Veo videos). The night run optimizes them into `public/media/` with `npm run media:optimize` and wires them into the landing page.

Suggested names (anything works; the landing step also looks at aspect ratio and content):

| File | What | Where it's used |
|---|---|---|
| `hero-desktop.png/jpg` | 16:9 blue-hour penthouse living room, city lights | Hero poster (desktop) |
| `hero-mobile.png/jpg` | 9:16 vertical version | Hero poster (mobile) |
| `hero.mp4` | 8s slow dolly-in, same scene | Hero video (desktop) |
| `hero-mobile.mp4` | vertical video (optional) | Hero video (mobile) |
| `city.mp4` | aerial of a river city at golden hour | Neighborhoods / about section |
| `walkthrough.mp4` | first-person walk through a bright apartment | 3D tours teaser |
| `tours3d.png` | interior dissolving into a point cloud | 3D tours section |
| `sell.png` | entrance hall with brass keys | "Prodajte sa nama" |
| `valuation.png` | floor plan + brass ruler still life | Valuation CTA |
| `about.png` | Secession facade at golden hour | About page |

## Delivered 2026-09-28 (generated in the owner's ChatGPT + Google Flow / Veo 3.1 Quality)
- `hero-desktop.png` 1672x941 and `hero.mp4` 1920x1080 8s: **hero.mp4 was generated with hero-desktop.png as its START FRAME**,
  so the poster and the first video frame are identical -> use hero-desktop.png (optimized) as the video poster for a seamless poster->video handoff.
- `hero-mobile.png` 941x1672 (9:16): mobile poster. On mobile, play hero.mp4 with object-fit: cover (center crop) or keep the still + GSAP Ken Burns if data-saver/low power.
- `city.mp4` 1920x1080 8s golden-hour aerial of a Belgrade-like river confluence -> Neighborhoods/"Lokacije" section or About.
- `walkthrough.mp4` 1920x1080 8s first-person walk through a bright apartment -> 3D tours teaser section (muted, loop, lazy).
- `tours3d.png` (+ `tours3d-alt.png`) interior dissolving into a champagne-gold point cloud -> 3D tours section poster.
- `sell.png` 1536x1024 entrance hall with brass keys -> "Prodajte sa nama".
- `valuation.png` 1536x1024 floor plan + brass ruler still life -> valuation CTA / Procena page.
- `about.png` 1536x1024 Belgrade Secession facade at golden hour -> About page.
All are AI-generated: never present them as photos of real listings; they are brand/mood visuals only.
