# SEO audit

Generated 2026-10-01T22:11:12.374Z by `node scripts/seo-audit.mjs` against `http://localhost:3000` (production build, `npm run start`), crawling as Bingbot: Next 16 renders metadata blocking in `<head>` for HTML-limited crawlers (Bing, Yandex, Facebook, X, WhatsApp, LinkedIn…) and streams it into `<body>` for browsers and Googlebot, which renders JavaScript.

**344 pages** (every `<loc>` in the sitemap + favorites/compare in 4 locales): **344 pass**, **0 with errors**, 34 warnings.

Checks per page: status 200 · `<html lang>` = locale · one `<title>` of 10–70 chars (warning above 65) · meta description 50–230 chars (warning above 170) · exactly one `<h1>` in the server HTML · one self-referencing canonical · hreflang sr-Latn/en/ru/de + x-default (= sr-Latn), each alternate crawled and linking back · `og:title/description/image/url` (url = canonical) · `twitter:card` = summary_large_image · `noindex` only on favorites/compare · JSON-LD valid (`scripts/validate-jsonld.mjs`, exactly one full `RealEstateAgent` per page) · every distinct `og:image` answers 200 with an image.

## Pages by route

| Route | sr | en | ru | de | Title chars (min–max) | Description chars (min–max) | JSON-LD types |
|---|---|---|---|---|---|---|---|
| home | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 47–50 | 107–134 | RealEstateAgent |
| search | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 36–38 | 132–143 | RealEstateAgent, BreadcrumbList |
| locations | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 48–63 | 132–161 | BreadcrumbList, RealEstateAgent |
| valuation | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 35–46 | 152–191 | BreadcrumbList, RealEstateAgent |
| sell | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 43–45 | 170–192 | BreadcrumbList, RealEstateAgent |
| agents | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 40–48 | 90–107 | BreadcrumbList, RealEstateAgent |
| about | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 55–58 | 137–177 | BreadcrumbList, AboutPage, RealEstateAgent |
| contact | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 24–25 | 130–142 | BreadcrumbList, ContactPage, RealEstateAgent |
| journal | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 23–24 | 64–78 | BreadcrumbList, RealEstateAgent |
| privacy | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 31–44 | 95–111 | BreadcrumbList, RealEstateAgent |
| terms | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 34–48 | 116–153 | BreadcrumbList, RealEstateAgent |
| cookies | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 30–51 | 102–129 | BreadcrumbList, RealEstateAgent |
| listing detail | ✅ 28 | ✅ 28 | ✅ 28 | ✅ 28 | 49–67 | 99–158 | RealEstateListing, Apartment, Offer, RealEstateAgent, BreadcrumbList, SingleFamilyResidence, Place, House |
| location detail | ✅ 37 | ✅ 37 | ✅ 37 | ✅ 37 | 46–67 | 78–157 | BreadcrumbList, Place, RealEstateAgent |
| journal detail | ✅ 3 | ✅ 3 | ✅ 3 | ✅ 3 | 51–70 | 146–202 | Article, Person, Organization, BreadcrumbList, RealEstateAgent |
| agent detail | ✅ 4 | ✅ 4 | ✅ 4 | ✅ 4 | 44–65 | 145–157 | BreadcrumbList, Person, RealEstateAgent |
| favorites | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 25–33 | 90–110 | BreadcrumbList, RealEstateAgent |
| compare | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 26–27 | 138–147 | BreadcrumbList, RealEstateAgent |

## Errors

None.

## Warnings

- `/en/valuation`: description 191 chars (snippet may cut)
- `/de/bewertung`: description 176 chars (snippet may cut)
- `/en/sell`: description 192 chars (snippet may cut)
- `/ru/prodat`: description 191 chars (snippet may cut)
- `/de/verkaufen`: description 184 chars (snippet may cut)
- `/de/ueber-uns`: description 177 chars (snippet may cut)
- `/de/immobilien/jednoiposoban-stan-na-kosancicevom-vencu-za-renoviranje-me-1046`: title 67 chars (may truncate): "1,5-Zimmer-Wohnung in Kosančićev Venac – 178.000 € – Mihajlo Estate"
- `/ru/nedvizhimost/penthaus-na-24-spratu-u-beogradu-na-vodi-pogled-na-savu-me-1049`: title 66 chars (may truncate): "3-комнатная квартира, Белград на воде — 725 000 € — Mihajlo Estate"
- `/de/immobilien/jednoiposoban-stan-u-beogradu-na-vodi-spreman-za-izdavanje-me-1050`: title 66 chars (may truncate): "1,5-Zimmer-Wohnung in Beograd na vodi – 265.000 € – Mihajlo Estate"
- `/ru/nedvizhimost/dvosoban-stan-u-novogradnji-na-bezanijskoj-kosi-useljenje-2027-me-1053`: title 66 chars (may truncate): "2-комнатная квартира, Бежанийска коса — 176 000 € — Mihajlo Estate"
- `/ru/nedvizhimost/lokal-od-74-m-u-strahinjica-bana-prizemlje-zgrade-iz-1935-me-1064`: title 66 chars (may truncate): "Коммерческое помещение, 74 м², Дорчол — 420 000 € — Mihajlo Estate"
- `/en/properties/renovirana-garsonjera-od-32-m-kod-cvetkove-pijace-me-1058`: title 67 chars (may truncate): "1-room apartment, Cvetkova Pijaca — €450 per month — Mihajlo Estate"
- `/en/locations/stari-grad`: title 67 chars (may truncate): "Stari Grad, Belgrade: property prices and listings — Mihajlo Estate"
- `/de/lagen/stari-grad`: title 66 chars (may truncate): "Stari Grad, Belgrad: Immobilienpreise und Angebot – Mihajlo Estate"
- `/ru/lokacii/vozdovac`: title 67 chars (may truncate): "Вождовац, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/ru/lokacii/zvezdara`: title 67 chars (may truncate): "Звездара, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/ru/lokacii/palilula`: title 67 chars (may truncate): "Палилула, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/ru/lokacii/cukarica`: title 67 chars (may truncate): "Чукарица, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/ru/lokacii/kalenic`: title 66 chars (may truncate): "Каленич, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/de/lagen/crveni-krst`: title 67 chars (may truncate): "Crveni Krst, Belgrad: Immobilienpreise und Angebot – Mihajlo Estate"
- `/sr/lokacije/beograd-na-vodi`: title 67 chars (may truncate): "Beograd na vodi, Beograd: cene i ponuda nekretnina — Mihajlo Estate"
- `/ru/lokacii/blok-19a`: title 67 chars (may truncate): "Блок 19а, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/ru/lokacii/blok-70`: title 66 chars (may truncate): "Блок 70, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/sr/lokacije/bezanijska-kosa`: title 67 chars (may truncate): "Bežanijska kosa, Beograd: cene i ponuda nekretnina — Mihajlo Estate"
- `/sr/lokacije/zemunske-kapije`: title 67 chars (may truncate): "Zemunske kapije, Beograd: cene i ponuda nekretnina — Mihajlo Estate"
- `/en/locations/dusanovac`: title 66 chars (may truncate): "Dušanovac, Belgrade: property prices and listings — Mihajlo Estate"
- `/sr/lokacije/cvetkova-pijaca`: title 67 chars (may truncate): "Cvetkova pijaca, Beograd: cene i ponuda nekretnina — Mihajlo Estate"
- `/de/lagen/banovo-brdo`: title 67 chars (may truncate): "Banovo Brdo, Belgrad: Immobilienpreise und Angebot – Mihajlo Estate"
- `/en/journal/kupovina-nekretnine-u-srbiji-za-strance`: description 184 chars (snippet may cut)
- `/ru/zhurnal/kupovina-nekretnine-u-srbiji-za-strance`: title 70 chars (may truncate): "Покупка недвижимости в Сербии: руководство для иностранных покупателей"; description 196 chars (snippet may cut)
- `/de/magazin/kupovina-nekretnine-u-srbiji-za-strance`: description 202 chars (snippet may cut)
- `/de/magazin/vracar-ili-dorcol-vodic-kroz-dva-kvarta`: description 174 chars (snippet may cut)
- `/de/magazin/povracaj-pdv-za-prvi-stan`: description 181 chars (snippet may cut)

## Sitemap (`/sitemap.xml`)

336 URLs, 164 with `<lastmod>`, 196 with images (644 `<image:image>`), 326.1 KB. Parsed with `saxes` (namespace-aware, well-formedness errors fail the audit); every `<url>` must carry the 5 hreflang alternates including itself, and every alternate must itself be a `<loc>`.

**Valid.**

## robots.txt

```
User-Agent: *
Allow: /
Disallow: /admin
Disallow: /api
Disallow: /*/styleguide

Sitemap: http://localhost:3000/sitemap.xml
```

**Valid.**

## Share images

| og:image | Status | Type | KB | Pages |
|---|---|---|---|---|
| `/sr/opengraph-image` | 200 | image/jpeg | 69 | 34 |
| `/en/opengraph-image` | 200 | image/jpeg | 70 | 34 |
| `/ru/opengraph-image` | 200 | image/jpeg | 72 | 34 |
| `/de/opengraph-image` | 200 | image/jpeg | 74 | 34 |
| `/media/valuation/valuation-fallback.jpg` | 200 | image/jpeg | 176 | 4 |
| `/media/sell/sell-fallback.jpg` | 200 | image/jpeg | 206 | 4 |
| `/media/about/about-fallback.jpg` | 200 | image/jpeg | 301 | 4 |
| `/sr/nekretnine/trosoban-stan-u-neimaru-renoviran-2023-me-1042/opengraph-image?v=430000` | 200 | image/jpeg | 67 | 1 |
| `/en/properties/trosoban-stan-u-neimaru-renoviran-2023-me-1042/opengraph-image?v=430000` | 200 | image/jpeg | 67 | 1 |
| `/ru/nedvizhimost/trosoban-stan-u-neimaru-renoviran-2023-me-1042/opengraph-image?v=430000` | 200 | image/jpeg | 68 | 1 |
| `/de/immobilien/trosoban-stan-u-neimaru-renoviran-2023-me-1042/opengraph-image?v=430000` | 200 | image/jpeg | 67 | 1 |
| `/sr/nekretnine/dvosoban-stan-kod-kalenic-pijace-u-originalnom-stanju-me-1043/opengraph-image?v=265000` | 200 | image/jpeg | 70 | 1 |
| `/photo-1632343084054-5b108ffb8be3?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/avif | 341 | 8 |
| `/photo-1630137294649-ab67a2c9891c?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/avif | 137 | 4 |
| `/photo-1664813953897-ada06817c48c?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/avif | 39 | 4 |
| `/photo-1560448205-d82bf18b9bcf?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/avif | 188 | 4 |
| `/photo-1714919286244-6f3f6cce6e65?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/avif | 174 | 4 |
| `/photo-1655245934655-bde35a9dae80?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/avif | 93 | 4 |
| `/photo-1568234942177-2b37de78f6da?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/avif | 238 | 4 |
| `/photo-1727105538592-3074729d8abc?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/avif | 139 | 8 |
| `/photo-1706480228561-6e6ba0b5a44b?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/avif | 136 | 4 |
| `/photo-1608816747977-4d303f476571?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/avif | 184 | 8 |
| `/photo-1515263487990-61b07816b324?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/avif | 54 | 4 |
| `/photo-1748063578185-3d68121b11ff?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/avif | 58 | 4 |
| `/photo-1766603636700-e9d80473f40f?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/avif | 102 | 4 |
| `/photo-1708253832369-ce7e621df31a?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/avif | 72 | 4 |
| `/photo-1624524799657-465e72edbcda?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/avif | 96 | 4 |
| `/sr/magazin/kupovina-nekretnine-u-srbiji-za-strance/opengraph-image` | 200 | image/jpeg | 63 | 1 |
| `/en/journal/kupovina-nekretnine-u-srbiji-za-strance/opengraph-image` | 200 | image/jpeg | 60 | 1 |
| `/ru/zhurnal/kupovina-nekretnine-u-srbiji-za-strance/opengraph-image` | 200 | image/jpeg | 66 | 1 |
| `/de/magazin/kupovina-nekretnine-u-srbiji-za-strance/opengraph-image` | 200 | image/jpeg | 63 | 1 |

146 distinct share images fetched, 0 failed; the table shows the first ones and every failure.
