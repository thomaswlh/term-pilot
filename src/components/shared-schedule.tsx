"use client";

import { Week } from "@/components/week";
import { theme } from "@/domain/theme";
import type { Section } from "@/domain/types";
import { buildWeek } from "@/domain/week";

function sectionKeyOf(section: Section): string {
  return `${section.courseCode}:${section.section}`;
}

export function SharedSchedule({
  title,
  sections,
  creditLabel,
}: {
  title: string;
  sections: Section[];
  creditLabel: string;
}) {
  const week = buildWeek({
    saved: sections,
    savedKeys: sections.map(sectionKeyOf),
    failures: [],
    proposal: null,
    preview: null,
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: theme.ground,
        color: theme.ink,
      }}
    >
      <header
        style={{
          minHeight: 64,
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "12px 24px",
        }}
      >
        <strong className="tp-wordmark" style={{ fontSize: 18 }}>
          TermPilot
        </strong>
        <h1
          style={{
            flex: 1,
            minWidth: 0,
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </h1>
        <span style={{ color: theme.muted, fontSize: 14, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
          {creditLabel}
        </span>
      </header>
      <main
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          padding: "0 16px 16px",
        }}
      >
        <Week
          days={week.days}
          blocks={week.blocks}
          removingKey={null}
          onRemove={() => {}}
          removable={false}
        />
      </main>
    </div>
  );
}
