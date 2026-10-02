# Mihajlo Estate

Sajt i administratorski panel agencije za nekretnine u Srbiji, sa Beogradom kao glavnim tržištem. „Mihajlo Estate“ je radni naziv; menja se u panelu (Podešavanja → „Naziv agencije (brend)“).

Kratak pregled na engleskom je na kraju fajla (English summary).

## Šta je ovo

- **Javni sajt** na četiri jezika: srpski latinicom (`/sr`, podrazumevani), engleski (`/en`), ruski (`/ru`) i nemački (`/de`). Ima pretragu sa mapom, stranice nekretnina (galerija, tlocrti, 360° tura, 3D šetnja, kalkulatori, zakazivanje razgledanja), procenu vrednosti i „Prodajte sa nama“, lokacije, agente, magazin, omiljene nekretnine, poređenje i pravne stranice.
- **Administratorski panel** na srpskom, na `/admin`, samo uz pozivnicu. Ima nekretnine sa medijima, prevodima, pravnim podacima, ugovorom o posredovanju i kontrolnom listom za objavu; upite i prodajni tok; razgledanja; kontakte i saglasnosti; tim i uloge; lokacije; magazin; sadržaj sajta; podešavanja; analitiku; dnevnik aktivnosti i brisanje demo sadržaja.

Zahtevi proizvoda su u `docs/01-PRD.md`, a arhitektura u `docs/02-ARCHITECTURE.md`. Pre bilo kakve izmene pročitajte `CLAUDE.md`: tu su obavezna pravila, na primer podaci po čl. 18 Zakona o posredovanju, zabrana izmišljenih preporuka i pravila za animaciju.

## Tehnologije (stack)

Next.js 16.3 (App Router, Turbopack) · React 19.2 · TypeScript (strict) · Tailwind CSS 4 · Convex 1.46 (baza, funkcije, skladište fajlova, cron poslovi) sa `@convex-dev/auth` (lozinka, samo uz pozivnicu) i `@convex-dev/rate-limiter` · next-intl 4 (lokalizovane putanje) · GSAP 3.15 + Lenis (samo javni sajt) · shadcn/ui + TanStack Table + react-hook-form/zod (admin) · MapLibre GL 6 + OpenFreeMap mape · Photo Sphere Viewer 5 · three.js + Spark 2 (Gaussian splat modeli) · Playwright + Vitest/convex-test.

## Pokretanje lokalno

Potrebni su Node 22 i npm. Komande su napisane za bash; na Windows-u koristite Git Bash.

1. Instalirajte zavisnosti:
   ```bash
   npm install
   npx playwright install chromium   # samo za e2e testove i snimke ekrana
   ```
2. U prvom terminalu povežite Convex:
   ```bash
   npx convex dev
   ```
   Pri prvom pokretanju komanda traži prijavu na Convex i izbor (ili pravljenje) dev deploymenta, pa upisuje `.env.local`. Zatim ostaje da radi i prati izmene u `convex/`; ostavite je u tom terminalu.
3. Napunite demo podatke:
   ```bash
   npx convex run seed:all '{}'
   ```
4. U drugom terminalu pokrenite sajt:
   ```bash
   npm run dev
   ```
   Otvorite http://localhost:3000. Adresa preusmerava na jezik pregledača, a podrazumevano na `/sr`.

### Promenljive okruženja

`.env.local` se nikada ne komituje; polazni primer je `.env.example`.

| Promenljiva | Namena |
|---|---|
| `CONVEX_DEPLOYMENT` | Deployment koji koristi `npx convex dev` (upisuje ga ta komanda) |
| `NEXT_PUBLIC_CONVEX_URL` | Adresa Convex klijenta za sajt i panel (upisuje je `npx convex dev`) |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Adresa Convex HTTP akcija. Upisuje je `npx convex dev`; aplikacija je ne čita |
| `NEXT_PUBLIC_SITE_URL` | Javna adresa sajta za kanonske adrese, sitemap i slike za deljenje. Podrazumevano `http://localhost:3000`. Na Vercelu se bez nje koristi `VERCEL_PROJECT_PRODUCTION_URL`, a produkcijski build bez obe ne prolazi |
| `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | Opciono: administrator na dev deploymentu za admin e2e testove (inače se čita `night-run/state/admin.json`) |

Tajni ključevi servera su Convex promenljive okruženja (`npx convex env list`): `JWT_PRIVATE_KEY`, `JWKS` i `SITE_URL`.

- **Nov deployment:** pokrenite `npx @convex-dev/auth` (za produkciju dodajte `--prod`). Komanda pravi par ključeva i postavlja sve tri promenljive; zatim postavite `SITE_URL` na javnu adresu sajta: `npx convex env set SITE_URL https://…`.
- **Postojeći deployment:** ne pravite nove ključeve na deploymentu koji ima korisnike, jer se tada odjavljuju sve sesije.

### Podaci

```bash
npx convex dev --once                          # šalje šemu i funkcije, ponovo pravi convex/_generated
npx convex run seed:all '{}'                   # demo podaci (oko 30 nekretnina, 4 jezika); ponovno pokretanje ništa ne menja
npx convex run seed:all '{"force":true}'       # ponovo pravi demo podatke; briše SAMO zapise sa oznakom isDemo
```

Svaki demo zapis ima `isDemo: true`. **Admin → Demo sadržaj** ih briše u jednom koraku (vidi „Kako zameniti demo sadržaj“).

## Prijava u admin

Prijava je na http://localhost:3000/admin/login (polja „E-pošta“ i „Lozinka“, dugme „Prijavite se“). Javne registracije nema; nalog se otvara samo preko pozivnice.

**Nalog iz noćnog builda.** Administratorski nalog napravljen tokom noćnog builda postoji na dev deploymentu. Njegova e-adresa i lozinka su u lokalnom fajlu `night-run/state/admin.json`. Fajl je u `.gitignore` i nije deo repozitorijuma. Te podatke ne prepisujte u dokumentaciju, poruke ni tikete.

**Promena lozinke.** Posle prve prijave promenite lozinku: meni korisnika u gornjoj traci (krug sa inicijalima, desno) → **„Promenite lozinku“**. Dijalog „Promena lozinke“ traži „Trenutna lozinka“, „Nova lozinka“ (od 10 do 128 znakova) i „Ponovite novu lozinku“; nova lozinka mora da se razlikuje od trenutne. Posle „Sačuvajte lozinku“ odjavljuju se sve ostale prijave na taj nalog, a Vi ostajete prijavljeni u pregledaču u kome ste menjali lozinku.

**Zaključavanje.** Posle 10 pogrešnih lozinki prijava na taj nalog se privremeno blokira. Pokušaji se vraćaju postepeno: jedan na svakih šest minuta, svih deset posle sat vremena. Pogrešna trenutna lozinka u dijalogu „Promena lozinke“ računa se u isto ograničenje. Deaktiviran nalog ne može da se prijavi.

### Prvi administrator na novom deploymentu

Na novom deploymentu prvog administratora pravi interna akcija `seed:createAdmin`. Lozinku ne kucajte u komandnu liniju, jer ostaje u istoriji; argumente stavite u fajl van repozitorijuma:

```bash
# ~/me-admin.json: {"email":"ime@example.com","password":"<najmanje 12 znakova>","name":"Ime Prezime"}
node -e "process.stdout.write(require('fs').readFileSync(require('os').homedir()+'/me-admin.json','utf8'))" \
  | xargs -0 npx convex run seed:createAdmin
```

Akcija prvo pravi pozivnicu za tu adresu, pa otvara nalog sa ulogom administratora (opciono polje `role` bira drugu ulogu). Ako nalog sa tom adresom već postoji, ništa se ne menja. Posle toga obrišite `~/me-admin.json`. Ostale članove tima pozivate iz **Admin → Tim**.

## Kako pozvati članove tima

Pozivnice pravi samo administrator, u **Admin → Tim** (`/admin/tim`).

### Uloge

| Uloga | Šta sme (opis iz panela) | Delovi panela |
|---|---|---|
| Administrator | Sve, uključujući tim, naloge i podešavanja. | Svi, uključujući Podešavanja i Demo sadržaj |
| Menadžer | Sve osim naloga i podešavanja. | Kontrolna tabla, Nekretnine, Upiti, Razgledanja, Kontakti, Lokacije, Magazin, Sadržaj sajta, Tim (samo profili agenata), Analitika, Aktivnost |
| Agent | Samo svoje nekretnine, upite i razgledanja. | Kontrolna tabla, Nekretnine, Upiti, Razgledanja |
| Urednik | Magazin, stranice sajta i lokacije. | Kontrolna tabla, Lokacije, Magazin, Sadržaj sajta |

Ova pravila važe na serveru (`requireRole()` u svakoj Convex funkciji, `convex/lib/auth.ts`), ne samo u meniju. Agent vidi i menja samo nekretnine, upite i razgledanja svog profila agenta, pa nalog sa ulogom Agent mora biti povezan sa profilom. Preporuke klijenata na sajt puštaju („Potvrdi i objavi“) samo administrator i menadžer.

### Pozivnica, korak po korak

1. **Tim → „Pozovite člana tima“.** Unesite „E-adresa“, „Ime i prezime“ i „Uloga“.
2. Za ulogu Agent izaberite „Povezivanje sa profilom“: „Novi profil agenta“ (polje „Ime na javnom profilu“; profil se pravi skriven sa sajta) ili „Postojeći profil agenta“ (samo profili koji još nisu povezani sa nalogom). Menadžer i administrator mogu i „Bez profila agenta“; urednik se ne povezuje sa profilom.
3. **„Napravite pozivnicu“.** Link pozivnice se prikazuje samo tada; kopirajte ga dugmetom „Kopiraj“.
4. Pošaljite link lično (e-pošta, Viber, WhatsApp). **Slanje e-pošte iz panela nije podešeno** (u kodu nema servisa za e-poštu), pa panel ništa ne šalje sam.
5. Pozvana osoba otvara link (`/admin/pozivnica/…`), unosi ime i prezime i lozinku od 10 do 128 znakova (dva puta) i ulazi u panel sa ulogom iz pozivnice.

Link važi **7 dana** i radi **samo jednom**. Nova pozivnica za istu adresu poništava prethodnu otvorenu.

### Pozivnice, uloge i deaktivacija

- **Kartica „Pozivnice“:** pod „Otvorene pozivnice“ su dugmad „Novi link“ (stari link prestaje da važi, a novi važi 7 dana od tog trenutka; koristi se i za izgubljen ili istekao link) i „Opozovi“ (link prestaje da važi odmah). Ispod je „Istorija“ prihvaćenih i opozvanih pozivnica.
- **Kartica „Korisnici“:** otvorite nalog. „Uloga u panelu“ → „Promenite ulogu“ (uz potvrdu); „Povezani profil“ → „Sačuvajte vezu“. „Deaktivirajte nalog“ odmah odjavljuje osobu sa svih uređaja i sprečava prijavu; nekretnine, upiti i razgledanja ostaju na njenom profilu, pa ih po potrebi prebacite na kolegu. „Aktivirajte nalog“ vraća pristup sa dosadašnjom lozinkom. Sopstveni nalog i jedinog aktivnog administratora nije moguće deaktivirati, a jedinom aktivnom administratoru nije moguće promeniti ulogu.
- **Kartica „Profili agenata“** (administrator i menadžer): javni profil agenta, sa poljima „Fotografija“, „Ime i prezime“, „Zvanje“, „Biografija“, jezici, „Telefon“, „E-adresa“, Viber, WhatsApp, „Oblasti rada“, „Broj licence posrednika“ i prekidačem „Javni profil“. Nedeljne termine za razgledanja agent podešava u **Razgledanja → Dostupnost**; od njih zavisi zakazivanje na sajtu.

## Kako zameniti demo sadržaj

`seed:all` puni bazu izmišljenim primerima: oko 30 nekretnina, agente, lokacije, tekstove za magazin, stranice, preporuke, upite, razgledanja i kontakte. Demo nekretnine su izmišljene; fotografije su sa Unsplash-a, a demo 360° i 3D ture prikazuju tuđe prostore sa slobodnom licencom (CC0 i CC BY).

**Gde:** Admin → **Demo sadržaj** (`/admin/demo`, samo administrator). Tabela „Demo zapisi“ pokazuje broj demo zapisa po vrsti (Nekretnine, Upiti, Razgledanja, Kontakti, Magazin, Utisci, Stranice, Agenti, Lokacije). Dugme „Obriši sav demo sadržaj“ traži da upišete `OBRIŠI DEMO` (velikim slovima, sa Š), pa potvrdite dugmetom „Obriši demo sadržaj“. Brisanje teče u pozadini, u serijama, a brojevi se osvežavaju sami.

**Šta se briše:** demo nekretnine sa fotografijama, 360° scenama, 3D fajlovima i statistikom, kao i demo upiti, razgledanja, kontakti, tekstovi magazina, preporuke, stranice (osim pravnih), agenti i lokacije.

**Šta ostaje** (`convex/demo.ts`, `convex/lib/listingCascade.ts`):
- Podešavanja agencije; pravne podatke menjate sami (vidi „Pravni podaci firme“).
- Demo nekretnina koja ima otpremljene fajlove (fotografije, tlocrte, sliku za deljenje, 360° panorame ili 3D modele) ili na koju upućuje pravi upit ili razgledanje. Nekretnina prestaje da bude demo i kada joj u kartici „Pravno“ sačuvate pravog vlasnika („Sačuvaj vlasnika“). Kopija demo nekretnine („Dupliraj“) nije demo. Obična izmena teksta ne skida oznaku demo.
- Demo agent koga koristi neka nekretnina ili koji ima nalog, otvorenu pozivnicu, prave upite ili prava razgledanja. Agent koga izmenite, uključite ili isključite kao javni, ili mu promenite termine, postaje Vaš i ostaje.
- Demo lokacija koju koristi neka nekretnina ili koja ima podređene lokacije. Lokacija koju izmenite postaje Vaša i ostaje; ostale demo lokacije se brišu.
- Stranica u „Sadržaj sajta“ koju izmenite i sačuvate (oznaka „Demo sadržaj“ na njoj tada nestaje).
- Uvek, i bez čuvanja: „Politika privatnosti“, „Uslovi korišćenja“ (na sajtu „Uslovi poslovanja“) i „Kolačići“. Forme traže saglasnost sa politikom privatnosti, a baner za kolačiće vodi na nju, pa sajt ne sme da ostane bez njih. Dok ih ne sačuvate posle pregleda pravnika, u panelu su i dalje označene kao nacrt (demo), ali se ne broje u „Demo zapisi“.

Tekstovi magazina i preporuke ostaju demo i kada ih izmenite, pa se brišu.

**Pažnja, stranice:** seed pravi sve stranice iz „Sadržaj sajta“ kao demo stranice. Brisanje uklanja one koje niste sačuvali, osim tri pravne. Bez sačuvanog sadržaja sajt koristi ugrađene tekstove gde postoje (npr. na početnoj), a ostale delove izostavlja (npr. priču na stranici O nama). Zato pre brisanja sačuvajte svaku stranicu koju želite da zadržite.

**Oznake dok traje demo:**
- Dok podešavanja imaju probne vrednosti, administrator i menadžer na vrhu svakog ekrana panela vide baner „Podaci agencije su još probni.“, a podnožje sajta prikazuje „Prikazani su demo podaci. PIB, matični broj i broj iz Registra posrednika još nisu uneti.“
- Brojke na početnoj strani označene kao demo nose napomenu „Demo vrednosti — biće zamenjene stvarnim podacima agencije.“
- Demo ture imaju oznaku „Demo prikaz“, a demo agenti monogram umesto fotografije.

**Redosled zamene:**
1. **Podešavanja:** pravi pravni podaci i kontakti (vidi „Pravni podaci firme“).
2. **Tim → Profili agenata:** pravi agenti sa pravim fotografijama. Bez fotografije sajt prikazuje inicijale (monogram); fotografije sa foto-banke se ne koriste. Zatim ih pozovite u panel.
3. **Lokacije:** gradovi, opštine i naselja, uvodni tekstovi, fotografije i prosečne cene. Onlajn procena računa raspon iz polja „Prosečna cena prodaje (€/m²)“ izabranog kraja (ako ga kraj nema, iz opštine, pa iz grada).
4. **Nekretnine:** pravi oglasi (vidi „Kako dodati nekretninu“).
5. **Magazin:** sopstveni tekstovi („Novi tekst“), jer se demo tekstovi brišu i posle izmene.
6. **Sadržaj sajta:** tekstovi stranica na četiri jezika; četiri brojke na početnoj (samo stvarni podaci; oznaku demo sa brojke skidaju administrator i menadžer, i to tek posle promene vrednosti); prave preporuke klijenata uz njihovu saglasnost („Nova preporuka“, na sajtu tek posle „Potvrdi i objavi“); pravne stranice posle pregleda pravnika (tada uklonite blok „Napomena: nacrt“, koji se vidi samo u panelu).
7. **Demo sadržaj:** na kraju obrišite demo zapise.

## Kako dodati nekretninu

Nekretnine dodaju administrator, menadžer i agent (agent samo na svom profilu).

1. **Admin → Nekretnine → „Nova nekretnina“** (`/admin/nekretnine/nova`). Unesite „Transakcija“, „Tip nekretnine“, „Grad“, „Agent“ i „Naslov na srpskom“ (od 10 do 140 znakova), pa kliknite „Kreiraj nacrt“. Nekretnina počinje kao privatni nacrt i nije vidljiva na sajtu.
2. Otvara se uređivač sa devet kartica. Izmene se čuvaju same.
   - **Osnovno:** transakcija, tip, podtip, agent, „Ekskluzivno“, „Istaknuto na naslovnoj“ i „Vidljivost“ („Javna“, „Skrivena iz pretrage“, „Privatna“). Šifru (npr. ME-1042) panel dodeljuje sam.
   - **Lokacija:** grad, opština, naselje, ulica i broj, „Prikaz adrese na sajtu“ („Tačna adresa i pin“, „Samo ulica, približan pin“, „Samo naselje, približan pin“), pin na mapi (klik ili prevlačenje) i „Mesta u blizini“.
   - **Karakteristike:** kvadratura, struktura (broj soba; garsonjera je 0,5), sprat, gradnja, stanje, grejanje, parking, pogodnosti i useljenje.
   - **Cena:** cena (na oglasu stoji i cena po m²), kredit, PDV, uslovi zakupa, mesečni troškovi i tekst o proviziji za ovaj oglas. Istorija cene se beleži sama.
   - **Opis:** naslov, opis i istaknute stavke za svaki jezik (srpski, engleski, ruski, nemački), sa oznakama ● potpuno, ◐ delimično i ○ prazno. Dugme „Kopiraj iz srpskog“ kopira srpski tekst kao polazište za prevod. Kada prevod nedostaje, sajt prikazuje srpski tekst.
   - **Mediji:** fotografije, tlocrti i „Adresa videa“ (YouTube ili Vimeo).
   - **360° / 3D:** virtuelna tura i 3D šetnja (vidi ispod).
   - **Pravno:** uknjiženost, legalizacija, upotrebna dozvola, udeo i teret; „Ugovor o posredovanju“; „Dokumentacija proverena“ (posle provere lista nepokretnosti po čl. 16; oglas tada dobija oznaku „Verifikovana dokumentacija“); „Vlasnik“ (privatni kontakt prodavca, nikad na sajtu, čuva se dugmetom „Sačuvaj vlasnika“).
   - **SEO:** adresa oglasa (promena pravi trajno preusmerenje 301 sa stare adrese), naslov i opis za pretraživače po jeziku i slika za deljenje.

**Fotografije** (kartica Mediji, odeljak „Fotografije“):
- Kliknite „Dodajte fotografije“ ili prevucite fajlove u polje. Prihvataju se JPEG, PNG, WebP i AVIF, do 20 MB po fajlu i do 60 fajlova po nekretnini (posebno za fotografije, posebno za tlocrte). Fotografija čija je duža strana ispod 1600 px dobija upozorenje „Mala rezolucija“.
- Prva otpremljena fotografija je naslovna. Drugu birate zvezdicom „Postavi kao naslovnu“.
- Redosled menjate prevlačenjem (ili tastaturom: razmaknica ili Enter, strelice, pa ponovo razmaknica ili Enter).
- „Uredi opis“ otvara „Prostorija“ (po njoj se galerija na sajtu filtrira) i „Alt tekst“ za svaki jezik, do 160 znakova. Fotografija bez opisa na srpskom je označena.
- Za objavu je potrebno **najmanje 5 fotografija** i izabrana naslovna; preporučeno je 8 i više.

**Ugovor o posredovanju (čl. 18).** Kartica Pravno → „Ugovor o posredovanju“: „Broj ugovora“, „Vrsta ugovora“ (Ekskluzivni ili Neekskluzivni), „Početak“ i „Kraj“. Bez unetog ugovora koji važi danas objava je blokirana, jer zakon dozvoljava oglašavanje samo uz zaključen ugovor o posredovanju. Ugovor se ne prikazuje na sajtu. Kada do isteka ostane 14 dana ili manje, uređivač upozorava, a ugovor se pojavljuje na kontrolnoj tabli pod „Ugovori ističu u 14 dana“. Svakog dana u 03:00 UTC oglasi kojima je ugovor istekao sami se povlače sa sajta (status „Povučeno“).

**Kontrolna lista za objavu** (panel „Objava“, odeljak „Uslovi za objavu“, `convex/lib/checklist.ts`). Dugme „Objavi“ radi tek kada su ispunjeni svi uslovi:
- Ugovor o posredovanju je unet i važi
- Cena je uneta
- Lokacija i koordinate su unete
- Kvadratura je uneta
- Struktura (broj soba) je uneta (ne traži se za plac i garažu)
- Najmanje 5 fotografija
- Naslovna fotografija je izabrana
- Naslov na srpskom (najmanje 10 znakova)
- Opis na srpskom (najmanje 80 znakova)
- URL adresa je generisana
- Dodeljen je agent koji je vidljiv na sajtu
- Broj iz Registra posrednika je unet u Podešavanjima: dok su podešavanja probna, ovo je samo upozorenje; posle unosa pravih podataka blokira objavu.

Server proverava istu listu i kada menjate javni oglas: izmena koja bi oglas spustila ispod uslova se ne čuva.

**Statusi:** Nacrt, Na pregledu, Objavljeno, Rezervisano, Prodato, Izdato, Povučeno i Arhivirano. U panelu „Objava“ su, zavisno od statusa, dugmad „Objavi“ (ili „Objavi ponovo“), „Pošalji na pregled“, „Vrati u nacrt“, „Rezervisano“, „Prodato“ ili „Izdato“, „Povuci sa sajta“ i „Arhiviraj“. „Objavi“ postavlja vidljivost na „Javna“. Prodata ili izdata nekretnina ostaje na svojoj adresi sa oznakom, ali nestaje iz pretrage i ne prima upite; povučena vraća 404. U istom panelu su „Link za pregled“ (pregled neobjavljenog oglasa za tim), „Istorija cene“ i „Dupliraj“.

### 360° tura

Kartica **360° / 3D → „360° tura“ → „Izvor ture“**: „Nema“, „Sopstvene 360° panorame“, „Matterport“ ili „Kuula“, uz prekidač „Objavljeno na sajtu“.

- **Sopstvene 360° panorame:** „Dodaj scenu“ otprema ekvirektangularnu panoramu u razmeri 2:1 (npr. 8192 × 4096 px), u formatu JPEG, PNG, WebP ili AVIF, do 40 MB. Panorama koja nije 2:1 dobija upozorenje, jer će u turi izgledati izobličeno. Verziju za telefone (2048 × 1024) i sličicu panel pravi sam. Tura ima do 40 scena; prva scena je ulaz u turu, a redosled menjate prevlačenjem. U sceni unosite „Naziv scene“ (npr. Dnevna soba) i „Početni pogled“ („Postavi početni pogled“). Pod „Veze ka drugim scenama“ okrenite pregled ka vratima i kliknite „Dodaj vezu“: strelica se postavlja tamo gde je krstić (do 12 veza po sceni). Izmene čuva dugme „Sačuvaj scenu“.
- **Matterport ili Kuula:** za klijente koji već imaju takvu turu. Unesite „Adresa ture“ (`https://my.matterport.com/show/?m=…` ili `https://kuula.co/share/…`) ili samo ID. Na oglasu se tura učitava tek kada je posetilac pokrene.

### 3D šetnja

Odeljak „3D šetnja (Gaussian splat)“ je beta. Posetilac hoda tasterima W A S D i strelicama, gleda mišem, ide do tačke klikom na pod, na telefonu koristi džojstik i prelazi između prostorija. Pre preuzimanja sajt proverava uređaj; slabijem uređaju nudi 360° turu ili fotografije.

- **Modeli:** „Model za računar“ (obavezan za objavu šetnje), „Model za telefon“ (opciono; do milion tačaka i 15–20 MB), „Kolizioni model“ (opciono, obično GLB) i „Naslovna slika šetnje“. Formati: SPZ, SOG (zip ili raspakovan, adresa do `meta.json`), PLY, SPLAT, KSPLAT i GLB.
- **Otpremanje ili adresa:** model se može otpremiti u Convex do 200 MB, ali Convex prekida otpremanje posle 2 minuta, pa panel za fajlove veće od 50 MB preporučuje spoljno skladište, Cloudflare R2. Adresa modela se prihvata samo sa servera sa spiska `SPLAT_HOSTS` u `convex/lib/tours.ts` (isti spisak puni CSP). Sada su na spisku samo dva servera sa demo modelima, pa pre prvog modela na R2 programer dodaje R2 domen na spisak i ponovo objavljuje aplikaciju.
- **Kretanje:** „Visina pogleda“ (u jedinicama modela: 1,6 m × broj jedinica po metru), „Početna tačka“ (x, y (pod), z i „Smer“), „Tlocrt poda“, mnogougao unutar koga se posetilac kreće (do 64 tačke; klik dodaje tačku, prevlačenje je pomera; postoji i unos kao JSON), i „Prostorije za skok“ (do 12).
- **Ostalo:** „Autor snimka“ (kod CC BY licence obavezno sa vezom), „Generisano veštačkom inteligencijom“ (za model koji nije snimljen u stvarnom prostoru) i „Objavljeno na sajtu“.

Snimanje i obrada (360° kamera → MipMap, Scaniverse ili Postshot → čišćenje u SuperSplat → verzija za računar i za telefon) opisani su u `docs/06-3D-TOURS.md`.

## Pravni podaci firme

Admin → **Podešavanja** (`/admin/podesavanja`, ekran „Podešavanja agencije“, samo administrator), odeljak **„Pravni podaci agencije“**:

| Polje | Napomena |
|---|---|
| Naziv agencije (brend) | Ime koje posetioci vide na sajtu; stoji i uz broj iz Registra na svakom oglasu |
| Poslovno ime | Tačno kao u APR-u, npr. „… d.o.o. Beograd“; prikazuje se u podnožju |
| Adresa sedišta | U podnožju i na pravnim stranicama |
| PIB | Tačno 9 cifara; panel upozorava ako kontrolna cifra ne odgovara |
| Matični broj | Tačno 8 cifara |
| Broj upisa u Registar posrednika | Obavezan; prikazuje se uz svaki oglas i u podnožju |
| Osiguranje od profesionalne odgovornosti | Opciono: osiguravač i broj polise, u podnožju |

U istom ekranu su i „Kontakt“ (do 5 telefona, „E-pošta“, Viber, WhatsApp, koordinate kancelarije), „Radno vreme“, „Društvene mreže“ (Instagram, Facebook, LinkedIn, YouTube), „Provizija i opšti uslovi“ („Tekst o proviziji“ i „Opšti uslovi poslovanja (PDF)“, samo PDF do 15 MB), „Kalkulator kredita i kurs“, „Podrazumevani SEO“ i „Analitika i oglašavanje“ (Plausible, Google Analytics 4 i Meta Pixel; skripte se učitavaju tek kada posetilac pristane na kolačiće). Izmene se čuvaju dugmetom „Sačuvaj“ u traci na dnu ekrana.

**Zašto su obavezni.** Zakon o posredovanju u prometu i zakupu nepokretnosti, čl. 18, traži da svaki oglas sadrži poslovno ime posrednika i broj upisa u Registar posrednika, uz cenu, lokaciju, površinu i strukturu, i zabranjuje oglašavanje bez ugovora o posredovanju. Podatke o firmi u podnožju (naziv, adresa, PIB, MB, kontakt) traži i zakon o elektronskoj trgovini, čl. 6 (`docs/04-CONTENT.md`). Na sajtu, pored cene svakog oglasa stoji „{Naziv agencije} · Registar posrednika br. {broj}“, a poslovno ime, adresa, PIB i MB su u podnožju svake stranice i na pravnim stranicama.

**Dok su vrednosti probne.** Seed upisuje nule u PIB, matični broj i broj iz Registra. Dok je bar jedno od ta tri polja probno (same nule), podešavanja su u demo režimu (`convex/settingsAdmin.ts`):
- administrator i menadžer na svakom ekranu panela vide baner „Podaci agencije su još probni.“, a i ekran Podešavanja ima isto upozorenje;
- podnožje sajta prikazuje „Prikazani su demo podaci. PIB, matični broj i broj iz Registra posrednika još nisu uneti.“, a na oglasima i u podnožju stoje nule;
- stavka „Broj iz Registra posrednika je unet u Podešavanjima“ je samo upozorenje, pa se oglasi i dalje mogu objaviti.

Kada sačuvate prave vrednosti za sva tri polja, demo režim se završava, poruke nestaju, a objava od tada zahteva važeći broj iz Registra.

Demo režim prati samo ta tri broja. Poslovno ime, adresa sedišta, telefon, e-pošta, Viber, WhatsApp, radno vreme i lokacija kancelarije su takođe probni (npr. `office@mihajlo-estate.local`, `+381 11 000 0010`) i morate ih zameniti sami.

## Skripte

| Komanda | Šta radi |
|---|---|
| `npm run dev` | Dev server na http://localhost:3000. Pre pokretanja kopira MapLibre worker. |
| `npm run verify` | **Glavna provera:** Convex push → `next typegen` → `tsc` → eslint → `npm run check` → `next build`. Mora da završi sa izlaznim kodom 0. |
| `npm run check` | Provere repozitorijuma: `i18n:check`, `scripts/audit-convex.mjs`, `scripts/check-cn-tables.mjs` i jedinični testovi |
| `npm run test:unit` | Vitest: čisti moduli u `lib/` i Convex funkcije kroz convex-test (`convex/tests/`, `convex/lib/`); traje nekoliko sekundi |
| `npm run test:e2e` | Playwright na desktopu (1440 px) i na Pixel 7, nad `npm run start` (vidi „Testovi“) |
| `npm run i18n:check` | Četiri fajla `messages/*.json` moraju imati iste ključeve i iste ICU parametre |
| `npm run cn:tables` | Ponovo pravi `lib/cn-tables.ts`, tabele konflikata koje koristi `cn()`. Pokrenite ga posle dodavanja tokena teme ili nove vrste utility klase; `check-cn-tables` pada dok su tabele zastarele, a zastarele tabele tiho izbacuju klase |
| `npm run typecheck`, `npm run lint`, `npm run typegen`, `npm run convex:once` | Pojedinačni koraci komande `verify` |
| `npm run media:optimize` | Pretvara vlasnikove rendere iz `media-src/` u `public/media/` |
| `node scripts/audit-convex.mjs` | Statička provera svake Convex funkcije: validatori, `requireRole`, ograničenja učestalosti, bez `Date.now()` u upitima, bez `.collect()` |
| `node scripts/shots.mjs --routes /sr,/sr/nekretnine --widths 390,1440` | Snimci ekrana u `.shots/` (isto radi `npm run shots`; `scripts/admin-shots.mjs` snima ekrane panela). U Git Bash-u ispred komande dodajte `MSYS_NO_PATHCONV=1`. |
| `node scripts/seo-audit.mjs`, `node scripts/validate-jsonld.mjs`, `node scripts/qa-matrix.mjs --axe`, `node scripts/lighthouse.mjs`, `node scripts/vitals.mjs` | SEO, strukturirani podaci, matrica ruta × jezika × širina ekrana, Lighthouse i Web Vitals. Traže produkcijski server na :3000. |
| `node scripts/check-bundle-isolation.mjs` | Posle builda: pada ako početni JS neke rute sadrži Photo Sphere Viewer, three.js ili Spark |
| `node scripts/fetch-demo-tours.mjs`, `node scripts/verify-demo-media.mjs` | Ponovo pravi demo panorame; proverava (HEAD zahtevom) adresu svake demo fotografije |
| `node scripts/check-auth.mjs`, `node scripts/make-fixtures.mjs`, `node scripts/analyze-chunks.mjs` | Proverava Convex Auth prijavu na dev deploymentu (čita `night-run/state/admin.json`, ne ispisuje ga); pravi test fotografije u `tests/fixtures/`; posle builda ispisuje početne JS delove po ruti |

## Testovi

- **Jedinični testovi:** `npm run test:unit` (Vitest; Convex funkcije kroz convex-test u edge-runtime okruženju). Pokreću se i u `npm run check`, pa i u `npm run verify`.
- **Prevodi:** `npm run i18n:check` proverava da četiri fajla `messages/*.json` imaju iste ključeve i parametre.
- **End-to-end (Playwright):**
  1. `npm run build`. Testovi rade nad produkcijskim buildom, a `tests/e2e/global-setup.ts` odbija da krene kada `.next` ne postoji ili je stariji od izvornog koda. `E2E_ALLOW_STALE_BUILD=1` preskače tu proveru, a `PLAYWRIGHT_BASE_URL` šalje testove na drugi server.
  2. Zaustavite stari server na :3000. Playwright pokreće `npm run start`, ali koristi bilo koji server koji već sluša na tom portu.
  3. Dev deployment mora imati demo podatke (`seed:all`). Testovi koriste nekretnine ME-1042, ME-1048 i ME-1049, kao i prodatu ME-1063.
  4. Admin testovima treba administratorski nalog: `E2E_ADMIN_EMAIL` i `E2E_ADMIN_PASSWORD`, ili fajl `night-run/state/admin.json`.
  5. `npm run test:e2e`.

  Podaci koje testovi prave imaju prefiks `[E2E]` u naslovu i adrese `e2e+…@mihajlo-estate.local`, a testovi ih sami brišu.

## Struktura, bezbednost, poznata ograničenja

### Struktura

```
app/[locale]/…        javni sajt (root layout #1; folderi ruta imaju engleska imena, adrese su lokalizovane)
app/admin/…           panel (root layout #2; iscrtava se u pregledaču, pristup preko Convex Auth)
components/site|motion|map|tours|forms   javni UI
components/admin|ui   UI panela (shadcn u components/ui)
convex/               šema, javni upiti i forme, *Admin.ts funkcije za tim, lib/ pomoćne funkcije, seed/, tests/
hooks/                React hookovi (media query, smanjeno kretanje, hidratacija)
i18n/                 next-intl rutiranje (lokalizovane putanje) i podešavanje zahteva
lib/                  formatiranje, SEO/JSON-LD, CSP, parametri pretrage, kalkulatori, store-ovi
messages/             UI tekstovi: sr-Latn, en, ru, de
public/               fontovi, optimizovani mediji, demo panorame
tests/e2e/            Playwright testovi
scripts/              pomoćne skripte za build i provere
docs/                 brief, PRD, arhitektura, dizajn sistem, sadržaj, odluke, napredak, izveštaji
night-run/            skripte noćnog builda (ne menjaju se)
```

Namerno ne postoje `app/layout.tsx` i `app/page.tsx`. Proxy (`proxy.ts`) preusmerava `/` na jezik posetioca i prepisuje `/sr` na segment `sr-Latn`.

### Bezbednost

- Svaka Convex funkcija za tim poziva `requireRole()` iz `convex/lib/auth.ts`. Agent menja samo svoje nekretnine, upite i razgledanja. Admin UI je pomoć, a ne granica bezbednosti.
- Javni upiti vraćaju samo objavljene, javne podatke, kroz DTO-ove u `convex/lib/dto.ts`. Ugovor o posredovanju, kontakt vlasnika, tokeni za pregled i tačne koordinate (osim kada je „Prikaz adrese na sajtu“ postavljen na „Tačna adresa i pin“) nikada ne napuštaju server.
- Javne forme (upit, razgledanje, procena, prodaja, kontakt) traže saglasnost za obradu podataka i prolaze proveru honeypot polja. Ograničene su po sesiji, po e-adresi i globalno.
- Nalog se otvara samo uz važeću pozivnicu, a prijava se privremeno blokira posle 10 pogrešnih lozinki (vidi „Prijava u admin“).
- CSP i ostala bezbednosna zaglavlja su u `lib/csp.ts`.

### Poznata ograničenja

- **Obim pretrage:** pretraga, brojanje i tačke na mapi čitaju ograničene prozore indeksa (`convex/lib/search.ts`). Kada brojanje potroši prozor od 600 dokumenata, prikazuje se „N+“, a mapa prikazuje najviše 500 tačaka. Iznad otprilike 500 oglasa po transakciji sledeći korak je tanja tabela za pretragu (vidi `docs/DECISIONS.md`).
- **Zaštita od botova:** javne forme imaju ograničenje učestalosti i honeypot. Turnstile (ili drugi izazov) nije povezan, jer traži ključeve.
- **E-pošta:** slanje e-pošte nije povezano. Pozivnice se šalju ručno, a novi upiti stižu samo u Admin → Upiti, bez obaveštenja e-poštom.
- **3D modeli po adresi:** prihvataju se samo serveri sa spiska `SPLAT_HOSTS` (`convex/lib/tours.ts`); za Cloudflare R2 programer dodaje svoj domen na spisak.
- **Mape:** OpenFreeMap, bez ključa i bez SLA. Svaka mapa ima rezervni prikaz kada nije dostupna.
- **HSTS** se šalje samo kada je `VERCEL_ENV=production`.
- **`/styleguide`** je javan, ali ima `noindex` i zabranjen je u `robots.txt`.
- **Stranice 404:** stranice iz `notFound()` server vraća kao Next-ov okvir za grešku (status 404, `noindex` i lokalizovan naslov su ispravni; sadržaj se iscrtava u pregledaču). Vidi DECISIONS [13].
- **Pravni podaci:** broj iz Registra posrednika, PIB i MB u **Podešavanjima** su demo vrednosti dok ih vlasnik ne unese. Obavezni su pre puštanja sajta u rad (čl. 18).
- **Pravni tekstovi:** Politika privatnosti, Uslovi poslovanja i Politika kolačića su nacrti (blok „Napomena: nacrt“ vidi se samo u panelu) i pre objave ih mora pregledati pravnik.

## Produkcija

Produkcija još nije podešena; plan je Vercel uz produkcijski Convex deployment, a ceo postupak je u `docs/HANDOFF.md`. Ukratko: postavite `NEXT_PUBLIC_SITE_URL`, napravite auth ključeve produkcijskog deploymenta (`npx @convex-dev/auth --prod`) i `SITE_URL`, napravite prvog administratora sa `seed:createAdmin` i unesite prave podatke firme (PIB, MB, broj iz Registra) u **Podešavanjima**; dok ih ne unesete, podešavanja se vode kao demo. Velike 3D skenove čuvajte na spoljnom skladištu kao što je Cloudflare R2 (`docs/06-3D-TOURS.md`).

## English summary

- **What it is:** website and admin panel for a real-estate agency in Serbia (Belgrade first). Public site in Serbian Latin (`/sr`, default), English, Russian and German; Serbian admin at `/admin`, invite-only. Requirements: `docs/01-PRD.md`; architecture: `docs/02-ARCHITECTURE.md`; hard rules: `CLAUDE.md`.
- **Stack:** Next.js 16.3, React 19.2, TypeScript, Tailwind CSS 4, Convex 1.46 (Convex Auth, rate limiter), next-intl 4, GSAP + Lenis, shadcn/ui, MapLibre + OpenFreeMap, Photo Sphere Viewer 5, three.js + Spark 2, Playwright + Vitest/convex-test.
- **Run locally:** Node 22, npm, bash (Git Bash on Windows). `npm install`; `npx convex dev` in its own terminal (first run: log in and pick or create the dev deployment; it writes `.env.local`, see `.env.example`); `npx convex run seed:all '{}'`; `npm run dev` in a second terminal, then http://localhost:3000 (redirects to `/sr`).
- **Admin login:** http://localhost:3000/admin/login. The night-run admin's e-mail and password are in `night-run/state/admin.json` (local, gitignored, not in the repository). Change the password after the first login: user menu → "Promenite lozinku" (current password, new one of 10–128 characters, repeat; the account's other sessions are signed out). Ten wrong passwords temporarily block sign-in. First admin on a new deployment: `seed:createAdmin` fed from a JSON file outside the repository (password of 12+ characters).
- **Invites:** Admin → Tim → "Pozovite člana tima": e-mail, name, role (Administrator, Menadžer, Agent, Urednik; an Agent needs an agent profile). E-mail sending is not wired, so copy the link and send it yourself. Links last 7 days and work once; "Novi link" replaces one, "Opozovi" revokes it. Deactivate accounts in the "Korisnici" tab.
- **Demo removal:** Admin → Demo sadržaj (`/admin/demo`), type `OBRIŠI DEMO`. It deletes the `isDemo` records but keeps the settings, demo listings with uploads, real leads/viewings or a real owner, duplicated listings, agents and locations in use or edited, saved pages, and always the three legal pages (privacy, terms, cookies), which stay marked as drafts until saved. Save every other page you want to keep before the purge. Order: settings, agents (real photo or monogram, never stock faces), locations (their average €/m² feeds the online valuation), listings, journal, site content, then the purge.
- **Listings:** Admin → Nekretnine → "Nova nekretnina" creates a private draft; the editor autosaves and has nine tabs. Publishing needs a valid brokerage contract (Art. 18), price, map pin, area, rooms, 5+ photos with a cover, a Serbian title (10+ characters) and description (80+), a public agent and, once the settings are real, the registry number. Photos: JPEG/PNG/WebP/AVIF up to 20 MB, 60 per listing, alt text per locale.
- **Tours:** 360°: 2:1 panoramas up to 40 MB, up to 40 scenes with doorway links, or a Matterport/Kuula embed. 3D walk (beta): a splat uploaded (up to 200 MB; over 50 MB use R2) or linked from a host in `SPLAT_HOSTS`, plus floor polygon, start point and room jumps. Capture guide: `docs/06-3D-TOURS.md`.
- **Legal data:** Admin → Podešavanja → "Pravni podaci agencije" (brand, legal name, address, PIB 9 digits, MB 8 digits, registry number, insurance). The seeded zeros keep the site in demo mode (admin banner, footer notice, registry item only a warning) until real values are saved. Replace the other seeded contact data by hand.
- **Scripts and tests:** `npm run verify` must exit 0; `npm run test:unit`; `npm run i18n:check`. E2E: `npm run build` first (stale-build guard), free port 3000, seeded dev deployment, admin credentials from `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` or `admin.json`, then `npm run test:e2e`.
- **Deploy:** not set up yet (Vercel plus a Convex production deployment). Full guide: `docs/HANDOFF.md`.
