# SEO audit

Generated 2026-10-01T20:44:03.812Z by `node scripts/seo-audit.mjs` against `http://localhost:3000` (production build, `npm run start`), crawling as Googlebot: Next 16 renders metadata blocking in `<head>` only for crawler user agents and streams it for browsers.

**344 pages** (every `<loc>` in the sitemap + favorites/compare in 4 locales): **294 pass**, **50 with errors**, 62 warnings.

Checks per page: status 200 · `<html lang>` = locale · one `<title>` of 10–70 chars (warning above 65) · meta description 50–230 chars (warning above 170) · exactly one `<h1>` in the server HTML · one self-referencing canonical · hreflang sr-Latn/en/ru/de + x-default (= sr-Latn), each alternate crawled and linking back · `og:title/description/image/url` (url = canonical) · `twitter:card` = summary_large_image · `noindex` only on favorites/compare · JSON-LD valid (`scripts/validate-jsonld.mjs`, exactly one full `RealEstateAgent` per page) · every distinct `og:image` answers 200 with an image.

## Pages by route

| Route | sr | en | ru | de | Title chars (min–max) | Description chars (min–max) | JSON-LD types |
|---|---|---|---|---|---|---|---|
| home | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 47–50 | 111–134 | RealEstateAgent |
| search | ❌ 1/1 | ❌ 1/1 | ❌ 1/1 | ❌ 1/1 | 0–37 | 0–143 | RealEstateAgent, BreadcrumbList |
| locations | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 48–70 | 132–161 | BreadcrumbList, RealEstateAgent |
| valuation | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 35–46 | 152–191 | BreadcrumbList, RealEstateAgent |
| sell | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 43–45 | 170–192 | BreadcrumbList, RealEstateAgent |
| agents | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 40–48 | 90–107 | BreadcrumbList, RealEstateAgent |
| about | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 55–58 | 137–177 | BreadcrumbList, AboutPage, RealEstateAgent |
| contact | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 24–25 | 130–142 | BreadcrumbList, ContactPage, RealEstateAgent |
| journal | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 23–24 | 64–78 | BreadcrumbList, RealEstateAgent |
| privacy | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 31–44 | 95–111 | BreadcrumbList, RealEstateAgent |
| terms | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 34–48 | 116–153 | BreadcrumbList, RealEstateAgent |
| cookies | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 30–51 | 102–129 | BreadcrumbList, RealEstateAgent |
| listing detail | ❌ 3/28 | ❌ 3/28 | ❌ 3/28 | ❌ 3/28 | 49–70 | 99–158 | RealEstateListing, Apartment, Offer, RealEstateAgent, BreadcrumbList, SingleFamilyResidence, Place, House |
| location detail | ❌ 1/37 | ❌ 6/37 | ❌ 9/37 | ❌ 6/37 | 46–80 | 78–154 | BreadcrumbList, Place, RealEstateAgent |
| journal detail | ❌ 3/3 | ❌ 3/3 | ❌ 3/3 | ❌ 3/3 | 57–87 | 146–202 | Article, Person, Organization, BreadcrumbList, RealEstateAgent |
| agent detail | ✅ 4 | ✅ 4 | ✅ 4 | ✅ 4 | 44–65 | 148–157 | BreadcrumbList, Person, RealEstateAgent |
| favorites | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 25–33 | 90–110 | BreadcrumbList, RealEstateAgent |
| compare | ✅ 1 | ✅ 1 | ✅ 1 | ✅ 1 | 26–27 | 138–147 | BreadcrumbList, RealEstateAgent |

## Errors

- `/sr/nekretnine`: 0 <title> elements; title length 0: ""; description length 0; Open Graph title/description/image missing; Twitter card missing; 0 canonical links; hreflang set (none)
- `/en/properties`: hreflang sr-Latn → http://localhost:3000/sr/nekretnine does not link back (reciprocity)
- `/ru/nedvizhimost`: hreflang sr-Latn → http://localhost:3000/sr/nekretnine does not link back (reciprocity)
- `/de/immobilien`: hreflang sr-Latn → http://localhost:3000/sr/nekretnine does not link back (reciprocity)
- `/sr/nekretnine/lokal-od-74-m-u-strahinjica-bana-prizemlje-zgrade-iz-1935-me-1064`: JSON-LD Place: name missing
- `/en/properties/lokal-od-74-m-u-strahinjica-bana-prizemlje-zgrade-iz-1935-me-1064`: JSON-LD Place: name missing
- `/ru/nedvizhimost/lokal-od-74-m-u-strahinjica-bana-prizemlje-zgrade-iz-1935-me-1064`: JSON-LD Place: name missing
- `/de/immobilien/lokal-od-74-m-u-strahinjica-bana-prizemlje-zgrade-iz-1935-me-1064`: JSON-LD Place: name missing
- `/sr/nekretnine/gradjevinski-plac-od-1-250-m-kod-palickog-jezera-me-1071`: JSON-LD Place: name missing
- `/en/properties/gradjevinski-plac-od-1-250-m-kod-palickog-jezera-me-1071`: JSON-LD Place: name missing
- `/ru/nedvizhimost/gradjevinski-plac-od-1-250-m-kod-palickog-jezera-me-1071`: JSON-LD Place: name missing
- `/de/immobilien/gradjevinski-plac-od-1-250-m-kod-palickog-jezera-me-1071`: JSON-LD Place: name missing
- `/sr/nekretnine/kancelarija-od-145-m-u-bloku-70-peti-sprat-sa-terasom-me-1065`: JSON-LD Place: name missing
- `/en/properties/kancelarija-od-145-m-u-bloku-70-peti-sprat-sa-terasom-me-1065`: JSON-LD Place: name missing
- `/ru/nedvizhimost/kancelarija-od-145-m-u-bloku-70-peti-sprat-sa-terasom-me-1065`: JSON-LD Place: name missing
- `/de/immobilien/kancelarija-od-145-m-u-bloku-70-peti-sprat-sa-terasom-me-1065`: JSON-LD Place: name missing
- `/ru/lokacii/savski-venac`: title length 71: "Савски венац, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/ru/lokacii/novi-beograd`: title length 71: "Нови-Белград, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/en/locations/kosancicev-venac`: title length 73: "Kosančićev Venac, Belgrade: property prices and listings — Mihajlo Estate"
- `/ru/lokacii/kosancicev-venac`: title length 75: "Косанчичев венац, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/de/lagen/kosancicev-venac`: title length 72: "Kosančićev Venac, Belgrad: Immobilienpreise und Angebot – Mihajlo Estate"
- `/en/locations/beograd-na-vodi`: title length 76: "Belgrade Waterfront, Belgrade: property prices and listings — Mihajlo Estate"
- `/ru/lokacii/beograd-na-vodi`: title length 74: "Белград на воде, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/de/lagen/beograd-na-vodi`: title length 75: "Belgrade Waterfront, Belgrad: Immobilienpreise und Angebot – Mihajlo Estate"
- `/en/locations/bezanijska-kosa`: title length 72: "Bežanijska Kosa, Belgrade: property prices and listings — Mihajlo Estate"
- `/ru/lokacii/bezanijska-kosa`: title length 74: "Бежанийска коса, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/de/lagen/bezanijska-kosa`: title length 71: "Bežanijska Kosa, Belgrad: Immobilienpreise und Angebot – Mihajlo Estate"
- `/en/locations/zemunske-kapije`: title length 72: "Zemunske Kapije, Belgrade: property prices and listings — Mihajlo Estate"
- `/ru/lokacii/zemunske-kapije`: title length 73: "Земунске капие, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/de/lagen/zemunske-kapije`: title length 71: "Zemunske Kapije, Belgrad: Immobilienpreise und Angebot – Mihajlo Estate"
- `/en/locations/cvetkova-pijaca`: title length 72: "Cvetkova Pijaca, Belgrade: property prices and listings — Mihajlo Estate"
- `/ru/lokacii/cvetkova-pijaca`: title length 73: "Цветкова пияца, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/de/lagen/cvetkova-pijaca`: title length 71: "Cvetkova Pijaca, Belgrad: Immobilienpreise und Angebot – Mihajlo Estate"
- `/sr/lokacije/profesorska-kolonija`: title length 72: "Profesorska kolonija, Beograd: cene i ponuda nekretnina — Mihajlo Estate"
- `/en/locations/profesorska-kolonija`: title length 75: "Professors' Colony, Belgrade: property prices and listings — Mihajlo Estate"
- `/ru/lokacii/profesorska-kolonija`: title length 80: "Профессорская колония, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/de/lagen/profesorska-kolonija`: title length 74: "Professorenkolonie, Belgrad: Immobilienpreise und Angebot – Mihajlo Estate"
- `/ru/lokacii/hadzipopovac`: title length 71: "Хаджипоповац, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/sr/magazin/kupovina-nekretnine-u-srbiji-za-strance`: JSON-LD Person: worksFor missing
- `/en/journal/kupovina-nekretnine-u-srbiji-za-strance`: JSON-LD Person: worksFor missing
- `/ru/zhurnal/kupovina-nekretnine-u-srbiji-za-strance`: title length 87: "Покупка недвижимости в Сербии: руководство для иностранных покупателей — Mihajlo Estate"; JSON-LD Person: worksFor missing
- `/de/magazin/kupovina-nekretnine-u-srbiji-za-strance`: title length 77: "Immobilienkauf in Serbien: Leitfaden für ausländische Käufer – Mihajlo Estate"; JSON-LD Person: worksFor missing
- `/sr/magazin/vracar-ili-dorcol-vodic-kroz-dva-kvarta`: JSON-LD Person: worksFor missing
- `/en/journal/vracar-ili-dorcol-vodic-kroz-dva-kvarta`: JSON-LD Person: worksFor missing
- `/ru/zhurnal/vracar-ili-dorcol-vodic-kroz-dva-kvarta`: JSON-LD Person: worksFor missing
- `/de/magazin/vracar-ili-dorcol-vodic-kroz-dva-kvarta`: title length 72: "Vračar oder Dorćol: zwei Belgrader Viertel im Vergleich – Mihajlo Estate"; JSON-LD Person: worksFor missing
- `/sr/magazin/povracaj-pdv-za-prvi-stan`: JSON-LD Person: worksFor missing
- `/en/journal/povracaj-pdv-za-prvi-stan`: title length 80: "VAT refund on your first flat: conditions, forms and an example — Mihajlo Estate"; JSON-LD Person: worksFor missing
- `/ru/zhurnal/povracaj-pdv-za-prvi-stan`: title length 81: "Возврат НДС при покупке первой квартиры: условия, формы и пример — Mihajlo Estate"; JSON-LD Person: worksFor missing
- `/de/magazin/povracaj-pdv-za-prvi-stan`: title length 78: "MwSt.-Rückerstattung für Erstkäufer: Bedingungen und Beispiel – Mihajlo Estate"; JSON-LD Person: worksFor missing

## Warnings

- `/en/locations`: title 70 chars (may truncate): "Locations: Belgrade neighbourhoods and Serbian cities — Mihajlo Estate"
- `/en/valuation`: description 191 chars (snippet may cut)
- `/de/bewertung`: description 176 chars (snippet may cut)
- `/en/sell`: description 192 chars (snippet may cut)
- `/ru/prodat`: description 191 chars (snippet may cut)
- `/de/verkaufen`: description 184 chars (snippet may cut)
- `/de/ueber-uns`: description 177 chars (snippet may cut)
- `/ru/nedvizhimost/jednoiposoban-stan-na-kosancicevom-vencu-za-renoviranje-me-1046`: title 69 chars (may truncate): "1,5-комнатная квартира, Косанчичев венац — 178 000 € — Mihajlo Estate"
- `/de/immobilien/jednoiposoban-stan-na-kosancicevom-vencu-za-renoviranje-me-1046`: title 67 chars (may truncate): "1,5-Zimmer-Wohnung in Kosančićev Venac – 178.000 € – Mihajlo Estate"
- `/ru/nedvizhimost/penthaus-na-24-spratu-u-beogradu-na-vodi-pogled-na-savu-me-1049`: title 66 chars (may truncate): "3-комнатная квартира, Белград на воде — 725 000 € — Mihajlo Estate"
- `/de/immobilien/penthaus-na-24-spratu-u-beogradu-na-vodi-pogled-na-savu-me-1049`: title 68 chars (may truncate): "3-Zimmer-Wohnung in Belgrade Waterfront – 725.000 € – Mihajlo Estate"
- `/en/properties/jednoiposoban-stan-u-beogradu-na-vodi-spreman-za-izdavanje-me-1050`: title 67 chars (may truncate): "1.5-room apartment, Belgrade Waterfront — €265,000 — Mihajlo Estate"
- `/ru/nedvizhimost/jednoiposoban-stan-u-beogradu-na-vodi-spreman-za-izdavanje-me-1050`: title 68 chars (may truncate): "1,5-комнатная квартира, Белград на воде — 265 000 € — Mihajlo Estate"
- `/de/immobilien/jednoiposoban-stan-u-beogradu-na-vodi-spreman-za-izdavanje-me-1050`: title 70 chars (may truncate): "1,5-Zimmer-Wohnung in Belgrade Waterfront – 265.000 € – Mihajlo Estate"
- `/ru/nedvizhimost/dvosoban-stan-u-novogradnji-na-bezanijskoj-kosi-useljenje-2027-me-1053`: title 66 chars (may truncate): "2-комнатная квартира, Бежанийска коса — 176 000 € — Mihajlo Estate"
- `/ru/nedvizhimost/lokal-od-74-m-u-strahinjica-bana-prizemlje-zgrade-iz-1935-me-1064`: title 66 chars (may truncate): "Коммерческое помещение, 74 м², Дорчол — 420 000 € — Mihajlo Estate"
- `/en/properties/renovirana-garsonjera-od-32-m-kod-cvetkove-pijace-me-1058`: title 67 chars (may truncate): "1-room apartment, Cvetkova Pijaca — €450 per month — Mihajlo Estate"
- `/ru/nedvizhimost/renovirana-garsonjera-od-32-m-kod-cvetkove-pijace-me-1058`: title 69 chars (may truncate): "1-комнатная квартира, Цветкова пияца — 450 € в месяц — Mihajlo Estate"
- `/de/immobilien/renovirana-garsonjera-od-32-m-kod-cvetkove-pijace-me-1058`: title 70 chars (may truncate): "1-Zimmer-Wohnung in Cvetkova Pijaca – 450 € monatlich – Mihajlo Estate"
- `/en/locations/stari-grad`: title 67 chars (may truncate): "Stari Grad, Belgrade: property prices and listings — Mihajlo Estate"
- `/ru/lokacii/stari-grad`: title 69 chars (may truncate): "Стари град, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/de/lagen/stari-grad`: title 66 chars (may truncate): "Stari Grad, Belgrad: Immobilienpreise und Angebot – Mihajlo Estate"
- `/en/locations/savski-venac`: title 69 chars (may truncate): "Savski Venac, Belgrade: property prices and listings — Mihajlo Estate"
- `/de/lagen/savski-venac`: title 68 chars (may truncate): "Savski Venac, Belgrad: Immobilienpreise und Angebot – Mihajlo Estate"
- `/en/locations/novi-beograd`: title 69 chars (may truncate): "Novi Beograd, Belgrade: property prices and listings — Mihajlo Estate"
- `/de/lagen/novi-beograd`: title 68 chars (may truncate): "Novi Beograd, Belgrad: Immobilienpreise und Angebot – Mihajlo Estate"
- `/ru/lokacii/vozdovac`: title 67 chars (may truncate): "Вождовац, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/ru/lokacii/zvezdara`: title 67 chars (may truncate): "Звездара, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/ru/lokacii/palilula`: title 67 chars (may truncate): "Палилула, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/ru/lokacii/cukarica`: title 67 chars (may truncate): "Чукарица, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/ru/lokacii/kalenic`: title 66 chars (may truncate): "Каленич, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/en/locations/crveni-krst`: title 68 chars (may truncate): "Crveni Krst, Belgrade: property prices and listings — Mihajlo Estate"
- `/ru/lokacii/crveni-krst`: title 70 chars (may truncate): "Црвени крст, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/de/lagen/crveni-krst`: title 67 chars (may truncate): "Crveni Krst, Belgrad: Immobilienpreise und Angebot – Mihajlo Estate"
- `/sr/lokacije/kosancicev-venac`: title 68 chars (may truncate): "Kosančićev venac, Beograd: cene i ponuda nekretnina — Mihajlo Estate"
- `/sr/lokacije/beograd-na-vodi`: title 67 chars (may truncate): "Beograd na vodi, Beograd: cene i ponuda nekretnina — Mihajlo Estate"
- `/en/locations/blok-19a`: title 66 chars (may truncate): "Block 19a, Belgrade: property prices and listings — Mihajlo Estate"
- `/ru/lokacii/blok-19a`: title 67 chars (may truncate): "Блок 19а, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/ru/lokacii/blok-70`: title 66 chars (may truncate): "Блок 70, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/sr/lokacije/bezanijska-kosa`: title 67 chars (may truncate): "Bežanijska kosa, Beograd: cene i ponuda nekretnina — Mihajlo Estate"
- `/en/locations/zemun-centar`: title 69 chars (may truncate): "Zemun Centre, Belgrade: property prices and listings — Mihajlo Estate"
- `/ru/lokacii/zemun-centar`: title 70 chars (may truncate): "Земун-центр, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/de/lagen/zemun-centar`: title 69 chars (may truncate): "Zemun Zentrum, Belgrad: Immobilienpreise und Angebot – Mihajlo Estate"
- `/sr/lokacije/zemunske-kapije`: title 67 chars (may truncate): "Zemunske kapije, Beograd: cene i ponuda nekretnina — Mihajlo Estate"
- `/en/locations/dusanovac`: title 66 chars (may truncate): "Dušanovac, Belgrade: property prices and listings — Mihajlo Estate"
- `/ru/lokacii/dusanovac`: title 68 chars (may truncate): "Душановац, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/sr/lokacije/cvetkova-pijaca`: title 67 chars (may truncate): "Cvetkova pijaca, Beograd: cene i ponuda nekretnina — Mihajlo Estate"
- `/en/locations/hadzipopovac`: title 69 chars (may truncate): "Hadžipopovac, Belgrade: property prices and listings — Mihajlo Estate"
- `/de/lagen/hadzipopovac`: title 68 chars (may truncate): "Hadžipopovac, Belgrad: Immobilienpreise und Angebot – Mihajlo Estate"
- `/en/locations/banovo-brdo`: title 68 chars (may truncate): "Banovo Brdo, Belgrade: property prices and listings — Mihajlo Estate"
- `/ru/lokacii/banovo-brdo`: title 70 chars (may truncate): "Баново брдо, Белград: цены и предложения недвижимости — Mihajlo Estate"
- `/de/lagen/banovo-brdo`: title 67 chars (may truncate): "Banovo Brdo, Belgrad: Immobilienpreise und Angebot – Mihajlo Estate"
- `/ru/lokacii/grbavica-ns`: title 68 chars (may truncate): "Грбавица, Нови-Сад: цены и предложения недвижимости — Mihajlo Estate"
- `/sr/magazin/kupovina-nekretnine-u-srbiji-za-strance`: title 68 chars (may truncate): "Kupovina nekretnine u Srbiji: vodič za strane kupce — Mihajlo Estate"
- `/en/journal/kupovina-nekretnine-u-srbiji-za-strance`: title 70 chars (may truncate): "Buying property in Serbia: a guide for foreign buyers — Mihajlo Estate"; description 184 chars (snippet may cut)
- `/ru/zhurnal/kupovina-nekretnine-u-srbiji-za-strance`: description 196 chars (snippet may cut)
- `/de/magazin/kupovina-nekretnine-u-srbiji-za-strance`: description 202 chars (snippet may cut)
- `/en/journal/vracar-ili-dorcol-vodic-kroz-dva-kvarta`: title 68 chars (may truncate): "Vračar or Dorćol: a guide to two Belgrade districts — Mihajlo Estate"
- `/de/magazin/vracar-ili-dorcol-vodic-kroz-dva-kvarta`: description 173 chars (snippet may cut)
- `/sr/magazin/povracaj-pdv-za-prvi-stan`: title 69 chars (may truncate): "Povraćaj PDV-a za prvi stan: uslovi, obrasci, primer — Mihajlo Estate"
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
| `/sr/opengraph-image` | 200 | image/jpeg | 69 | 33 |
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
| `/photo-1632343084054-5b108ffb8be3?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/jpeg | 339 | 8 |
| `/photo-1630137294649-ab67a2c9891c?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/jpeg | 176 | 4 |
| `/photo-1664813953897-ada06817c48c?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/jpeg | 91 | 4 |
| `/photo-1560448205-d82bf18b9bcf?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/jpeg | 227 | 4 |
| `/photo-1714919286244-6f3f6cce6e65?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/jpeg | 225 | 4 |
| `/photo-1655245934655-bde35a9dae80?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/jpeg | 148 | 4 |
| `/photo-1568234942177-2b37de78f6da?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/jpeg | 265 | 4 |
| `/photo-1727105538592-3074729d8abc?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/jpeg | 181 | 8 |
| `/photo-1706480228561-6e6ba0b5a44b?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/jpeg | 184 | 4 |
| `/photo-1608816747977-4d303f476571?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/jpeg | 215 | 8 |
| `/photo-1515263487990-61b07816b324?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/jpeg | 120 | 4 |
| `/photo-1748063578185-3d68121b11ff?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/jpeg | 116 | 4 |
| `/photo-1766603636700-e9d80473f40f?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/jpeg | 159 | 4 |
| `/photo-1708253832369-ce7e621df31a?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/jpeg | 123 | 4 |
| `/photo-1624524799657-465e72edbcda?w=1200&h=630&fit=crop&crop=entropy&q=80&auto=format` | 200 | image/jpeg | 140 | 4 |
| `/sr/magazin/kupovina-nekretnine-u-srbiji-za-strance/opengraph-image` | 200 | image/jpeg | 63 | 1 |
| `/en/journal/kupovina-nekretnine-u-srbiji-za-strance/opengraph-image` | 200 | image/jpeg | 60 | 1 |
| `/ru/zhurnal/kupovina-nekretnine-u-srbiji-za-strance/opengraph-image` | 200 | image/jpeg | 66 | 1 |
| `/de/magazin/kupovina-nekretnine-u-srbiji-za-strance/opengraph-image` | 200 | image/jpeg | 63 | 1 |

146 distinct share images fetched, 0 failed; the table shows the first ones and every failure.
