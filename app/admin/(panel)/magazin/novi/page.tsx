import type { Metadata } from "next";
import { NewPostScreen } from "@/components/admin/posts/NewPostScreen";

export const metadata: Metadata = {
  title: "Novi tekst",
};

/** Creates an empty draft, then hands over to the editor. */
export default function NewPostPage() {
  return <NewPostScreen />;
}
