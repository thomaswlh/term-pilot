import { notFound } from "next/navigation";
import { SharedSchedule } from "@/components/shared-schedule";
import { appStore } from "@/db/server-store";
import { loadCatalogue, sectionKey } from "@/domain/catalogue";
import type { Section } from "@/domain/types";

export default async function SharedTimetablePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await appStore.getSharedTimetable(token);
  if (!row) {
    notFound();
  }

  const catalogue = loadCatalogue();
  const byKey = new Map(catalogue.sections.map((section) => [sectionKey(section), section]));
  const sections: Section[] = [];
  for (const key of row.sectionKeys) {
    const section = byKey.get(key);
    if (section) sections.push(section);
  }

  return <SharedSchedule title={row.title} sections={sections} />;
}
