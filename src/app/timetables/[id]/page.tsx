import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { Editor, type EditorProposal } from "@/components/editor";
import { appStore } from "@/db/server-store";
import { loadCatalogue, parseSectionKey, sectionKey } from "@/domain/catalogue";
import { demoCredits } from "@/domain/credits";
import { validateSections } from "@/domain/rules";
import type { Section } from "@/domain/types";

export default async function TimetablePage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }
  const { id } = await params;
  const row = await appStore.getTimetable(userId, id);
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
  const credits = demoCredits(row.sectionKeys.map((key) => parseSectionKey(key).courseCode));
  const profile = await appStore.getProfile(userId);
  const shareToken = await appStore.getShareStatus(userId, id);
  const proposalRows = await appStore.listProposals(userId, id);
  const proposals: EditorProposal[] = proposalRows.map((proposal) => {
    const proposalSections: Section[] = [];
    for (const key of proposal.sectionKeys) {
      const section = byKey.get(key);
      if (section) proposalSections.push(section);
    }
    const report = validateSections(
      proposal.sectionKeys,
      { majorCode: profile.majorCode ?? "", completed: profile.completed },
      catalogue,
    );
    return {
      id: proposal.id,
      sectionKeys: proposal.sectionKeys,
      droppedWishes: proposal.droppedWishes,
      summary: proposal.summary,
      sections: proposalSections,
      failures: report.failures,
      status: proposal.status,
      baseRevision: proposal.baseRevision,
      createdAt: proposal.createdAt,
    };
  });

  return (
    <Editor
      timetable={{
        id: row.id,
        title: row.title,
        revision: row.revision,
        sectionKeys: row.sectionKeys,
      }}
      sections={sections}
      credits={credits}
      proposals={proposals}
      shareToken={shareToken}
      majorCode={profile.majorCode}
    />
  );
}
