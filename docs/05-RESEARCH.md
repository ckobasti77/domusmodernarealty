# 05: Research summary (September 2026)

The why behind the PRD. Sources are linked so decisions can be checked.

## Local market: the bar to beat
- **CityExpert** is the strongest local player, with 360° photos, floor plans, a loan calculator, a monthly rate on every card, the commission shown ("Provizija 1,5% sa PDV-om") and its registry number (#313). [example](https://cityexpert.rs/prodaja-nekretnina/beograd/80232/dvoiposoban-stan-jurija-gagarina-novi-beograd)
- **4zida** shows €/m² against the neighborhood average and a "MOŽE NA KREDIT" badge, imports agencies' XML feeds, and sells paid placements. **Halo Oglasi** shows banner ads, its map caps at 300 results, and alerts are daily or weekly only. **nekretnine.rs** has draw-on-map and "AI pretraga".
- **Agency sites** (Turaquadra, DIVIS, Kadena Sotheby's, Đinas, Gigant): mostly no valuation funnel, weak English/Russian, often no visible registry number, dated footers.
- **Legal:** brokerage law Art. 18 (ad content + registry number, no ads without a contract); Art. 16 (document check); ZZPL (consent). [Zakon](https://www.paragraf.rs/propisi/zakon_o_posredovanju_u_prometu_i_zakupu_nepokretnosti.html)
- **Financing:** about 40% of Belgrade purchases use a mortgage (RGZ Q4 2025), so calculators matter.

## Global patterns worth copying
- **Search:**
  - Map-first search with price pins, clustering, draw/multi-area selection (Zillow, Rightmove, idealista's Jan-2026 multi-area launch).
  - Instant alerts and price-drop alerts (Zillow). Favorites without an account plus compare (Zillow, Rightmove lists).
- **Listing page:**
  - Floor plans (Rightmove: 1 in 5 buyers ignore listings without one).
  - Showcase-style media: Zillow Showcase listings get +75% views and +68% saves.
  - Sticky "Schedule tour" with real time slots (Redfin).
- **Funnels and portals:**
  - Seller valuation funnel: E&V (5 inputs + contact), Immobiliare (instant + free agent valuation).
  - Owner portals: My Knight Frank, MySavills, Compass One. This is V2 for us and a strong differentiator.
- **Lead handling:** response speed. Leads contacted within 1 hour are about 7× more likely to qualify (HBR). Hence the response timer and dashboard alerts.

## Award-level craft references (motion + typography)
- [ERA Residence](https://www.era-residence.com/) (Awwwards SOTD Aug 2026): GSAP + Lenis, horizontal scroll, day/night toggle.
- [Belgrade Arbor](https://belgradearbor.rs/en) by Square43, Belgrade (HM Aug 2026): Next.js + GSAP + Three.js 3D unit explorer.
- [Sobha Privy Collection](https://sobha-privy-collection.com/) (SOTD Sep 2026): WebGL galleries.
- [Silver Pinewood](https://silver-pinewood.com/) (SOTD Oct 2025): "true luxury is quiet".
- [Luxury Places](https://www.luxury-places.ch/) (HM Jun 2026): agency site with map, favorites drawer, Lenis.
- [FIND Real Estate](https://findrealestate.com/) by Cuberto (HM Mar 2026): search-led, still award-level.
- [The Carlin Residence Club](http://carlinresidenceclub.com) (HM Jan 2026): photography-led storytelling.
- [ARETÈ Immobiliare](https://www.areteimmobiliare.com) (HM Jun 2026): loading sequence, custom cursor.
- Browse more: [Awwwards real-estate](https://www.awwwards.com/websites/real-estate/).
- **Lesson:** heavy motion on marketing pages; fast, clean, CWV-passing search and listing pages.

## Differentiators we build in
1. A "Verifikovana dokumentacija" badge with the date the ownership documents were checked.
2. Full price transparency: price history, €/m² against the area average, commission up front, total purchase-cost calculator (2.5% transfer tax / VAT, first-home exemption note).
3. A live map with no result cap, price pins, multi-area search.
4. Real viewing booking (time slots, in person or video) instead of "call us".
5. Floor plan, video and 360°/3D on premium listings; room-tagged galleries.
6. Native-quality EN/RU/DE for the diaspora and foreign buyers, with an EUR/RSD toggle.
7. Compliance as a trust signal: registry number, licensed agents, general terms, clean consent.
8. Award-level motion on marketing pages; fast, ad-free search.
9. V2: owner portal (views, leads, feedback), instant/Viber alerts, AI natural-language search, neighborhood price guides.

## SEO notes
- URL pattern: `/{locale}/{section}/{slug}`. Index curated filter combos only (city × type × transaction); canonicalize the rest.
- Sitemaps split by type and locale, ≤ 50k URLs each. Next's `generateSitemaps` doesn't produce an index, so add a custom index route if it's ever needed.
- hreflang `sr-Latn`/`en`/`ru`/`de` + `x-default`; self-referencing and reciprocal.
- JSON-LD `RealEstateListing` + `Offer` + `Accommodation` subtype and a sitewide `RealEstateAgent` (identifier = registry number). Google shows no special result for listings, but the markup helps discovery and AI answers.
- CWV targets: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1. Never lazy-load the hero; use `fetchPriority="high"`/`preload`.

## Stack facts verified (Sept 2026)
- **Versions:** next 16.3.6, gsap 3.15.0 (all plugins free), lenis 1.3.26, convex 1.46.0, next-intl 4.14.7, maplibre-gl 6.11.2, @vis.gl/react-maplibre 8.1.3, shadcn CLI 4.21, tailwindcss 4.3.3.
- **Convex Auth** v1 (0.0.95) is "beta"; the v2 alpha must not be used. The project's installed `convex-auth` skill documents headless key generation.
- **Convex text search:** 1 search field, ≤ 16 filter fields, equality filters only, 1,024-doc scan limit, no accent folding (so we normalize ourselves).
- **Convex storage:** unlimited size, but the upload POST times out at 2 minutes and HTTP actions are capped at 20 MB. The free plan has 1 GB egress/month, so use R2 for heavy 3D assets in production.
- **OpenFreeMap:** free, no key, commercial use OK, no SLA. Keep the OSM attribution.
