import type { Metadata } from "next";
import { AuthCard } from "@/components/admin/auth/AuthCard";
import { InviteAcceptForm } from "@/components/admin/auth/InviteAcceptForm";

export const metadata: Metadata = {
  title: "Pozivnica",
  // The token is in the path; never let it leave the site in a Referer.
  referrer: "no-referrer",
};

/** Invite acceptance: the invited person sets a password (Convex Auth `signUp`). */
export default async function InvitePage({ params }: PageProps<"/admin/pozivnica/[token]">) {
  const { token } = await params;
  return (
    <AuthCard
      eyebrow="Pozivnica u tim"
      lede="Postavite lozinku za svoj nalog. Uloga i ovlašćenja dolaze iz pozivnice."
      footer="Pozivnica važi 7 dana i može se iskoristiti samo jednom."
    >
      <InviteAcceptForm token={decodeURIComponent(token)} />
    </AuthCard>
  );
}
