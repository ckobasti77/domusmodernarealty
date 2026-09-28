/**
 * Seeded content for the `pages` table plus the localized strings that live on
 * the settings singleton.
 *
 * Shape rules (must match `convex/lib/validators.ts::pageBlockV`):
 * - `sr` is the source of truth; `en` / `ru` / `de` are complete translations.
 * - HTML appears ONLY inside `richText` bodies, limited to
 *   `h3, p, ul, ol, li, strong, em, a, blockquote`. Every other string is plain
 *   text.
 * - `{{companyName}}`, `{{pib}}`, `{{mb}}`, `{{registryNo}}`, `{{address}}` and
 *   `{{email}}` are substituted by the renderer from the settings document.
 * - Numbers in `stats` are editable placeholders and carry `isDemo: true`.
 *   Nothing here claims a founding year, a sales record, an award or a person.
 * - Legal pages are drafts: the first block of each legal page opens with the
 *   "NACRT" warning required by `docs/04-CONTENT.md`.
 */

export type L10nText = { sr: string; en: string; ru: string; de: string };
export type L10nList = { sr: string[]; en: string[]; ru: string[]; de: string[] };

export type SeedBlock =
  | { type: "richText"; key: string; title?: L10nText; body: L10nText }
  | {
      type: "stats";
      key: string;
      items: { value: string; label: L10nText; isDemo: boolean }[];
    }
  | { type: "steps"; key: string; items: { title: L10nText; body: L10nText }[] }
  | { type: "faq"; key: string; items: { q: L10nText; a: L10nText }[] }
  | {
      type: "cta";
      key: string;
      heading: L10nText;
      sub?: L10nText;
      label: L10nText;
      href: string;
    }
  | {
      type: "media";
      key: string;
      image: { kind: "url"; url: string };
      caption?: L10nText;
    }
  | { type: "list"; key: string; title?: L10nText; items: L10nList };

export type SeedPage = {
  key:
    | "home"
    | "about"
    | "sell"
    | "valuation"
    | "contact"
    | "privacy"
    | "terms"
    | "cookies";
  blocks: SeedBlock[];
};

/** Mandatory warning on every seeded legal page (docs/04-CONTENT.md). */
const DRAFT_NOTICE_TITLE: L10nText = {
  sr: "NACRT — proveriti sa pravnikom pre objave",
  en: "DRAFT — to be reviewed by a lawyer before publication",
  ru: "ЧЕРНОВИК — проверить у юриста до публикации",
  de: "ENTWURF — vor Veröffentlichung juristisch prüfen lassen",
};

/** Four demo counters. Values are placeholders; labels come from 04-CONTENT. */
const DEMO_STATS: { value: string; label: L10nText; isDemo: boolean }[] = [
  {
    value: "12",
    label: {
      sr: "godina iskustva",
      en: "years of experience",
      ru: "лет опыта",
      de: "Jahre Erfahrung",
    },
    isDemo: true,
  },
  {
    value: "180",
    label: {
      sr: "prodatih nekretnina",
      en: "properties sold",
      ru: "проданных объектов",
      de: "verkaufte Immobilien",
    },
    isDemo: true,
  },
  {
    value: "300",
    label: {
      sr: "zadovoljnih klijenata",
      en: "satisfied clients",
      ru: "довольных клиентов",
      de: "zufriedene Kunden",
    },
    isDemo: true,
  },
  {
    value: "54",
    label: {
      sr: "dana do prodaje (prosek)",
      en: "days to sale (average)",
      ru: "дней до продажи (в среднем)",
      de: "Tage bis zum Verkauf (Durchschnitt)",
    },
    isDemo: true,
  },
];

/* ------------------------------------------------------------------- home */

const HOME: SeedPage = {
  key: "home",
  blocks: [
    {
      type: "richText",
      key: "hero",
      title: {
        sr: "Dom koji se pamti.",
        en: "A home you remember.",
        ru: "Дом, который запоминается.",
        de: "Ein Zuhause, das bleibt.",
      },
      body: {
        sr: "<p>Pažljivo odabrane nekretnine u Beogradu i širom Srbije — i savet koji traje duže od kupovine.</p>",
        en: "<p>Carefully chosen properties in Belgrade and across Serbia — and advice that outlasts the purchase.</p>",
        ru: "<p>Тщательно отобранная недвижимость в Белграде и по всей Сербии — и сопровождение, которое не заканчивается сделкой.</p>",
        de: "<p>Sorgfältig ausgewählte Immobilien in Belgrad und in ganz Serbien — und eine Beratung, die über den Kauf hinaus trägt.</p>",
      },
    },
    {
      type: "richText",
      key: "intro",
      body: {
        sr: "<p>Verujemo da se prava nekretnina ne bira, već prepoznaje. Zato biramo manje, proveravamo više i vodimo Vas kroz svaki korak — od prvog razgledanja do ključeva u ruci.</p>",
        en: "<p>We believe the right property is not so much chosen as recognised. So we take on less, check more, and guide you through every step — from the first viewing to the keys in your hand.</p>",
        ru: "<p>Мы убеждены: правильную недвижимость не столько выбирают, сколько узнают. Поэтому мы берём меньше объектов, проверяем больше и ведём Вас через каждый шаг — от первого просмотра до ключей в Вашей руке.</p>",
        de: "<p>Wir glauben, dass man die richtige Immobilie weniger auswählt als erkennt. Deshalb nehmen wir weniger Objekte an, prüfen mehr und begleiten Sie durch jeden Schritt — von der ersten Besichtigung bis zur Schlüsselübergabe.</p>",
      },
    },
    {
      type: "richText",
      key: "neighborhoodsIntro",
      title: {
        sr: "Poznajemo svaku ulicu.",
        en: "We know every street.",
        ru: "Мы знаем каждую улицу.",
        de: "Wir kennen jede Straße.",
      },
      body: {
        sr: "<p>Vračar, Dorćol, Senjak, Dedinje, Novi Beograd, Beograd na vodi, Zemun, Novi Sad. Za svaku lokaciju znamo kako zvuči ujutru, koliko se stoji u saobraćaju i koje zgrade drže vrednost. Pitajte nas o ulici, ne samo o kvadraturi.</p>",
        en: "<p>Vračar, Dorćol, Senjak, Dedinje, Novi Beograd, Beograd na vodi, Zemun, Novi Sad. For each of them we know how the morning sounds, how long the traffic takes and which buildings hold their value. Ask us about the street, not only the floor area.</p>",
        ru: "<p>Врачар, Дорчол, Сеньяк, Дедине, Нови-Белград, Белград на воде, Земун, Нови-Сад. О каждом районе мы знаем, как он звучит утром, сколько времени уходит на дорогу и какие дома держат цену. Спрашивайте нас об улице, а не только о площади.</p>",
        de: "<p>Vračar, Dorćol, Senjak, Dedinje, Novi Beograd, Beograd na vodi, Zemun, Novi Sad. Für jede Lage wissen wir, wie der Morgen klingt, wie lange man im Verkehr steht und welche Häuser ihren Wert halten. Fragen Sie uns nach der Straße, nicht nur nach der Wohnfläche.</p>",
      },
    },
    {
      type: "list",
      key: "services",
      title: {
        sr: "Kako Vam pomažemo",
        en: "How we help",
        ru: "Чем мы помогаем",
        de: "Wie wir Sie begleiten",
      },
      items: {
        sr: [
          "Kupovina — pronalazimo, proveravamo i pregovaramo za Vas.",
          "Prodaja — prava cena, prava publika, bez stresa.",
          "Zakup — pouzdani zakupci i uredni ugovori.",
          "Procena — realna vrednost na osnovu stvarnih transakcija.",
          "3D ture — nekretnina dostupna svakome, u svakom trenutku.",
          "Relokacija i dijaspora — kupovina iz inostranstva, bez putovanja.",
        ],
        en: [
          "Buying — we find, verify and negotiate on your behalf.",
          "Selling — the right price, the right audience, without the stress.",
          "Letting — dependable tenants and sound contracts.",
          "Valuation — a realistic figure based on actual transactions.",
          "3D tours — the property open to everyone, at any hour.",
          "Relocation and diaspora — buying from abroad, without the journey.",
        ],
        ru: [
          "Покупка — находим, проверяем и ведём переговоры для Вас.",
          "Продажа — верная цена, верная аудитория, без лишнего напряжения.",
          "Аренда — надёжные арендаторы и аккуратные договоры.",
          "Оценка — реальная стоимость на основе состоявшихся сделок.",
          "3D-туры — объект доступен каждому и в любое время.",
          "Релокация и диаспора — покупка из-за рубежа, без поездок.",
        ],
        de: [
          "Kauf — wir finden, prüfen und verhandeln für Sie.",
          "Verkauf — der richtige Preis, das richtige Publikum, ohne Stress.",
          "Vermietung — verlässliche Mieter und saubere Verträge.",
          "Bewertung — ein realistischer Wert auf Basis tatsächlicher Abschlüsse.",
          "3D-Touren — die Immobilie jederzeit für jeden zugänglich.",
          "Relokation und Diaspora — Kauf aus dem Ausland, ohne Anreise.",
        ],
      },
    },
    {
      type: "richText",
      key: "tours3d",
      title: {
        sr: "Prošetajte pre nego što dođete.",
        en: "Walk through before you arrive.",
        ru: "Пройдитесь ещё до визита.",
        de: "Ein Rundgang, bevor Sie anreisen.",
      },
      body: {
        sr: "<p>Virtuelne 360° ture i 3D šetnje za odabrane nekretnine. Pogledajte raspored, visinu plafona i pogled sa terase sa telefona ili računara, u bilo koje doba dana — i dođite na razgledanje kada ste sigurni.</p>",
        en: "<p>Virtual 360° tours and 3D walkthroughs for selected properties. Study the layout, the ceiling height and the view from the terrace on your phone or laptop, at any hour — and come to a viewing once you are sure.</p>",
        ru: "<p>Виртуальные 360°-туры и 3D-прогулки для отдельных объектов. Изучите планировку, высоту потолков и вид с террасы с телефона или компьютера в любое время — и приезжайте на просмотр, когда будете уверены.</p>",
        de: "<p>Virtuelle 360°-Touren und 3D-Rundgänge für ausgewählte Immobilien. Prüfen Sie Grundriss, Raumhöhe und den Blick von der Terrasse am Telefon oder am Rechner, zu jeder Tageszeit — und kommen Sie zur Besichtigung, wenn Sie sicher sind.</p>",
      },
    },
    {
      type: "steps",
      key: "process",
      items: [
        {
          title: {
            sr: "Upoznavanje i procena",
            en: "Introduction and valuation",
            ru: "Знакомство и оценка",
            de: "Kennenlernen und Bewertung",
          },
          body: {
            sr: "Obilazimo nekretninu, proveravamo dokumentaciju i predlažemo cenu zasnovanu na ostvarenim transakcijama u kraju.",
            en: "We visit the property, check the paperwork and propose a price grounded in completed transactions nearby.",
            ru: "Осматриваем объект, проверяем документы и предлагаем цену, основанную на состоявшихся сделках в районе.",
            de: "Wir besichtigen die Immobilie, prüfen die Unterlagen und schlagen einen Preis vor, der auf tatsächlichen Abschlüssen in der Umgebung beruht.",
          },
        },
        {
          title: {
            sr: "Priprema i fotografisanje",
            en: "Preparation and photography",
            ru: "Подготовка и фотосъёмка",
            de: "Vorbereitung und Fotografie",
          },
          body: {
            sr: "Savetujemo šta vredi urediti pre snimanja, a zatim dolaze fotograf i, po potrebi, snimanje tlocrta.",
            en: "We advise what is worth tidying before the shoot, then the photographer arrives, with a floor plan where useful.",
            ru: "Советуем, что стоит привести в порядок до съёмки, затем работает фотограф, при необходимости — обмер планировки.",
            de: "Wir sagen Ihnen, was sich vor dem Termin lohnt, danach kommt der Fotograf, bei Bedarf mit Grundrissaufnahme.",
          },
        },
        {
          title: {
            sr: "Marketing i 3D tura",
            en: "Marketing and the 3D tour",
            ru: "Маркетинг и 3D-тур",
            de: "Marketing und 3D-Tour",
          },
          body: {
            sr: "Oglas na četiri jezika, portali, naša baza kupaca i 3D tura koja štedi vreme i Vama i kupcu.",
            en: "A listing in four languages, the portals, our buyer database and a 3D tour that saves everyone time.",
            ru: "Объявление на четырёх языках, порталы, наша база покупателей и 3D-тур, который экономит время всем.",
            de: "Ein Angebot in vier Sprachen, die Portale, unsere Käuferdatei und eine 3D-Tour, die allen Zeit spart.",
          },
        },
        {
          title: {
            sr: "Razgledanja i pregovori",
            en: "Viewings and negotiation",
            ru: "Просмотры и переговоры",
            de: "Besichtigungen und Verhandlung",
          },
          body: {
            sr: "Vodimo razgledanja, prenosimo Vam svaku povratnu informaciju i pregovaramo o ceni i rokovima.",
            en: "We host the viewings, pass on every piece of feedback and negotiate price and timings.",
            ru: "Проводим просмотры, передаём Вам каждый отзыв и ведём переговоры о цене и сроках.",
            de: "Wir führen die Besichtigungen, geben Ihnen jede Rückmeldung weiter und verhandeln Preis und Termine.",
          },
        },
        {
          title: {
            sr: "Ugovor i primopredaja",
            en: "Contract and handover",
            ru: "Договор и передача",
            de: "Vertrag und Übergabe",
          },
          body: {
            sr: "Uz advokata i notara pripremamo ugovor, a na primopredaji zapisujemo stanje brojila i predaju ključeva.",
            en: "With a solicitor and a notary we prepare the contract; at handover we record the meter readings and the keys.",
            ru: "С адвокатом и нотариусом готовим договор, а при передаче фиксируем показания счётчиков и вручение ключей.",
            de: "Mit Anwalt und Notar bereiten wir den Vertrag vor; bei der Übergabe halten wir Zählerstände und Schlüssel fest.",
          },
        },
      ],
    },
    { type: "stats", key: "numbers", items: DEMO_STATS },
    {
      type: "cta",
      key: "valuationCta",
      heading: {
        sr: "Koliko vredi Vaš stan?",
        en: "What is your apartment worth?",
        ru: "Сколько стоит Ваша квартира?",
        de: "Was ist Ihre Wohnung wert?",
      },
      sub: {
        sr: "Besplatna procena za 2 minuta, bez obaveza.",
        en: "A free, no-obligation valuation in two minutes.",
        ru: "Бесплатная оценка за две минуты, без обязательств.",
        de: "Kostenlose Bewertung in zwei Minuten, ohne Verpflichtung.",
      },
      label: {
        sr: "Započni procenu",
        en: "Start the valuation",
        ru: "Начать оценку",
        de: "Bewertung starten",
      },
      href: "/valuation",
    },
    {
      type: "cta",
      key: "finalCta",
      heading: {
        sr: "Razgovarajmo.",
        en: "Let us talk.",
        ru: "Давайте поговорим.",
        de: "Sprechen wir darüber.",
      },
      sub: {
        sr: "Pozovite nas, pišite na Viber ili WhatsApp — odgovaramo istog dana.",
        en: "Call us, or write on Viber or WhatsApp — we reply the same day.",
        ru: "Позвоните нам или напишите в Viber или WhatsApp — отвечаем в тот же день.",
        de: "Rufen Sie uns an oder schreiben Sie über Viber oder WhatsApp — wir antworten am selben Tag.",
      },
      label: {
        sr: "Pišite nam",
        en: "Write to us",
        ru: "Напишите нам",
        de: "Schreiben Sie uns",
      },
      href: "/contact",
    },
  ],
};

/* ------------------------------------------------------------------ about */

const ABOUT: SeedPage = {
  key: "about",
  blocks: [
    {
      type: "richText",
      key: "story",
      title: {
        sr: "Ko smo i kako radimo",
        en: "Who we are and how we work",
        ru: "Кто мы и как мы работаем",
        de: "Wer wir sind und wie wir arbeiten",
      },
      body: {
        sr: "<p>Mihajlo Estate je agencija za nekretnine sa sedištem u Beogradu. Posredujemo u prodaji, zakupu i proceni stanova, kuća i poslovnih prostora u Beogradu i širom Srbije.</p><p>Radimo sa manjim brojem nekretnina nego što bi tržište dopuštalo. Nekretninu primamo u ponudu tek kada je vidimo iznutra, pročitamo list nepokretnosti i potvrdimo ko ima pravo da prodaje. Ako dokumentacija nije uredna, prvo kažemo šta treba rešiti, pa onda razgovaramo o oglasu.</p><p>Cenu predlažemo na osnovu ostvarenih transakcija u istoj ulici i istom tipu zgrade, a ne na osnovu želja. Oglas pišemo konkretno: kvadratura, orijentacija, sprat, grejanje, stanje instalacija i šta ostaje u stanu. Fotografišemo profesionalno, a za odabrane nekretnine snimamo i 360° turu, tako da kupac iz inostranstva vidi prostor pre puta.</p><p>Razgovaramo na srpskom, engleskom, ruskom i nemačkom. Na svaki upit odgovaramo u toku jednog radnog dana — i kada je odgovor da ova nekretnina nije za Vas.</p>",
        en: "<p>Mihajlo Estate is an estate agency based in Belgrade. We act as brokers in the sale, letting and valuation of apartments, houses and commercial premises in Belgrade and across Serbia.</p><p>We take on fewer properties than the market would allow. A property enters our portfolio only once we have seen it from the inside, read the title deed and confirmed who holds the right to sell. Where the paperwork is incomplete, we first set out what needs resolving, and only then discuss the listing.</p><p>Our price proposal rests on completed transactions in the same street and the same type of building, not on wishes. Listings are written in concrete terms: floor area, orientation, floor, heating, the state of the services, and what stays in the flat. Photography is professional, and selected properties are captured as a 360° tour, so a buyer abroad can see the space before travelling.</p><p>We work in Serbian, English, Russian and German. Every enquiry receives a reply within one working day — including when the answer is that a property is not right for you.</p>",
        ru: "<p>Mihajlo Estate — агентство недвижимости со штаб-квартирой в Белграде. Мы выступаем посредниками при продаже, аренде и оценке квартир, домов и коммерческих помещений в Белграде и по всей Сербии.</p><p>Мы берём в работу меньше объектов, чем позволил бы рынок. Объект попадает в нашу подборку только после того, как мы увидели его изнутри, изучили выписку из кадастра и подтвердили, кто вправе продавать. Если документы не в порядке, мы сначала говорим, что нужно устранить, и лишь затем обсуждаем объявление.</p><p>Цену мы предлагаем на основе состоявшихся сделок на той же улице и в домах того же типа, а не исходя из пожеланий. Объявление пишем конкретно: площадь, ориентация, этаж, отопление, состояние коммуникаций и то, что остаётся в квартире. Фотосъёмка профессиональная, а для отдельных объектов мы снимаем 360°-тур, чтобы покупатель из-за рубежа увидел пространство до поездки.</p><p>Мы говорим на сербском, английском, русском и немецком. На каждое обращение отвечаем в течение одного рабочего дня — в том числе когда ответ таков, что этот объект Вам не подходит.</p>",
        de: "<p>Mihajlo Estate ist eine Immobilienagentur mit Sitz in Belgrad. Wir vermitteln Verkauf, Vermietung und Bewertung von Wohnungen, Häusern und Gewerbeflächen in Belgrad und in ganz Serbien.</p><p>Wir nehmen weniger Objekte an, als der Markt zuließe. Eine Immobilie kommt erst dann in unser Angebot, wenn wir sie von innen gesehen, den Grundbuchauszug gelesen und die Verkaufsberechtigung geklärt haben. Sind die Unterlagen unvollständig, benennen wir zuerst die offenen Punkte und sprechen erst danach über das Angebot.</p><p>Unseren Preisvorschlag stützen wir auf abgeschlossene Verkäufe in derselben Straße und in vergleichbaren Häusern, nicht auf Wünsche. Angebote formulieren wir konkret: Wohnfläche, Ausrichtung, Etage, Heizung, Zustand der Installationen und was in der Wohnung bleibt. Fotografiert wird professionell; ausgewählte Objekte nehmen wir zusätzlich als 360°-Tour auf, damit Interessenten aus dem Ausland die Räume vor der Anreise sehen.</p><p>Wir beraten auf Serbisch, Englisch, Russisch und Deutsch. Jede Anfrage wird innerhalb eines Werktags beantwortet — auch dann, wenn die Antwort lautet, dass eine Immobilie nicht zu Ihnen passt.</p>",
      },
    },
    {
      type: "list",
      key: "values",
      title: {
        sr: "Šta nam je važno",
        en: "What matters to us",
        ru: "Что для нас важно",
        de: "Was uns wichtig ist",
      },
      items: {
        sr: [
          "Manje nekretnina, više provere — ne oglašavamo ono što nismo videli.",
          "Dokumentacija pre cene — list nepokretnosti i pravo prodaje proveravamo na početku.",
          "Cena iz podataka — predlog se oslanja na ostvarene transakcije, ne na osećaj.",
          "Bez skrivenih troškova — provizija i troškovi dogovaraju se pisano i unapred.",
          "Diskrecija — podatke o klijentima i nekretninama ne delimo bez dogovora.",
          "Odgovor u roku od jednog radnog dana, na četiri jezika.",
        ],
        en: [
          "Fewer properties, more checking — we do not advertise what we have not seen.",
          "Documents before price — we verify the title deed and the right to sell at the outset.",
          "A price from data — our proposal rests on completed transactions, not on a feeling.",
          "No hidden costs — commission and expenses are agreed in writing, in advance.",
          "Discretion — we do not share client or property details without agreement.",
          "A reply within one working day, in four languages.",
        ],
        ru: [
          "Меньше объектов, больше проверок — мы не рекламируем то, чего не видели сами.",
          "Документы прежде цены — выписку из кадастра и право на продажу проверяем в самом начале.",
          "Цена из данных — предложение опирается на состоявшиеся сделки, а не на ощущения.",
          "Без скрытых расходов — комиссия и издержки согласуются письменно и заранее.",
          "Конфиденциальность — сведения о клиентах и объектах не передаём без согласия.",
          "Ответ в течение одного рабочего дня, на четырёх языках.",
        ],
        de: [
          "Weniger Objekte, mehr Prüfung — wir bewerben nichts, was wir nicht selbst gesehen haben.",
          "Unterlagen vor Preis — Grundbuchauszug und Verkaufsberechtigung prüfen wir zu Beginn.",
          "Ein Preis aus Daten — unser Vorschlag beruht auf abgeschlossenen Verkäufen, nicht auf Gefühl.",
          "Keine versteckten Kosten — Provision und Auslagen werden vorab schriftlich vereinbart.",
          "Diskretion — Angaben zu Kunden und Objekten geben wir nicht ohne Absprache weiter.",
          "Antwort innerhalb eines Werktags, in vier Sprachen.",
        ],
      },
    },
    {
      type: "richText",
      key: "method",
      title: {
        sr: "Standardi rada",
        en: "Our standards",
        ru: "Стандарты работы",
        de: "Unsere Standards",
      },
      body: {
        sr: "<h3>Provera pre oglasa</h3><p>Pre nego što nekretnina izađe u oglas, pregledamo list nepokretnosti, rešenje o ozakonjenju ili upotrebnu dozvolu kada postoje, i proveravamo terete. Tu obavezu posrednik ima po članu 16. Zakona o posredovanju u prometu i zakupu nepokretnosti, a nama je ujedno i uslov za saradnju. Oglašavamo isključivo uz potpisan ugovor o posredovanju.</p><h3>Predstavljanje</h3><p>Jedan tekst, četiri jezika. Fotografije sa stativa i pripremljenim prostorom, tlocrt kada postoji, 360° tura za odabrane nekretnine. U svakom oglasu stoje cena, lokacija, kvadratura i struktura prostorija, kao i naš poslovni naziv i broj upisa u Registar posrednika.</p><h3>Posle potpisa</h3><p>Ostajemo dostupni i nakon primopredaje — za prijavu poreza na prenos apsolutnih prava, prepis brojila, pouzdane majstore i prvo iznajmljivanje. Savet koji tada damo ne naplaćujemo.</p>",
        en: "<h3>Checks before the listing</h3><p>Before a property is advertised we examine the title deed, the legalisation decision or occupancy permit where these exist, and check for charges. Article 16 of the Serbian Law on Real Estate Brokerage and Leasing places that duty on the broker; for us it is also a condition of working together. We advertise only on the basis of a signed brokerage agreement.</p><h3>Presentation</h3><p>One text, four languages. Photographs taken from a tripod in a prepared space, a floor plan where one exists, and a 360° tour for selected properties. Every listing states the price, location, floor area and room structure, together with our business name and our number in the register of brokers.</p><h3>After signing</h3><p>We remain available after handover — for the transfer-tax filing, the change of meter accounts, reliable tradespeople and a first letting. Advice at that stage is not charged for.</p>",
        ru: "<h3>Проверка до публикации</h3><p>Прежде чем объект появится в объявлении, мы изучаем выписку из кадастра, решение об узаконении или разрешение на эксплуатацию, если они есть, и проверяем обременения. Эту обязанность посредника устанавливает статья 16 сербского Закона о посредничестве при купле-продаже и аренде недвижимости, а для нас это ещё и условие сотрудничества. Мы публикуем объявление только при подписанном договоре о посредничестве.</p><h3>Подача объекта</h3><p>Один текст, четыре языка. Фотографии со штатива в подготовленном помещении, планировка, если она есть, и 360°-тур для отдельных объектов. В каждом объявлении указаны цена, район, площадь и структура помещений, а также наше фирменное наименование и номер в реестре посредников.</p><h3>После подписания</h3><p>Мы остаёмся на связи и после передачи объекта — для подачи налога на передачу прав, перевода счётчиков, поиска надёжных мастеров и первой сдачи в аренду. Эти консультации мы не оплачиваем счётом.</p>",
        de: "<h3>Prüfung vor der Veröffentlichung</h3><p>Bevor eine Immobilie beworben wird, sehen wir den Grundbuchauszug, den Legalisierungsbescheid oder die Nutzungsgenehmigung ein, soweit vorhanden, und prüfen Belastungen. Artikel 16 des serbischen Immobilienvermittlungsgesetzes weist dem Makler diese Pflicht zu; für uns ist sie zugleich Bedingung der Zusammenarbeit. Wir bewerben ausschließlich Objekte mit unterzeichnetem Maklervertrag.</p><h3>Darstellung</h3><p>Ein Text, vier Sprachen. Aufnahmen vom Stativ in vorbereiteten Räumen, ein Grundriss, soweit vorhanden, und eine 360°-Tour für ausgewählte Objekte. Jedes Angebot nennt Preis, Lage, Wohnfläche und Raumstruktur sowie unseren Firmennamen und unsere Nummer im Maklerregister.</p><h3>Nach der Unterschrift</h3><p>Auch nach der Übergabe bleiben wir erreichbar — für die Grunderwerbsteuererklärung, die Umschreibung der Zähler, verlässliche Handwerker und eine erste Vermietung. Diese Beratung stellen wir nicht in Rechnung.</p>",
      },
    },
  ],
};
