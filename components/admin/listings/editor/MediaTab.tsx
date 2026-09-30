"use client";

import { MediaManager } from "@/components/admin/listings/media/MediaManager";
import type { EditorData } from "./editor-context";
import { Group, TabPanel, TextField } from "./fields";

export function MediaTab({ data }: { data: EditorData }) {
  return (
    <TabPanel
      id="panel-mediji"
      title="Mediji"
      description="Fotografije i planovi se čuvaju odmah po otpremanju. Za objavu je potrebno najmanje 5 fotografija i izabrana naslovna."
    >
      <MediaManager
        listingId={data.listing._id}
        media={data.listing.media}
        floorPlans={data.listing.floorPlans}
        mediaUrls={data.mediaUrls}
      />
      <Group title="Video" layout="stack">
        <TextField
          name="videoUrl"
          id="f-videoUrl"
          label="Adresa videa"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://www.youtube.com/watch?v=…"
          hint="YouTube ili Vimeo, adresa počinje sa https://. Video se prikazuje u galeriji oglasa; prazno polje ga uklanja."
        />
      </Group>
    </TabPanel>
  );
}
