# Demo media for the Belgrade luxury real-estate demo

Curated and verified on 2026-09-27. All listings that use these files must stay flagged as demo content in the app.

Machine-readable copy: `demo-media.json` (same folder).

## How this was verified

- **Unsplash (90 photos).** Each photo's own page (`unsplash.com/photos/<slug>`) was fetched. The page's image ID, the photographer name it credits and its license line ("Free to use under the Unsplash License") were checked. For most photos the name came from the page's "Download this free HD photo ... by NAME (@username)" line. The rest were cross-checked against a second independent extraction. Every image URL returned HTTP 200 from `images.unsplash.com` with `?w=2000&q=80&auto=format&fit=crop`. imgix metadata confirmed width > height, so every photo is landscape. Every photo was also looked at to check for faces, legible logos and plates, and an obviously American look. No Unsplash+ (`plus.unsplash.com`) images are included.
- **Heads-up.** Photographer names on Unsplash *search* pages were often attached to the wrong photo. Every author below comes from the photo's own page.
- **Poly Haven.** File URLs come from `api.polyhaven.com/files/<id>`. The pixel size of each tonemapped JPG was read from its JPEG header: all are 8192x4096 equirectangular. `dl.polyhaven.org` sends `Access-Control-Allow-Origin: *`. License: CC0, per polyhaven.com/license and the asset pages.
- **Splats.** Spark's `examples/assets.json` and example sources were read. SuperSplat's public API gave the license and author, the scene pages carry `<link rel="license" href="https://creativecommons.org/licenses/by/4.0/">`, and every SOG file (meta.json and all WebP textures) returned 200 with `Access-Control-Allow-Origin: *`.

## A. Unsplash photos (Unsplash License: free commercial use, no attribution required)

Build the display URL as `url + "?w=2000&q=80&auto=format&fit=crop"`. A credit line is appreciated but not required: *Photo by {author} on Unsplash*. The Unsplash License does not allow selling unaltered copies or compiling the photos into a competing stock service. For production, prefer self-hosting or the official Unsplash API, which has its own hotlink and download-tracking rules.

| Category | Count |
|---|---|
| Living rooms | 16 |
| Kitchens | 10 |
| Bedrooms | 10 |
| Bathrooms | 8 |
| Dining | 4 |
| Home office / study | 4 |
| Terraces, balconies & views | 8 |
| Residential building exteriors (European apartment buildings) | 10 |
| Villas / houses (exteriors) | 6 |
| Belgrade cityscape & landmarks | 10 |
| Novi Sad | 4 |
| **Total** | **90** |

### Living rooms (16)

| # | Alt text | Photographer | Location tag on page | Original px | Page | Image URL |
|---|---|---|---|---|---|---|
| 1 | Sunlit open-plan living room with grey sofa, leather ottomans and floor-to-ceiling garden windows | Spacejoy | Leesburg, VA, USA | 6144x3240 | [page](https://unsplash.com/photos/white-and-brown-living-room-set-9M66C_w_ToM) | `https://images.unsplash.com/photo-1618221195710-dd6b41faaea6` |
| 2 | Minimalist living room with camel sectional sofa, arched doorway and black round coffee table | Le Quan | - | 4000x3000 | [page](https://unsplash.com/photos/a-living-room-with-a-couch-and-a-table-fPVWpK85oLk) | `https://images.unsplash.com/photo-1699239116624-85268dce7377` |
| 3 | Bright white open-plan living room and kitchen with modular sofa and a large window onto a lakeside view | Lumbardh Plluzhina | - | 4292x2414 | [page](https://unsplash.com/photos/a-modern-living-room-with-a-large-window-7NvBEeHDY7M) | `https://images.unsplash.com/photo-1682184805271-11671b7ecf4c` |
| 4 | Contemporary living room with marble media wall, wood-panelled accent wall and wide garden windows (3D render) | Aalo Lens | - (page says: computer-generated rendering) | 3000x2000 | [page](https://unsplash.com/photos/modern-living-room-with-large-windows-and-comfortable-seating-LqGf5UvHCZ8) | `https://images.unsplash.com/photo-1757924461488-ef9ad0670978` |
| 5 | Modern living room with curved white sofa, sculptural coffee tables and wood-panelled walls | Le Quan | - | 5500x3500 | [page](https://unsplash.com/photos/a-living-room-filled-with-furniture-and-a-large-window-9if4MIUhYl8) | `https://images.unsplash.com/photo-1697947656193-a87d460b5fb5` |
| 6 | Calm living room with grey modular sofa, dark shelving and floor-to-ceiling glazing | Prydumano Design | - | 4000x2500 | [page](https://unsplash.com/photos/a-modern-living-room-with-a-large-window-vIbxvHj9m9g) | `https://images.unsplash.com/photo-1724582586529-62622e50c0b3` |
| 7 | Light living room with beige sectional sofa, globe pendant lights and oak floor | Pipcke | - | 6616x3676 | [page](https://unsplash.com/photos/a-living-room-with-a-couch-and-a-table-g_5UyVBIX_k) | `https://images.unsplash.com/photo-1705321963943-de94bb3f0dd3` |
| 8 | Airy minimalist living area with tufted grey sofa, polished concrete floor and dining nook | dada design | - | 3840x2160 | [page](https://unsplash.com/photos/a-living-room-with-a-couch-and-a-table-9KGB4HspwsM) | `https://images.unsplash.com/photo-1653972233229-1b8c042d6d8e` |
| 9 | Warmly lit open-plan living room and kitchen at night with city lights through tall windows | Christian | - | 6000x3376 | [page](https://unsplash.com/photos/a-living-room-filled-with-furniture-and-a-kitchen-DS9Xc7AWmwQ) | `https://images.unsplash.com/photo-1680416124510-5eae1beca412` |
| 10 | Olive-green sectional sofa in a modern apartment living room with large windows | Prydumano Design | Europe | 4000x2500 | [page](https://unsplash.com/photos/a-living-room-with-a-large-green-couch-VZ2z8ozzy10) | `https://images.unsplash.com/photo-1738168246881-40f35f8aba0a` |
| 11 | Elegant living room with crystal chandelier, curved white sofa and gold-accented shelving | Aalo Lens | - | 3000x1688 | [page](https://unsplash.com/photos/modern-living-room-with-elegant-furniture-and-decor--QCjahEjubY) | `https://images.unsplash.com/photo-1758448755952-42b404bc6f39` |
| 12 | Apartment living room with beige sofa, parquet floor and dining area by tall windows | MD SHAFAAT HOSSAIN | - | 4680x3120 | [page](https://unsplash.com/photos/a-living-room-filled-with-furniture-and-a-large-window-9kPH5hA-d7U) | `https://images.unsplash.com/photo-1713832139688-79676097edde` |
| 13 | Double-height luxury living room with glass staircase, sculptural chandelier and panoramic windows | Aalo Lens | - | 5000x2812 | [page](https://unsplash.com/photos/luxurious-modern-living-room-with-large-windows-and-staircase-Ez7fz5mavj0) | `https://images.unsplash.com/photo-1776362355123-ca966d36e29c` |
| 14 | Art-filled apartment living room with concrete ceiling and floor-to-ceiling city-view windows | Lotus Design N Print | - | 6960x4640 | [page](https://unsplash.com/photos/a-living-room-filled-with-furniture-and-a-flat-screen-tv-4-7s995Kv1U) | `https://images.unsplash.com/photo-1638454795595-0a0abf68614d` |
| 15 | Modern living room with cream sectional sofa, marble TV wall and full-height window | Aalo Lens | - | 3001x2000 | [page](https://unsplash.com/photos/modern-living-room-with-sectional-sofa-and-large-window-yxO8YG082v8) | `https://images.unsplash.com/photo-1758448511322-8bfc73daf606` |
| 16 | Corner living room with tan leather sofa under a wood ceiling and wraparound windows onto greenery | Collov Home Design | - | 4000x3000 | [page](https://unsplash.com/photos/living-room-with-brown-sofa-and-glass-window-4_jQL4JCS98) | `https://images.unsplash.com/photo-1600210492493-0946911123ea` |

### Kitchens (10)

| # | Alt text | Photographer | Location tag on page | Original px | Page | Image URL |
|---|---|---|---|---|---|---|
| 17 | Dark modern kitchen with fluted cabinetry, wood-topped island, green velvet bar stools and a wavy LED pendant | Kam Idris | - | 3400x3000 | [page](https://unsplash.com/photos/a-modern-kitchen-with-a-bar-and-stools-vqMQN9zImG4) | `https://images.unsplash.com/photo-1632583824020-937ae9564495` |
| 18 | Charcoal handleless kitchen with marble backsplash, dining table, blush velvet chairs and globe chandelier | Kam Idris | Germany | 3461x2815 | [page](https://unsplash.com/photos/a-kitchen-with-a-table-and-chairs-3-GXEUE_sCc) | `https://images.unsplash.com/photo-1656402887556-e727ffe1f6d7` |
| 19 | White handleless kitchen with marble backsplash, induction hob and stainless extractor hood | Zac Gudakov | Seattle, WA, USA | 6240x4160 | [page](https://unsplash.com/photos/white-and-black-wooden-kitchen-cabinet-JG5cNEhSwvg) | `https://images.unsplash.com/photo-1628745277866-0c4468030a81` |
| 20 | Modern white-and-black kitchen with marble island, built-in ovens and leather bar stools | Steven Ungermann | South Brisbane QLD, Australia | 6027x4021 | [page](https://unsplash.com/photos/brown-wooden-table-with-chairs-fZ1vlupgdSY) | `https://images.unsplash.com/photo-1614597445336-8a67e9314d91` |
| 21 | Contemporary grey kitchen with built-in ovens, marble island and induction cooktop | Lotus Design N Print | - | 6000x4000 | [page](https://unsplash.com/photos/a-modern-kitchen-with-stainless-steel-appliances-and-marble-counter-tops-j6QSUeiW6vo) | `https://images.unsplash.com/photo-1639405069836-f82aa6dcb900` |
| 22 | Modern kitchen with glossy grey cabinets, white island and three pendant lights | Lotus Design N Print | - | 6960x4640 | [page](https://unsplash.com/photos/modern-kitchen-with-grey-cabinets-RwXneIyqxAw) | `https://images.unsplash.com/photo-1602028915047-37269d1a73f7` |
| 23 | White kitchen with marble island styled with lemons, herbs and cookware | Jason Briscoe | - | 5930x3554 | [page](https://unsplash.com/photos/modern-white-kitchen-with-marble-island-GliaHAJ3_5A) | `https://images.unsplash.com/photo-1556911220-bff31c812dba` |
| 24 | Wood and grey kitchen with concrete-look island, open wine shelving and track lights | Lotus Design N Print | - | 6960x4640 | [page](https://unsplash.com/photos/white-wooden-kitchen-cabinet-with-stainless-steel-faucet-ik9WP2V8Vas) | `https://images.unsplash.com/photo-1600122272511-c85c3a0209f9` |
| 25 | Open-plan kitchen with white waterfall island, bar stools and stainless fridge beside the living area | Gerda Kauks | Scottsdale, AZ, USA | 5965x3977 | [page](https://unsplash.com/photos/a-kitchen-with-a-refrigerator-freezer-sitting-next-to-a-counter-KYM5QsbRsxk) | `https://images.unsplash.com/photo-1715985160053-d339e8b6eb94` |
| 26 | Black glossy kitchen island with induction hob and stainless hood looking into a bright living space | Frames For Your Heart | Villamartín, Spain | 5051x3367 | [page](https://unsplash.com/photos/round-white-wooden-table-near-kitchen-island-MyeOnGcibCQ) | `https://images.unsplash.com/photo-1512914890251-2f96a9b0bbe2` |

### Bedrooms (10)

| # | Alt text | Photographer | Location tag on page | Original px | Page | Image URL |
|---|---|---|---|---|---|---|
| 27 | Modern bedroom with wood-panelled headboard wall, charcoal bedding and a lounge chair | Le Quan | - | 3840x2160 | [page](https://unsplash.com/photos/a-bedroom-with-a-bed-and-a-chair-ErDrzSvSNv4) | `https://images.unsplash.com/photo-1696762932825-2737db830bbe` |
| 28 | Warm modern bedroom with walnut wardrobe, lit display niches and upholstered bed | POOJAN THANEKAR | - | 3840x2160 | [page](https://unsplash.com/photos/modern-bedroom-with-wooden-accents-and-soft-lighting-u-RIsXlI8Q8) | `https://images.unsplash.com/photo-1757344454333-cc666252e596` |
| 29 | Soft neutral bedroom with upholstered bed, oval floor mirror and boucle armchair | dada design | - | 3840x2160 | [page](https://unsplash.com/photos/a-large-bed-sitting-in-a-bedroom-next-to-a-chair-YmtlGsmTcgk) | `https://images.unsplash.com/photo-1654064550858-c62b971a378a` |
| 30 | Light bedroom with oak wall panelling, upholstered bed and sheer-curtained window | dada design | - | 3840x2160 | [page](https://unsplash.com/photos/a-bedroom-with-a-large-bed-and-a-large-window-k6CwSTSuOaw) | `https://images.unsplash.com/photo-1653974123568-b5eff6d851e1` |
| 31 | Dark luxurious bedroom with black panelled walls, grey upholstered bed and ring wall light | Ali Moradi | Tehran Province, Iran | 3500x2600 | [page](https://unsplash.com/photos/a-bedroom-with-a-large-bed-and-a-chair-vz9IbCAXHKQ) | `https://images.unsplash.com/photo-1644057501622-dfa7dd26dbfb` |
| 32 | Minimal hotel-style bedroom with grey bed, bench and glass-walled walk-in wardrobe | 刘 强 | - | 5000x2500 | [page](https://unsplash.com/photos/gray-bed-in-bedroom-R5v8Xtc0ecg) | `https://images.unsplash.com/photo-1562438668-bcf0ca6578f0` |
| 33 | Bedroom with floor-to-ceiling windows, lounge chair and golden sunset light | Chet Yeary II | Dallas, TX, USA | 4096x2730 | [page](https://unsplash.com/photos/white-bed-near-glass-window-zrJ7GEmUknc) | `https://images.unsplash.com/photo-1630427999287-692ff825c9d1` |
| 34 | Bright bedroom with charcoal tufted headboard, white bedding and LED wall light | Lotus Design N Print | - | 6000x4000 | [page](https://unsplash.com/photos/white-bed-linen-on-bed-7jlVQPX8PLE) | `https://images.unsplash.com/photo-1595526051245-4506e0005bd0` |
| 35 | Bedroom with a sculptural wooden headboard wall, white bedding and a desk by the window | Antonio Araujo | - | 5451x3634 | [page](https://unsplash.com/photos/a-bedroom-with-a-white-bed-and-a-wooden-headboard-WWYF8Lts8Ho) | `https://images.unsplash.com/photo-1731336478850-6bce7235e320` |
| 36 | Moody modern bedroom with textured grey walls, circular wall art and blush upholstered bench (3D render) | Le Quan | - | 5400x4500 | [page](https://unsplash.com/photos/a-bedroom-with-a-large-bed-and-a-chair-anLoz4xfC8c) | `https://images.unsplash.com/photo-1699800900071-ae073285ca02` |

### Bathrooms (8)

| # | Alt text | Photographer | Location tag on page | Original px | Page | Image URL |
|---|---|---|---|---|---|---|
| 37 | White bathroom with freestanding tub, vessel basin and potted palm | Steven Ungermann | Brisbane QLD, Australia | 6016x4016 | [page](https://unsplash.com/photos/white-ceramic-bathtub-near-green-potted-plant-Aac7IlKnYX8) | `https://images.unsplash.com/photo-1620626011761-996317b8d101` |
| 38 | Spa-like bathroom with freestanding stone tub, textured wall and palm on a pebble bed | Jared Rice | - | 6547x4365 | [page](https://unsplash.com/photos/white-ceramic-bathtub-PibraWHb4h8) | `https://images.unsplash.com/photo-1507652313519-d4e9174996dd` |
| 39 | Bright bathroom with freestanding tub, walnut wall panel, walk-in shower and large window | Murad Kerimli | Baku, Azerbaijan | 8334x7083 | [page](https://unsplash.com/photos/a-bathroom-with-a-tub-sink-and-large-window-N03PjHWOEFA) | `https://images.unsplash.com/photo-1733426107854-ee00a25d72a7` |
| 40 | Marble bathroom with freestanding tub, frameless glass shower and floating walnut vanity | Lotus Design N Print | - | 6000x4000 | [page](https://unsplash.com/photos/a-bathroom-with-a-large-white-bathtub-next-to-a-walk-in-shower-Dk_o7KQyGkI) | `https://images.unsplash.com/photo-1638799869566-b17fa794c4de` |
| 41 | Dark modern bathroom with glass walk-in shower, stone vanity and backlit mirror | Mohammad Najjar | - | 4981x3277 | [page](https://unsplash.com/photos/a-bathroom-with-a-glass-shower-yH1k2Qp86Tk) | `https://images.unsplash.com/photo-1651951646668-46562cfb4518` |
| 42 | Concrete-look bathroom with bathtub, black-framed shower screen and wall-hung toilet | Alex Tyson | - | 6000x4000 | [page](https://unsplash.com/photos/a-bathroom-with-a-large-bathtub-next-to-a-toilet-BfVqm3io8uE) | `https://images.unsplash.com/photo-1721825157088-1cf9e64ddba5` |
| 43 | Modern bathroom with oak slat wall, built-in bathtub and floating white vanity | Backbone | - | 5000x3750 | [page](https://unsplash.com/photos/a-bathroom-with-a-toilet-sink-and-bathtub-L4iRkKL5dng) | `https://images.unsplash.com/photo-1631889993959-41b4e9c6e3c5` |
| 44 | Luxury bathroom with veined stone shower wall, lit niches and backlit mirror | POOJAN THANEKAR | - | 3840x2880 | [page](https://unsplash.com/photos/modern-bathroom-design-with-elegant-lighting-lXHnEe5AGVo) | `https://images.unsplash.com/photo-1742134131017-44d377a611b1` |

### Dining (4)

| # | Alt text | Photographer | Location tag on page | Original px | Page | Image URL |
|---|---|---|---|---|---|---|
| 45 | Bright dining room with black oval table, wishbone chairs and tall forest-view windows | Clay Banks | Livingston Manor, NY, USA | 3200x2133 | [page](https://unsplash.com/photos/a-dining-room-with-a-table-and-chairs-aYjdg6wZrOU) | `https://images.unsplash.com/photo-1723750290151-164cb19ebab7` |
| 46 | Scandinavian-style dining area with walnut table, mid-century chairs and open kitchen | Clay Banks | Roxbury, NY, USA | 3400x2267 | [page](https://unsplash.com/photos/modern-dining-room-with-table-chairs-and-kitchen-urH155LONWs) | `https://images.unsplash.com/photo-1745794621090-d856c53b0cc2` |
| 47 | Long dining table with grey upholstered chairs beside sheer curtains and a pool terrace | Rebecca Chandler | - | 6170x3085 | [page](https://unsplash.com/photos/a-dining-room-table-with-chairs-around-it-fE3kcMhB1oc) | `https://images.unsplash.com/photo-1658280024253-34cafdfbb002` |
| 48 | Round marble dining table with grey chairs, globe pendant and a balcony city view | Infinite Views | - | 4240x2832 | [page](https://unsplash.com/photos/white-round-table-with-chairs-SByfd_e-s2c) | `https://images.unsplash.com/photo-1629236714868-9e43db5bd7c3` |

### Home office / study (4)

| # | Alt text | Photographer | Location tag on page | Original px | Page | Image URL |
|---|---|---|---|---|---|---|
| 49 | Study with walnut desk, teal velvet armchairs and marble coffee table | Gian Paolo Aliatis | London, UK | 4888x3258 | [page](https://unsplash.com/photos/black-and-brown-wooden-table-near-blue-padded-chair-EJSNrTzz6xk) | `https://images.unsplash.com/photo-1595846723416-99a641e1231a` |
| 50 | Sunny study with a long desk beneath a row of windows and built-in bookshelves | Clay Banks | Forestburgh, NY, USA | 3386x2257 | [page](https://unsplash.com/photos/bright-room-with-bookshelves-and-two-desks-by-windows-Mb-lGau6K5U) | `https://images.unsplash.com/photo-1777896193454-8b4863264f0b` |
| 51 | Library lounge with floor-to-ceiling bookcase, two cream sofas and table lamps | Lina Bob | - | 5472x3648 | [page](https://unsplash.com/photos/elegant-library-room-featuring-a-large-bookshelf-and-two-sofas-Xfa7Pte_7YU) | `https://images.unsplash.com/photo-1782248765552-e80331b41abe` |
| 52 | Modern home office with sit-stand desk, dual monitors, leather lounge chair and console table | Lotus Design N Print | - | 6000x4000 | [page](https://unsplash.com/photos/a-home-office-with-a-desk-chair-and-computer-1T3Ng46czSw) | `https://images.unsplash.com/photo-1641998148499-cb6b55a3c0d3` |

### Terraces, balconies & views (8)

| # | Alt text | Photographer | Location tag on page | Original px | Page | Image URL |
|---|---|---|---|---|---|---|
| 53 | Balcony with wicker armchairs and planters overlooking rooftops and a lake | Francesca Tosolini | - | 5472x3648 | [page](https://unsplash.com/photos/two-brown-wicker-armchairs-D7a8yW1MxQM) | `https://images.unsplash.com/photo-1560448205-d82bf18b9bcf` |
| 54 | Open French window with wrought-iron balcony overlooking a sea bay and pines (Portofino) | Bjorn Agerbeek | Portofino, Metropolitan City of Genoa, Italy | 6336x4752 | [page](https://unsplash.com/photos/an-open-window-with-a-view-of-a-body-of-water-uH8GHfmgS3Y) | `https://images.unsplash.com/photo-1696854649609-1fd6e5abf87f` |
| 55 | Cosy lit balcony with fringed parasol above a lake at dusk | Karl Hedin | - | 7598x4749 | [page](https://unsplash.com/photos/a-building-with-a-body-of-water-in-the-background-aOjx_n__SKs) | `https://images.unsplash.com/photo-1658048806266-f793f1f8c7c6` |
| 56 | Modern balcony with hanging egg chair, lounge seating and city skyline at sunset (3D render) | Aalo Lens | - | 5000x2812 | [page](https://unsplash.com/photos/modern-balcony-with-city-view-and-hanging-chair-iqGUN6GIl78) | `https://images.unsplash.com/photo-1776363116182-51694a04a1d5` |
| 57 | Rooftop terrace with bench overlooking the city and a building with a planted roof | Omar Hakeem | - | 5472x3648 | [page](https://unsplash.com/photos/a-rooftop-terrace-overlooking-a-building-with-a-green-roof-wuhwDJauICs) | `https://images.unsplash.com/photo-1785486249823-02fbb298c918` |
| 58 | Landscaped rooftop garden with planters, paved path and wooden pergola (Vienna) | HANS-Y | Kelsenstraße, Wien, Österreich | 6000x4000 | [page](https://unsplash.com/photos/a-modern-rooftop-garden-with-planters-path-and-wooden-pergola-IFKgs02kdQ0) | `https://images.unsplash.com/photo-1784878281083-58f3f8e6d5ab` |
| 59 | Wrought-iron balcony table and chairs overlooking a Mediterranean harbour | Romina Denti | Provenza-Alpi-Costa Azzurra, Francia | 10791x5473 | [page](https://unsplash.com/photos/a-table-and-chairs-on-a-balcony-overlooking-the-ocean-CU96aTBRQIg) | `https://images.unsplash.com/photo-1714919286244-6f3f6cce6e65` |
| 60 | Penthouse roof terrace with concrete frame, lounge furniture and a tree at dusk (3D render) | Aalo Lens | - | 6000x3375 | [page](https://unsplash.com/photos/modern-rooftop-patio-with-seating-and-a-tree-k1hCHacaUu0) | `https://images.unsplash.com/photo-1776363284806-873eeef565a7` |

### Residential building exteriors (European apartment buildings) (10)

| # | Alt text | Photographer | Location tag on page | Original px | Page | Image URL |
|---|---|---|---|---|---|---|
| 61 | Contemporary black-and-white apartment building with glazed corner balconies | Luke van Zyl | - | 6000x4000 | [page](https://unsplash.com/photos/black-and-white-cocnrete-building-low-angle-photography-koH7IVuwRLw) | `https://images.unsplash.com/photo-1515263487990-61b07816b324` |
| 62 | Modern apartment tower with glass balconies against a pink evening sky | Tobias Wilden | - | 6956x4642 | [page](https://unsplash.com/photos/apartment-building-reflecting-pink-sky-4453DIQWtsQ) | `https://images.unsplash.com/photo-1624204386084-dd8c05e32226` |
| 63 | White residential building with stacked balconies, Berlin-Mitte | Burak Arslan | Mitte, Berlin, Germany | 6006x4056 | [page](https://unsplash.com/photos/a-building-with-a-blue-sky-myCgLguuFzo) | `https://images.unsplash.com/photo-1664813953897-ada06817c48c` |
| 64 | Curved limestone apartment building with balconies, Berlin-Mitte | Burak Arslan | Mitte, Berlin, Germany | 5931x4061 | [page](https://unsplash.com/photos/a-building-with-balconies-and-windows-uUzBpVxuxf0) | `https://images.unsplash.com/photo-1664813954641-1ffcb7b55fd1` |
| 65 | Dark brick apartment block with recessed balconies, London | Seb Doe | Farringdon, London, UK | 5184x3888 | [page](https://unsplash.com/photos/a-tall-brick-building-with-balconies-and-balconies-JIOlbLYmWlk) | `https://images.unsplash.com/photo-1676680071181-0a0b45968d23` |
| 66 | Black-and-white detail of a modern building with curved glass balconies | Heng Chiu | - | 10667x6000 | [page](https://unsplash.com/photos/black-and-white-modern-building-with-curved-glass-balconies-tA1O2mGZVKs) | `https://images.unsplash.com/photo-1785606144879-6bc2e980e5a1` |
| 67 | Haussmann-style Parisian apartment buildings with wrought-iron balconies | Wyatt Simpson | Paris, France | 6000x4000 | [page](https://unsplash.com/photos/beautiful-parisian-apartment-buildings-under-a-cloudy-sky-JcbUM1vhf1w) | `https://images.unsplash.com/photo-1752887634231-5b3c6cb0d404` |
| 68 | Modern facade with glass balconies beside a weathered concrete wall | Richard Williams | - | 4421x3315 | [page](https://unsplash.com/photos/modern-building-facade-with-concrete-wall-cjRJpduMgWU) | `https://images.unsplash.com/photo-1787059501730-b3ec5ada19f6` |
| 69 | Terraced modern residential complex with stone cladding and lawns | Tomasz Dzioch | - | 4133x2755 | [page](https://unsplash.com/photos/gray-concrete-building-near-green-grass-field-during-daytime-48Umuknbw08) | `https://images.unsplash.com/photo-1624524799657-465e72edbcda` |
| 70 | Minimal white residential building corner with roof-terrace railing, Berlin | Burak Arslan | Mitte, Berlin, Germany | 6023x3697 | [page](https://unsplash.com/photos/a-white-building-with-a-railing-TgEoxRAVqwg) | `https://images.unsplash.com/photo-1664813953289-7c3350f040e0` |

### Villas / houses (exteriors) (6)

| # | Alt text | Photographer | Location tag on page | Original px | Page | Image URL |
|---|---|---|---|---|---|---|
| 71 | Modern white villa with swimming pool, lounge terrace and floor-to-ceiling glazing | John Fornander | - | 7781x5190 | [page](https://unsplash.com/photos/modern-white-villa-with-swimming-pool-Id7u0EkTjBE) | `https://images.unsplash.com/photo-1613977257363-707ba9348227` |
| 72 | Contemporary white villa with timber soffit and long pool | Avi Werde | - | 5969x3979 | [page](https://unsplash.com/photos/white-and-brown-concrete-building-hHz4yrvxwlA) | `https://images.unsplash.com/photo-1613490493576-7fde63acd811` |
| 73 | Modern two-storey house with glowing glazing and timber-lined upper level at dusk | Arthur BAUDRY | - | 6912x5376 | [page](https://unsplash.com/photos/modern-house-exterior-glows-with-lights-4vioYQ9Nn9Y) | `https://images.unsplash.com/photo-1748063578185-3d68121b11ff` |
| 74 | White modern villa with roof terrace and swimming pool, Villamartin, Spain | Frames For Your Heart | Villamartín, Spain | 4712x3126 | [page](https://unsplash.com/photos/white-concrete-building-under-blue-sky-during-daytime-mR1CIDduGLc) | `https://images.unsplash.com/photo-1600596542815-ffad4c1539a9` |
| 75 | Glass-walled modern house with flat roof overhang beside a swimming pool | Florian Schmidinger | - | 3729x2486 | [page](https://unsplash.com/photos/modern-house-with-pool-and-patio-b_79nOqf95I) | `https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf` |
| 76 | Modern house with timber and stone facade, large windows and lawn | Alef Morais | - | 6000x3375 | [page](https://unsplash.com/photos/modern-house-with-large-windows-and-a-green-lawn-d2hYqpR0YS0) | `https://images.unsplash.com/photo-1766603636700-e9d80473f40f` |

### Belgrade cityscape & landmarks (10)

| # | Alt text | Photographer | Location tag on page | Original px | Page | Image URL |
|---|---|---|---|---|---|---|
| 77 | Pobednik (Victor) monument at Kalemegdan above the Sava-Danube confluence, Belgrade | Dimitrije Milenkovic | Kalemegdan, Belgrade, Serbia | 4000x2250 | [page](https://unsplash.com/photos/a-statue-of-a-man-standing-on-top-of-a-tower-Wa9gkmHOTf8) | `https://images.unsplash.com/photo-1632343084107-353ad9e95e37` |
| 78 | Aerial view of Belgrade Fortress walls and Kalemegdan park | Dimitrije Milenkovic | Kalemegdan, Belgrade, Serbia | 4000x2250 | [page](https://unsplash.com/photos/an-aerial-view-of-a-city-with-a-castle-XP1ozWBIPb8) | `https://images.unsplash.com/photo-1632343084054-5b108ffb8be3` |
| 79 | Stone gate towers and wooden bridge at Belgrade Fortress (Kalemegdan) | Evgeny Smirnov | Belgrade, Serbia | 4032x3024 | [page](https://unsplash.com/photos/gray-stone-castle-J68ApjRXz1U) | `https://images.unsplash.com/photo-1568234942177-2b37de78f6da` |
| 80 | Sava riverfront with moored boats below Belgrade's old town and cathedral spire | Maria Ivanova | Belgrade, Serbia | 5523x3107 | [page](https://unsplash.com/photos/a-harbor-with-boats-and-a-city-in-the-background-TbhkJftacjc) | `https://images.unsplash.com/photo-1727105538592-3074729d8abc` |
| 81 | Aerial view of the Ada Bridge pylon over the Sava river, Belgrade | Anton Lukin | Belgrade, Serbia | 4032x3024 | [page](https://unsplash.com/photos/an-aerial-view-of-a-bridge-over-a-river-PASnLl9Jmbw) | `https://images.unsplash.com/photo-1706480228561-6e6ba0b5a44b` |
| 82 | Belgrade Waterfront towers and an arched bridge reflected in the Sava at night | Nikola Tasic | Belgrade, Serbia | 6184x4123 | [page](https://unsplash.com/photos/a-city-at-night-with-a-bridge-over-water-CJrsTBcWcWM) | `https://images.unsplash.com/photo-1711970908551-6bb1f39377b5` |
| 83 | Sava river with Belgrade Waterfront residential towers and Belgrade Tower, Savski Venac | Anton Lukin | Savski Venac, Belgrade, Serbia | 4032x3024 | [page](https://unsplash.com/photos/a-river-running-through-a-city-next-to-tall-buildings-3KP0-psxaYY) | `https://images.unsplash.com/photo-1708253832369-ce7e621df31a` |
| 84 | Aerial view of the red-tiled rooftops of Zemun above the Danube, Belgrade | Nikola Cirkovic | Zemun, Belgrade, Serbia | 6000x4000 | [page](https://unsplash.com/photos/aerial-view-of-city-buildings-during-daytime-t0sXKOz9qtk) | `https://images.unsplash.com/photo-1608816747977-4d303f476571` |
| 85 | Temple of Saint Sava dome above snowy rooftops, Belgrade | Lazar Krstić | Hram Svetog Save, Beograd, Srbija (page text) | 3413x1920 | [page](https://unsplash.com/photos/a-large-white-building-with-a-green-dome-X4ld3qM0PcM) | `https://images.unsplash.com/photo-1643285677419-986d88603216` |
| 86 | Ornate historic facades and a street lamp in central Belgrade | Mirko Božić | Belgrade, Serbia | 6240x4160 | [page](https://unsplash.com/photos/a-group-of-buildings-v-0OAOiULfk) | `https://images.unsplash.com/photo-1655245934655-bde35a9dae80` |

### Novi Sad (4)

| # | Alt text | Photographer | Location tag on page | Original px | Page | Image URL |
|---|---|---|---|---|---|---|
| 87 | Petrovaradin Fortress above the Danube, Novi Sad | Stefan Kostić | Novi Sad, Serbia | 6000x4000 | [page](https://unsplash.com/photos/brown-concrete-building-near-body-of-water-during-daytime-1V5YCyhC4W0) | `https://images.unsplash.com/photo-1630137294649-ab67a2c9891c` |
| 88 | Sunset over Novi Sad old-town rooftops and the Name of Mary Church spire | Nikola Johnny Mirkovic | Novi Sad, Serbia | 5540x4000 | [page](https://unsplash.com/photos/the-sun-is-setting-over-a-city-with-tall-buildings-2iZuC-LK7EQ) | `https://images.unsplash.com/photo-1635183529733-df2fc30650be` |
| 89 | Arched Danube bridge at sunset with wildflowers in the foreground, Novi Sad | Nemanja Ćirić | Novi Sad, Novi Sad, Serbia | 4032x3024 | [page](https://unsplash.com/photos/the-sun-is-setting-over-a-river-with-purple-flowers-in-the-foreground-Wocu01-O6Fw) | `https://images.unsplash.com/photo-1652987044170-523d5858e559` |
| 90 | Danube bridge and the Novi Sad skyline under a dramatic dusk sky | Nikola Rakic | Novi Sad, Serbia | 3897x2611 | [page](https://unsplash.com/photos/bridge-over-river-during-sunset-k7vQnFkVz4o) | `https://images.unsplash.com/photo-1579981596048-b9ba73dc0091` |

**Notes on the selection**

- Interiors were picked for a modern European look. Some carry non-European location tags (US, Australia, Iran, Azerbaijan), but nothing identifies them as such.
- Several interiors are 3D renders: Aalo Lens, Le Quan, Pipcke, dada design, Prydumano Design, Lotus Design N Print and others. That is normal in real-estate marketing. Alt texts say "(3D render)" where the page states it or where it is obvious.
- Building exteriors: 5 are location-tagged in Europe (Berlin x3, London, Paris). The other 5 are untagged but look European-generic.
- Belgrade: all 10 are identified as Belgrade on their pages, tagged Belgrade, Kalemegdan, Savski Venac or Zemun. For the Temple of Saint Sava it is the page text: "Hram Svetog Save, Beograd". There is no clean Dorćol street shot, because every street candidate had pedestrians, faces or readable number plates. `v-0OAOiULfk` (historic facades, central Belgrade) is the old-town street stand-in.
- Small appliance nameplates (for example on ovens) can be legible at full resolution in a few kitchen shots. No prominent brand logos remain.

### Verified alternates (not in the JSON)

| Category | Alt text | Photographer | Location tag | Page | Image URL |
|---|---|---|---|---|---|
| belgrade | Red-tiled rooftops and a church bell tower above the Danube, Belgrade | Jiamin Huang | Belgrade, Serbia | [page](https://unsplash.com/photos/a-group-of-buildings-with-trees-and-a-body-of-water-in-the-background-CL6seutcPWM) | `https://images.unsplash.com/photo-1655574283016-d456bad79aad` |
| belgrade | Green-arched Old Sava Bridge with Belgrade Waterfront towers behind | Ljubiša Mitrović | - | [page](https://unsplash.com/photos/a-river-filled-with-lots-of-boats-next-to-a-tall-building-RcsNWHagAq8) | `https://images.unsplash.com/photo-1689857520119-c3ed5a624c1c` |
| belgrade | Sava river and Belgrade Waterfront seen from Kalemegdan on a sunny day | Dimitrije Milenkovic | Beograd na vodi, Belgrade, Serbia | [page](https://unsplash.com/photos/a-body-of-water-with-boats-in-it-and-a-city-in-the-background-2UcX4SY7xTg) | `https://images.unsplash.com/photo-1659702958006-3d7b6854ce10` |
| belgrade | Old Sava Bridge and the Belgrade skyline at golden hour | Anton Lukin | Staro Sajmište, Belgrade, Serbia | [page](https://unsplash.com/photos/a-bridge-over-a-body-of-water-with-a-city-in-the-background-UlteGvwtit4) | `https://images.unsplash.com/photo-1708253813887-f18daca63c90` |
| belgrade | Aerial view of Kalemegdan park and fortress beside the river under dramatic clouds | Dimitrije Milenkovic | Kalemegdan, Belgrade, Serbia | [page](https://unsplash.com/photos/a-park-with-a-body-of-water-in-the-background-gKSrIXXxWzU) | `https://images.unsplash.com/photo-1659702849917-87134326294c` |
| novisad | Novi Sad City Hall illuminated at night (small pedestrian silhouettes) | Vuksan Bulatovic | Novi Sad, Serbia | [page](https://unsplash.com/photos/a-building-with-a-clock-tower-lit-up-at-night-ngH3XfH8Z9k) | `https://images.unsplash.com/photo-1703806914338-a18ed6066f74` |
| bedroom | Neutral bedroom with arched wooden headboard niche (3D render; ceiling fan visible) | Spl Interiors | New Delhi, Delhi, India | [page](https://unsplash.com/photos/a-modern-bedroom-with-a-stylish-neutral-aesthetic-0tVimluL_ls) | `https://images.unsplash.com/photo-1750420556288-d0e32a6f517b` |
| building | Black-and-white modern apartment facade against clouds (Wellington, NZ) | Nate Watson | Rugby Street, Wellington, New Zealand | [page](https://unsplash.com/photos/black-and-white-building-during-daytime-Ib_nblJ2Jis) | `https://images.unsplash.com/photo-1516501312919-d0cb0b7b60b8` |
| building | Modern red-clad apartment block with glass balconies (Saint-Ouen, Paris) | Mika Baumeister | Rue des Batelieres in Saint Quen, Paris, France | [page](https://unsplash.com/photos/white-and-brown-concrete-building-PshCtT16gJo) | `https://images.unsplash.com/photo-1565363887735-c63cb07cf57e` |
| office | Home study with walnut desk, coral armchair and cube shelving (3D render; laptop screen visible) | Collov Home Design | - | [page](https://unsplash.com/photos/brown-and-white-wooden-cabinet-V0FAELuM3nQ) | `https://images.unsplash.com/photo-1613685303404-19f881533316` |
| office | Sunny desk by tall windows with plants and a desk lamp | Annie Spratt | - | [page](https://unsplash.com/photos/a-room-filled-with-furniture-and-vase-of-flowers-on-a-table-gdi9fJboJQU) | `https://images.unsplash.com/photo-1651739084015-85af0539f960` |
| bedroom | Grey luxury bedroom with glass-fronted wardrobe and tray ceiling (3D render) | Ali Moradi | United States | [page](https://unsplash.com/photos/a-bedroom-with-a-large-bed-Z043ywooiNY) | `https://images.unsplash.com/photo-1651132205872-091b35e72b15` |
| bedroom | Modern bedroom with desk corner, art prints and floor-to-ceiling window | Lotus Design N Print | - | [page](https://unsplash.com/photos/a-bedroom-with-a-bed-desk-and-a-window-WDUtNbot6Qw) | `https://images.unsplash.com/photo-1638454668466-e8dbd5462f20` |
| novisad | Petrovaradin Fortress clock tower on its ramparts, Novi Sad | Stefan Kostić | Novi Sad, Serbia | [page](https://unsplash.com/photos/white-and-brown-concrete-building-on-top-of-hill-LSltIg27ymk) | `https://images.unsplash.com/photo-1630137294239-96731fe3271e` |

Photos that passed page verification but were excluded after visual review:

- `UUsQk_9bdR8` and `lDlU1zbjGQA`: visible Apple logos.
- `xtDpXi_a-YQ`: app UI on the screen.
- `hQvLc8KDN6A`: movie poster.
- `emqnSQwQQDo`: desert view.
- `pPuI5NVJpjQ`: hotel logo and guests.
- `g4Dq_vCOGc0`: readable number plate and driver.
- `T6GW3OGhA6M`: poster with faces.
- `qc2l2Z5uQbI`: identifiable person.

## B. Poly Haven 360 panoramas (CC0: no attribution needed, commercial use OK)

All are equirectangular (2:1). `url` is Poly Haven's full-resolution tonemapped JPG, verified as 8192x4096. These files are heavy, 20-40 MB each. For the web tour, download once and self-host a resized copy: 4096x2048 at about 80% quality is typically 2-4 MB, while 8192x4096 exceeds some mobile GPUs' maximum texture size. Low-res previews are available at `https://cdn.polyhaven.com/asset_img/primary/<id>.png?width=800` (capped at 1920x960). HDR lighting files are listed by the API under `hdri.<res>.hdr`.

| # | ID | Name | Poly Haven category | Author(s) | What it shows | Tonemapped JPG (8192x4096) | Size | License |
|---|---|---|---|---|---|---|---|---|
| 1 | [glasshouse_interior](https://polyhaven.com/a/glasshouse_interior) | Glasshouse Interior | Interiors / Residential / Living Rooms & Lounges | Dario Barresi | Open-plan glass-walled studio: bed, dining table, wood stove, panoramic windows; soft daylight | `https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/glasshouse_interior.jpg` | 38.9 MB | CC0 |
| 2 | [brown_photostudio_04](https://polyhaven.com/a/brown_photostudio_04) | Brown Photostudio 04 | Studio / Natural-Light Studios | Sergej Majboroda | Bright white open room with sofa, kitchenette and large window with sheer curtains (reads as a minimalist apartment) | `https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/brown_photostudio_04.jpg` | 40.2 MB | CC0 |
| 3 | [brown_photostudio_02](https://polyhaven.com/a/brown_photostudio_02) | Brown Photostudio 02 | Studio / Natural-Light Studios | Sergej Majboroda | Loft studio with bed on a platform, kitchen corner and large arched window (studio-apartment feel) | `https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/brown_photostudio_02.jpg` | 39.4 MB | CC0 |
| 4 | [relax_inn_seaview_suite](https://polyhaven.com/a/relax_inn_seaview_suite) | Relax Inn Seaview Suite | Interiors / Residential / Bedrooms | Dario Barresi, Jenelle van Heerden | Hotel-suite bedroom with double bed, chaise, desk and sliding doors to a balcony | `https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/relax_inn_seaview_suite.jpg` | 21.0 MB | CC0 |
| 5 | [modern_bathroom](https://polyhaven.com/a/modern_bathroom) | Modern Bathroom | Interiors / Residential / Bathrooms | Adrian Kubasa | Contemporary white bathroom under a sloped roof window: tub, walk-in shower, wall-hung toilet | `https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/modern_bathroom.jpg` | 35.6 MB | CC0 |
| 6 | [photo_studio_loft_hall](https://polyhaven.com/a/photo_studio_loft_hall) | Photo Studio Loft Hall | Studio / Natural-Light Studios | Sergej Majboroda | Sunny loft hall with green walls, wood floor, armchairs and tall windows | `https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/photo_studio_loft_hall.jpg` | 39.0 MB | CC0 |

Other residential options verified through the same API. They have a more dated look, and most have much lighter JPGs:

- `lythwood_lounge` (living room, 5.0 MB)
- `kiara_interior` (kitchen and lounge, 5.4 MB)
- `lythwood_room` (bedroom and lounge, 4.2 MB)
- `reading_room` (37.8 MB)
- `en_suite` (bathroom, 3.3 MB)
- `blinds` (kitchen, 3.7 MB)

Their URLs follow the same pattern.

## C. Gaussian splats

### C1. SuperSplat scenes marked CC BY 4.0 by their uploaders (best fit: interior rooms)

CC BY 4.0 requires attribution. Show *"<title>" by <user>, SuperSplat, CC BY 4.0* with a link to the scene page.

- **Format.** PlayCanvas **SOG v2**: `meta.json` plus WebP textures in the same folder, generated by splat-transform v2.x. The URL is what the official SuperSplat viewer streams from PlayCanvas's CloudFront, with CORS `*`. That is fine for prototyping. For production, use the scene's Download button (needs a free login) and self-host.
- **PlayCanvas engine** loads SOG natively.
- **Spark.** Its `SplatFileType` enum has `PCSOGS` (unzipped meta.json) and `PCSOGSZIP` (.sog). Pass `fileType: SplatFileType.PCSOGS` when loading the meta.json URL. This was not tested at runtime here.
- **Synthetic scenes.** Several are CG-rendered scenes. The license is as the uploader declared it, and the underlying 3D assets were not audited.

| # | Scene (page) | Author | What it depicts | Source | Splats | Total size | URL (format: sog) | License |
|---|---|---|---|---|---|---|---|---|
| 1 | [Reading Room (No Lidar, Only Photos)](https://superspl.at/scene/9d370db9) | ethan3111 | Modern dining/reading room with long oak table, walnut wall panels and framed photo wall | real photo capture (Insta360 Ace Pro 2, MipMap Desktop) | 5.72M | 65.7 MB | `https://d28zzqy0iyovbz.cloudfront.net/9d370db9/v1/meta.json` | CC BY 4.0 |
| 2 | [Living Room and Kitchen](https://superspl.at/scene/9917211a) | ethan3111 | Open-plan living room with sofa, dining table and kitchen on herringbone floor | reconstructed with MipMap Desktop | 3.85M | 43.1 MB | `https://d28zzqy0iyovbz.cloudfront.net/9917211a/v1/meta.json` | CC BY 4.0 |
| 3 | [Bedroom](https://superspl.at/scene/ef3837bd) | ethan3111 | Bedroom with double bed, framed paintings and wooden shelving | synthetic: trained from captures of an Unreal Engine scene (per description) | 4.36M | 49.8 MB | `https://d28zzqy0iyovbz.cloudfront.net/ef3837bd/v1/meta.json` | CC BY 4.0 |
| 4 | [HAUSSMANN APARTMENT](https://superspl.at/scene/4de797f4) | sa3d | Empty white Haussmann-style room with herringbone parquet and three French windows | synthetic: 3ds Max/Corona renders (per description) | 3.00M | 43.6 MB | `https://d28zzqy0iyovbz.cloudfront.net/4de797f4/v1/meta.json` | CC BY 4.0 |
| 5 | [Studio 11](https://superspl.at/scene/c37cb759) | milanoski | Bright modern studio-apartment living area with sofa, lounge chair and large windows | synthetic: UE5 scene via Unreal-to-COLMAP + LichtFeld Studio (per description) | 5.00M | 57.3 MB | `https://d28zzqy0iyovbz.cloudfront.net/c37cb759/v1/meta.json` | CC BY 4.0 |
| 6 | [Apartment 07](https://superspl.at/scene/1a55cdea) | milanoski | Modern apartment living room with sectional sofa, zebra rug and sheer curtains | synthetic: UE5 scene via Unreal-to-COLMAP + LichtFeld Studio (per description) | 5.00M | 67.4 MB | `https://d28zzqy0iyovbz.cloudfront.net/1a55cdea/v1/meta.json` | CC BY 4.0 |
| 7 | [Apartment_SH3](https://superspl.at/scene/1e56ea8e) | milanoski | Studio-apartment kitchen/dining corner with black cabinets, brick wall and wall clock (SH degree 3) | synthetic: UE5 scene via Unreal-to-COLMAP + LichtFeld Studio (per description) | 5.00M | 66.0 MB | `https://d28zzqy0iyovbz.cloudfront.net/1e56ea8e/v1/meta.json` | CC BY 4.0 |

### C2. Spark (sparkjs.dev) example assets

The Spark repo is MIT, but these remote assets have **no stated license**. They are hosted by World Labs for Spark's own examples. Use them for internal prototyping only, and confirm with World Labs before any public use. All are served with CORS `*`.

| # | URL | Format | Size | Used by | What it depicts | License |
|---|---|---|---|---|---|---|
| 1 | `https://storage.googleapis.com/forge-dev-public/painted_bedroom.spz` | spz (v2, SH0) | 7.8 MB, 500k splats | examples/interactive-holes (`painted-bedroom.spz`) | Stylised hand-painted fantasy bedroom (checked with a point-cloud preview render) | Unspecified |
| 2 | `https://storage.googleapis.com/forge-dev-public/marble-scenes/greyscale-room.spz` | spz (v2, SH0) | 30.7 MB, 2.0M splats | examples/splat-painter (`greyscale-bedroom.spz`) | Greyscale classic French-style bedroom (checked with a preview render) | Unspecified |
| 3 | `https://sparkjs.dev/assets/splats/fireplace.spz` | spz | 4.4 MB, 301k splats | examples envmap, dynamic-lighting, render-cube-depth | The name suggests a fireplace scene. Content not confirmed: the preview render was inconclusive | Unspecified |
| 4 | `https://storage.googleapis.com/forge-dev-public/asundqui/cozy-xr/cozy_cottage-lod.spz` | spz (LoD) | 93.1 MB | examples/basic-xr | "Cozy cottage" world, content not visually verified | Unspecified |

Only rows 1-2 are in the JSON.

### C3. Other findings

- **License-clean SPZ format tests, not interiors.** Niantic's MIT-licensed repo: `https://raw.githubusercontent.com/nianticlabs/spz/main/samples/hornedlizard.spz` (18.1 MB) and `.../samples/racoonfamily.spz` (24.2 MB). The repo LICENSE is MIT and no separate asset license is stated.
- **Not usable for a public demo:**
  - `spatialverse/InteriorGS`: gated, custom terms.
  - SceneSplat datasets (`GaussianWorld/*`, for example crowdsourced_3dgs_cleaned): gated, non-commercial research only.
  - Inria / mip-NeRF 360-derived room, bonsai and kitchen splats (for example HF `dylanebert/3dgs`, `kishimisu/.../room.ply`): no license, or research-only.
  - SuperSplat scenes without a license, for example "Private Residence Interior".

## Additions (2026-09-28)

94 more Unsplash photos were verified the same way as section A: each one was opened on its own Unsplash page (photographer, image ID and the "Free to use under the Unsplash License" line checked, no Unsplash+), then looked at for faces, legible logos and plates. They were merged into the `unsplash` array of `demo-media.json` in night-run step 06 (no URL was already present), `demo-media-additions.json` was deleted, and `node scripts/verify-demo-media.mjs` answered 199 / 199 (184 photos, 6 panoramas, 9 splats; 0 dropped).

| Category | Before | Added | Now |
|---|---|---|---|
| Living rooms | 16 | 22 | 38 |
| Kitchens | 10 | 14 | 24 |
| Bedrooms | 10 | 14 | 24 |
| Bathrooms | 8 | 12 | 20 |
| Dining | 4 | 8 | 12 |
| Home office / study | 4 | 4 | 8 |
| Terraces, balconies & views | 8 | 8 | 16 |
| Residential building exteriors | 10 | 6 | 16 |
| Villas / houses (exteriors) | 6 | 6 | 12 |
| Belgrade cityscape & landmarks | 10 | 0 | 10 |
| Novi Sad | 4 | 0 | 4 |
| **Total** | **90** | **94** | **184** |

Effect on the seed (30 demo listings, 220 gallery slots, `convex/seed/media.ts::buildPhotoPlan`): distinct photos used 87 → 177; covers distinct 24 / 30 → 30 / 30; the most any one photo is used 4 → 2. The 43 remaining repeats are the arithmetic minimum, because seven categories still have more slots than photos (bedroom 35 slots for 24 photos, bathroom 29 for 20, building 25 for 16, terrace 23 for 16, kitchen 27 for 24, living 41 for 38, dining 13 for 12).

### Added photos (94)

| # | Category | Alt text | Photographer | Page | Image URL |
|---|---|---|---|---|---|
| 1 | living | Bright living room with white sofas, black wood-burning stove and tall windows onto woodland | Clay Banks | [page](https://unsplash.com/photos/a-living-room-filled-with-furniture-and-a-fire-place-UTWRDWMMaag) | `https://images.unsplash.com/photo-1723748972084-4124765e0a55` |
| 2 | living | Modern living room with white bouclé sofas, glass courtyard wall with a tree and walnut media console | Wemel Wood | [page](https://unsplash.com/photos/modern-living-room-with-courtyard-view-and-television-o08lTHSjjU8) | `https://images.unsplash.com/photo-1774437290632-f4e91d831537` |
| 3 | living | Elegant living room with mauve velvet tub chairs, round coffee table, oak floor and dining area beyond | GoodLifeConstruction | [page](https://unsplash.com/photos/modern-living-room-with-minimalist-furniture-and-decor-e0oJLc5FYsg) | `https://images.unsplash.com/photo-1771888703723-01d85da1dae1` |
| 4 | living | Classic living room with powder-blue walls, crystal chandelier, herringbone parquet and French doors | Alex Tyson | [page](https://unsplash.com/photos/a-living-room-filled-with-furniture-and-a-painting-on-the-wall-ZcUTLou4jVQ) | `https://images.unsplash.com/photo-1721742146903-5b37cb82ff54` |
| 5 | living | Airy open living room with white sectional, armchairs, light oak floor and potted palms | Lisa Anna | [page](https://unsplash.com/photos/a-living-room-filled-with-furniture-and-lots-of-windows-Kt0KcFxHHhA) | `https://images.unsplash.com/photo-1721742121037-f3f1431d99cc` |
| 6 | living | Mid-century modern living room with grey sofa, burgundy tubular chairs and built-in walnut shelving | Irena Oze | [page](https://unsplash.com/photos/cozy-modern-living-space-with-sofa-armchair-and-natural-light-5wMfBJqSqIg) | `https://images.unsplash.com/photo-1781249144459-0a9ce5bbf77d` |
| 7 | living | Sunny apartment living area with grey sofa, paper globe pendant, balcony door and terrazzo kitchen counter | Irena Oze | [page](https://unsplash.com/photos/sunny-modern-apartment-living-room-with-balcony-and-kitchen-counter-eDKrWCFn8is) | `https://images.unsplash.com/photo-1781249144484-f5969c55e54e` |
| 8 | living | Classic living room with curved bouclé sofa, white marble fireplace, gilt mirror and round stone coffee table | Clay Banks | [page](https://unsplash.com/photos/a-living-room-filled-with-furniture-and-a-fire-place-qdavoiFWGQc) | `https://images.unsplash.com/photo-1728649054288-61f332ee389b` |
| 9 | living | Minimalist living room with two grey velvet sofas facing a linear fireplace on wide oak floors | Zac Gudakov | [page](https://unsplash.com/photos/living-room-with-grey-velvet-sofas-mw_mj-noYHM) | `https://images.unsplash.com/photo-1628744876497-eb30460be9f6` |
| 10 | living | Contemporary living room with white sectional, concrete accent wall, abstract art and tall windows | Aalo Lens | [page](https://unsplash.com/photos/modern-living-room-with-sectional-sofa-and-artwork-ugIfsN9l_q4) | `https://images.unsplash.com/photo-1758957701419-2c6e266f7988` |
| 11 | living | Minimalist living room with cognac leather lounge chairs, wood stove and black-framed windows | Clay Banks | [page](https://unsplash.com/photos/modern-living-room-with-tan-leather-chairs-and-fireplace-CCQi3pV95k0) | `https://images.unsplash.com/photo-1762544968153-b9b47435fefd` |
| 12 | living | Sunlit living room with sculptural cream lounge chairs, white sofa and large abstract painting (3D render) | Franco Debartolo | [page](https://unsplash.com/photos/modern-living-room-with-abstract-art-and-plush-furniture-Wkqs3XD8JPk) | `https://images.unsplash.com/photo-1759238136818-7b00ec9e782a` |
| 13 | living | Modern living room with white swivel armchairs, open walnut shelving divider and strap-hung round mirror | Obegi Home | [page](https://unsplash.com/photos/modern-living-room-with-stylish-furniture-and-shelving-IDAsplMgG7A) | `https://images.unsplash.com/photo-1760072513442-9872656c1b07` |
| 14 | living | Bright open-plan apartment with kitchen, red armchair and large window onto a classic facade | deborah cortelazzi | [page](https://unsplash.com/photos/tidy-room-filled-with-furnitures-gREquCUXQLI) | `https://images.unsplash.com/photo-1522708323590-d24dbb6b0267` |
| 15 | living | Warm minimalist living room with low beige sofa, rattan pendant and sheer curtains (3D render) | D5 Render | [page](https://unsplash.com/photos/a-living-room-filled-with-furniture-and-a-large-window--_eNaluvWv0) | `https://images.unsplash.com/photo-1678762200388-51e11225d4de` |
| 16 | living | Open-plan apartment living room with cream sofa, abstract art, dining table and modern kitchen | Melrose By The Lake | [page](https://unsplash.com/photos/modern-stylish-living-room-with-open-concept-kitchen-43vHzsfrmxk) | `https://images.unsplash.com/photo-1741764014072-68953e93cd48` |
| 17 | living | Luxury living room with cognac leather sofas, black marble feature wall and backlit shelving (3D render) | POOJAN THANEKAR | [page](https://unsplash.com/photos/elegant-living-room-with-brown-leather-furniture-and-stylish-decor-VR6A9572dI8) | `https://images.unsplash.com/photo-1780257562941-d9a6923befa1` |
| 18 | living | Scandinavian-style living room with herringbone parquet, blue sofa and white TV console | Jarek Ceborski | [page](https://unsplash.com/photos/flat-screen-monitor-inside-room-jn7uVeCdf6U) | `https://images.unsplash.com/photo-1493809842364-78817add7ffb` |
| 19 | living | Sunlit living room with cream sofa, linen curtains and floor-to-ceiling windows over the city | Danilo Rios | [page](https://unsplash.com/photos/a-living-room-with-a-large-window-AgK_XAqSbfk) | `https://images.unsplash.com/photo-1665249934445-1de680641f50` |
| 20 | living | Cosy apartment living room with grey loveseat, bookshelves, plants and a bright window | Patrick Perkins | [page](https://unsplash.com/photos/gray-fabric-loveseat-near-brown-wooden-table-3wylDrjxH-E) | `https://images.unsplash.com/photo-1502672260266-1c1ef2d93688` |
| 21 | living | Loft-style living room with navy sofa, floating staircase and open kitchen beside tall windows | Lotus Design N Print | [page](https://unsplash.com/photos/a-living-room-with-a-staircase-OuiohmAG9x8) | `https://images.unsplash.com/photo-1669317139155-912572c38362` |
| 22 | living | Double-height living room with white armchairs, stone fireplace wall and gallery landing | Zac Gudakov | [page](https://unsplash.com/photos/white-and-brown-living-room-set-ztWpwTEx728) | `https://images.unsplash.com/photo-1613545325278-f24b0cae1224` |
| 23 | kitchen | Open-plan kitchen with long white quartz island, walnut base cabinets and garden windows | Zac Gudakov | [page](https://unsplash.com/photos/white-and-brown-kitchen-counter-UPbYh3A5cdg) | `https://images.unsplash.com/photo-1628745277862-bc0b2d68c50c` |
| 24 | kitchen | Black modern kitchen with concrete-look counter, gas range and floor-to-ceiling windows onto trees | Clay Banks | [page](https://unsplash.com/photos/a-kitchen-with-a-stove-top-oven-next-to-a-window-4zlQ3CCoIyo) | `https://images.unsplash.com/photo-1696986681606-b156ccd761c5` |
| 25 | kitchen | Dark kitchen with charcoal tiled backsplash, open wooden shelves, gas range and black faucet | Clay Banks | [page](https://unsplash.com/photos/a-kitchen-with-a-sink-and-a-stove-top-oven-C-FqIffctHI) | `https://images.unsplash.com/photo-1696986681436-f5ee12981bc9` |
| 26 | kitchen | White luxury kitchen with marble island, brass trim and warm under-cabinet lighting (3D render) | Brian Zajac | [page](https://unsplash.com/photos/a-kitchen-with-a-marble-counter-top-and-white-cabinets-T28LLOIuJj4) | `https://images.unsplash.com/photo-1683629357963-adf2b1fa9ad9` |
| 27 | kitchen | Luxury kitchen with book-matched marble island, bar stools and backlit marble niche | Aalo Lens | [page](https://unsplash.com/photos/modern-kitchen-island-with-marble-accents-and-pendant-light-UlIj_qKpgCw) | `https://images.unsplash.com/photo-1758448755927-e5c5ae14790c` |
| 28 | kitchen | Modern kitchen with walnut island, beige bar stools, black glass cabinets and marble backsplash (3D render) | Alina Tramontana | [page](https://unsplash.com/photos/modern-kitchen-with-island-and-bar-stools-kAa2xEs_jZo) | `https://images.unsplash.com/photo-1759147960461-b74a7e9a75d4` |
| 29 | kitchen | Modern kitchen island with stone countertop, ceramic vases and marble backsplash | Franco Debartolo | [page](https://unsplash.com/photos/modern-kitchen-island-with-decorative-vases-and-faucet-yFsop3bwYoA) | `https://images.unsplash.com/photo-1772567732923-5ba1956dcd07` |
| 30 | kitchen | Taupe handleless kitchen with walnut island, wooden bar stools and glass-front display cabinets | Caroline Badran | [page](https://unsplash.com/photos/modern-kitchen-with-island-and-bar-stools-BaKdrhCvn0E) | `https://images.unsplash.com/photo-1758565811438-23e44c7c65fa` |
| 31 | kitchen | Minimal kitchen with white fluted island, brass faucet and walnut tall cabinets | Lisa Anna | [page](https://unsplash.com/photos/a-kitchen-with-a-sink-stove-and-cabinets-2g6aRZE9S8s) | `https://images.unsplash.com/photo-1722247478581-17f7d9ffb3a6` |
| 32 | kitchen | Walnut and marble kitchen with waterfall island, bulb pendants and dining area by glass walls | Clay Banks | [page](https://unsplash.com/photos/modern-kitchen-with-island-and-dining-area-LrAvlHZtW-Y) | `https://images.unsplash.com/photo-1764526612515-6b4ab2868a6e` |
| 33 | kitchen | Walnut kitchen with white island, four wooden stools and brass pendant light | Clay Banks | [page](https://unsplash.com/photos/modern-kitchen-with-walnut-cabinetry-TDXF1KUyyTk) | `https://images.unsplash.com/photo-1788217158679-5f7a52049ecc` |
| 34 | kitchen | Walnut kitchen with terrazzo counters, white bar stools and mirrored backsplash | Irena Oze | [page](https://unsplash.com/photos/modern-kitchen-with-dark-wood-cabinets-and-speckled-countertops-xLEQEF3cC1s) | `https://images.unsplash.com/photo-1781249144275-c04daed37031` |
| 35 | kitchen | Modern kitchen with terrazzo island, walnut cabinetry and built-in oven beside a window | Irena Oze | [page](https://unsplash.com/photos/modern-kitchen-with-dark-cabinets-stone-countertops-and-breakfast-bar-Tf5QDU9xxMU) | `https://images.unsplash.com/photo-1781249144389-4174c1164955` |
| 36 | kitchen | Loft kitchen with dark teal cabinets, bar stools and open-tread staircase to a mezzanine | Caroline Badran | [page](https://unsplash.com/photos/modern-kitchen-with-loft-and-staircase-HBJzUF3kwts) | `https://images.unsplash.com/photo-1768413292179-d958b344f1d4` |
| 37 | bedroom | Attic bedroom with white beamed ceiling, oak headboard wall, bench and linen bedding (3D render) | Prydumano Design | [page](https://unsplash.com/photos/a-bedroom-with-a-bed-and-a-table-in-it-qPHpk6G9nik) | `https://images.unsplash.com/photo-1724582586413-6b69e1c94a17` |
| 38 | bedroom | Bedroom with wood-slat accent wall and floor-to-ceiling corner windows onto trees | Hans | [page](https://unsplash.com/photos/a-bedroom-with-a-bed-and-a-large-window-p6pfOaavscc) | `https://images.unsplash.com/photo-1659720879195-d5a108231648` |
| 39 | bedroom | Bright bedroom with upholstered bed, wooden bench, gallery wall and tall windows | Spacejoy | [page](https://unsplash.com/photos/bedroom-with-bed-and-wall-art-XM-miHibz64) | `https://images.unsplash.com/photo-1616486029423-aaa4789e8c9a` |
| 40 | bedroom | Bedroom with oak platform bed, built-in desk and windows onto a historic facade (3D render) | laura adai | [page](https://unsplash.com/photos/a-bed-room-with-a-neatly-made-bed-and-a-desk-j67CwQzRLPg) | `https://images.unsplash.com/photo-1633948393301-d43e3ec0e5cd` |
| 41 | bedroom | Light-filled bedroom with upholstered bed, clerestory windows and rattan pendant | Point3D Commercial Imaging Ltd. | [page](https://unsplash.com/photos/white-bed-with-white-bed-linen-AJCs3SvOzRg) | `https://images.unsplash.com/photo-1631048501786-4e97f20eac71` |
| 42 | bedroom | Contemporary bedroom with wood-panelled wall, burgundy throw, built-in desk and round mirror | Obegi Home | [page](https://unsplash.com/photos/modern-bedroom-with-a-bed-desk-and-mirrors-v6iTdvOQsW4) | `https://images.unsplash.com/photo-1760072513376-67a46aab0fd1` |
| 43 | bedroom | Modern bedroom with grey upholstered bed against a dark oak panelled wall and sheer curtains | WE DO Interior Design & Fit Out | [page](https://unsplash.com/photos/modern-bedroom-with-wood-paneled-wall-efi-aJ-0qVs) | `https://images.unsplash.com/photo-1789132782848-74945d8699a8` |
| 44 | bedroom | Master bedroom with tufted headboard, fitted white wardrobes and glass balustrade | Lotus Design N Print | [page](https://unsplash.com/photos/a-bedroom-with-a-large-bed-and-a-glass-wall-uIef-ivLFio) | `https://images.unsplash.com/photo-1638284556849-1848ec7beb4a` |
| 45 | bedroom | Luxurious bedroom with curved headboard, crystal chandelier and full-height sheer curtains | Aalo Lens | [page](https://unsplash.com/photos/luxurious-bedroom-with-modern-decor-and-large-windows-Xph_EJ-22vE) | `https://images.unsplash.com/photo-1758448755969-8791367cf5c5` |
| 46 | bedroom | Calm bedroom with walnut nightstand, pleated lamp and sunlit doorway to a sitting nook | Clay Banks | [page](https://unsplash.com/photos/bedroom-with-a-wooden-nightstand-and-a-chair-in-doorway-tstSvl2Z3_0) | `https://images.unsplash.com/photo-1771611186938-39a6b934f2f6` |
| 47 | bedroom | Elegant bedroom with iron canopy bed, upholstered bench and a wall of windows | Spacejoy | [page](https://unsplash.com/photos/brown-wooden-bed-frame-with-white-bed-linen-iq6QpreZ1sA) | `https://images.unsplash.com/photo-1618296778887-7924838508a2` |
| 48 | bedroom | Parisian boutique bedroom with emerald walls, gilded mirror and French balcony doors | Emile Guillemot | [page](https://unsplash.com/photos/well-arrange-room-Bj_rcSC5XfE) | `https://images.unsplash.com/photo-1544097935-e6d136448533` |
| 49 | bedroom | Minimal white bedroom with oval mirror and casement window over tiled rooftops | Linh Pham | [page](https://unsplash.com/photos/a-bedroom-with-a-white-bed-and-a-round-window-xcuBKWvnp7o) | `https://images.unsplash.com/photo-1731712828280-488311b6c8d9` |
| 50 | bedroom | Neutral bedroom with arched upholstered headboard and two bouclé armchairs | Franco Debartolo | [page](https://unsplash.com/photos/a-neutral-toned-bedroom-with-two-chairs-and-a-bed-Nt_bhlWvK0A) | `https://images.unsplash.com/photo-1774578342040-e43e8016428c` |
| 51 | bathroom | Marble bathroom with double white vanity, brass faucets and oval gold-framed mirrors | Christian Mackie | [page](https://unsplash.com/photos/white-ceramic-sink-6BJu73-UJpg) | `https://images.unsplash.com/photo-1564540583246-934409427776` |
| 52 | bathroom | Bathroom with green shaker vanity, arched brass mirrors and marble walk-in shower | Zac Gudakov | [page](https://unsplash.com/photos/a-bathroom-with-green-cabinets-and-a-marble-shower-FiKcg6EMneY) | `https://images.unsplash.com/photo-1682888818704-6dc91e9d7532` |
| 53 | bathroom | Marble bathroom with vessel basin, dark stone accent panel and wall-hung toilet (3D render) | Medea Dzagnidze | [page](https://unsplash.com/photos/a-bathroom-with-a-tub-sink-and-toilet-SWSY0NEicIs) | `https://images.unsplash.com/photo-1667550177753-52b318cd4d40` |
| 54 | bathroom | Bright bathroom with marble-top oak vanity, round brass mirror and walk-in shower | Clay Banks | [page](https://unsplash.com/photos/modern-bathroom-with-marble-accents-and-a-large-plant-Fuguvv3goCA) | `https://images.unsplash.com/photo-1771681278369-e2a5480b8c29` |
| 55 | bathroom | Onyx-clad bathroom with built-in bathtub, teak vanity and backlit mirror cabinet | Backbone | [page](https://unsplash.com/photos/a-bathroom-with-two-sinks-and-a-bathtub-x66VPslVfQ0) | `https://images.unsplash.com/photo-1631889477858-95b7aa36d727` |
| 56 | bathroom | Twin oak vanities with marble tops, oval brass mirrors and wall sconces | Clay Banks | [page](https://unsplash.com/photos/two-wooden-vanities-with-oval-mirrors-and-gold-fixtures-7Z2OTozIY_0) | `https://images.unsplash.com/photo-1771681278446-6f8eb0c7323f` |
| 57 | bathroom | Grey-tiled bathroom with freestanding tub, heated towel rails and window over rooftops | Jessica Hearn | [page](https://unsplash.com/photos/a-bathroom-with-a-tub-and-sink-ODU4mXpF-5I) | `https://images.unsplash.com/photo-1662624914003-9bb2095ca7a0` |
| 58 | bathroom | Grey stone bathroom with illuminated organic-shaped mirror, floating walnut vanity and orchid | Alex Tyson | [page](https://unsplash.com/photos/a-bathroom-with-a-large-mirror-above-the-sink-Q46fpVCfdSk) | `https://images.unsplash.com/photo-1722858812731-d96eceb10f52` |
| 59 | bathroom | Terrazzo bathroom with walnut vanity, vessel sink and mirrored cabinet | Irena Oze | [page](https://unsplash.com/photos/modern-bathroom-with-sink-toilet-mirror-and-brown-cabinetry-bbVVw9FgTRY) | `https://images.unsplash.com/photo-1781249144347-32719b169201` |
| 60 | bathroom | Bathroom with floating double vanity, backlit mirror, textured tile wall and terrazzo floor | Salvo Media LLC | [page](https://unsplash.com/photos/elegant-modern-bathroom-with-large-illuminated-mirror-and-double-vanity-Gs3M7gcOSTU) | `https://images.unsplash.com/photo-1783125126959-bcd87518b7d8` |
| 61 | bathroom | White bathroom with freestanding tub, brass floor-mounted tap and glass walk-in shower | Salvo Media LLC | [page](https://unsplash.com/photos/modern-white-bathroom-with-freestanding-tub-and-glass-shower-ftjqFgBR7oI) | `https://images.unsplash.com/photo-1783125126704-508356c71390` |
| 62 | bathroom | Travertine bathroom with double trough sink and glass shower enclosure | Alef Morais | [page](https://unsplash.com/photos/modern-bathroom-with-double-vanity-and-glass-shower-k8bh3LZpsyI) | `https://images.unsplash.com/photo-1760067537877-dd4d2722c649` |
| 63 | dining | Parisian dining room with herringbone parquet, black chairs, sculptural chandelier and tall windows | yann maignan | [page](https://unsplash.com/photos/brown-wooden-dining-set-inside-room-x3BCSWCAtrY) | `https://images.unsplash.com/photo-1505409628601-edc9af17fda6` |
| 64 | dining | Solid wood dining table with moulded chairs seen through a doorway in a period apartment | Pickawood | [page](https://unsplash.com/photos/white-and-black-wooden-table-with-chairs-h2WbMAg56EM) | `https://images.unsplash.com/photo-1599643332904-ddc6060f3289` |
| 65 | dining | Open dining area with round black table, cane-back chairs and herringbone floor by garden windows | Lisa Anna | [page](https://unsplash.com/photos/a-living-room-filled-with-furniture-and-a-dining-room-table-y6ncLVtt5Rk) | `https://images.unsplash.com/photo-1721614666806-e8c48ff335ca` |
| 66 | dining | Bright dining corner with herringbone oak floor, white table and walnut sideboard | Lisa Anna | [page](https://unsplash.com/photos/a-living-room-filled-with-furniture-and-a-dining-room-table-9d5dCNXFHx4) | `https://images.unsplash.com/photo-1722942114580-04958c43a04a` |
| 67 | dining | Formal dining room with round table, botanical-print chairs and arched garden windows | Jez Timms | [page](https://unsplash.com/photos/a-dining-room-table-with-chairs-and-a-vase-of-flowers-XMXuiLoZlFY) | `https://images.unsplash.com/photo-1634389312178-50613e56acda` |
| 68 | dining | Dining table with bentwood chairs and bench beneath tall windows onto greenery | Clay Banks | [page](https://unsplash.com/photos/a-dining-room-table-with-chairs-and-a-vase-of-flowers-yitjwM777fE) | `https://images.unsplash.com/photo-1696986296905-e631802befb0` |
| 69 | dining | Warehouse loft with long dining table, exposed brick walls and tall arched windows | Keren Fedida | [page](https://unsplash.com/photos/brown-wooden-table-with-chairs-ZXZ7t7TneQs) | `https://images.unsplash.com/photo-1617817643768-8855fc457e3a` |
| 70 | dining | Dining room with round pedestal table, grey chairs and window view over the city | Infinite Views | [page](https://unsplash.com/photos/brown-wooden-table-with-chairs-OPTtVaI8H2Q) | `https://images.unsplash.com/photo-1629236714902-e1926e8ab314` |
| 71 | office | Minimal home office with oak trestle desk and black chair in a white attic room | Sven Brandsma | [page](https://unsplash.com/photos/black-chair-beside-brown-wooden-table-zIltX6n3m7w) | `https://images.unsplash.com/photo-1596022326953-84f20bfebb77` |
| 72 | office | Home office with oak desk, brass lamp, wire chair and framed botanical print | Steven Ungermann | [page](https://unsplash.com/photos/black-metal-framed-white-padded-chair-beside-brown-wooden-table-ZQaRJmPGmsQ) | `https://images.unsplash.com/photo-1629078692914-1160b6bace81` |
| 73 | office | Small study desk with potted plants beneath a tall sash window | Annie Spratt | [page](https://unsplash.com/photos/a-desk-with-a-chair-and-a-window-in-the-background-cpDBPCwTs2s) | `https://images.unsplash.com/photo-1653463174225-fb1c604b8812` |
| 74 | office | Sunlit home office with wooden desk, anglepoise lamp and plants by sash windows | Annie Spratt | [page](https://unsplash.com/photos/a-room-filled-with-furniture-and-vase-of-flowers-on-a-table-gdi9fJboJQU) | `https://images.unsplash.com/photo-1651739084015-85af0539f960` |
| 75 | terrace | Balcony view over Belgrade rooftops and residential towers on a clear day | Anna Sophie Reich | [page](https://unsplash.com/photos/a-view-of-a-city-from-a-high-rise-building-vlELUCagPK0) | `https://images.unsplash.com/photo-1713799210416-593f9734af6a` |
| 76 | terrace | Glass sliding door opening onto a terrace with sea and coastal town view | Gábor Szűts | [page](https://unsplash.com/photos/balcony-overlooking-the-sea-and-coastal-town-N1DlQkl2V2c) | `https://images.unsplash.com/photo-1769869173719-997e7be14a56` |
| 77 | terrace | Penthouse terrace with teak dining table, outdoor sofa and glazed facade | Point3D Commercial Imaging Ltd. | [page](https://unsplash.com/photos/black-metal-table-and-chairs-o81t31QUpXs) | `https://images.unsplash.com/photo-1630703103084-4ac45d397a0c` |
| 78 | terrace | Rooftop terrace with white lounge furniture under a pergola surrounded by greenery | Sergej ***** | [page](https://unsplash.com/photos/modern-outdoor-seating-area-with-white-furniture-9U9Kf6191X0) | `https://images.unsplash.com/photo-1762608675427-09ac2dbd1540` |
| 79 | terrace | Wooden balcony with flower boxes overlooking an alpine lake and mountains | Hasmik Ghazaryan Olson | [page](https://unsplash.com/photos/pink-flowers-on-brown-wooden-fence-near-body-of-water-during-daytime-IMq53G6S5co) | `https://images.unsplash.com/photo-1597086831626-aca8ef5a0046` |
| 80 | terrace | Covered stone terrace with balustrade and column overlooking a lake and hills | Hector John Periquin | [page](https://unsplash.com/photos/a-balcony-with-a-view-of-the-ocean-A37oXJL4YbM) | `https://images.unsplash.com/photo-1681971636852-de901b958b22` |
| 81 | terrace | Balustraded terrace view over Rome's rooftops and domes | Nensi Patel | [page](https://unsplash.com/photos/distant-city-skyline-with-domes-balustrade-and-blue-sky-avoEiFoc3Yc) | `https://images.unsplash.com/photo-1784594614352-4b4474afd072` |
| 82 | terrace | Rooftop patio with lounge seating and fire table overlooking a bay at sunset | Addison Lin | [page](https://unsplash.com/photos/rooftop-patio-overlooking-a-calm-bay-at-sunset-Ue5yZQRQDi4) | `https://images.unsplash.com/photo-1785129495552-d0d0ce25212b` |
| 83 | building | Haussmann-style Paris apartment building with stone facade and wrought-iron balconies | Athithan Vignakaran | [page](https://unsplash.com/photos/haussmann-building-with-balconies-in-paris-BEyTxiQFFpQ) | `https://images.unsplash.com/photo-1787826249483-edfeee468445` |
| 84 | building | Classic Madrid apartment building with red shutters and iron balconies under blue sky | Robin van der Wal | [page](https://unsplash.com/photos/a-multi-story-building-with-red-shutters-under-a-blue-sky-stinEaAxn6Q) | `https://images.unsplash.com/photo-1779300207128-0a53e9eceb67` |
| 85 | building | Barcelona apartment facade with iron balconies, wooden shutters and balustraded roofline | Project:KENO | [page](https://unsplash.com/photos/old-building-facade-with-balconies-and-windows-Ff331ZKrgr8) | `https://images.unsplash.com/photo-1776677533260-036ab62c5593` |
| 86 | building | Sunlit brick and ochre apartment buildings with ornate balconies in Zürich | Nicolas Keller | [page](https://unsplash.com/photos/orange-and-yellow-buildings-with-balconies-under-blue-sky-NOAbWXaK57U) | `https://images.unsplash.com/photo-1774466186458-afe03547402e` |
| 87 | building | Red-brick apartment block with white windows and tiled roof under blue sky | Marek Lumi | [page](https://unsplash.com/photos/red-brick-apartment-building-IeewDFwtfEg) | `https://images.unsplash.com/photo-1788098089083-15f03cddcaf9` |
| 88 | building | Modern apartment facade with timber cladding, louvred shutters and furnished balconies | Patrick von der Wehd | [page](https://unsplash.com/photos/a-tall-building-with-balconies-and-chairs-on-the-balconies-1PdHMTELbxE) | `https://images.unsplash.com/photo-1728675676909-c74cbfd1b676` |
| 89 | villa | Provençal stone house with swimming pool, terracotta patio and potted plants | Babi Kacharava | [page](https://unsplash.com/photos/swimming-pool-and-house-in-provence-ar6XJWyZKqw) | `https://images.unsplash.com/photo-1787868377879-98168d69cfe2` |
| 90 | villa | Modern white villa with glass walls, stone cladding and infinity pool | Ярослав Алексеенко | [page](https://unsplash.com/photos/white-and-brown-concrete-building-under-blue-sky-during-daytime-_TPTXZd9mOo) | `https://images.unsplash.com/photo-1580587771525-78b9dba3b914` |
| 91 | villa | Modern white cubist villa with large glazing beside a stone pine | Lukas Tennie | [page](https://unsplash.com/photos/a-large-white-building-with-a-tree-in-front-of-it-d6DtdiBxBVc) | `https://images.unsplash.com/photo-1680874261352-ed1ee3d1cf01` |
| 92 | villa | Modern white villa with glass walls, sunny patio and swimming pool | Frames For Your Heart | [page](https://unsplash.com/photos/white-and-grey-concrete-building-near-swimming-pool-under-clear-sky-during-daytime-2d4lAQAlbDA) | `https://images.unsplash.com/photo-1512917774080-9991f1c4c750` |
| 93 | villa | Italian lakeside villa with manicured gardens, topiary and mountain backdrop | Marc Snailum | [page](https://unsplash.com/photos/elegant-villa-with-manicured-gardens-by-a-lake-8oOPN5I_d2A) | `https://images.unsplash.com/photo-1762856900971-626502a8d4fc` |
| 94 | villa | Jugendstil villa with light-blue facade, ornate white trim and flowering garden | Ali AOUF | [page](https://unsplash.com/photos/ornate-light-blue-house-with-white-trim-and-flowering-bushes-d99uvhbX07k) | `https://images.unsplash.com/photo-1782200752090-9c5f8b17b7fb` |
