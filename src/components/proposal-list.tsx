"use client";

import type { ProposalStatus } from "@/db/store";
import { Button } from "@/components/ui/button";
import { theme } from "@/domain/theme";

export type ProposalListItem = {
  id: string;
  summary: string;
  status: ProposalStatus;
  stale: boolean;
};

export function proposalStatusLabel(status: ProposalStatus): string {
  if (status === "open") return "Open";
  if (status === "applied") return "Applied";
  if (status === "saved-as-new") return "Saved as new";
  return "Discarded";
}

export function resolvedProposalSentence(status: ProposalStatus): string {
  if (status === "applied") return "This proposal was applied to the current timetable.";
  if (status === "saved-as-new") return "This proposal was saved as a new timetable.";
  return "This proposal was discarded.";
}

export function ProposalList({
  items,
  selectedId,
  onOpenProposal,
  onHideProposal,
}: {
  items: ProposalListItem[];
  selectedId: string | null;
  onOpenProposal: (proposalId: string) => void;
  onHideProposal: () => void;
}) {
  if (items.length === 0) {
    return (
      <p style={{ margin: 0, color: theme.muted, fontSize: 14, lineHeight: 1.45 }}>No proposals yet.</p>
    );
  }

  return (
    <ul
      aria-label="Proposal history"
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        overflow: "auto",
        flex: 1,
        minHeight: 0,
      }}
    >
      {items.map((item) => {
        const pressed = item.id === selectedId;
        const meta = [proposalStatusLabel(item.status), item.stale && item.status === "open" ? "Out of date" : null]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={item.id}>
            <article
              style={{
                borderLeft: "3px solid var(--accent)",
                paddingLeft: 12,
                paddingTop: 4,
                paddingBottom: 4,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <p style={{ margin: 0, fontSize: 12, color: theme.muted }}>{meta}</p>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, color: "var(--ink)" }}>
                {item.summary || "Open this proposal"}
              </p>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-pressed={pressed}
                  onClick={pressed ? onHideProposal : () => onOpenProposal(item.id)}
                  style={{
                    borderRadius: 8,
                    borderColor: "var(--line)",
                    background: pressed ? "var(--field)" : "transparent",
                    color: "var(--ink)",
                    fontSize: 13,
                    padding: "4px 10px",
                    height: "auto",
                  }}
                >
                  {pressed ? "Hide from week" : "Show on week"}
                </Button>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
