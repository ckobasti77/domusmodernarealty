import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactsScreen } from "@/components/admin/contacts/ContactsScreen";

export const metadata: Metadata = {
  title: "Kontakti",
};

/**
 * Contacts and consent (PRD B6). The search and the open contact live in the
 * query string (`?q=…&id=…`), and `useSearchParams` needs a Suspense boundary.
 */
export default function ContactsPage() {
  return (
    <Suspense fallback={null}>
      <ContactsScreen />
    </Suspense>
  );
}
