import { notFound } from "next/navigation";
import { SharedSchedule } from "@/components/shared-schedule";
import { appStore } from "@/db/server-store";
import { loadCatalogue, parseSectionKey, sectionKey } from "@/domain/catalogue";
import { loadCreditBook } from "@/domain/credit-snapshot";
import { creditReport, formatCredits } from "@/domain/credits";
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

  const courseCodes = row.sectionKeys.map((key) => parseSectionKey(key).courseCode);
  const creditLabel = formatCredits(creditReport(courseCodes, loadCreditBook()));

  return <SharedSchedule title={row.title} sections={sections} creditLabel={creditLabel} />;
}
