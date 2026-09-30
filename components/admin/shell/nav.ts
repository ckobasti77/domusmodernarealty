import {
  BarChart3,
  Building2,
  CalendarDays,
  FileText,
  FlaskConical,
  History,
  Inbox,
  LayoutDashboard,
  MapPin,
  Newspaper,
  Settings,
  Users,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/convex/lib/validators";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: readonly Role[];
  /**
   * False until the section's screens exist (step 09 builds the CRM and
   * content modules). The sidebar shows it disabled with "uskoro" instead of
   * linking to a 404.
   */
  ready: boolean;
};

export type NavGroup = { label: string; items: readonly NavItem[] };

const ALL: readonly Role[] = ["admin", "manager", "agent", "editor"];
const LISTINGS: readonly Role[] = ["admin", "manager", "agent"];
const MANAGERS: readonly Role[] = ["admin", "manager"];
const CONTENT: readonly Role[] = ["admin", "manager", "editor"];
const ADMIN: readonly Role[] = ["admin"];

export const NAV: readonly NavGroup[] = [
  {
    label: "Pregled",
    items: [
      { href: "/admin", label: "Kontrolna tabla", icon: LayoutDashboard, roles: ALL, ready: true },
      { href: "/admin/nekretnine", label: "Nekretnine", icon: Building2, roles: LISTINGS, ready: true },
    ],
  },
  {
    label: "Klijenti",
    items: [
      { href: "/admin/upiti", label: "Upiti", icon: Inbox, roles: LISTINGS, ready: false },
      { href: "/admin/razgledanja", label: "Razgledanja", icon: CalendarDays, roles: LISTINGS, ready: false },
      { href: "/admin/kontakti", label: "Kontakti", icon: UserRound, roles: MANAGERS, ready: false },
    ],
  },
  {
    label: "Sadržaj",
    items: [
      { href: "/admin/lokacije", label: "Lokacije", icon: MapPin, roles: CONTENT, ready: false },
      { href: "/admin/magazin", label: "Magazin", icon: Newspaper, roles: CONTENT, ready: false },
      { href: "/admin/sadrzaj", label: "Sadržaj sajta", icon: FileText, roles: CONTENT, ready: false },
    ],
  },
  {
    label: "Agencija",
    items: [
      { href: "/admin/tim", label: "Tim", icon: Users, roles: MANAGERS, ready: false },
      { href: "/admin/analitika", label: "Analitika", icon: BarChart3, roles: MANAGERS, ready: false },
      { href: "/admin/aktivnost", label: "Aktivnost", icon: History, roles: MANAGERS, ready: false },
      { href: "/admin/podesavanja", label: "Podešavanja", icon: Settings, roles: ADMIN, ready: false },
      { href: "/admin/demo", label: "Demo sadržaj", icon: FlaskConical, roles: ADMIN, ready: true },
    ],
  },
];

/** The groups and items this role may see, empty groups dropped. */
export function navFor(role: Role): NavGroup[] {
  return NAV.map((group) => ({
    label: group.label,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}

/** Longest-prefix match, so `/admin/nekretnine/123` highlights "Nekretnine". */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Static labels for breadcrumb segments. Dynamic ids are labelled by the page. */
export const SEGMENT_LABEL: Record<string, string> = {
  nekretnine: "Nekretnine",
  nova: "Nova nekretnina",
  demo: "Demo sadržaj",
  upiti: "Upiti",
  razgledanja: "Razgledanja",
  kontakti: "Kontakti",
  lokacije: "Lokacije",
  magazin: "Magazin",
  sadrzaj: "Sadržaj sajta",
  tim: "Tim",
  analitika: "Analitika",
  aktivnost: "Aktivnost",
  podesavanja: "Podešavanja",
};
