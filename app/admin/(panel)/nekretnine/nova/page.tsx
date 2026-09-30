import type { Metadata } from "next";
import { NewListingScreen } from "@/components/admin/listings/NewListingForm";

export const metadata: Metadata = {
  title: "Nova nekretnina",
};

/** Creates a private draft, then hands over to the editor. */
export default function NewListingPage() {
  return <NewListingScreen />;
}
