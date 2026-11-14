import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Gallery, type GalleryCard } from "@/components/gallery";
import { loadCatalogue, parseSectionKey, sectionKey } from "@/domain/catalogue";
import { creditReport, formatCredits, miniature } from "@/domain/credits";
import { loadCreditBook } from "@/domain/credit-snapshot";
import { appStore } from "@/db/server-store";
import type { Section } from "@/domain/types";

function formatEdited(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Macau",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default async function TimetablesPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }
  const rows = await appStore.listTimetables(userId);
  const catalogue = loadCatalogue();
  const byKey = new Map(catalogue.sections.map((section) => [sectionKey(section), section]));
  const cards: GalleryCard[] = [...rows]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((row) => {
      const sections: Section[] = [];
      for (const key of row.sectionKeys) {
        const section = byKey.get(key);
        if (section) sections.push(section);
      }
      const courseCodes = row.sectionKeys.map((key) => parseSectionKey(key).courseCode);
      return {
        id: row.id,
        title: row.title,
        editedLabel: formatEdited(row.updatedAt),
        creditLabel: formatCredits(creditReport(courseCodes, loadCreditBook())),
        columns: miniature(sections).columns,
      };
    });

  return <Gallery cards={cards} />;
}
