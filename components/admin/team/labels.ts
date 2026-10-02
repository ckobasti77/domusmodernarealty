import type { FunctionReturnType } from "convex/server";
import type { DotTone } from "@/components/admin/common/StatusBadge";
import type { api } from "@/convex/_generated/api";
import type { Role, UserStatus } from "@/convex/lib/validators";

export type TeamUser = FunctionReturnType<typeof api.users.list>[number];
export type TeamInvite = FunctionReturnType<typeof api.invites.list>[number];
export type TeamAgent = FunctionReturnType<typeof api.agentsAdmin.list>[number];

/** What each role may do, in one line (invite dialog, role select). */
export const ROLE_HINT: Record<Role, string> = {
  admin: "Sve, uključujući tim, naloge i podešavanja.",
  manager: "Sve osim naloga i podešavanja.",
  agent: "Samo svoje nekretnine, upite i razgledanja.",
  editor: "Magazin, stranice sajta i lokacije.",
};

export const USER_STATUS_TONE: Record<UserStatus, DotTone> = {
  active: "success",
  invited: "warning",
  disabled: "muted",
};

export type InviteState = "pending" | "expired" | "accepted" | "revoked";

export const INVITE_STATE_LABEL: Record<InviteState, string> = {
  pending: "Čeka prihvatanje",
  expired: "Istekla",
  accepted: "Prihvaćena",
  revoked: "Opozvana",
};

export const INVITE_STATE_TONE: Record<InviteState, DotTone> = {
  pending: "warning",
  expired: "muted",
  accepted: "success",
  revoked: "muted",
};

export function inviteState(invite: TeamInvite, now: number): InviteState {
  if (invite.acceptedAt !== undefined) return "accepted";
  if (invite.revokedAt !== undefined) return "revoked";
  if (invite.expiresAt <= now) return "expired";
  return "pending";
}

/** Name, else e-mail: accounts made before names were required may lack one. */
export function userLabel(user: Pick<TeamUser, "name" | "email">): string {
  return user.name ?? user.email ?? "Bez imena";
}

/** Two initials for the monogram avatar (never a stock face). */
export function monogram(name: string): string {
  // Letters and digits only, and a parenthesized note is not part of the name:
  // "Mihajlo (admin)" is MI, like any one-word name.
  const parts = name
    .replace(/\([^)]*\)/g, " ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((part) => part.length > 0);
  if (parts.length === 0) return "ME";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** The four site languages first; the checkbox chips of the profile editor. */
export const CORE_LANGUAGES = ["sr", "en", "ru", "de"] as const;

let displayNames: Intl.DisplayNames | null = null;

/** `it` → `italijanski`; an unknown code is shown as typed. */
export function languageName(code: string): string {
  try {
    displayNames ??= new Intl.DisplayNames(["sr-Latn"], { type: "language" });
    return displayNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** The link the invitee opens. The raw token exists only in this response. */
export function inviteUrl(token: string): string {
  return `${window.location.origin}/admin/pozivnica/${encodeURIComponent(token)}`;
}

/** Serbian count noun: 1 lokacija, 2 lokacije, 5 lokacija (11–14 take "many"). */
export function countNoun(count: number, one: string, few: string, many: string): string {
  const last = count % 10;
  const lastTwo = count % 100;
  if (last === 1 && lastTwo !== 11) return `${count} ${one}`;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} ${few}`;
  return `${count} ${many}`;
}
