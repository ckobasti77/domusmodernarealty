import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/admin/LoginForm";
import { AuthCard } from "@/components/admin/auth/AuthCard";

export const metadata: Metadata = {
  title: "Prijava",
};

/** Admin sign-in (Convex Auth, Password provider, invite-only accounts). */
export default function AdminLoginPage() {
  return (
    <AuthCard
      eyebrow="Administracija"
      lede="Prijavite se nalogom koji ste dobili pozivnicom."
      footer="Nalozi se otvaraju isključivo pozivnicom administratora. Ako ste zaboravili lozinku, obratite se administratoru agencije."
    >
      {/* `useSearchParams` (the post-login target) needs a Suspense boundary. */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
