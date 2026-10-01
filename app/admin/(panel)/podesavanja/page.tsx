import type { Metadata } from "next";
import { SettingsScreen } from "@/components/admin/settings/SettingsScreen";

export const metadata: Metadata = {
  title: "Podešavanja",
};

/** Agency settings (PRD B11): legal data, contact, texts, defaults. Admin only. */
export default function SettingsPage() {
  return <SettingsScreen />;
}
