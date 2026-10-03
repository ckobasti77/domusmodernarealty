# Domus Moderna Realty — brand files

**SR (kratko):** Ovo su glavni fajlovi novog logoa. Koristi ih ovakve kakvi jesu: ne crtaj logo ponovo, ne kucaj tekst fontom i ne menjaj razmake. Pečat sa 3D D-om je glavni grb, horizontalni logo ide u zaglavlje sajta i dokumente, a ravan D u favicon i najmanje ikonice.

The agency is **Domus Moderna Realty** (short form: **Domus Moderna**). "Mihajlo Estate" was a working name and is retired.

## The identity in one line
A **portal D**: the D of *Domus* with an arched doorway as its counter, extruded like a bronze monument. Modern geometry, classical entrance. The **seal** puts that D in a ring that reads "DOMUS MODERNA · REALTY · BEOGRAD".

## Files (all SVG are outlined paths, no fonts, no filters)

| File | What | Use it for |
|---|---|---|
| `svg/lockup-horizontal-on-dark.svg` / `-on-light` / `-mono` | 3D D + DOMUS MODERNA / REALTY | Website header, documents, e-mail signature, letterhead |
| `svg/lockup-compact-on-dark.svg` / `-on-light` | 3D D + DOMUS MODERNA (no REALTY) | Narrow spaces where REALTY would be smaller than ~6 px cap height |
| `svg/seal-on-dark.svg` / `-on-light` / `-mono` | Ring text + 3D D | Main emblem: footer, signage, social avatar, brochures, photo watermark |
| `svg/seal-flat-mono.svg` | Ring text + flat D, one colour | Rubber stamp, embossing, engraving, single-colour print |
| `svg/mark-3d-on-dark.svg` / `-on-light` / `-mono` | 3D D alone | App icon, avatar fallback, loading/preloader, admin sidebar |
| `svg/mark-flat-*.svg` | Flat D alone | Anything ≤ 24 px (favicon, tiny UI) |
| `svg/wordmark-*.svg` | DOMUS MODERNA / REALTY | When the D is already shown nearby |
| `icons/icon.svg`, `icons/favicon.ico` | Flat ivory D on ink | Favicon (16/32/48) |
| `icons/apple-icon.png` (180), `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`, `icons/app-icon.svg` | 3D D on ink | Apple touch icon, web manifest |
| `og/og-default.png` (1200×630), `og/og-default.svg` | Seal + wordmark on ink | Default Open Graph / Twitter image |

Each SVG names its parts with ids: `front` (D face), `side` (depth), `ring` (seal rings + text), `name` (DOMUS MODERNA), `desc` (REALTY), `mark` (merged one-colour art). Recolour by part, never by redrawing.

## Colours (existing site tokens)

| Part | On dark (ink #0E0D0B) | On light (ivory #F4EFE6 / paper / white) | One colour |
|---|---|---|---|
| D face (`front`) | Ivory `#F4EFE6` | Ink `#0E0D0B` | currentColor |
| D depth (`side`) | Bronze `#B08D57` | Bronze `#B08D57` | currentColor, separated from the face by a gap (mono files) |
| DOMUS MODERNA (`name`) | Ivory `#F4EFE6` | Ink `#0E0D0B` | currentColor |
| REALTY (`desc`) | Bronze `#B08D57` | Bronze text `#7A623C` | currentColor |
| Seal ring + text (`ring`) | Bronze `#B08D57` | Ink `#0E0D0B` | currentColor |

Bronze in print: about CMYK 0 / 20 / 51 / 31 (check against a physical Pantone guide before printing; around Pantone 7562 C).

## Sizes and spacing
- **Seal:** at least 96 px on screen / 25 mm in print. Below that the ring text cannot be read, so use the 3D mark.
- **3D mark:** at least 24 px / 8 mm. Below that use the flat mark.
- **Horizontal lockup:** at least 160 px wide. Below that use the compact lockup.
- **Clear space:** on every side, keep at least the width of the D's doorway (≈ ¼ of the D's height) free of other elements.
- The 3D D is centred by visual weight, not by its bounding box. When you place it alone in a square or circle, shift it ≈ 5 % of its height to the right of the box centre (the seal and app icons already do this).

## Don't
- Don't redraw the logo, set the name in a live font, or change letter spacing.
- Don't stretch, rotate, outline, add shadows or glows, or replace the flat depth with a gradient.
- Don't swap the colours of face and depth, or put the bronze depth on a bronze background.
- Don't place the 3D mark on busy photos without a dark scrim. On photos use the seal or the mark on-dark over a scrim, or the mono version.

## Typography in the logo (already outlined)
- DOMUS MODERNA: EB Garamond 500, caps, +0.12 em tracking.
- REALTY and seal text: Manrope 600, caps, wide tracking.
- Both are SIL Open Font License, so they are fine in a logo. These are the site's own display and UI fonts.
