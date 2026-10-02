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
 * - Owner decisions (2026-09-28): the instant online estimate is indicative,
 *   from average prices in the area — only the on-site valuation by an agent
 *   may cite real transactions; the one reply-time promise is "Odgovaramo
 *   istog radnog dana, a najkasnije u roku od 24 sata."
 *
 * The `home` blocks are the landing's managed copy (`lib/content/pages.ts`
 * reads them, key by key). Their text is exactly the `home.*` strings of
 * `messages/*.json`, which stay as the landing's fallback: a seeded landing
 * renders identically with or without this page.
 */

export type L10nText = { sr: string; en: string; ru: string; de: string };
export type L10nList = {
  sr: string[];
  en: string[];
  ru: string[];
  de: string[];
};

export type SeedBlock =
  | { type: "richText"; key: string; title?: L10nText; body: L10nText }
  | {
      type: "stats";
      key: string;
      title?: L10nText;
      items: { value: string; label: L10nText; isDemo: boolean }[];
    }
  | {
      type: "steps";
      key: string;
      title?: L10nText;
      lede?: L10nText;
      items: { title: L10nText; body: L10nText }[];
    }
  | { type: "faq"; key: string; items: { q: L10nText; a: L10nText }[] }
  | {
      type: "cta";
      key: string;
      heading: L10nText;
      sub?: L10nText;
      note?: L10nText;
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
      en: "days to sell (average)",
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
        en: "A home to remember.",
        ru: "Дом, который запомнится.",
        de: "Ein Zuhause, das man nicht vergisst.",
      },
      body: {
        sr: "<p>Pažljivo odabrane nekretnine u Beogradu i širom Srbije — i savet koji traje duže od kupovine.</p>",
        en: "<p>Carefully selected properties in Belgrade and across Serbia — and advice that outlasts the purchase.</p>",
        ru: "<p>Тщательно отобранная недвижимость в Белграде и по всей Сербии — и совет, на который можно рассчитывать и после покупки.</p>",
        de: "<p>Sorgfältig ausgewählte Immobilien in Belgrad und in ganz Serbien – und eine Beratung, die nicht mit dem Kauf endet.</p>",
      },
    },
    {
      type: "richText",
      key: "intro",
      body: {
        sr: "<p>Verujemo da se prava nekretnina ne bira, već prepoznaje. Zato biramo manje, proveravamo više i vodimo Vas kroz svaki korak — od prvog razgledanja do ključeva u ruci.</p>",
        en: "<p>We believe the right property is not so much chosen as recognised. That is why we select fewer, check more and guide you through every step — from the first viewing to the keys in your hand.</p>",
        ru: "<p>Мы верим, что свой дом не выбирают, а узнают. Поэтому мы отбираем меньше, проверяем больше и сопровождаем Вас на каждом этапе — от первого просмотра до ключей в Ваших руках.</p>",
        de: "<p>Wir glauben, dass man die richtige Immobilie nicht auswählt, sondern erkennt. Deshalb wählen wir strenger aus, prüfen gründlicher und begleiten Sie bei jedem Schritt – von der ersten Besichtigung bis zur Schlüsselübergabe.</p>",
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
        sr: "<p>Od Vračara i Dorćola do Novog Beograda i Novog Sada — biramo kraj pre nego što biramo stan.</p>",
        en: "<p>From Vračar and Dorćol to Novi Beograd and Novi Sad — we choose the neighbourhood first, then the apartment.</p>",
        ru: "<p>От Врачара и Дорчола до Нови-Белграда и Нови-Сада — сначала мы выбираем район, а уже потом квартиру.</p>",
        de: "<p>Von Vračar und Dorćol bis Novi Beograd und Novi Sad – erst wählen wir das Viertel, dann die Wohnung.</p>",
      },
    },
    {
      type: "steps",
      key: "services",
      title: {
        sr: "Kako Vam pomažemo",
        en: "How we can help",
        ru: "Чем мы можем помочь",
        de: "Wie wir Sie unterstützen",
      },
      items: [
        {
          title: {
            sr: "Kupovina",
            en: "Buying",
            ru: "Покупка",
            de: "Kauf",
          },
          body: {
            sr: "Pronalazimo, proveravamo i pregovaramo za Vas. Vidite samo nekretnine koje su prošle našu proveru dokumentacije.",
            en: "We find, verify and negotiate on your behalf. You only see properties whose paperwork has passed our checks.",
            ru: "Находим, проверяем и ведём переговоры за Вас. Вы видите только объекты, документы которых прошли нашу проверку.",
            de: "Wir suchen, prüfen und verhandeln für Sie. Sie sehen nur Immobilien, deren Unterlagen unsere Prüfung bestanden haben.",
          },
        },
        {
          title: {
            sr: "Prodaja",
            en: "Selling",
            ru: "Продажа",
            de: "Verkauf",
          },
          body: {
            sr: "Prava cena, prava publika, bez stresa. Pripremamo nekretninu, fotografišemo i vodimo pregovore do potpisa.",
            en: "The right price, the right buyers, without the stress. We prepare the property, photograph it and see negotiations through to signing.",
            ru: "Справедливая цена, нужные покупатели и никакого стресса. Мы готовим объект, фотографируем его и ведём переговоры до подписания договора.",
            de: "Der richtige Preis, die richtigen Käufer, ohne Stress. Wir bereiten Ihre Immobilie vor, fotografieren sie und führen die Verhandlungen bis zur Unterschrift.",
          },
        },
        {
          title: {
            sr: "Zakup",
            en: "Letting",
            ru: "Аренда",
            de: "Vermietung",
          },
          body: {
            sr: "Pouzdani zakupci i uredni ugovori. Proveravamo svakog kandidata i vodimo primopredaju.",
            en: "Reliable tenants and sound tenancy agreements. We vet every applicant and manage the handover.",
            ru: "Надёжные арендаторы и грамотно составленные договоры. Мы проверяем каждого кандидата и проводим передачу объекта.",
            de: "Zuverlässige Mieter und saubere Verträge. Wir prüfen jeden Mietinteressenten und kümmern uns um die Übergabe.",
          },
        },
        {
          title: {
            sr: "Procena",
            en: "Valuation",
            ru: "Оценка",
            de: "Bewertung",
          },
          body: {
            sr: "Okvirna procena onlajn za dva minuta, a na terenu i detaljna analiza sa uporedivim prodajama iz Vašeg kraja.",
            en: "An indicative online estimate in two minutes, and a detailed on-site analysis drawing on comparable sales in your neighbourhood.",
            ru: "Ориентировочная онлайн-оценка за две минуты, а при выезде на объект — подробный анализ сопоставимых продаж в Вашем районе.",
            de: "Online erhalten Sie in zwei Minuten einen Richtwert, vor Ort eine detaillierte Analyse anhand vergleichbarer Verkäufe aus Ihrem Viertel.",
          },
        },
        {
          title: {
            sr: "3D ture",
            en: "3D tours",
            ru: "3D-туры",
            de: "3D-Touren",
          },
          body: {
            sr: "Nekretnina dostupna svakome, u svakom trenutku. 360° ture i 3D šetnje za odabrane nekretnine.",
            en: "A property anyone can visit, at any hour. 360° tours and 3D walkthroughs of selected properties.",
            ru: "Объект доступен каждому и в любое время. Туры 360° и 3D-прогулки по отобранным объектам.",
            de: "Die Immobilie, jederzeit und für jeden zugänglich. 360°-Touren und 3D-Rundgänge für ausgewählte Objekte.",
          },
        },
        {
          title: {
            sr: "Relokacija i dijaspora",
            en: "Relocation and diaspora",
            ru: "Релокация и диаспора",
            de: "Relocation und Diaspora",
          },
          body: {
            sr: "Kupovina iz inostranstva, bez putovanja. Razgledanja uživo preko video poziva i punomoćje uz našeg advokata.",
            en: "Buying from abroad, with no need to travel. Live viewings by video call, and power of attorney arranged through our lawyer.",
            ru: "Покупка из-за рубежа — без поездок. Просмотры в реальном времени по видеосвязи и оформление доверенности через нашего адвоката.",
            de: "Kauf aus dem Ausland, ohne Anreise. Sie besichtigen live per Videoanruf, die Vollmacht regeln wir mit unserem Anwalt.",
          },
        },
      ],
    },
    {
      type: "richText",
      key: "tours3d",
      title: {
        sr: "Prošetajte pre nego što dođete.",
        en: "Step inside before you arrive.",
        ru: "Прогуляйтесь по комнатам ещё до визита.",
        de: "Ein Rundgang, noch bevor Sie kommen.",
      },
      body: {
        sr: "<p>Virtuelne 360° ture i 3D šetnje za odabrane nekretnine.</p>",
        en: "<p>Virtual 360° tours and 3D walkthroughs of selected properties.</p>",
        ru: "<p>Виртуальные туры 360° и 3D-прогулки по отобранным объектам.</p>",
        de: "<p>Virtuelle 360°-Touren und 3D-Rundgänge für ausgewählte Immobilien.</p>",
      },
    },
    {
      type: "steps",
      key: "process",
      title: {
        sr: "Kako prodajemo",
        en: "How we sell",
        ru: "Как мы продаём",
        de: "Wie wir verkaufen",
      },
      lede: {
        sr: "Pet koraka od prvog razgovora do primopredaje ključeva. Na svakom znate šta sledi i ko Vas vodi.",
        en: "Five steps, from our first conversation to handing over the keys. At each step you know what comes next and who is guiding you.",
        ru: "Пять шагов от первого разговора до передачи ключей. На каждом этапе Вы знаете, что будет дальше и кто Вас сопровождает.",
        de: "Fünf Schritte vom ersten Gespräch bis zur Schlüsselübergabe. Bei jedem wissen Sie, was als Nächstes kommt und wer Sie begleitet.",
      },
      items: [
        {
          title: {
            sr: "Upoznavanje i procena",
            en: "First meeting and valuation",
            ru: "Знакомство и оценка",
            de: "Kennenlernen und Bewertung",
          },
          body: {
            sr: "Dolazimo na adresu, slušamo Vaš plan i dajemo realan raspon cene sa obrazloženjem.",
            en: "We visit the property, listen to your plans and give you a realistic price range, with the reasoning behind it.",
            ru: "Приезжаем на объект, выслушиваем Ваши планы и называем реалистичный диапазон цены с обоснованием.",
            de: "Wir besichtigen die Immobilie, hören uns Ihre Pläne an und nennen Ihnen eine realistische Preisspanne mit Begründung.",
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
            sr: "Sređujemo dokumentaciju, savetujemo šta vredi urediti i snimamo profesionalne fotografije.",
            en: "We put the paperwork in order, advise on what is worth refreshing and take professional photographs.",
            ru: "Приводим в порядок документы, подсказываем, что стоит обновить, и делаем профессиональные фотографии.",
            de: "Wir bringen die Unterlagen in Ordnung, beraten Sie dazu, was sich herzurichten lohnt, und erstellen professionelle Fotos.",
          },
        },
        {
          title: {
            sr: "Marketing i 3D tura",
            en: "Marketing and 3D tour",
            ru: "Маркетинг и 3D-тур",
            de: "Vermarktung und 3D-Tour",
          },
          body: {
            sr: "Oglas na četiri jezika, 360° tura ili 3D šetnja i ciljano oglašavanje prema kupcima iz zemlje i dijaspore.",
            en: "A listing in four languages, a 360° tour or a 3D walkthrough, and advertising targeted at buyers in Serbia and the diaspora.",
            ru: "Объявление на четырёх языках, тур 360° или 3D-прогулка и адресная реклама для покупателей из Сербии и диаспоры.",
            de: "Ein Exposé in vier Sprachen, eine 360°-Tour oder ein 3D-Rundgang sowie die gezielte Ansprache von Käufern in Serbien und in der Diaspora.",
          },
        },
        {
          title: {
            sr: "Razgledanja i pregovori",
            en: "Viewings and negotiation",
            ru: "Просмотры и переговоры",
            de: "Besichtigungen und Verhandlungen",
          },
          body: {
            sr: "Vodimo svako razgledanje, filtriramo ozbiljne kupce i pregovaramo u Vaše ime.",
            en: "We conduct every viewing, screen buyers for serious interest and negotiate on your behalf.",
            ru: "Проводим каждый просмотр, отбираем серьёзных покупателей и ведём переговоры от Вашего имени.",
            de: "Wir führen jede Besichtigung durch, treffen eine Vorauswahl ernsthafter Interessenten und verhandeln in Ihrem Namen.",
          },
        },
        {
          title: {
            sr: "Ugovor i primopredaja",
            en: "Contract and handover",
            ru: "Договор и передача ключей",
            de: "Vertrag und Übergabe",
          },
          body: {
            sr: "Uz advokata pripremamo ugovor, pratimo overu, poresku prijavu i predaju ključeva.",
            en: "We prepare the contract with a lawyer and oversee the notarisation, the tax filing and the handover of the keys.",
            ru: "Вместе с адвокатом готовим договор, сопровождаем нотариальное заверение, подачу налоговой декларации и передачу ключей.",
            de: "Gemeinsam mit einem Anwalt bereiten wir den Vertrag vor und begleiten die notarielle Beurkundung, die Meldung beim Finanzamt und die Schlüsselübergabe.",
          },
        },
      ],
    },
    {
      type: "stats",
      key: "numbers",
      title: {
        sr: "Rezultati koji se mere",
        en: "Results you can measure",
        ru: "Результаты, которые можно измерить",
        de: "Messbare Ergebnisse",
      },
      items: DEMO_STATS,
    },
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
        sr: "Okvirna procena za dva minuta, na osnovu prosečnih cena u Vašem kraju. Bez obaveza i bez poziva koje niste tražili.",
        en: "An indicative estimate in two minutes, based on average prices in your neighbourhood. No obligation, and no unsolicited calls.",
        ru: "Ориентировочная оценка за две минуты на основе средних цен в Вашем районе. Без обязательств и без звонков, о которых Вы не просили.",
        de: "Ein Richtwert in zwei Minuten, auf Basis der Durchschnittspreise in Ihrem Viertel. Unverbindlich und ohne unerwünschte Anrufe.",
      },
      note: {
        sr: "Želite tačniju cifru? Agent izlazi na teren besplatno i procenjuje na osnovu stvarnih transakcija iz Vašeg kraja.",
        en: "Would you like a more precise figure? An agent will visit your property free of charge and value it based on actual transactions in your neighbourhood.",
        ru: "Нужна более точная цифра? Агент бесплатно приедет на объект и оценит его на основе реальных сделок в Вашем районе.",
        de: "Sie möchten es genauer wissen? Einer unserer Makler bewertet Ihre Immobilie kostenlos vor Ort – anhand tatsächlich erzielter Verkaufspreise in Ihrem Viertel.",
      },
      label: {
        sr: "Započnite procenu",
        en: "Start your valuation",
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
        en: "Let's talk.",
        ru: "Поговорим.",
        de: "Kommen wir ins Gespräch.",
      },
      sub: {
        sr: "Pozovite nas ili pišite na Viber, WhatsApp ili e-poštu. Odgovaramo istog radnog dana, a najkasnije u roku od 24 sata.",
        en: "Call us, message us on Viber or WhatsApp, or email us. We reply the same working day, and within 24 hours at the latest.",
        ru: "Позвоните нам или напишите в Viber, WhatsApp или на электронную почту. Мы отвечаем в тот же рабочий день, самое позднее — в течение 24 часов.",
        de: "Rufen Sie uns an oder schreiben Sie uns per Viber, WhatsApp oder E-Mail. Wir antworten noch am selben Werktag, spätestens innerhalb von 24 Stunden.",
      },
      label: {
        sr: "Pošaljite upit",
        en: "Send an enquiry",
        ru: "Отправить запрос",
        de: "Anfrage senden",
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
        ru: "Кто мы и как работаем",
        de: "Wer wir sind und wie wir arbeiten",
      },
      body: {
        sr: "<p>Mihajlo Estate je agencija za nekretnine sa sedištem u Beogradu. Posredujemo u prodaji, zakupu i proceni stanova, kuća i poslovnih prostora u Beogradu i širom Srbije.</p><p>Radimo sa manjim brojem nekretnina nego što bi tržište dopuštalo. Nekretninu primamo u ponudu tek kada je vidimo iznutra, pročitamo list nepokretnosti i potvrdimo ko ima pravo da prodaje. Ako dokumentacija nije uredna, prvo kažemo šta treba rešiti, pa onda razgovaramo o oglasu.</p><p>Cenu predlažemo na osnovu ostvarenih transakcija u istoj ulici i istom tipu zgrade, a ne na osnovu želja. Oglas pišemo konkretno: kvadratura, orijentacija, sprat, grejanje, stanje instalacija i šta ostaje u stanu. Fotografišemo profesionalno, a za odabrane nekretnine snimamo i 360° turu, tako da kupac iz inostranstva vidi prostor pre puta.</p><p>Razgovaramo na srpskom, engleskom, ruskom i nemačkom. Na svaki upit odgovaramo — i kada je odgovor da ova nekretnina nije za Vas.</p>",
        en: "<p>Mihajlo Estate is an estate agency based in Belgrade. We act as brokers in the sale, letting and valuation of apartments, houses and commercial premises in Belgrade and across Serbia.</p><p>We take on fewer properties than the market would allow. A property enters our portfolio only once we have seen it from the inside, read the title deed and confirmed who holds the right to sell. Where the paperwork is incomplete, we first set out what needs resolving, and only then discuss the listing.</p><p>Our price proposal rests on completed transactions in the same street and the same type of building, not on wishes. Listings are written in concrete terms: floor area, orientation, floor, heating, the state of the services, and what stays in the flat. Photography is professional, and selected properties are captured as a 360° tour, so a buyer abroad can see the space before travelling.</p><p>We work in Serbian, English, Russian and German. We reply to every enquiry — including when the answer is that a property is not right for you.</p>",
        ru: "<p>Mihajlo Estate — агентство недвижимости с офисом в Белграде. Мы выступаем посредниками при продаже, аренде и оценке квартир, домов и коммерческих помещений в Белграде и по всей Сербии.</p><p>Мы берём в работу меньше объектов, чем позволил бы рынок. Объект попадает в нашу подборку только после того, как мы увидели его изнутри, изучили выписку из кадастра и подтвердили, кто вправе продавать. Если документы не в порядке, мы сначала говорим, что нужно устранить, и лишь затем обсуждаем объявление.</p><p>Цену мы предлагаем на основе состоявшихся сделок на той же улице и в домах того же типа, а не исходя из пожеланий. Объявление пишем конкретно: площадь, ориентация, этаж, отопление, состояние коммуникаций и то, что остаётся в квартире. Фотосъёмка профессиональная, а для отдельных объектов мы снимаем тур 360°, чтобы покупатель из-за рубежа увидел пространство до поездки.</p><p>Мы говорим на сербском, английском, русском и немецком. На каждое обращение мы отвечаем, даже если ответ один: этот объект Вам не подходит.</p>",
        de: "<p>Mihajlo Estate ist eine Immobilienagentur mit Sitz in Belgrad. Wir vermitteln Verkauf, Vermietung und Bewertung von Wohnungen, Häusern und Gewerbeflächen in Belgrad und in ganz Serbien.</p><p>Wir nehmen bewusst weniger Objekte auf, als der Markt zuließe. Eine Immobilie kommt erst dann in unser Angebot, wenn wir sie von innen gesehen, den Grundbuchauszug gelesen und die Verkaufsberechtigung geklärt haben. Sind die Unterlagen unvollständig, benennen wir zuerst die offenen Punkte und sprechen erst danach über das Inserat.</p><p>Unseren Preisvorschlag stützen wir auf abgeschlossene Verkäufe in derselben Straße und in vergleichbaren Häusern, nicht auf Wünsche. Inserate formulieren wir konkret: Wohnfläche, Ausrichtung, Etage, Heizung, Zustand der Installationen und was in der Wohnung bleibt. Fotografiert wird professionell; ausgewählte Objekte nehmen wir zusätzlich als 360°-Tour auf, damit Interessenten aus dem Ausland die Räume vor der Anreise sehen.</p><p>Wir beraten auf Serbisch, Englisch, Russisch und Deutsch. Wir antworten auf jede Anfrage — auch dann, wenn die Antwort lautet, dass eine Immobilie nicht zu Ihnen passt.</p>",
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
          "Cena iz podataka — predlog cene posle obilaska oslanja se na ostvarene transakcije, ne na osećaj.",
          "Bez skrivenih troškova — provizija i troškovi dogovaraju se pisano i unapred.",
          "Diskrecija — podatke o klijentima i nekretninama ne delimo bez dogovora.",
          "Brz odgovor, na četiri jezika — odgovaramo istog radnog dana, a najkasnije u roku od 24 sata.",
        ],
        en: [
          "Fewer properties, more checking — we do not advertise what we have not seen.",
          "Documents before price — we verify the title deed and the right to sell at the outset.",
          "A price from data — after a visit, our proposal rests on completed transactions, not on a feeling.",
          "No hidden costs — commission and expenses are agreed in writing, in advance.",
          "Discretion — we do not share client or property details without agreement.",
          "A quick reply, in four languages — we reply the same working day, and within 24 hours at the latest.",
        ],
        ru: [
          "Меньше объектов, больше проверок — мы не рекламируем то, чего не видели сами.",
          "Документы прежде цены — выписку из кадастра и право на продажу проверяем в самом начале.",
          "Цена из данных — после осмотра наше предложение опирается на состоявшиеся сделки, а не на ощущения.",
          "Без скрытых расходов — комиссия и издержки согласуются письменно и заранее.",
          "Конфиденциальность — сведения о клиентах и объектах не передаём без согласия.",
          "Быстрый ответ на четырёх языках — мы отвечаем в тот же рабочий день, самое позднее — в течение 24 часов.",
        ],
        de: [
          "Weniger Objekte, mehr Prüfung — wir bewerben nichts, was wir nicht selbst gesehen haben.",
          "Unterlagen vor Preis — Grundbuchauszug und Verkaufsberechtigung prüfen wir zu Beginn.",
          "Ein Preis aus Daten — nach der Besichtigung beruht unser Vorschlag auf abgeschlossenen Verkäufen, nicht auf Gefühl.",
          "Keine versteckten Kosten — Provision und Auslagen werden vorab schriftlich vereinbart.",
          "Diskretion — Angaben zu Kunden und Objekten geben wir nicht ohne Absprache weiter.",
          "Schnelle Antwort, in vier Sprachen — wir antworten noch am selben Werktag, spätestens innerhalb von 24 Stunden.",
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
        en: "<h3>Checks before the listing</h3><p>Before a property is advertised we examine the title deed, the legalization decision or occupancy permit where these exist, and check for charges. Article 16 of the Serbian Law on Real Estate Brokerage and Leasing places that duty on the broker; for us it is also a condition of working together. We advertise only on the basis of a signed brokerage agreement.</p><h3>Presentation</h3><p>One text, four languages. Photographs taken from a tripod in a prepared space, a floor plan where one exists, and a 360° tour for selected properties. Every listing states the price, location, floor area and room structure, together with our business name and our number in the register of brokers.</p><h3>After signing</h3><p>We remain available after handover — for the transfer-tax filing, the change of meter accounts, reliable tradespeople and a first letting. Advice at that stage is not charged for.</p>",
        ru: "<h3>Проверка до публикации</h3><p>Прежде чем объект появится в объявлении, мы изучаем выписку из кадастра, решение об узаконении или разрешение на эксплуатацию, если они есть, и проверяем обременения. Эту обязанность посредника устанавливает статья 16 сербского Закона о посредничестве при купле-продаже и аренде недвижимости, а для нас это ещё и условие сотрудничества. Мы публикуем объявление только при подписанном договоре о посредничестве.</p><h3>Подача объекта</h3><p>Один текст, четыре языка. Фотографии со штатива в подготовленном помещении, планировка, если она есть, и тур 360° для отдельных объектов. В каждом объявлении указаны цена, район, площадь и структура помещений, а также наше фирменное наименование и номер в реестре посредников.</p><h3>После подписания</h3><p>Мы остаёмся на связи и после передачи объекта — для подачи декларации по налогу на передачу прав, перевода счётчиков, поиска надёжных мастеров и первой сдачи в аренду. Плату за такие консультации мы не берём.</p>",
        de: "<h3>Prüfung vor der Veröffentlichung</h3><p>Bevor eine Immobilie beworben wird, sehen wir den Grundbuchauszug, den Legalisierungsbescheid oder die Nutzungsgenehmigung ein, soweit vorhanden, und prüfen Belastungen. Artikel 16 des serbischen Immobilienvermittlungsgesetzes weist dem Makler diese Pflicht zu; für uns ist sie zugleich Bedingung der Zusammenarbeit. Wir bewerben ausschließlich Objekte mit unterzeichnetem Maklervertrag.</p><h3>Darstellung</h3><p>Ein Text, vier Sprachen. Aufnahmen vom Stativ in vorbereiteten Räumen, ein Grundriss, soweit vorhanden, und eine 360°-Tour für ausgewählte Objekte. Jedes Angebot nennt Preis, Lage, Wohnfläche und Raumstruktur sowie unseren Firmennamen und unsere Nummer im Maklerregister.</p><h3>Nach der Unterschrift</h3><p>Auch nach der Übergabe bleiben wir erreichbar — für die Grunderwerbsteuererklärung, die Umschreibung der Zähler, verlässliche Handwerker und eine erste Vermietung. Diese Beratung stellen wir nicht in Rechnung.</p>",
      },
    },
  ],
};

/* ------------------------------------------------------------------- sell */

const SELL: SeedPage = {
  key: "sell",
  blocks: [
    {
      type: "richText",
      key: "lede",
      title: {
        sr: "Prodajte sa nama",
        en: "Sell with us",
        ru: "Продайте вместе с нами",
        de: "Mit uns verkaufen",
      },
      body: {
        sr: "<p>Vaša nekretnina ima jednu priliku da se predstavi pravim kupcima. Pripremamo je, fotografišemo i iznosimo na tržište sa cenom koja se može odbraniti podacima — a Vi u svakom trenutku znate šta se dešava.</p>",
        en: "<p>Your property has one chance to be introduced to the right buyers. We prepare it, photograph it and bring it to market at a price the data supports — and you always know where matters stand.</p>",
        ru: "<p>У Вашей недвижимости есть один шанс быть представленной подходящим покупателям. Мы готовим объект, фотографируем его и выводим на рынок с ценой, которую подтверждают данные, — и Вы всегда знаете, на каком этапе продажа.</p>",
        de: "<p>Ihre Immobilie hat nur eine Chance, sich den richtigen Käufern vorzustellen. Wir bereiten sie vor, fotografieren sie und bringen sie zu einem Preis auf den Markt, den die Daten tragen — und Sie wissen jederzeit, wie es steht.</p>",
      },
    },
    {
      type: "list",
      key: "benefits",
      title: {
        sr: "Šta dobijate",
        en: "What you receive",
        ru: "Что Вы получаете",
        de: "Was Sie erhalten",
      },
      items: {
        sr: [
          "Predlog cene posle obilaska, iz ostvarenih transakcija u Vašoj ulici i tipu zgrade.",
          "Provera dokumentacije pre oglasa, sa spiskom onoga što treba rešiti.",
          "Profesionalne fotografije, tlocrt i 360° tura za odabrane nekretnine.",
          "Oglas na srpskom, engleskom, ruskom i nemačkom — i za kupce iz dijaspore.",
          "Filtrirana razgledanja: dovodimo kupce koji su videli turu i mogu da plate.",
          "Pisani izveštaj o interesovanju i reakcijama sa svakog razgledanja.",
          "Pravna i poreska koordinacija do primopredaje, uz advokata i notara.",
        ],
        en: [
          "A price proposal after a visit, based on completed transactions in your street and building type.",
          "A documents check before the listing goes live, with a list of what needs resolving.",
          "Professional photography, a floor plan and a 360° tour for selected properties.",
          "A listing in Serbian, English, Russian and German — reaching buyers abroad too.",
          "Filtered viewings: we bring buyers who have seen the tour and can afford the purchase.",
          "A written report on enquiries and on the reactions from each viewing.",
          "Legal and tax coordination through to handover, with a lawyer and a notary.",
        ],
        ru: [
          "Предложение по цене после осмотра — на основе состоявшихся сделок на Вашей улице и в домах того же типа.",
          "Проверка документов до публикации объявления и перечень того, что нужно устранить.",
          "Профессиональные фотографии, планировка и тур 360° для отдельных объектов.",
          "Объявление на сербском, английском, русском и немецком — в том числе для покупателей за рубежом.",
          "Отфильтрованные просмотры: приводим покупателей, которые видели тур и располагают средствами.",
          "Письменный отчёт об обращениях и о реакциях после каждого просмотра.",
          "Юридическое и налоговое сопровождение до передачи объекта, с адвокатом и нотариусом.",
        ],
        de: [
          "Ein Preisvorschlag nach der Besichtigung, auf Basis abgeschlossener Verkäufe in Ihrer Straße und in vergleichbaren Häusern.",
          "Prüfung der Unterlagen vor der Veröffentlichung, mit einer Liste der offenen Punkte.",
          "Professionelle Fotos, Grundriss und 360°-Tour für ausgewählte Immobilien.",
          "Ein Inserat auf Serbisch, Englisch, Russisch und Deutsch — auch für Käufer im Ausland.",
          "Gefilterte Besichtigungen: Wir bringen Käufer, die die Tour gesehen haben und sich den Kauf leisten können.",
          "Ein schriftlicher Bericht über Anfragen und die Rückmeldungen jeder Besichtigung.",
          "Rechtliche und steuerliche Koordination bis zur Übergabe, mit Anwalt und Notar.",
        ],
      },
    },
    {
      type: "steps",
      key: "process",
      items: [
        {
          title: {
            sr: "Upoznavanje i procena",
            en: "First meeting and valuation",
            ru: "Знакомство и оценка",
            de: "Kennenlernen und Bewertung",
          },
          body: {
            sr: "Dolazimo u nekretninu, merimo i fotografišemo za internu evidenciju, pregledamo list nepokretnosti i uporedne transakcije. Na kraju dobijate raspon cene, predlog početne cene i procenu vremena do prodaje, u pisanoj formi.",
            en: "We visit the property, take measurements and reference photographs, read the title deed and compare recent transactions. You then receive a price range, a proposed asking price and an estimated time to sale, in writing.",
            ru: "Приезжаем на объект, делаем замеры и служебные фотографии, изучаем выписку из кадастра и сопоставимые сделки. В итоге Вы получаете диапазон цены, предложение по стартовой цене и оценку срока продажи в письменном виде.",
            de: "Wir besichtigen die Immobilie, nehmen Maße und interne Fotos auf, lesen den Grundbuchauszug und vergleichen aktuelle Abschlüsse. Anschließend erhalten Sie schriftlich eine Preisspanne, einen Angebotspreis und eine Einschätzung zur Verkaufsdauer.",
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
            sr: "Predlažemo šta vredi popraviti, rasvetliti ili ukloniti pre snimanja — obično su to sitnice koje menjaju prvi kadar. Zatim dolazi fotograf, a po potrebi snimamo i tlocrt i 360° turu.",
            en: "We suggest what is worth repairing, brightening or removing before the shoot — usually small things that change the first frame. The photographer follows, with a floor plan and a 360° tour where these help.",
            ru: "Подсказываем, что стоит починить, осветить или убрать до съёмки — обычно это мелочи, которые меняют первый кадр. Затем работает фотограф, при необходимости добавляем планировку и тур 360°.",
            de: "Wir sagen Ihnen, was sich vor dem Fototermin zu reparieren, aufzuhellen oder auszuräumen lohnt — meist Kleinigkeiten, die das erste Bild verändern. Danach fotografiert unser Fotograf, bei Bedarf mit Grundriss und 360°-Tour.",
          },
        },
        {
          title: {
            sr: "Marketing i 3D tura",
            en: "Marketing and 3D tour",
            ru: "Маркетинг и 3D-тур",
            de: "Marketing und 3D-Tour",
          },
          body: {
            sr: "Oglas pišemo na četiri jezika i objavljujemo na sajtu, na domaćim portalima i u našoj bazi kupaca. Kupci iz inostranstva prvo prolaze kroz 3D turu, pa se onda najavljuju za posetu.",
            en: "We write the listing in four languages and publish it on our website, on Serbian property portals and to our database of buyers. Buyers abroad take the 3D tour first and only then ask for a viewing.",
            ru: "Пишем объявление на четырёх языках и публикуем его на сайте, на сербских порталах и в нашей базе покупателей. Покупатели из-за рубежа сначала проходят 3D-тур и только затем записываются на просмотр.",
            de: "Wir verfassen das Inserat in vier Sprachen, veröffentlichen es auf unserer Website und auf serbischen Immobilienportalen und stellen es den Interessenten in unserer Kartei vor. Interessenten aus dem Ausland sehen sich zuerst die 3D-Tour an und melden sich erst dann zur Besichtigung.",
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
            sr: "Razgledanja vodimo sami, uvek uz prethodnu najavu i dogovoren termin. Posle svakog dobijate belešku sa reakcijama, a ponude i uslove plaćanja pregovaramo pisano, dok odluku donosite Vi.",
            en: "We host every viewing ourselves, always by appointment and with notice. After each one you receive a note on the reactions; offers and payment terms are negotiated in writing, and the decision is yours.",
            ru: "Просмотры проводим сами, всегда по записи и с предварительным уведомлением. После каждого Вы получаете краткий отчёт о реакциях покупателей; предложения и условия оплаты обсуждаем письменно, а решение принимаете Вы.",
            de: "Besichtigungen führen wir selbst durch, stets nach Absprache und zu einem festen Termin. Nach jeder erhalten Sie eine Notiz zu den Reaktionen; Angebote und Zahlungsbedingungen verhandeln wir schriftlich, die Entscheidung liegt bei Ihnen.",
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
            sr: "Pripremamo predugovor i ugovor sa advokatom, koordiniramo overu kod notara i uplatu kupoprodajne cene. Na primopredaji zapisujemo stanje brojila, predajemo ključeve i pomažemo oko prijave poreza.",
            en: "We prepare the preliminary contract and the contract with a lawyer, and coordinate notarisation and payment of the purchase price. At handover we record the meter readings, hand over the keys and help with the tax filing.",
            ru: "Готовим предварительный и основной договор вместе с адвокатом, согласуем заверение у нотариуса и оплату цены. При передаче фиксируем показания счётчиков, вручаем ключи и помогаем с налоговой декларацией.",
            de: "Wir erstellen Vorvertrag und Kaufvertrag mit einem Anwalt und koordinieren Beurkundung und Kaufpreiszahlung. Bei der Übergabe halten wir die Zählerstände fest, übergeben die Schlüssel und helfen bei der Steueranmeldung.",
          },
        },
      ],
    },
    {
      type: "faq",
      key: "faq",
      items: [
        {
          q: {
            sr: "Kolika je provizija?",
            en: "What is your commission?",
            ru: "Какова комиссия?",
            de: "Wie hoch ist die Provision?",
          },
          a: {
            sr: "Provizija se dogovara ugovorom o posredovanju i zavisi od vrste posla, cene i obima usluge. Važeća tarifa je deo naših Uslova poslovanja i dostupna je na zahtev, u PDF-u, pre potpisivanja. U ugovoru stoji tačan iznos, šta je uključeno i kada dospeva na plaćanje.",
            en: "The commission is agreed in the brokerage agreement and depends on the type of transaction, the price and the scope of the service. The current tariff forms part of our general terms of business and is available on request, as a PDF, before you sign. The agreement states the exact amount, what it includes and when it falls due.",
            ru: "Комиссия согласуется в договоре о посредничестве и зависит от вида сделки, цены и объёма услуг. Действующий тариф входит в наши условия сотрудничества и предоставляется по запросу в формате PDF до подписания. В договоре указаны точная сумма, состав услуг и срок оплаты.",
            de: "Die Provision wird im Maklervertrag vereinbart und richtet sich nach Art des Geschäfts, Preis und Leistungsumfang. Der geltende Tarif ist Teil unserer Allgemeinen Geschäftsbedingungen und steht auf Anfrage als PDF vor der Unterzeichnung zur Verfügung. Der Vertrag nennt den genauen Betrag, den Leistungsumfang und die Fälligkeit.",
          },
        },
        {
          q: {
            sr: "Da li tražite ekskluzivu?",
            en: "Do you require a sole agency agreement?",
            ru: "Нужен ли эксклюзивный договор?",
            de: "Verlangen Sie einen Alleinauftrag?",
          },
          a: {
            sr: "Radimo i sa ekskluzivnim i sa otvorenim ugovorom. Ekskluziva nam dopušta da ulažemo u pripremu, fotografiju i 3D turu i da cenu držimo na jednom mestu, pa je prodaja obično brža i mirnija. Rok je ograničen i uvek ga možete ne obnoviti.",
            en: "We work both with sole agency and with open agreements. A sole mandate lets us invest in preparation, photography and a 3D tour and keep a single price on the market, which usually makes the sale faster and calmer. The term is limited and you are always free not to renew it.",
            ru: "Мы работаем и по эксклюзивному, и по открытому договору. Эксклюзив позволяет нам вкладываться в подготовку, фотосъёмку и 3D-тур и держать единую цену на рынке, поэтому продажа обычно идёт быстрее и спокойнее. Срок ограничен, и Вы вправе его не продлевать.",
            de: "Wir arbeiten mit Alleinauftrag und mit einfachem Auftrag. Ein Alleinauftrag erlaubt es uns, in Vorbereitung, Fotografie und 3D-Tour zu investieren und einen einheitlichen Preis am Markt zu halten — das verläuft meist schneller und ruhiger. Die Laufzeit ist befristet, eine Verlängerung ist freiwillig.",
          },
        },
        {
          q: {
            sr: "Ko plaća fotografisanje i 3D turu?",
            en: "Who pays for the photography and the 3D tour?",
            ru: "Кто оплачивает фотосъёмку и 3D-тур?",
            de: "Wer zahlt Fotografie und 3D-Tour?",
          },
          a: {
            sr: "Fotografije, tlocrt i 360° turu snimamo o svom trošku za nekretnine koje smo primili u ponudu i ne naplaćujemo ih posebno. Snimanje traje dva do tri sata i najbolje uspeva u danu sa dovoljno svetla, pa termin dogovaramo prema orijentaciji stana.",
            en: "We commission the photography, the floor plan and the 360° tour at our own expense for the properties we take on, and we do not invoice them separately. A shoot takes two to three hours and works best in good daylight, so we set the time according to the orientation of the flat.",
            ru: "Фотосъёмку, планировку и тур 360° мы выполняем за свой счёт для объектов, которые берём в работу, и отдельно их не выставляем в счёт. Съёмка занимает два-три часа и удаётся при хорошем свете, поэтому время выбираем по ориентации квартиры.",
            de: "Fotografie, Grundriss und 360°-Tour übernehmen wir für die Objekte, die wir in unser Angebot aufnehmen, auf eigene Kosten und stellen sie nicht gesondert in Rechnung. Ein Termin dauert zwei bis drei Stunden und gelingt bei gutem Tageslicht, daher richten wir ihn nach der Ausrichtung der Wohnung.",
          },
        },
        {
          q: {
            sr: "Koliko traje prodaja?",
            en: "How long does a sale take?",
            ru: "Сколько длится продажа?",
            de: "Wie lange dauert ein Verkauf?",
          },
          a: {
            sr: "Zavisi od cene, lokacije i dokumentacije. Priprema i snimanje obično traju do nedelju dana, prva razgledanja počinju u prvih deset dana od objave, a od prihvaćene ponude do primopredaje najčešće prođe mesec do dva, uz kredit i duže. Ako posle tri nedelje nema ozbiljnih upita, zajedno menjamo cenu ili način predstavljanja.",
            en: "It depends on price, location and paperwork. Preparation and the shoot usually take up to a week, the first viewings begin within ten days of publication, and from an accepted offer to handover it is commonly one to two months, longer with a mortgage. If three weeks bring no serious enquiries, we revisit the price or the presentation together.",
            ru: "Это зависит от цены, района и документов. Подготовка и съёмка обычно занимают до недели, первые просмотры начинаются в течение десяти дней после публикации, а от принятого предложения до передачи объекта чаще всего проходит один-два месяца, с ипотекой — дольше. Если за три недели серьёзных обращений нет, мы вместе пересматриваем цену или подачу объекта.",
            de: "Das hängt von Preis, Lage und Unterlagen ab. Vorbereitung und Aufnahmen brauchen meist bis zu einer Woche, die ersten Besichtigungen beginnen innerhalb von zehn Tagen nach Veröffentlichung, und vom angenommenen Angebot bis zur Übergabe vergehen üblicherweise ein bis zwei Monate, mit Finanzierung länger. Bleiben nach drei Wochen ernsthafte Anfragen aus, prüfen wir gemeinsam Preis und Präsentation.",
          },
        },
      ],
    },
  ],
};

/* -------------------------------------------------------------- valuation */

const VALUATION: SeedPage = {
  key: "valuation",
  blocks: [
    {
      type: "richText",
      key: "lede",
      title: {
        sr: "Procena vrednosti",
        en: "Property valuation",
        ru: "Оценка стоимости",
        de: "Immobilienbewertung",
      },
      body: {
        sr: "<p>Naša online procena je okvirni raspon. Računa se iz prosečne cene po kvadratu u Vašem kraju, uz korekciju za stanje, sprat i lift.</p><p>To nije zvanično veštačenje i ne može se koristiti pred bankom, sudom ili poreskom upravom. Za kredit banka angažuje svog procenitelja, a za sudske i poreske potrebe potrebna je procena ovlašćenog sudskog veštaka.</p><p>Raspon je koristan za jednu odluku: da li ima smisla izaći na tržište sada i sa kojom cenom. Tačniji broj dobijate kada nekretninu vidimo — tada gledamo svetlo, orijentaciju, instalacije, zgradu i dokumentaciju i poredimo je sa stvarnim transakcijama iz Vašeg kraja, iz Registra cena nepokretnosti RGZ-a.</p>",
        en: "<p>Our online valuation is an indicative range. It is calculated from the average price per square metre in your neighbourhood, adjusted for condition, floor and lift.</p><p>It is not a formal appraisal and cannot be used with a bank, a court or the tax authority. For a mortgage the bank appoints its own valuer; for court or tax purposes you need a report from a licensed court expert.</p><p>The range is useful for one decision: whether it makes sense to come to market now, and at what price. A firmer figure follows once we have seen the property — then we look at the light, the orientation, the services, the building and the paperwork, and compare the property with actual transactions in your area from the property price register of the Republic Geodetic Authority (RGZ).</p>",
        ru: "<p>Наша онлайн-оценка — это ориентировочный диапазон. Он рассчитывается из средней цены за квадратный метр в Вашем районе с поправками на состояние, этаж и лифт.</p><p>Это не официальная экспертиза: такой расчёт нельзя предъявить банку, суду или налоговому органу. Для ипотеки банк привлекает своего оценщика, а для суда и налогов требуется отчёт лицензированного судебного эксперта.</p><p>Диапазон помогает решить одно: имеет ли смысл выходить на рынок сейчас и с какой ценой. Более точную цифру Вы получите после нашего осмотра — тогда мы смотрим на свет, ориентацию, коммуникации, дом и документы и сравниваем объект с реальными сделками в Вашем районе по данным реестра цен недвижимости RGZ.</p>",
        de: "<p>Unsere Online-Bewertung liefert eine grobe Wertspanne. Sie wird aus dem durchschnittlichen Quadratmeterpreis in Ihrem Viertel berechnet und an Zustand, Etage und Aufzug angepasst.</p><p>Sie ist kein offizielles Wertgutachten und lässt sich gegenüber Bank, Gericht oder Steuerbehörde nicht verwenden. Für eine Finanzierung bestellt die Bank ihren eigenen Gutachter; für Gericht und Steuer brauchen Sie das Gutachten eines gerichtlich zugelassenen Sachverständigen.</p><p>Die Spanne hilft bei einer Frage: Lohnt sich der Markteintritt jetzt, und zu welchem Preis? Eine belastbare Zahl folgt nach der Besichtigung — dann betrachten wir Licht, Ausrichtung, Installationen, Haus und Unterlagen und vergleichen die Immobilie mit tatsächlichen Verkäufen in Ihrem Viertel aus dem Immobilienpreisregister der serbischen Vermessungsbehörde (RGZ).</p>",
      },
    },
    {
      type: "list",
      key: "whatWeLookAt",
      title: {
        sr: "Šta gledamo",
        en: "What we look at",
        ru: "На что мы смотрим",
        de: "Worauf wir achten",
      },
      items: {
        sr: [
          "Lokacija i mikrolokacija — ulica, saobraćaj, škole, zelenilo, buka.",
          "Kvadratura i struktura — broj soba, raspored, upotrebljivost prostora.",
          "Sprat, lift i orijentacija — svetlo, pogled, nivo ulične buke.",
          "Godina gradnje i stanje — instalacije, stolarija, fasada, krov, zajednički delovi.",
          "Grejanje i energetska efikasnost — CG, EG, toplotna pumpa, mesečni računi.",
          "Dokumentacija — uknjiženost, ozakonjenje, upotrebna dozvola, tereti i suvlasništvo.",
        ],
        en: [
          "Location and micro-location — the street, transport, schools, greenery, noise.",
          "Floor area and layout — the number of rooms and how the space actually works.",
          "Floor, lift and orientation — daylight, outlook, street noise.",
          "Year of construction and condition — services, windows, façade, roof, common areas.",
          "Heating and energy efficiency — district or individual heating, heat pump, monthly bills.",
          "Paperwork — cadastral registration, legalization, occupancy permit, encumbrances and co-ownership.",
        ],
        ru: [
          "Расположение и микролокация — улица, транспорт, школы, зелень, шум.",
          "Площадь и планировка — число комнат, их расположение, функциональность пространства.",
          "Этаж, лифт и ориентация — свет, вид, уровень уличного шума.",
          "Год постройки и состояние — коммуникации, окна, фасад, крыша, общие части.",
          "Отопление и энергоэффективность — центральное, автономное, тепловой насос, счета.",
          "Документы — регистрация права, узаконение, разрешение на эксплуатацию, обременения и долевая собственность.",
        ],
        de: [
          "Lage und Mikrolage — Straße, Verkehr, Schulen, Grün, Lärm.",
          "Wohnfläche und Grundriss — Zimmerzahl, Anordnung, Nutzbarkeit.",
          "Etage, Aufzug und Ausrichtung — Tageslicht, Ausblick, Straßenlärm.",
          "Baujahr und Zustand — Installationen, Fenster, Fassade, Dach, Gemeinschaftsflächen.",
          "Heizung und Energieeffizienz — Fernwärme, Etagenheizung, Wärmepumpe, monatliche Kosten.",
          "Unterlagen — Grundbucheintrag, Legalisierung, Nutzungsgenehmigung, Belastungen und Miteigentum.",
        ],
      },
    },
    {
      type: "faq",
      key: "faq",
      items: [
        {
          q: {
            sr: "Da li je procena besplatna?",
            en: "Is the valuation free?",
            ru: "Оценка бесплатная?",
            de: "Ist die Bewertung kostenlos?",
          },
          a: {
            sr: "Online procena je besplatna i traje oko dva minuta. Procena na terenu je takođe bez naknade i bez obaveze da nam poverite prodaju: dolazimo u dogovoreno vreme i ostavljamo Vam raspon u pisanoj formi.",
            en: "The online valuation is free and takes about two minutes. An on-site valuation is free as well, with no obligation to instruct us: we come at a time that suits you and leave you the range in writing.",
            ru: "Онлайн-оценка бесплатна и занимает около двух минут. Выезд на объект тоже бесплатен и не обязывает Вас поручать нам продажу: приезжаем в удобное время и оставляем диапазон в письменном виде.",
            de: "Die Online-Bewertung ist kostenlos und dauert etwa zwei Minuten. Auch die Bewertung vor Ort ist kostenfrei und verpflichtet Sie nicht, uns den Verkauf zu übertragen: Wir kommen zum vereinbarten Termin, und Sie erhalten die Wertspanne schriftlich.",
          },
        },
        {
          q: {
            sr: "Koliko je procena precizna?",
            en: "How accurate is the valuation?",
            ru: "Насколько точна оценка?",
            de: "Wie genau ist die Bewertung?",
          },
          a: {
            sr: "Za standardan stan u kraju sa dovoljno podataka o cenama raspon je blizu tržišta. Kod netipičnih nekretnina — potkrovlja, adaptacija, neuknjiženih delova, kuća sa velikim placem — odstupanje je veće, pa procenu treba proveriti na terenu. Zato rezultat uvek dajemo kao interval, ne kao jedan broj.",
            en: "For a standard apartment in an area with plenty of price data, the range sits close to the market. For unusual properties — attic apartments, conversions, unregistered extensions, houses on large plots — the margin widens, so the figure should be checked on site. That is why the result is always an interval rather than a single number.",
            ru: "Для типовой квартиры в районе, по которому достаточно данных о ценах, диапазон близок к рынку. Для нетипичных объектов — мансард, перепланировок, незарегистрированных частей, домов с большим участком — разброс шире, и результат стоит проверить на месте. Поэтому мы всегда даём интервал, а не одно число.",
            de: "Bei einer üblichen Wohnung in einem Viertel mit ausreichend Preisdaten liegt die Spanne nah am Markt. Bei besonderen Objekten — Dachgeschossausbauten, Umnutzungen, nicht eingetragenen Teilen, Häusern mit großem Grundstück — wird sie breiter und sollte vor Ort geprüft werden. Deshalb nennen wir immer eine Spanne und keinen Einzelwert.",
          },
        },
        {
          q: {
            sr: "Šta se dešava sa mojim podacima?",
            en: "What happens to my data?",
            ru: "Что происходит с моими данными?",
            de: "Was geschieht mit meinen Daten?",
          },
          a: {
            sr: "Podatke iz formulara koristimo samo da izračunamo raspon i da Vam odgovorimo. Ne prodajemo ih i ne šaljemo trećim licima. Izbor novih nekretnina dobijate samo ako to posebno označite, a brisanje možete zatražiti u svakom trenutku na adresu iz Politike privatnosti.",
            en: "We use the details from the form only to calculate the range and to reply to you. We do not sell them or pass them to third parties. You receive our selection of new properties only if you tick that box, and you may request deletion at any time at the address given in our privacy policy.",
            ru: "Данные из формы мы используем только для расчёта диапазона и для ответа Вам. Мы их не продаём и не передаём третьим лицам. Подборку новых объектов присылаем лишь при Вашем отдельном согласии, а удаление Вы можете запросить в любой момент по адресу из политики конфиденциальности.",
            de: "Die Angaben aus dem Formular nutzen wir ausschließlich, um die Spanne zu berechnen und Ihnen zu antworten. Wir verkaufen sie nicht und geben sie nicht an Dritte weiter. Unsere Auswahl neuer Immobilien erhalten Sie nur, wenn Sie dies ausdrücklich wünschen; eine Löschung können Sie jederzeit über die in der Datenschutzerklärung genannte Adresse verlangen.",
          },
        },
      ],
    },
    {
      type: "cta",
      key: "bookOnSite",
      heading: {
        sr: "Procena na terenu, bez obaveze.",
        en: "An on-site valuation, with no obligation.",
        ru: "Оценка с выездом, без обязательств.",
        de: "Bewertung vor Ort, ohne Verpflichtung.",
      },
      sub: {
        sr: "Dolazimo u dogovoreno vreme, pregledamo nekretninu i dokumentaciju i ostavljamo raspon u pisanoj formi.",
        en: "We come at a time that suits you, review the property and the paperwork, and leave you the range in writing.",
        ru: "Приезжаем в удобное время, осматриваем объект и документы и оставляем диапазон в письменном виде.",
        de: "Wir kommen zum vereinbarten Termin, sehen uns Immobilie und Unterlagen an, und Sie erhalten die Wertspanne schriftlich.",
      },
      label: {
        sr: "Zakažite procenu",
        en: "Book a valuation",
        ru: "Записаться на оценку",
        de: "Termin vereinbaren",
      },
      href: "/contact",
    },
  ],
};

/* ---------------------------------------------------------------- contact */

const CONTACT: SeedPage = {
  key: "contact",
  blocks: [
    {
      type: "richText",
      key: "lede",
      title: {
        sr: "Kontakt",
        en: "Contact",
        ru: "Контакты",
        de: "Kontakt",
      },
      body: {
        sr: "<p>Najlakše je telefonom: na konkretno pitanje o nekretnini dobijate odgovor odmah. Pišite nam i na Viber, WhatsApp ili e-poštu. Odgovaramo istog radnog dana, a najkasnije u roku od 24 sata.</p><p>Ako tražite nekretninu koju još nemamo u ponudi, opišite šta Vam je važno: kraj, kvadratura, sprat, rok. Takve upite vodimo kao potražnju i javljamo se kada se pojavi odgovarajuća nekretnina, često pre objave oglasa.</p>",
        en: "<p>The telephone is quickest: a specific question about a property gets an answer straight away. You are equally welcome on Viber, WhatsApp or by email. We reply the same working day, and within 24 hours at the latest.</p><p>If you are looking for something we do not currently have, tell us what matters: the area, the floor area, the floor, your timing. We keep such requests on file and come back to you when a suitable property appears, often before it is advertised.</p>",
        ru: "<p>Быстрее всего по телефону: на конкретный вопрос об объекте Вы получите ответ сразу. Пишите также в Viber, WhatsApp или на электронную почту. Мы отвечаем в тот же рабочий день, самое позднее — в течение 24 часов.</p><p>Если Вы ищете объект, которого пока нет в нашей подборке, опишите, что для Вас важно: район, площадь, этаж, сроки. Такие запросы мы ведём отдельно и сообщаем, когда появляется подходящий вариант — часто до публикации объявления.</p>",
        de: "<p>Am schnellsten geht es telefonisch: Eine konkrete Frage zu einer Immobilie beantworten wir sofort. Ebenso erreichen Sie uns über Viber, WhatsApp oder per E-Mail. Wir antworten noch am selben Werktag, spätestens innerhalb von 24 Stunden.</p><p>Wenn Sie etwas suchen, das wir derzeit nicht im Angebot haben, beschreiben Sie uns, worauf es Ihnen ankommt: Viertel, Wohnfläche, Etage, Zeitrahmen. Solche Anfragen führen wir als Suchauftrag und melden uns, sobald eine passende Immobilie auftaucht — oft vor der Veröffentlichung.</p>",
      },
    },
    {
      type: "faq",
      key: "faq",
      items: [
        {
          q: {
            sr: "Kada ste dostupni?",
            en: "When are you available?",
            ru: "Когда Вы доступны?",
            de: "Wann sind Sie erreichbar?",
          },
          a: {
            sr: "Kancelarija radi radnim danima i subotom pre podne; tačno radno vreme stoji u podnožju sajta. Razgledanja zakazujemo i van tog vremena — uveče ili nedeljom — kada tako odgovara i Vama i prodavcu.",
            en: "The office is open on weekdays and on Saturday mornings; the exact hours are in the footer of this site. Viewings can be arranged outside those hours — in the evening or on a Sunday — whenever that suits both you and the seller.",
            ru: "Офис работает по рабочим дням и в субботу до полудня; точные часы указаны в нижней части сайта. Просмотры возможны и вне этого времени — вечером или в воскресенье, — если так удобно Вам и продавцу.",
            de: "Das Büro ist an Werktagen und samstagvormittags geöffnet; die genauen Zeiten stehen im Fußbereich dieser Seite. Besichtigungen vereinbaren wir auch außerhalb dieser Zeiten — abends oder sonntags —, wenn es Ihnen und der Verkäuferseite passt.",
          },
        },
        {
          q: {
            sr: "Na kojim jezicima razgovarate?",
            en: "Which languages do you speak?",
            ru: "На каких языках Вы говорите?",
            de: "Welche Sprachen sprechen Sie?",
          },
          a: {
            sr: "Srpski, engleski, ruski i nemački. Oglasi, opisi i ugovorna dokumentacija dostupni su na sva četiri jezika, a za overu kod notara organizujemo sudskog prevodioca kada je potreban.",
            en: "Serbian, English, Russian and German. Listings, descriptions and contract documents are available in all four, and for notarisation we arrange a court interpreter where one is required.",
            ru: "На сербском, английском, русском и немецком. Объявления, описания и договорные документы доступны на всех четырёх языках, а для заверения у нотариуса при необходимости приглашаем судебного переводчика.",
            de: "Serbisch, Englisch, Russisch und Deutsch. Angebote, Beschreibungen und Vertragsunterlagen liegen in allen vier Sprachen vor; für die notarielle Beurkundung organisieren wir bei Bedarf einen gerichtlich bestellten Übersetzer.",
          },
        },
        {
          q: {
            sr: "Koliko brzo odgovarate?",
            en: "How quickly do you reply?",
            ru: "Как быстро Вы отвечаете?",
            de: "Wie schnell antworten Sie?",
          },
          a: {
            sr: "Odgovaramo istog radnog dana, a najkasnije u roku od 24 sata. Ako je pitanje složeno — dokumentacija, kredit, kupovina iz inostranstva — prvo potvrdimo prijem i kažemo kada možete očekivati potpun odgovor.",
            en: "We reply the same working day, and within 24 hours at the latest. If the question is involved — paperwork, a mortgage, buying from abroad — we confirm receipt first and tell you when to expect a full answer.",
            ru: "Мы отвечаем в тот же рабочий день, самое позднее — в течение 24 часов. Если вопрос сложный — документы, ипотека, покупка из-за рубежа, — сначала подтверждаем получение и сообщаем, когда ждать полный ответ.",
            de: "Wir antworten noch am selben Werktag, spätestens innerhalb von 24 Stunden. Bei umfangreicheren Fragen — Unterlagen, Finanzierung, Kauf aus dem Ausland — bestätigen wir zuerst den Eingang und nennen Ihnen, wann Sie eine vollständige Antwort erhalten.",
          },
        },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- privacy */

const PRIVACY: SeedPage = {
  key: "privacy",
  blocks: [
    {
      type: "richText",
      key: "notice",
      title: DRAFT_NOTICE_TITLE,
      body: {
        sr: "<p>Ovaj tekst je radna verzija, pripremljena kao osnova za Politiku privatnosti i usklađena sa Zakonom o zaštiti podataka o ličnosti („ZZPL”). Pre objave treba da ga proveri advokat, a podaci o rukovaocu moraju se dopuniti stvarnim podacima agencije.</p><p>Rokovi čuvanja navedeni u ovom nacrtu su predlog i moraju se uskladiti sa stvarnom praksom agencije i mišljenjem advokata pre objave. Spisak obrađivača i zemalja u koje se podaci prenose treba dopuniti pre objave.</p><p>Politika se odnosi na sajt {{companyName}} i na obradu podataka koji nam dolaze preko formulara, telefona, e-pošte i poruka.</p>",
        en: "<p>This text is a working draft, prepared as the basis for a privacy policy and aligned with the Serbian Personal Data Protection Act (ZZPL). It must be reviewed by a lawyer before publication, and the controller's details must be completed with the agency's actual data.</p><p>The retention periods in this draft are a proposal and must be reconciled with the agency's actual practice and with legal advice before publication. The list of processors and of the countries data is transferred to must be completed before publication.</p><p>The policy covers the {{companyName}} website and the processing of data reaching us through forms, telephone, email and messaging apps.</p>",
        ru: "<p>Этот текст — рабочая версия, подготовленная как основа политики конфиденциальности и приведённая в соответствие с сербским Законом о защите персональных данных («ZZPL»). До публикации его должен проверить юрист, а сведения об операторе необходимо заполнить фактическими данными агентства.</p><p>Сроки хранения, указанные в этом черновике, являются предложением и до публикации должны быть согласованы с фактической практикой агентства и с юристом. Перечень обработчиков и стран, в которые передаются данные, необходимо дополнить до публикации.</p><p>Политика распространяется на сайт {{companyName}} и на обработку данных, поступающих к нам через формы, по телефону, электронной почте и в мессенджерах.</p>",
        de: "<p>Dieser Text ist eine Arbeitsfassung als Grundlage für eine Datenschutzerklärung, abgestimmt auf das serbische Datenschutzgesetz („ZZPL“). Vor der Veröffentlichung ist eine juristische Prüfung erforderlich; die Angaben zum Verantwortlichen sind mit den tatsächlichen Daten der Agentur zu ergänzen.</p><p>Die Speicherfristen in diesem Entwurf sind ein Vorschlag und müssen vor der Veröffentlichung mit der tatsächlichen Praxis der Agentur und mit juristischem Rat abgeglichen werden. Die Liste der Auftragsverarbeiter und der Länder, in die Daten übermittelt werden, ist vor der Veröffentlichung zu ergänzen.</p><p>Die Erklärung gilt für die Website von {{companyName}} und für die Verarbeitung von Daten, die uns über Formulare, telefonisch, per E-Mail und über Messenger erreichen.</p>",
      },
    },
    {
      type: "richText",
      key: "controller",
      title: {
        sr: "Rukovalac podacima",
        en: "Data controller",
        ru: "Оператор данных",
        de: "Verantwortlicher",
      },
      body: {
        sr: "<h3>Rukovalac</h3><p><strong>{{companyName}}</strong>, {{address}}, Republika Srbija.</p><ul><li>PIB: {{pib}}</li><li>Matični broj: {{mb}}</li><li>Broj upisa u Registar posrednika: {{registryNo}}</li><li>E-pošta za pitanja o podacima: {{email}}</li></ul><p>Rukovalac odlučuje o svrsi i načinu obrade podataka opisanih u ovoj politici. Ako za pojedine obrade bude imenovano lice za zaštitu podataka o ličnosti, njegovi kontakt podaci biće objavljeni na ovom mestu.</p>",
        en: "<h3>Controller</h3><p><strong>{{companyName}}</strong>, {{address}}, Republic of Serbia.</p><ul><li>Tax number (PIB): {{pib}}</li><li>Company number (MB): {{mb}}</li><li>Register of brokers, entry number: {{registryNo}}</li><li>Email for data enquiries: {{email}}</li></ul><p>The controller determines the purposes and means of the processing described in this policy. Should a data protection officer be appointed for any of it, their contact details will be published here.</p>",
        ru: "<h3>Оператор</h3><p><strong>{{companyName}}</strong>, {{address}}, Республика Сербия.</p><ul><li>Налоговый номер (PIB): {{pib}}</li><li>Регистрационный номер (MB): {{mb}}</li><li>Номер записи в реестре посредников: {{registryNo}}</li><li>Электронная почта по вопросам данных: {{email}}</li></ul><p>Оператор определяет цели и способы обработки, описанной в этой политике. Если для отдельных процессов будет назначено ответственное лицо по защите данных, его контакты будут опубликованы здесь.</p>",
        de: "<h3>Verantwortlicher</h3><p><strong>{{companyName}}</strong>, {{address}}, Republik Serbien.</p><ul><li>Steuernummer (PIB): {{pib}}</li><li>Registernummer (MB): {{mb}}</li><li>Eintragsnummer im Maklerregister: {{registryNo}}</li><li>E-Mail für Datenschutzanfragen: {{email}}</li></ul><p>Der Verantwortliche entscheidet über Zwecke und Mittel der in dieser Erklärung beschriebenen Verarbeitung. Wird für einzelne Verarbeitungen ein Datenschutzbeauftragter bestellt, werden dessen Kontaktdaten hier veröffentlicht.</p>",
      },
    },
    {
      type: "richText",
      key: "purposes",
      title: {
        sr: "Svrhe obrade",
        en: "Purposes of processing",
        ru: "Цели обработки",
        de: "Zwecke der Verarbeitung",
      },
      body: {
        sr: "<h3>Zašto obrađujemo podatke</h3><ul><li><strong>Odgovor na upit</strong> — ime, e-pošta, telefon i tekst poruke koje ostavite u formularu za upit, zakazivanje razgledanja, procenu ili prijavu nekretnine za prodaju.</li><li><strong>Zakazivanje i vođenje razgledanja</strong> — termin, adresa nekretnine i podaci za kontakt.</li><li><strong>Procena vrednosti</strong> — podaci o nekretnini koje sami unesete (kraj, kvadratura, sprat, stanje, godina gradnje).</li><li><strong>Izvršenje ugovora o posredovanju</strong> — podaci neophodni za zaključenje i izvršenje ugovora, uključujući dokumentaciju o nekretnini.</li><li><strong>Obaveštenja o novim nekretninama</strong> — samo ako ste posebno označili tu saglasnost.</li><li><strong>Bezbednost i statistika sajta</strong> — tehnički zapisi i merenje posećenosti, u obimu opisanom u Politici kolačića.</li></ul><p>Podatke ne koristimo za automatizovano odlučivanje koje proizvodi pravne posledice, niti za profilisanje van opisanih svrha.</p>",
        en: "<h3>Why we process your data</h3><ul><li><strong>Answering enquiries</strong> — the name, email address, telephone number and message you leave in the enquiry, viewing, valuation or sell-your-property form.</li><li><strong>Arranging and conducting viewings</strong> — the appointment, the property address and your contact details.</li><li><strong>Valuations</strong> — the property details you enter yourself (area, floor area, floor, condition, year of construction).</li><li><strong>Performing the brokerage agreement</strong> — the data required to conclude and perform the agreement, including the property documentation.</li><li><strong>Notifications about new properties</strong> — only where you have given that separate consent.</li><li><strong>Site security and statistics</strong> — technical logs and audience measurement, to the extent described in our cookie policy.</li></ul><p>We do not use your data for automated decision-making with legal effect, nor for profiling beyond the purposes described here.</p>",
        ru: "<h3>Для чего мы обрабатываем данные</h3><ul><li><strong>Ответ на обращение</strong> — имя, адрес электронной почты, телефон и текст сообщения, которые Вы указываете в форме обращения, записи на просмотр, оценки или заявки на продажу.</li><li><strong>Организация и проведение просмотров</strong> — время, адрес объекта и контактные данные.</li><li><strong>Оценка стоимости</strong> — сведения об объекте, которые Вы вводите сами (район, площадь, этаж, состояние, год постройки).</li><li><strong>Исполнение договора о посредничестве</strong> — данные, необходимые для заключения и исполнения договора, включая документы по объекту.</li><li><strong>Сообщения о новых объектах</strong> — только при Вашем отдельном согласии.</li><li><strong>Безопасность и статистика сайта</strong> — технические журналы и измерение посещаемости в объёме, описанном в политике в отношении файлов cookie.</li></ul><p>Мы не используем Ваши данные для автоматизированных решений с юридическими последствиями и не занимаемся профилированием вне описанных целей.</p>",
        de: "<h3>Wozu wir Daten verarbeiten</h3><ul><li><strong>Beantwortung von Anfragen</strong> — Name, E-Mail-Adresse, Telefonnummer und Nachricht aus dem Anfrage-, Besichtigungs-, Bewertungs- oder Verkaufsformular.</li><li><strong>Vereinbarung und Durchführung von Besichtigungen</strong> — Termin, Objektadresse und Kontaktdaten.</li><li><strong>Immobilienbewertung</strong> — die Angaben zur Immobilie, die Sie selbst eingeben (Viertel, Wohnfläche, Etage, Zustand, Baujahr).</li><li><strong>Erfüllung des Maklervertrags</strong> — die zum Abschluss und zur Durchführung erforderlichen Daten, einschließlich der Objektunterlagen.</li><li><strong>Hinweise auf neue Immobilien</strong> — nur bei ausdrücklicher gesonderter Einwilligung.</li><li><strong>Sicherheit und Statistik der Website</strong> — technische Protokolle und Reichweitenmessung im Umfang der Cookie-Richtlinie.</li></ul><p>Wir nutzen Ihre Daten nicht für automatisierte Entscheidungen mit Rechtsfolgen und nicht für Profiling über die beschriebenen Zwecke hinaus.</p>",
      },
    },
    {
      type: "richText",
      key: "legalBasis",
      title: {
        sr: "Pravni osnov",
        en: "Legal basis",
        ru: "Правовое основание",
        de: "Rechtsgrundlage",
      },
      body: {
        sr: "<h3>Na kom osnovu obrađujemo podatke</h3><ul><li><strong>Saglasnost</strong> (član 12. stav 1. tačka 1 ZZPL) — za odgovor na upit poslat kroz formular i za marketinška obaveštenja. Saglasnost možete opozvati u svakom trenutku, bez posledica na obradu koja je već izvršena.</li><li><strong>Izvršenje ugovora</strong> (tačka 2) — kada ste sa nama zaključili ugovor o posredovanju ili se pripremate za njegovo zaključenje.</li><li><strong>Zakonska obaveza</strong> (tačka 3) — vođenje evidencije o posredovanju, poreske i računovodstvene obaveze i obaveze iz propisa o sprečavanju pranja novca.</li><li><strong>Legitimni interes</strong> (tačka 6) — bezbednost sajta, zaštita formulara od zloupotrebe i dokazivanje sadržaja poslovne komunikacije.</li></ul><p>Uz svaki formular prikazan je tekst saglasnosti i njegova verzija, a zapis o saglasnosti (tekst, datum i kanal) čuvamo zajedno sa upitom.</p>",
        en: "<h3>The basis on which we process data</h3><ul><li><strong>Consent</strong> (Article 12(1)(1) of the ZZPL) — for answering an enquiry sent through a form and for marketing messages. You may withdraw consent at any time, without affecting processing already carried out.</li><li><strong>Performance of a contract</strong> (Article 12(1)(2)) — where you have entered into a brokerage agreement with us or are preparing to do so.</li><li><strong>Legal obligation</strong> (Article 12(1)(3)) — keeping the statutory brokerage records, tax and accounting duties, and obligations under anti-money-laundering rules.</li><li><strong>Legitimate interest</strong> (Article 12(1)(6)) — site security, protecting forms against abuse, and evidence of the content of business correspondence.</li></ul><p>Every form displays the consent wording and its version, and the consent record (text, date and channel) is stored together with the enquiry.</p>",
        ru: "<h3>На каком основании мы обрабатываем данные</h3><ul><li><strong>Согласие</strong> (статья 12, пункт 1, подпункт 1 ZZPL) — для ответа на обращение, отправленное через форму, и для маркетинговых сообщений. Согласие Вы можете отозвать в любой момент, это не затрагивает уже выполненную обработку.</li><li><strong>Исполнение договора</strong> (подпункт 2) — когда Вы заключили с нами договор о посредничестве или готовитесь к его заключению.</li><li><strong>Исполнение обязанности по закону</strong> (подпункт 3) — ведение учёта посреднической деятельности, налоговые и бухгалтерские обязанности, требования законодательства о противодействии отмыванию денег.</li><li><strong>Законный интерес</strong> (подпункт 6) — безопасность сайта, защита форм от злоупотреблений и подтверждение содержания деловой переписки.</li></ul><p>У каждой формы показан текст согласия и его версия, а запись о согласии (текст, дата и канал) хранится вместе с обращением.</p>",
        de: "<h3>Auf welcher Grundlage wir Daten verarbeiten</h3><ul><li><strong>Einwilligung</strong> (Artikel 12 Abs. 1 Nr. 1 ZZPL) — für die Beantwortung einer über ein Formular gesendeten Anfrage und für Marketingnachrichten. Sie können die Einwilligung jederzeit widerrufen; die bereits erfolgte Verarbeitung bleibt davon unberührt.</li><li><strong>Vertragserfüllung</strong> (Nr. 2) — wenn Sie mit uns einen Maklervertrag geschlossen haben oder dessen Abschluss vorbereiten.</li><li><strong>Gesetzliche Pflicht</strong> (Nr. 3) — Führung der Vermittlungsaufzeichnungen, steuerliche und buchhalterische Pflichten sowie Vorgaben zur Geldwäscheprävention.</li><li><strong>Berechtigtes Interesse</strong> (Nr. 6) — Sicherheit der Website, Schutz der Formulare vor Missbrauch und Nachweis des Inhalts der Geschäftskorrespondenz.</li></ul><p>Bei jedem Formular werden der Einwilligungstext und seine Version angezeigt; der Einwilligungsnachweis (Text, Datum und Kanal) wird zusammen mit der Anfrage gespeichert.</p>",
      },
    },
    {
      type: "richText",
      key: "retention",
      title: {
        sr: "Rokovi čuvanja",
        en: "Retention periods",
        ru: "Сроки хранения",
        de: "Speicherfristen",
      },
      body: {
        sr: "<h3>Koliko dugo čuvamo podatke</h3><ul><li><strong>Upiti bez daljeg kontakta</strong> — do dve godine od poslednje komunikacije, a zatim se brišu ili anonimizuju.</li><li><strong>Aktivni klijenti i evidentirana potražnja</strong> — dok traje saradnja i dve godine posle njenog završetka.</li><li><strong>Ugovorna i računovodstvena dokumentacija</strong> — u rokovima propisanim poreskim, računovodstvenim i posredničkim propisima.</li><li><strong>Saglasnost za marketing</strong> — do opoziva, uz zapis o datumu opoziva.</li><li><strong>Tehnički zapisi i zapisi o bezbednosti</strong> — do dvanaest meseci.</li></ul>",
        en: "<h3>How long we keep data</h3><ul><li><strong>Enquiries without further contact</strong> — up to two years from the last communication, after which they are deleted or anonymised.</li><li><strong>Active clients and recorded search requests</strong> — for the duration of our work together and two years thereafter.</li><li><strong>Contractual and accounting documentation</strong> — for the periods prescribed by tax, accounting and brokerage legislation.</li><li><strong>Marketing consent</strong> — until withdrawn, together with a record of the withdrawal date.</li><li><strong>Technical and security logs</strong> — up to twelve months.</li></ul>",
        ru: "<h3>Как долго мы храним данные</h3><ul><li><strong>Обращения без дальнейшего контакта</strong> — до двух лет с момента последней переписки, затем данные удаляются или анонимизируются.</li><li><strong>Активные клиенты и зарегистрированные запросы на поиск</strong> — на время сотрудничества и два года после его завершения.</li><li><strong>Договорная и бухгалтерская документация</strong> — в сроки, установленные налоговым, бухгалтерским и посредническим законодательством.</li><li><strong>Согласие на маркетинг</strong> — до отзыва, с фиксацией даты отзыва.</li><li><strong>Технические журналы и журналы безопасности</strong> — до двенадцати месяцев.</li></ul>",
        de: "<h3>Wie lange wir Daten speichern</h3><ul><li><strong>Anfragen ohne weiteren Kontakt</strong> — bis zu zwei Jahre nach der letzten Kommunikation, danach werden sie gelöscht oder anonymisiert.</li><li><strong>Aktive Kunden und erfasste Suchaufträge</strong> — für die Dauer der Zusammenarbeit und zwei Jahre darüber hinaus.</li><li><strong>Vertrags- und Buchhaltungsunterlagen</strong> — für die Fristen, die Steuer-, Buchhaltungs- und Vermittlungsrecht vorschreiben.</li><li><strong>Marketing-Einwilligung</strong> — bis zum Widerruf, mit Vermerk des Widerrufsdatums.</li><li><strong>Technische und Sicherheitsprotokolle</strong> — bis zu zwölf Monate.</li></ul>",
      },
    },
    {
      type: "richText",
      key: "rights",
      title: {
        sr: "Vaša prava",
        en: "Your rights",
        ru: "Ваши права",
        de: "Ihre Rechte",
      },
      body: {
        sr: '<h3>Prava u vezi sa Vašim podacima</h3><p>Imate pravo na pristup i kopiju podataka, ispravku i dopunu, brisanje, ograničenje obrade, prenosivost, prigovor na obradu zasnovanu na legitimnom interesu i opoziv saglasnosti.</p><p>Zahtev možete poslati na <a href="mailto:{{email}}">{{email}}</a> ili poštom na {{address}}. Odgovaramo u roku od 30 dana od prijema zahteva, sa mogućnošću produženja u skladu sa zakonom. Identitet proveravamo samo kada je to neophodno da se podaci ne otkriju nepozvanom licu.</p><p>Ako smatrate da je obrada nezakonita, pritužbu možete uputiti Povereniku za informacije od javnog značaja i zaštitu podataka o ličnosti, Bulevar kralja Aleksandra 15, 11120 Beograd.</p>',
        en: '<h3>Rights in respect of your data</h3><p>You have the right of access and to a copy of your data, to rectification and completion, erasure, restriction of processing, portability, objection to processing based on legitimate interest, and withdrawal of consent.</p><p>Requests may be sent to <a href="mailto:{{email}}">{{email}}</a> or by post to {{address}}. We respond within 30 days of receipt, with an extension where the law allows. We verify identity only where that is necessary so that data are not disclosed to the wrong person.</p><p>If you consider the processing unlawful, you may complain to the Commissioner for Information of Public Importance and Personal Data Protection, Bulevar kralja Aleksandra 15, 11120 Belgrade.</p>',
        ru: '<h3>Права в отношении Ваших данных</h3><p>Вы имеете право на доступ и копию данных, на исправление и дополнение, удаление, ограничение обработки, переносимость, возражение против обработки на основании законного интереса и на отзыв согласия.</p><p>Запрос можно направить на <a href="mailto:{{email}}">{{email}}</a> или почтой на адрес {{address}}. Мы отвечаем в течение 30 дней с момента получения запроса, с возможностью продления в соответствии с законом. Личность мы проверяем только тогда, когда это необходимо, чтобы данные не были раскрыты посторонним.</p><p>Если Вы считаете обработку незаконной, жалобу можно подать Уполномоченному по информации общественного значения и защите персональных данных, Bulevar kralja Aleksandra 15, 11120 Белград.</p>',
        de: '<h3>Rechte bezüglich Ihrer Daten</h3><p>Sie haben das Recht auf Auskunft und eine Kopie Ihrer Daten, auf Berichtigung und Vervollständigung, Löschung, Einschränkung der Verarbeitung, Übertragbarkeit, Widerspruch gegen eine auf berechtigtem Interesse beruhende Verarbeitung sowie auf Widerruf der Einwilligung.</p><p>Anträge richten Sie an <a href="mailto:{{email}}">{{email}}</a> oder per Post an {{address}}. Wir antworten innerhalb von 30 Tagen nach Eingang, mit Verlängerung, soweit das Gesetz sie zulässt. Die Identität prüfen wir nur, wenn dies nötig ist, damit Daten nicht an Unbefugte gelangen.</p><p>Halten Sie die Verarbeitung für rechtswidrig, können Sie sich beim Beauftragten für Informationen von öffentlicher Bedeutung und für den Schutz personenbezogener Daten beschweren, Bulevar kralja Aleksandra 15, 11120 Belgrad.</p>',
      },
    },
    {
      type: "richText",
      key: "transfers",
      title: {
        sr: "Kome poveravamo podatke",
        en: "Who we share data with",
        ru: "Кому мы передаём данные",
        de: "Weitergabe von Daten",
      },
      body: {
        sr: "<h3>Obrađivači i prenos u druge zemlje</h3><p>Podatke ne prodajemo. Pojedine obrade poveravamo pružaocima usluga hostinga i baze podataka, usluge e-pošte, alata za merenje posećenosti, kao i — u konkretnom poslu — advokatu i notaru. Svaki obrađivač je vezan ugovorom i podatke obrađuje samo po našem uputstvu.</p><p>Deo tih usluga podrazumeva prenos podataka van Republike Srbije, u zemlje za koje je utvrđen primereni nivo zaštite ili uz odgovarajuće zaštitne mere.</p><p>Podatke dostavljamo državnim organima samo kada za to postoji zakonska obaveza.</p>",
        en: "<h3>Processors and transfers abroad</h3><p>We do not sell data. Certain processing is entrusted to providers of hosting and database services, email services and audience-measurement tools, and — in a specific transaction — to a lawyer and a notary. Every processor is bound by contract and processes data only on our instructions.</p><p>Some of those services involve transferring data outside the Republic of Serbia, to countries recognised as providing an adequate level of protection or under appropriate safeguards.</p><p>We disclose data to public authorities only where there is a legal obligation to do so.</p>",
        ru: "<h3>Обработчики и передача за рубеж</h3><p>Мы не продаём данные. Отдельные операции мы поручаем поставщикам услуг хостинга и баз данных, электронной почты и инструментов измерения посещаемости, а в конкретной сделке — адвокату и нотариусу. Каждый обработчик связан договором и обрабатывает данные только по нашим указаниям.</p><p>Часть этих услуг предполагает передачу данных за пределы Республики Сербия — в страны с признанным надлежащим уровнем защиты либо при наличии соответствующих гарантий.</p><p>Государственным органам мы передаём данные только при наличии обязанности по закону.</p>",
        de: "<h3>Auftragsverarbeiter und Übermittlung ins Ausland</h3><p>Wir verkaufen keine Daten. Einzelne Verarbeitungen übertragen wir Anbietern von Hosting- und Datenbankdiensten, E-Mail-Diensten und Werkzeugen zur Reichweitenmessung sowie — im konkreten Geschäft — einem Anwalt und einem Notar. Jeder Auftragsverarbeiter ist vertraglich gebunden und verarbeitet Daten ausschließlich nach unserer Weisung.</p><p>Ein Teil dieser Dienste bringt eine Übermittlung von Daten außerhalb der Republik Serbien mit sich, in Länder mit anerkannt angemessenem Schutzniveau oder unter geeigneten Garantien.</p><p>An Behörden geben wir Daten nur weiter, wenn eine gesetzliche Pflicht besteht.</p>",
      },
    },
    {
      type: "richText",
      key: "contact",
      title: {
        sr: "Kontakt za pitanja o podacima",
        en: "Contact for data enquiries",
        ru: "Контакт по вопросам данных",
        de: "Kontakt für Datenschutzfragen",
      },
      body: {
        sr: '<h3>Kako nas kontaktirate</h3><p>{{companyName}}, {{address}}</p><ul><li>E-pošta: <a href="mailto:{{email}}">{{email}}</a></li><li>PIB: {{pib}} · Matični broj: {{mb}}</li><li>Registar posrednika: {{registryNo}}</li></ul><p>Ako imenujemo lice za zaštitu podataka o ličnosti, njegovi podaci biće objavljeni na ovoj strani. Politiku ažuriramo kada se promeni način obrade; datum poslednje izmene prikazan je na vrhu strane.</p>',
        en: '<h3>How to reach us</h3><p>{{companyName}}, {{address}}</p><ul><li>Email: <a href="mailto:{{email}}">{{email}}</a></li><li>Tax number (PIB): {{pib}} · Company number (MB): {{mb}}</li><li>Register of brokers: {{registryNo}}</li></ul><p>Should we appoint a data protection officer, their details will be published on this page. We update the policy whenever our processing changes; the date of the last revision is shown at the top of the page.</p>',
        ru: '<h3>Как с нами связаться</h3><p>{{companyName}}, {{address}}</p><ul><li>Электронная почта: <a href="mailto:{{email}}">{{email}}</a></li><li>Налоговый номер (PIB): {{pib}} · Регистрационный номер (MB): {{mb}}</li><li>Реестр посредников: {{registryNo}}</li></ul><p>Если мы назначим ответственное лицо по защите персональных данных, его данные будут опубликованы на этой странице. Политику мы обновляем при изменении порядка обработки; дата последней редакции указана в верхней части страницы.</p>',
        de: '<h3>So erreichen Sie uns</h3><p>{{companyName}}, {{address}}</p><ul><li>E-Mail: <a href="mailto:{{email}}">{{email}}</a></li><li>Steuernummer (PIB): {{pib}} · Registernummer (MB): {{mb}}</li><li>Maklerregister: {{registryNo}}</li></ul><p>Sollten wir einen Datenschutzbeauftragten bestellen, werden dessen Angaben auf dieser Seite veröffentlicht. Wir aktualisieren die Erklärung, sobald sich die Verarbeitung ändert; das Datum der letzten Änderung steht oben auf der Seite.</p>',
      },
    },
  ],
};

/* ------------------------------------------------------------------ terms */

const TERMS: SeedPage = {
  key: "terms",
  blocks: [
    {
      type: "richText",
      key: "notice",
      title: DRAFT_NOTICE_TITLE,
      body: {
        sr: "<p>Ovaj tekst je radna verzija Opštih uslova poslovanja, pripremljena na osnovu Zakona o posredovanju u prometu i zakupu nepokretnosti. Pre objave treba da ga proveri advokat, a tarifu, rokove i podatke o agenciji treba dopuniti stvarnim vrednostima.</p><p>Uslovi poslovanja i važeća tarifa moraju biti dostupni na sajtu i u PDF dokumentu koji nalogodavac dobija pre potpisivanja ugovora o posredovanju.</p>",
        en: "<p>This text is a working draft of the general terms of business, prepared on the basis of the Serbian Law on Real Estate Brokerage and Leasing. It must be reviewed by a lawyer before publication, and the tariff, the time limits and the agency's details must be completed with actual values.</p><p>The terms of business and the current tariff must be available on the website and as a PDF that the client receives before signing the brokerage agreement.</p>",
        ru: "<p>Этот текст — рабочая версия общих условий сотрудничества, подготовленная на основе сербского Закона о посредничестве при купле-продаже и аренде недвижимости. До публикации его должен проверить юрист, а тариф, сроки и сведения об агентстве необходимо заполнить фактическими данными.</p><p>Условия сотрудничества и действующий тариф должны быть доступны на сайте и в PDF-документе, который заказчик получает до подписания договора о посредничестве.</p>",
        de: "<p>Dieser Text ist eine Arbeitsfassung der Allgemeinen Geschäftsbedingungen, erstellt auf Grundlage des serbischen Immobilienvermittlungsgesetzes. Vor der Veröffentlichung ist eine juristische Prüfung erforderlich; Tarif, Fristen und Angaben zur Agentur sind mit tatsächlichen Werten zu ergänzen.</p><p>Die Geschäftsbedingungen und der geltende Tarif müssen auf der Website sowie als PDF verfügbar sein, das der Auftraggeber vor Unterzeichnung des Maklervertrags erhält.</p>",
      },
    },
    {
      type: "richText",
      key: "scope",
      title: {
        sr: "Predmet i primena",
        en: "Subject and application",
        ru: "Предмет и применение",
        de: "Gegenstand und Anwendung",
      },
      body: {
        sr: "<h3>Na koga se uslovi primenjuju</h3><p>Ovim uslovima poslovanja {{companyName}} uređuje odnose sa nalogodavcima i drugim korisnicima usluga posredovanja u prometu i zakupu nepokretnosti, u skladu sa Zakonom o posredovanju u prometu i zakupu nepokretnosti.</p><p>Uslovi su sastavni deo svakog ugovora o posredovanju i primenjuju se ako pojedinim ugovorom nije izričito drugačije određeno. Nalogodavac potpisom potvrđuje da je pre zaključenja ugovora dobio i pročitao ove uslove zajedno sa važećom tarifom.</p><p>Podaci o posredniku: {{companyName}}, {{address}}, PIB {{pib}}, matični broj {{mb}}, broj upisa u Registar posrednika {{registryNo}}, e-pošta {{email}}.</p>",
        en: "<h3>Who the terms apply to</h3><p>By these terms of business {{companyName}} governs its relations with clients and other users of brokerage services in the sale and letting of real estate, in accordance with the Serbian Law on Real Estate Brokerage and Leasing.</p><p>The terms form an integral part of every brokerage agreement and apply unless an individual agreement expressly provides otherwise. By signing, the client confirms having received and read these terms together with the current tariff before the agreement was concluded.</p><p>Broker details: {{companyName}}, {{address}}, tax number {{pib}}, company number {{mb}}, register of brokers entry number {{registryNo}}, email {{email}}.</p>",
        ru: "<h3>К кому применяются условия</h3><p>Настоящими условиями сотрудничества {{companyName}} регулирует отношения с заказчиками и другими пользователями услуг посредничества при купле-продаже и аренде недвижимости в соответствии с сербским Законом о посредничестве при купле-продаже и аренде недвижимости.</p><p>Условия являются неотъемлемой частью каждого договора о посредничестве и применяются, если отдельным договором прямо не предусмотрено иное. Подписывая договор, заказчик подтверждает, что до его заключения получил и прочитал настоящие условия вместе с действующим тарифом.</p><p>Сведения о посреднике: {{companyName}}, {{address}}, налоговый номер {{pib}}, регистрационный номер {{mb}}, номер записи в реестре посредников {{registryNo}}, электронная почта {{email}}.</p>",
        de: "<h3>Für wen die Bedingungen gelten</h3><p>Mit diesen Geschäftsbedingungen regelt {{companyName}} die Beziehungen zu Auftraggebern und weiteren Nutzern der Vermittlungsleistungen beim Verkauf und bei der Vermietung von Immobilien, im Einklang mit dem serbischen Immobilienvermittlungsgesetz.</p><p>Die Bedingungen sind Bestandteil jedes Maklervertrags und gelten, soweit ein einzelner Vertrag nicht ausdrücklich Abweichendes bestimmt. Mit der Unterschrift bestätigt der Auftraggeber, diese Bedingungen samt geltendem Tarif vor Vertragsschluss erhalten und gelesen zu haben.</p><p>Angaben zum Makler: {{companyName}}, {{address}}, Steuernummer {{pib}}, Registernummer {{mb}}, Eintragsnummer im Maklerregister {{registryNo}}, E-Mail {{email}}.</p>",
      },
    },
    {
      type: "richText",
      key: "services",
      title: {
        sr: "Usluge posredovanja",
        en: "Brokerage services",
        ru: "Услуги посредничества",
        de: "Vermittlungsleistungen",
      },
      body: {
        sr: "<h3>Šta posredovanje obuhvata</h3><ul><li>Upoznavanje nalogodavca sa stanjem na tržištu i procena tržišne cene nekretnine.</li><li>Pregled dokumentacije o nekretnini i provera prava svojine ili drugog stvarnog prava.</li><li>Priprema predstavljanja: opis, fotografije, tlocrt i, za odabrane nekretnine, 360° tura ili 3D šetnja.</li><li>Oglašavanje nekretnine na sajtu posrednika, na portalima i u internoj bazi kupaca.</li><li>Organizacija i vođenje razgledanja i posredovanje u pregovorima.</li><li>Učešće u pripremi predugovora i ugovora, uz advokata, i prisustvo primopredaji.</li><li>Obaveštavanje nalogodavca o svim okolnostima značajnim za posao.</li></ul><p>Dodatne usluge — uređenje prostora za snimanje, pribavljanje dokumentacije, poreske prijave — ugovaraju se posebno i naplaćuju odvojeno od provizije.</p>",
        en: "<h3>What brokerage covers</h3><ul><li>Briefing the client on market conditions and estimating the market price of the property.</li><li>Examining the property documentation and verifying ownership or another right in rem.</li><li>Preparing the presentation: description, photographs, floor plan and, for selected properties, a 360° tour or 3D walkthrough.</li><li>Advertising the property on the broker's website, on portals and to the internal buyer database.</li><li>Arranging and conducting viewings and mediating in negotiations.</li><li>Assisting, with a lawyer, in preparing the preliminary contract and the contract, and attending the handover.</li><li>Informing the client of all circumstances material to the transaction.</li></ul><p>Additional services — styling the property for the shoot, obtaining documents, tax filings — are agreed separately and charged separately from the commission.</p>",
        ru: "<h3>Что включает посредничество</h3><ul><li>Информирование заказчика о состоянии рынка и оценка рыночной цены объекта.</li><li>Изучение документов на объект и проверка права собственности или иного вещного права.</li><li>Подготовка подачи объекта: описание, фотографии, планировка и, для отдельных объектов, тур 360° или 3D-прогулка.</li><li>Размещение объекта на сайте посредника, на порталах и во внутренней базе покупателей.</li><li>Организация и проведение просмотров и посредничество в переговорах.</li><li>Участие в подготовке предварительного и основного договора вместе с адвокатом и присутствие при передаче объекта.</li><li>Информирование заказчика обо всех обстоятельствах, существенных для сделки.</li></ul><p>Дополнительные услуги — подготовка помещения к съёмке, получение документов, налоговые декларации — согласуются отдельно и оплачиваются отдельно от комиссии.</p>",
        de: "<h3>Was die Vermittlung umfasst</h3><ul><li>Information des Auftraggebers über die Marktlage und Einschätzung des Marktpreises der Immobilie.</li><li>Einsicht in die Objektunterlagen und Prüfung des Eigentums oder eines anderen dinglichen Rechts.</li><li>Vorbereitung der Darstellung: Beschreibung, Fotos, Grundriss und für ausgewählte Objekte eine 360°-Tour oder ein 3D-Rundgang.</li><li>Bewerbung der Immobilie auf der Website des Maklers, auf Portalen und in der internen Käuferdatei.</li><li>Organisation und Durchführung von Besichtigungen sowie Vermittlung in den Verhandlungen.</li><li>Mitwirkung bei der Erstellung von Vorvertrag und Kaufvertrag mit einem Anwalt und Teilnahme an der Übergabe.</li><li>Unterrichtung des Auftraggebers über alle für das Geschäft wesentlichen Umstände.</li></ul><p>Zusatzleistungen — Herrichten der Räume für die Aufnahmen, Beschaffung von Unterlagen, Steuererklärungen — werden gesondert vereinbart und getrennt von der Provision abgerechnet.</p>",
      },
    },
    {
      type: "richText",
      key: "commission",
      title: {
        sr: "Provizija",
        en: "Commission",
        ru: "Комиссия",
        de: "Provision",
      },
      body: {
        sr: "<h3>Kako se određuje provizija</h3><p>Visina provizije, osnovica za obračun, trenutak dospelosti i obim usluge određuju se ugovorom o posredovanju, koji se potpisuje pre početka posredovanja. Provizija se ne obračunava mimo ugovora.</p><p>Važeća tarifa je sastavni deo ovih uslova poslovanja i dostupna je na zahtev, kao i u PDF dokumentu koji možete preuzeti pre potpisivanja. Tarifa se može menjati, ali izmene ne utiču na već zaključene ugovore.</p><p>U proviziju nisu uključeni porez na prenos apsolutnih prava, PDV pri kupovini od investitora, takse katastra, naknade notara i advokata, ni troškovi pribavljanja dokumentacije. Te troškove nosi strana određena zakonom ili ugovorom.</p>",
        en: "<h3>How the commission is set</h3><p>The amount of the commission, the basis on which it is calculated, when it falls due and the scope of the service are set out in the brokerage agreement, which is signed before brokerage begins. No commission is charged outside an agreement.</p><p>The current tariff forms an integral part of these terms of business and is available on request, as well as in a PDF you can download before signing. The tariff may change, but changes do not affect agreements already concluded.</p><p>The commission does not include the property transfer tax, VAT on a purchase from a developer, cadastral fees, notary and lawyer's fees, or the cost of obtaining documents. Those costs are borne by the party designated by law or by the agreement.</p>",
        ru: "<h3>Как определяется комиссия</h3><p>Размер комиссии, база для расчёта, момент наступления обязанности по оплате и объём услуг определяются договором о посредничестве, который подписывается до начала работы. Вне договора комиссия не начисляется.</p><p>Действующий тариф является неотъемлемой частью настоящих условий и предоставляется по запросу, а также в PDF-документе, который можно скачать до подписания. Тариф может изменяться, но изменения не затрагивают уже заключённые договоры.</p><p>В комиссию не входят налог на передачу прав, НДС при покупке у застройщика, сборы кадастра, вознаграждения нотариуса и адвоката, а также расходы на получение документов. Эти расходы несёт сторона, определённая законом или договором.</p>",
        de: "<h3>Wie die Provision bestimmt wird</h3><p>Höhe der Provision, Berechnungsgrundlage, Fälligkeit und Leistungsumfang werden im Maklervertrag festgelegt, der vor Beginn der Vermittlung unterzeichnet wird. Ohne Vertrag wird keine Provision berechnet.</p><p>Der geltende Tarif ist Bestandteil dieser Geschäftsbedingungen und steht auf Anfrage sowie als PDF zum Download vor der Unterzeichnung bereit. Der Tarif kann geändert werden; Änderungen berühren bereits geschlossene Verträge nicht.</p><p>Nicht in der Provision enthalten sind die Grunderwerbsteuer, die Mehrwertsteuer beim Kauf vom Bauträger, Katastergebühren, Notar- und Anwaltskosten sowie die Kosten der Beschaffung von Unterlagen. Diese Kosten trägt die Partei, die Gesetz oder Vertrag bestimmt.</p>",
      },
    },
    {
      type: "richText",
      key: "obligationsAgency",
      title: {
        sr: "Obaveze posrednika",
        en: "The broker's obligations",
        ru: "Обязанности посредника",
        de: "Pflichten des Maklers",
      },
      body: {
        sr: "<h3>Šta posrednik preuzima</h3><ul><li>Da pre zaključenja ugovora o posredovanju izvrši uvid u isprave kojima se dokazuje pravo svojine ili drugo stvarno pravo na nekretnini i da nalogodavca upozori na očigledne nedostatke i moguće rizike, u skladu sa članom 16. Zakona.</li><li>Da posreduje pošteno i u interesu nalogodavca i da ga obavesti o svim okolnostima značajnim za posao.</li><li>Da kao poslovnu tajnu čuva podatke o nalogodavcu, nekretnini i uslovima posla.</li><li>Da vodi evidenciju o posredovanju i čuva zaključene ugovore u skladu sa zakonom.</li><li>Da ima važeće osiguranje od profesionalne odgovornosti i upis u Registar posrednika.</li><li>Da nekretninu oglašava isključivo uz zaključen ugovor o posredovanju.</li></ul>",
        en: "<h3>What the broker undertakes</h3><ul><li>Before the brokerage agreement is concluded, to inspect the documents evidencing ownership or another right in rem over the property and to warn the client of obvious defects and possible risks, in accordance with Article 16 of the Law.</li><li>To act honestly and in the client's interest and to inform the client of all circumstances material to the transaction.</li><li>To keep data about the client, the property and the terms of the transaction as a business secret.</li><li>To maintain the statutory brokerage records and to retain concluded agreements as the law requires.</li><li>To hold valid professional indemnity insurance and an entry in the register of brokers.</li><li>To advertise the property only on the basis of a concluded brokerage agreement.</li></ul>",
        ru: "<h3>Что берёт на себя посредник</h3><ul><li>До заключения договора о посредничестве ознакомиться с документами, подтверждающими право собственности или иное вещное право на объект, и предупредить заказчика об очевидных недостатках и возможных рисках в соответствии со статьёй 16 Закона.</li><li>Действовать добросовестно и в интересах заказчика и сообщать ему обо всех обстоятельствах, существенных для сделки.</li><li>Сохранять как коммерческую тайну сведения о заказчике, объекте и условиях сделки.</li><li>Вести учёт посреднической деятельности и хранить заключённые договоры в соответствии с законом.</li><li>Иметь действующее страхование профессиональной ответственности и запись в реестре посредников.</li><li>Размещать объявления об объекте исключительно при заключённом договоре о посредничестве.</li></ul>",
        de: "<h3>Was der Makler übernimmt</h3><ul><li>Vor Abschluss des Maklervertrags Einsicht in die Urkunden zu nehmen, die Eigentum oder ein anderes dingliches Recht an der Immobilie belegen, und den Auftraggeber gemäß Artikel 16 des Gesetzes auf offensichtliche Mängel und mögliche Risiken hinzuweisen.</li><li>Redlich und im Interesse des Auftraggebers zu vermitteln und ihn über alle für das Geschäft wesentlichen Umstände zu unterrichten.</li><li>Angaben zu Auftraggeber, Immobilie und Geschäftsbedingungen als Geschäftsgeheimnis zu behandeln.</li><li>Die Vermittlungsaufzeichnungen zu führen und geschlossene Verträge gesetzeskonform aufzubewahren.</li><li>Eine gültige Berufshaftpflichtversicherung und die Eintragung im Maklerregister vorzuhalten.</li><li>Die Immobilie ausschließlich auf Grundlage eines geschlossenen Maklervertrags zu bewerben.</li></ul>",
      },
    },
    {
      type: "richText",
      key: "obligationsClient",
      title: {
        sr: "Obaveze nalogodavca",
        en: "The client's obligations",
        ru: "Обязанности заказчика",
        de: "Pflichten des Auftraggebers",
      },
      body: {
        sr: "<h3>Šta se očekuje od nalogodavca</h3><ul><li>Da posredniku da tačne podatke o nekretnini i stavi na uvid originalnu dokumentaciju o svojini, ozakonjenju i eventualnim teretima.</li><li>Da obavesti posrednika o svakoj promeni: cene, rokova, pravnog statusa, kao i o poslu zaključenom preko drugog posrednika ili direktno sa kupcem.</li><li>Da omogući razgledanje nekretnine u dogovorenim terminima.</li><li>Da plati proviziju u roku i na način dogovoren ugovorom o posredovanju.</li><li>Da naknadi stvarne troškove izričito dogovorene ugovorom, ako su nastali po njegovom nalogu a posredovanje ne bude uspešno.</li></ul><p>Nalogodavac odgovara za štetu ako je posredniku svesno dao netačne podatke ili prikrio pravne nedostatke nekretnine.</p>",
        en: "<h3>What is expected of the client</h3><ul><li>To give the broker accurate information about the property and to produce the original documents on ownership, legalization and any charges.</li><li>To notify the broker of any change in price, deadlines or legal status, and of any transaction concluded through another broker or directly with a buyer.</li><li>To allow viewings at the agreed times.</li><li>To pay the commission within the period and in the manner agreed in the brokerage agreement.</li><li>To reimburse actual costs expressly agreed in the contract where these were incurred at the client's request and the brokerage is unsuccessful.</li></ul><p>The client is liable for loss caused by knowingly giving the broker inaccurate information or concealing legal defects in the property.</p>",
        ru: "<h3>Что ожидается от заказчика</h3><ul><li>Предоставить посреднику точные сведения об объекте и показать оригиналы документов о собственности, узаконении и возможных обременениях.</li><li>Сообщать посреднику о любом изменении цены, сроков или правового статуса, а также о сделке, заключённой через другого посредника или напрямую с покупателем.</li><li>Обеспечивать возможность просмотра объекта в согласованное время.</li><li>Уплатить комиссию в срок и в порядке, согласованных договором о посредничестве.</li><li>Возместить фактические расходы, прямо согласованные договором, если они возникли по его поручению, а посредничество не привело к сделке.</li></ul><p>Заказчик отвечает за ущерб, если сознательно сообщил посреднику неверные сведения или скрыл правовые недостатки объекта.</p>",
        de: "<h3>Was vom Auftraggeber erwartet wird</h3><ul><li>Dem Makler zutreffende Angaben zur Immobilie zu machen und die Originalunterlagen zu Eigentum, Legalisierung und etwaigen Lasten vorzulegen.</li><li>Den Makler über jede Änderung von Preis, Fristen oder Rechtslage sowie über ein über einen anderen Makler oder direkt mit einem Käufer geschlossenes Geschäft zu unterrichten.</li><li>Besichtigungen zu den vereinbarten Terminen zu ermöglichen.</li><li>Die Provision fristgerecht und in der im Maklervertrag vereinbarten Weise zu zahlen.</li><li>Ausdrücklich vertraglich vereinbarte tatsächliche Kosten zu ersetzen, wenn sie in seinem Auftrag entstanden sind und die Vermittlung erfolglos bleibt.</li></ul><p>Der Auftraggeber haftet für Schäden, wenn er dem Makler bewusst unrichtige Angaben gemacht oder rechtliche Mängel der Immobilie verschwiegen hat.</p>",
      },
    },
    {
      type: "richText",
      key: "advertising",
      title: {
        sr: "Oglašavanje",
        en: "Advertising",
        ru: "Размещение объявлений",
        de: "Werbung",
      },
      body: {
        sr: "<h3>Pravila oglašavanja</h3><p>Posrednik oglašava nekretninu isključivo na osnovu zaključenog ugovora o posredovanju i u granicama datih ovlašćenja.</p><p>U skladu sa članom 18. Zakona, svaki oglas sadrži poslovno ime posrednika i broj upisa u Registar posrednika ({{companyName}}, {{registryNo}}), kao i cenu, lokaciju, kvadraturu i strukturu prostorija nekretnine.</p><p>Adresa nekretnine prikazuje se u obimu koji je nalogodavac odobrio: tačna adresa, samo ulica ili približna zona na mapi. Fotografije, tlocrti i virtuelne ture objavljuju se uz saglasnost nalogodavca i uklanjaju se iz javne ponude po prestanku ugovora.</p>",
        en: "<h3>Advertising rules</h3><p>The broker advertises a property solely on the basis of a concluded brokerage agreement and within the authority granted.</p><p>In accordance with Article 18 of the Law, every advertisement states the broker's business name and its entry number in the register of brokers ({{companyName}}, {{registryNo}}), together with the price, location, floor area and room structure of the property.</p><p>The address is shown only to the extent the client has approved: the exact address, the street alone, or an approximate zone on the map. Photographs, floor plans and virtual tours are published with the client's consent and are withdrawn from the public listing when the agreement ends.</p>",
        ru: "<h3>Правила размещения</h3><p>Посредник размещает объявление об объекте исключительно на основании заключённого договора о посредничестве и в пределах предоставленных полномочий.</p><p>В соответствии со статьёй 18 Закона каждое объявление содержит фирменное наименование посредника и номер записи в реестре посредников ({{companyName}}, {{registryNo}}), а также цену, район, площадь и структуру помещений объекта.</p><p>Адрес показывается в том объёме, который одобрил заказчик: точный адрес, только улица или приблизительная зона на карте. Фотографии, планировки и виртуальные туры публикуются с согласия заказчика и удаляются из открытого доступа после прекращения договора.</p>",
        de: "<h3>Regeln der Bewerbung</h3><p>Der Makler bewirbt eine Immobilie ausschließlich auf Grundlage eines geschlossenen Maklervertrags und im Rahmen der erteilten Vollmacht.</p><p>Gemäß Artikel 18 des Gesetzes nennt jede Anzeige den Firmennamen des Maklers und seine Eintragsnummer im Maklerregister ({{companyName}}, {{registryNo}}) sowie Preis, Lage, Wohnfläche und Raumstruktur der Immobilie.</p><p>Die Adresse wird nur in dem vom Auftraggeber genehmigten Umfang gezeigt: genaue Adresse, nur Straße oder eine ungefähre Zone auf der Karte. Fotos, Grundrisse und virtuelle Touren werden mit Zustimmung des Auftraggebers veröffentlicht und nach Vertragsende aus dem öffentlichen Angebot entfernt.</p>",
      },
    },
    {
      type: "richText",
      key: "complaints",
      title: {
        sr: "Reklamacije i prigovori",
        en: "Complaints",
        ru: "Претензии и жалобы",
        de: "Beschwerden",
      },
      body: {
        sr: '<h3>Kako podnosite prigovor</h3><p>Prigovor na kvalitet usluge možete uputiti pisanim putem na adresu {{address}} ili na <a href="mailto:{{email}}">{{email}}</a>. U prigovoru navedite broj ugovora, opis problema i način na koji predlažete rešenje.</p><p>Prijem prigovora potvrđujemo bez odlaganja, a pisani odgovor dostavljamo u roku od osam dana od prijema. Ako prigovor ne bude rešen u Vašu korist, imate pravo na vansudsko rešavanje spora pred telom sa liste ministarstva nadležnog za zaštitu potrošača, kao i na sudsku zaštitu.</p><p>Pritužbu na rad posrednika možete uputiti i ministarstvu koje vodi Registar posrednika.</p>',
        en: '<h3>How to complain</h3><p>A complaint about the quality of our service may be sent in writing to {{address}} or to <a href="mailto:{{email}}">{{email}}</a>. Please state the agreement number, a description of the problem and the outcome you propose.</p><p>We acknowledge receipt without delay and provide a written reply within eight days of receiving the complaint. If the complaint is not resolved in your favour, you are entitled to out-of-court dispute resolution before a body on the list held by the ministry responsible for consumer protection, and to judicial protection.</p><p>A complaint about the conduct of the broker may also be submitted to the ministry that maintains the register of brokers.</p>',
        ru: '<h3>Как подать претензию</h3><p>Претензию к качеству услуги можно направить письменно на адрес {{address}} или на <a href="mailto:{{email}}">{{email}}</a>. Укажите номер договора, описание проблемы и предлагаемый Вами способ решения.</p><p>Получение претензии мы подтверждаем без задержки, а письменный ответ направляем в течение восьми дней с момента получения. Если претензия не будет разрешена в Вашу пользу, Вы вправе обратиться к внесудебному урегулированию спора в органе из списка министерства, отвечающего за защиту потребителей, а также в суд.</p><p>Жалобу на работу посредника можно направить и в министерство, которое ведёт реестр посредников.</p>',
        de: '<h3>Wie Sie sich beschweren</h3><p>Eine Beschwerde über die Qualität unserer Leistung können Sie schriftlich an {{address}} oder an <a href="mailto:{{email}}">{{email}}</a> richten. Nennen Sie darin die Vertragsnummer, eine Beschreibung des Problems und die von Ihnen vorgeschlagene Lösung.</p><p>Den Eingang bestätigen wir unverzüglich; eine schriftliche Antwort erhalten Sie innerhalb von acht Tagen nach Eingang. Wird die Beschwerde nicht zu Ihren Gunsten gelöst, steht Ihnen die außergerichtliche Streitbeilegung vor einer Stelle aus der Liste des für Verbraucherschutz zuständigen Ministeriums sowie der Rechtsweg offen.</p><p>Eine Beschwerde über die Tätigkeit des Maklers können Sie auch an das Ministerium richten, das das Maklerregister führt.</p>',
      },
    },
    {
      type: "richText",
      key: "law",
      title: {
        sr: "Primenjivo pravo i izmene",
        en: "Governing law and amendments",
        ru: "Применимое право и изменения",
        de: "Anwendbares Recht und Änderungen",
      },
      body: {
        sr: "<h3>Pravo, jezik i nadležnost</h3><p>Na ugovor o posredovanju i ove uslove primenjuje se pravo Republike Srbije, pre svega Zakon o posredovanju u prometu i zakupu nepokretnosti, Zakon o obligacionim odnosima i Zakon o zaštiti potrošača kada je nalogodavac potrošač.</p><p>Ugovor se zaključuje na srpskom jeziku. Prevodi na engleski, ruski i nemački služe za informisanje, a u slučaju razlike u tumačenju važi verzija na srpskom.</p><p>Za sporove je nadležan stvarno nadležan sud u Beogradu, ako zakon ne propisuje drugačije. Izmene ovih uslova objavljujemo na ovoj strani sa datumom izmene i primenjuju se na ugovore zaključene posle objave.</p>",
        en: "<h3>Law, language and jurisdiction</h3><p>The brokerage agreement and these terms are governed by the law of the Republic of Serbia, in particular the Law on Real Estate Brokerage and Leasing, the Law on Contracts and Torts and, where the client is a consumer, the Consumer Protection Act.</p><p>The agreement is concluded in Serbian. The English, Russian and German versions are provided for information; in the event of a difference in interpretation, the Serbian version prevails.</p><p>Disputes fall to the competent court in Belgrade unless the law provides otherwise. Amendments to these terms are published on this page with the date of the change and apply to agreements concluded after publication.</p>",
        ru: "<h3>Право, язык и подсудность</h3><p>К договору о посредничестве и настоящим условиям применяется право Республики Сербия, прежде всего Закон о посредничестве при купле-продаже и аренде недвижимости, Закон об обязательственных отношениях и — если заказчик является потребителем — Закон о защите потребителей.</p><p>Договор заключается на сербском языке. Переводы на английский, русский и немецкий носят информационный характер; при расхождении в толковании действует сербская версия.</p><p>Споры относятся к компетенции надлежащего суда в Белграде, если законом не предусмотрено иное. Изменения настоящих условий публикуются на этой странице с указанием даты и применяются к договорам, заключённым после публикации.</p>",
        de: "<h3>Recht, Sprache und Gerichtsstand</h3><p>Für den Maklervertrag und diese Bedingungen gilt das Recht der Republik Serbien, insbesondere das Immobilienvermittlungsgesetz, das Schuldrechtsgesetz und, sofern der Auftraggeber Verbraucher ist, das Verbraucherschutzgesetz.</p><p>Der Vertrag wird in serbischer Sprache geschlossen. Die englische, russische und deutsche Fassung dienen der Information; bei Auslegungsunterschieden gilt die serbische Fassung.</p><p>Für Streitigkeiten ist das zuständige Gericht in Belgrad berufen, soweit das Gesetz nichts anderes vorschreibt. Änderungen dieser Bedingungen veröffentlichen wir mit Änderungsdatum auf dieser Seite; sie gelten für Verträge, die nach der Veröffentlichung geschlossen werden.</p>",
      },
    },
  ],
};

/* ---------------------------------------------------------------- cookies */

const COOKIES: SeedPage = {
  key: "cookies",
  blocks: [
    {
      type: "richText",
      key: "notice",
      title: DRAFT_NOTICE_TITLE,
      body: {
        sr: "<p>Ovaj tekst je radna verzija Politike kolačića. Pre objave treba da ga proveri advokat, a spisak kolačića, njihovi rokovi i pružaoci usluga moraju se dopuniti stvarnim podacima nakon završetka integracija.</p><p>Politika se odnosi na sajt {{companyName}} i čita se zajedno sa Politikom privatnosti.</p>",
        en: "<p>This text is a working draft of the cookie policy. It must be reviewed by a lawyer before publication, and the list of cookies, their lifetimes and the service providers must be completed with actual data once the integrations are finished.</p><p>The policy covers the {{companyName}} website and should be read together with our privacy policy.</p>",
        ru: "<p>Этот текст — рабочая версия политики в отношении файлов cookie. До публикации его должен проверить юрист, а перечень файлов cookie, сроки их хранения и поставщиков услуг необходимо дополнить фактическими данными после завершения интеграций.</p><p>Политика распространяется на сайт {{companyName}} и читается вместе с политикой конфиденциальности.</p>",
        de: "<p>Dieser Text ist eine Arbeitsfassung der Cookie-Richtlinie. Vor der Veröffentlichung ist eine juristische Prüfung erforderlich; die Liste der Cookies, ihre Laufzeiten und die Dienstleister sind nach Abschluss der Integrationen mit den tatsächlichen Daten zu ergänzen.</p><p>Die Richtlinie gilt für die Website von {{companyName}} und ist zusammen mit der Datenschutzerklärung zu lesen.</p>",
      },
    },
    {
      type: "richText",
      key: "what",
      title: {
        sr: "Šta su kolačići",
        en: "What cookies are",
        ru: "Что такое файлы cookie",
        de: "Was Cookies sind",
      },
      body: {
        sr: "<h3>Kolačići i lokalno skladište</h3><p>Kolačići su mali tekstualni zapisi koje sajt ostavlja u Vašem pregledaču da bi zapamtio izbor jezika, sesiju ili Vašu odluku o kolačićima.</p><p>Uz njih koristimo i lokalno skladište pregledača (localStorage), u kojem se čuvaju lista Vaših omiljenih nekretnina i izbor filtera. Ti podaci ostaju na Vašem uređaju i ne stižu do nas u obliku koji Vas identifikuje.</p><p>Kolačiće postavlja ovaj sajt (kolačići prve strane) ili usluge koje koristimo za merenje posećenosti, prikaz mapa i virtuelnih tura (kolačići treće strane).</p>",
        en: "<h3>Cookies and local storage</h3><p>Cookies are small text records a site places in your browser so that it can remember your language, your session or your cookie choice.</p><p>Alongside them we use the browser's local storage, which holds your list of saved properties and your filter selections. Those data stay on your device and do not reach us in a form that identifies you.</p><p>Cookies are set either by this site (first-party cookies) or by the services we use for audience measurement, maps and virtual tours (third-party cookies).</p>",
        ru: "<h3>Файлы cookie и локальное хранилище</h3><p>Файлы cookie — это небольшие текстовые записи, которые сайт оставляет в Вашем браузере, чтобы запомнить выбор языка, сессию или Ваше решение о файлах cookie.</p><p>Кроме них мы используем локальное хранилище браузера, в котором хранятся список Ваших избранных объектов и выбранные фильтры. Эти данные остаются на Вашем устройстве и не поступают к нам в виде, позволяющем Вас идентифицировать.</p><p>Файлы cookie устанавливает либо сам сайт (первой стороны), либо сервисы, которые мы используем для измерения посещаемости, отображения карт и виртуальных туров (третьей стороны).</p>",
        de: "<h3>Cookies und lokaler Speicher</h3><p>Cookies sind kleine Textdateien, die eine Website in Ihrem Browser ablegt, um Sprachwahl, Sitzung oder Ihre Cookie-Entscheidung zu speichern.</p><p>Daneben nutzen wir den lokalen Speicher des Browsers, in dem Ihre Merkliste und Ihre Filterauswahl liegen. Diese Daten bleiben auf Ihrem Gerät und erreichen uns nicht in einer Form, die Sie identifiziert.</p><p>Cookies werden entweder von dieser Website gesetzt (First-Party) oder von Diensten, die wir für Reichweitenmessung, Karten und virtuelle Touren einsetzen (Third-Party).</p>",
      },
    },
    {
      type: "richText",
      key: "categories",
      title: {
        sr: "Kategorije kolačića",
        en: "Cookie categories",
        ru: "Категории файлов cookie",
        de: "Cookie-Kategorien",
      },
      body: {
        sr: "<h3>Tri kategorije</h3><ul><li><strong>Neophodni</strong> — bez njih sajt ne radi: izbor jezika, sesija, zaštita formulara i pamćenje Vaše odluke o kolačićima. Postavljaju se na osnovu legitimnog interesa i ne mogu se isključiti.</li><li><strong>Analitički</strong> — mere broj posetilaca, izvor poseta i ponašanje na stranici, u zbirnom obliku, da bismo popravili sajt.</li><li><strong>Marketinški</strong> — mere uspešnost kampanja i omogućavaju prikaz oglasa na drugim platformama.</li></ul><p>Analitički i marketinški kolačići ne postavljaju se dok ne date saglasnost: skripte se učitavaju tek posle Vaše potvrde u baneru, a do tada se tim uslugama ne šalju nikakvi podaci.</p>",
        en: "<h3>Three categories</h3><ul><li><strong>Essential</strong> — the site does not work without them: language choice, the session, form protection and remembering your cookie decision. They are set on the basis of legitimate interest and cannot be switched off.</li><li><strong>Analytics</strong> — they measure visitor numbers, traffic sources and on-page behaviour in aggregate form, so that we can improve the site.</li><li><strong>Marketing</strong> — they measure campaign performance and allow advertisements to be shown on other platforms.</li></ul><p>Analytics and marketing cookies are not set until you consent: the scripts load only after you confirm in the banner, and until then no data are sent to those services.</p>",
        ru: "<h3>Три категории</h3><ul><li><strong>Необходимые</strong> — без них сайт не работает: выбор языка, сессия, защита форм и запоминание Вашего решения о файлах cookie. Они устанавливаются на основании законного интереса и не могут быть отключены.</li><li><strong>Аналитические</strong> — измеряют число посетителей, источники переходов и поведение на странице в обобщённом виде, чтобы мы могли улучшать сайт.</li><li><strong>Маркетинговые</strong> — измеряют эффективность кампаний и позволяют показывать объявления на других платформах.</li></ul><p>Аналитические и маркетинговые файлы cookie не устанавливаются до Вашего согласия: скрипты загружаются только после подтверждения в баннере, и до этого момента данные этим сервисам не передаются.</p>",
        de: "<h3>Drei Kategorien</h3><ul><li><strong>Notwendig</strong> — ohne sie funktioniert die Website nicht: Sprachwahl, Sitzung, Formularschutz und das Speichern Ihrer Cookie-Entscheidung. Sie werden auf Grundlage des berechtigten Interesses gesetzt und lassen sich nicht abschalten.</li><li><strong>Analyse</strong> — sie messen Besucherzahlen, Herkunft der Zugriffe und Verhalten auf der Seite in aggregierter Form, damit wir die Website verbessern können.</li><li><strong>Marketing</strong> — sie messen den Erfolg von Kampagnen und ermöglichen Anzeigen auf anderen Plattformen.</li></ul><p>Analyse- und Marketing-Cookies werden erst nach Ihrer Einwilligung gesetzt: Die Skripte laden ausschließlich nach Ihrer Bestätigung im Banner, und bis dahin werden keine Daten an diese Dienste übermittelt.</p>",
      },
    },
    {
      type: "richText",
      key: "managing",
      title: {
        sr: "Upravljanje saglasnošću",
        en: "Managing your consent",
        ru: "Управление согласием",
        de: "Einwilligung verwalten",
      },
      body: {
        sr: "<h3>Kako menjate odluku</h3><p>Pri prvoj poseti prikazuje se baner sa tri jednako dostupne opcije: prihvatanje svih kolačića, odbijanje svih osim neophodnih i podešavanje po kategorijama. Odluku možete promeniti u svakom trenutku dugmetom „Podešavanja” na ovoj stranici ili istoimenim linkom u odeljku „Pravno” u podnožju sajta.</p><p>Kolačiće možete i obrisati ili blokirati u podešavanjima pregledača. Ako blokirate neophodne kolačiće, delovi sajta — pretraga, izbor jezika i formulari — mogu prestati da rade ispravno.</p>",
        en: "<h3>How to change your decision</h3><p>On your first visit a banner appears with three equally prominent options: accept all cookies, reject all but the essential ones, or choose by category. You can change that decision at any time with the “Settings” button on this page or the link of the same name in the Legal section of the footer.</p><p>You can also delete or block cookies in your browser settings. If you block the essential cookies, parts of the site — search, language choice and the forms — may stop working correctly.</p>",
        ru: "<h3>Как изменить решение</h3><p>При первом посещении появляется баннер с тремя равнодоступными вариантами: принять все файлы cookie, отклонить все, кроме необходимых, или настроить по категориям. Изменить решение можно в любой момент кнопкой «Настройки» на этой странице или одноимённой ссылкой в разделе «Правовая информация» внизу сайта.</p><p>Файлы cookie можно также удалить или заблокировать в настройках браузера. При блокировке необходимых файлов cookie отдельные части сайта — поиск, выбор языка и формы — могут работать неправильно.</p>",
        de: "<h3>Wie Sie Ihre Entscheidung ändern</h3><p>Beim ersten Besuch erscheint ein Banner mit drei gleichwertigen Optionen: alle Cookies annehmen, alles außer den notwendigen ablehnen oder nach Kategorien einstellen. Ihre Entscheidung können Sie jederzeit über die Schaltfläche „Einstellungen“ auf dieser Seite oder den gleichnamigen Link im Bereich „Rechtliches“ der Fußzeile ändern.</p><p>Cookies lassen sich auch in den Browsereinstellungen löschen oder blockieren. Blockieren Sie die notwendigen Cookies, können Teile der Website — Suche, Sprachwahl und Formulare — nicht mehr korrekt funktionieren.</p>",
      },
    },
    {
      type: "richText",
      key: "contact",
      title: {
        sr: "Pitanja",
        en: "Questions",
        ru: "Вопросы",
        de: "Fragen",
      },
      body: {
        sr: '<h3>Kome se obraćate</h3><p>Za pitanja o kolačićima i obradi podataka pišite na <a href="mailto:{{email}}">{{email}}</a> ili na adresu {{companyName}}, {{address}}.</p><p>Detalji o pravnim osnovima, rokovima čuvanja i Vašim pravima nalaze se u Politici privatnosti.</p>',
        en: '<h3>Who to contact</h3><p>For questions about cookies and data processing, write to <a href="mailto:{{email}}">{{email}}</a> or to {{companyName}}, {{address}}.</p><p>Details of the legal bases, retention periods and your rights are set out in our privacy policy.</p>',
        ru: '<h3>К кому обращаться</h3><p>По вопросам о файлах cookie и обработке данных пишите на <a href="mailto:{{email}}">{{email}}</a> или на адрес {{companyName}}, {{address}}.</p><p>Подробности о правовых основаниях, сроках хранения и Ваших правах изложены в политике конфиденциальности.</p>',
        de: '<h3>An wen Sie sich wenden</h3><p>Bei Fragen zu Cookies und Datenverarbeitung schreiben Sie an <a href="mailto:{{email}}">{{email}}</a> oder an {{companyName}}, {{address}}.</p><p>Einzelheiten zu Rechtsgrundlagen, Speicherfristen und Ihren Rechten finden Sie in der Datenschutzerklärung.</p>',
      },
    },
  ],
};

/* ------------------------------------------------------------------ export */

export const PAGE_CONTENT: SeedPage[] = [
  HOME,
  ABOUT,
  SELL,
  VALUATION,
  CONTACT,
  PRIVACY,
  TERMS,
  COOKIES,
];

/** Localized strings that live on the settings singleton. */
export const SETTINGS_COPY: {
  commissionText: L10nText;
  seoDefaultTitle: L10nText;
  seoDefaultDescription: L10nText;
  stats: { value: string; label: L10nText; isDemo: boolean }[];
} = {
  commissionText: {
    sr: "Agencijska provizija ugovara se ugovorom o posredovanju, u skladu sa važećom tarifom iz naših Uslova poslovanja. Tarifa je dostupna na zahtev i u PDF-u pre potpisivanja. Porez na prenos apsolutnih prava, naknade notara i katastra i troškovi pribavljanja dokumentacije nisu uključeni u proviziju.",
    en: "The agency commission is agreed in the brokerage agreement, in line with the current tariff in our general terms of business. The tariff is available on request and as a PDF before you sign. Property transfer tax, notary and cadastral fees and the cost of obtaining documents are not included in the commission.",
    ru: "Комиссия агентства согласуется в договоре о посредничестве в соответствии с действующим тарифом из наших условий сотрудничества. Тариф предоставляется по запросу и в формате PDF до подписания. Налог на передачу прав, вознаграждения нотариуса, сборы кадастра и расходы на получение документов в комиссию не входят.",
    de: "Die Maklerprovision wird im Maklervertrag vereinbart, entsprechend dem geltenden Tarif unserer Geschäftsbedingungen. Der Tarif ist auf Anfrage und als PDF vor der Unterzeichnung verfügbar. Grunderwerbsteuer, Notar- und Katastergebühren sowie die Kosten der Beschaffung von Unterlagen sind nicht in der Provision enthalten.",
  },
  seoDefaultTitle: {
    sr: "Mihajlo Estate — nekretnine u Beogradu i Srbiji",
    en: "Mihajlo Estate — property in Belgrade and Serbia",
    ru: "Mihajlo Estate — недвижимость в Белграде и Сербии",
    de: "Mihajlo Estate – Immobilien in Belgrad und Serbien",
  },
  seoDefaultDescription: {
    sr: "Pažljivo odabrani stanovi, kuće i poslovni prostori u Beogradu i širom Srbije. Procena, prodaja, zakup i 3D ture.",
    en: "Carefully selected apartments, houses and commercial premises in Belgrade and across Serbia. Valuations, sales, lettings and 3D tours.",
    ru: "Тщательно отобранные квартиры, дома и коммерческие помещения в Белграде и по всей Сербии. Оценка, продажа, аренда и 3D-туры.",
    de: "Sorgfältig ausgewählte Wohnungen, Häuser und Gewerbeflächen in Belgrad und in ganz Serbien. Bewertung, Verkauf, Vermietung und 3D-Rundgänge.",
  },
  stats: DEMO_STATS,
};
