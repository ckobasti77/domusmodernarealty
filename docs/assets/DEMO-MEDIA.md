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
