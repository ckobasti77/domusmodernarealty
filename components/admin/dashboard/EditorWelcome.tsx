import { FileText, Languages, MapPin, Newspaper, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DashCard } from "./DashCard";

const MODULES: readonly { label: string; text: string; icon: LucideIcon }[] = [
  { label: "Magazin", text: "Tekstovi o tržištu, naseljima i kupovini", icon: Newspaper },
  { label: "Sadržaj sajta", text: "Stranice O nama i Kontakt, pravni tekstovi", icon: FileText },
  { label: "Lokacije", text: "Opisi gradova, opština i naselja", icon: MapPin },
  { label: "Prevodi", text: "Engleski, ruski i nemački sadržaj", icon: Languages },
];

/**
 * Editors work on content only (PRD B1), and those modules are not in the
 * panel yet — so instead of empty queues they get an honest overview.
 */
export function EditorWelcome() {
  return (
    <DashCard
      title="Vaš deo panela"
      description="Kao urednik, Vi uređujete sadržaj sajta. Moduli za to stižu uskoro; do tada nema zadataka za Vas."
      className="max-w-3xl"
    >
      <ul className="grid gap-3 sm:grid-cols-2">
        {MODULES.map((item) => (
          <li key={item.label} className="flex items-start gap-3 rounded-lg border p-3">
            <item.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center justify-between gap-2 text-sm font-medium">
                {item.label}
                <Badge variant="outline" className="text-muted-foreground">
                  uskoro
                </Badge>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </DashCard>
  );
}
