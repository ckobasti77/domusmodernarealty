import type { Metadata } from "next";
import { InviteScreen } from "@/components/admin/auth/InviteScreen";

export const metadata: Metadata = {
  title: "Pozivnica",
  // The token is in the path; never let it leave the site in a Referer.
  referrer: "no-referrer",
};

/** Invite acceptance: the invited person sets a password (Convex Auth `signUp`). */
export default async function InvitePage({ params }: PageProps<"/admin/pozivnica/[token]">) {
  const { token } = await params;
  return <InviteScreen token={decodeURIComponent(token)} />;
}
