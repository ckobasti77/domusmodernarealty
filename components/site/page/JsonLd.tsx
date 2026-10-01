import { serializeJsonLd, type JsonLd } from "@/lib/jsonld";

/** A `<script type="application/ld+json">`; `serializeJsonLd` escapes `<`. */
export function JsonLdScript({ data }: { data: JsonLd | JsonLd[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
