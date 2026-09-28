/**
 * Four demo agents. Per docs/04-CONTENT.md they carry obviously fictional
 * contact details (`+381 11 000 00xx`, `@mihajlo-estate.local`) and NO photo, so
 * the UI renders a monogram avatar instead of a stock face.
 */
export type SeedAgent = {
  slug: string;
  name: string;
  role: { sr: string; en: string; ru: string; de: string };
  bio: { sr: string; en: string; ru: string; de: string };
  languages: string[];
  phone: string;
  viber?: string;
  whatsapp?: string;
  email: string;
  /** Location slugs the agent covers. */
  areas: string[];
  licenseId?: string;
  availability: { weekday: number; from: string; to: string }[];
};

const WEEKDAYS = [1, 2, 3, 4, 5];

function workweek(from: string, to: string, saturday?: [string, string]) {
  const slots = WEEKDAYS.map((weekday) => ({ weekday, from, to }));
  if (saturday !== undefined) {
    slots.push({ weekday: 6, from: saturday[0], to: saturday[1] });
  }
  return slots;
}

export const SEED_AGENTS: SeedAgent[] = [
  {
    slug: "milica-jovanovic",
    name: "Milica Jovanović",
    role: {
      sr: "Direktorka prodaje",
      en: "Head of Sales",
      ru: "Руководитель отдела продаж",
      de: "Leiterin Vertrieb",
    },
    bio: {
      sr: "Vodi prodaju stanova na Vračaru, Savskom vencu i Starom gradu. Radi sa kupcima koji traže renovirane stanove u zgradama sa fasadama i sa investitorima u novogradnji na savskoj obali.",
      en: "Leads apartment sales across Vračar, Savski Venac and Stari Grad. Works with buyers looking for renovated flats in period buildings and with investors in the new build on the Sava bank.",
      ru: "Отвечает за продажу квартир во Врачаре, Савском венце и Старом граде. Работает с покупателями, которые ищут отремонтированные квартиры в исторических домах, и с инвесторами в новостройках на берегу Савы.",
      de: "Leitet den Wohnungsverkauf in Vračar, Savski Venac und Stari Grad. Arbeitet mit Käufern, die renovierte Wohnungen in Altbauten suchen, und mit Investoren im Neubau am Save-Ufer.",
    },
    languages: ["sr", "en", "de"],
    phone: "+381 11 000 0011",
    viber: "+381 11 000 0011",
    whatsapp: "+381 11 000 0011",
    email: "milica@mihajlo-estate.local",
    areas: ["vracar", "savski-venac", "stari-grad"],
    licenseId: "DEMO-001",
    availability: workweek("09:00", "18:00", ["10:00", "14:00"]),
  },
  {
    slug: "stefan-petrovic",
    name: "Stefan Petrović",
    role: {
      sr: "Viši agent",
      en: "Senior Agent",
      ru: "Старший агент",
      de: "Senior-Makler",
    },
    bio: {
      sr: "Pokriva Čukaricu, Voždovac i Zemun. Specijalizovan za stanove u starogradnji koje treba proveriti pre kupovine — uknjiženost, legalizaciju i stanje instalacija.",
      en: "Covers Čukarica, Voždovac and Zemun. Specialises in older-building flats that need checking before purchase: cadastre registration, legalisation and the state of the services.",
      ru: "Работает по Чукарице, Вождовцу и Земуну. Специализируется на квартирах во вторичном фонде, которые нужно проверить до покупки: регистрация, узаконение и состояние коммуникаций.",
      de: "Betreut Čukarica, Voždovac und Zemun. Spezialisiert auf Altbauwohnungen, die vor dem Kauf geprüft werden müssen: Grundbuch, Legalisierung und Zustand der Installationen.",
    },
    languages: ["sr", "en"],
    phone: "+381 11 000 0012",
    viber: "+381 11 000 0012",
    email: "stefan@mihajlo-estate.local",
    areas: ["cukarica", "vozdovac", "zemun"],
    licenseId: "DEMO-002",
    availability: workweek("09:00", "17:00"),
  },
  {
    slug: "ana-markovic",
    name: "Ana Marković",
    role: {
      sr: "Agent za luksuzne nekretnine",
      en: "Prime Property Agent",
      ru: "Агент по элитной недвижимости",
      de: "Maklerin für Premium-Immobilien",
    },
    bio: {
      sr: "Vodi kuće i vile na Senjaku, Dedinju i u Profesorskoj koloniji, kao i penthause na Zvezdari. Priprema nekretnine za tržište: fotografija, 360° tura i dokumentacija pre prve objave.",
      en: "Handles houses and villas in Senjak, Dedinje and the Professors' Colony, plus penthouses on Zvezdara. Prepares properties for the market: photography, a 360° tour and the paperwork before the first listing goes live.",
      ru: "Ведёт дома и виллы в Сеньяке, Дедине и Профессорской колонии, а также пентхаусы на Звездаре. Готовит объекты к выходу на рынок: фотосъёмка, 360°-тур и документы до первой публикации.",
      de: "Betreut Häuser und Villen in Senjak, Dedinje und der Professorenkolonie sowie Penthäuser in Zvezdara. Bereitet Objekte für den Markt vor: Fotografie, 360°-Tour und Unterlagen vor der ersten Veröffentlichung.",
    },
    languages: ["sr", "en", "ru"],
    phone: "+381 11 000 0013",
    viber: "+381 11 000 0013",
    whatsapp: "+381 11 000 0013",
    email: "ana@mihajlo-estate.local",
    areas: ["savski-venac", "zvezdara", "palilula", "zlatibor"],
    licenseId: "DEMO-003",
    availability: workweek("10:00", "18:00", ["10:00", "13:00"]),
  },
  {
    slug: "nikola-ilic",
    name: "Nikola Ilić",
    role: {
      sr: "Agent za novogradnju i investicije",
      en: "New Build & Investment Agent",
      ru: "Агент по новостройкам и инвестициям",
      de: "Makler für Neubau und Investment",
    },
    bio: {
      sr: "Radi sa investitorima i kupcima iz dijaspore na Novom Beogradu i u Zemunu. Prati rokove završetka, povraćaj PDV-a za prvi stan i uslove kreditiranja po projektima.",
      en: "Works with investors and diaspora buyers in Novi Beograd and Zemun. Tracks completion dates, the first-home VAT refund and the financing terms available per development.",
      ru: "Работает с инвесторами и покупателями из диаспоры в Нови-Белграде и Земуне. Отслеживает сроки сдачи, возврат НДС за первую квартиру и условия кредитования по проектам.",
      de: "Arbeitet mit Investoren und Käufern aus der Diaspora in Novi Beograd und Zemun. Verfolgt Fertigstellungstermine, die MwSt.-Rückerstattung für die erste Wohnung und die Finanzierungsbedingungen je Projekt.",
    },
    languages: ["sr", "en", "ru"],
    phone: "+381 11 000 0014",
    viber: "+381 11 000 0014",
    whatsapp: "+381 11 000 0014",
    email: "nikola@mihajlo-estate.local",
    areas: ["novi-beograd", "zemun", "kopaonik"],
    licenseId: "DEMO-004",
    availability: workweek("09:00", "17:00", ["10:00", "14:00"]),
  },
];
