"use client";

import type { ReactNode } from "react";
import { theme } from "@/domain/theme";
import type { Day } from "@/domain/types";
import type { WeekBlock } from "@/domain/week";

const DAY_NAME: Record<Day, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};

const DEFAULT_START = 8 * 60;
const DEFAULT_END = 18 * 60;

function formatClock(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function formatSpan(start: number, end: number): string {
  return `${formatClock(start)}–${formatClock(end)}`;
}

function proposalFill(background: string): string {
  return `color-mix(in srgb, ${background} 50%, ${theme.sheet})`;
}

function hourRange(blocks: WeekBlock[]): { start: number; end: number } {
  if (blocks.length === 0) {
    return { start: DEFAULT_START, end: DEFAULT_END };
  }
  const earliest = Math.min(...blocks.map((block) => block.startMinutes));
  const latest = Math.max(...blocks.map((block) => block.endMinutes));
  const start = Math.min(DEFAULT_START, Math.floor(earliest / 60) * 60);
  const end = Math.max(DEFAULT_END, Math.ceil(latest / 60) * 60);
  return { start, end };
}

export function Week({
  days,
  blocks,
  removingKey,
  onRemove,
  removable = true,
  header,
  footer,
}: {
  days: Day[];
  blocks: WeekBlock[];
  removingKey: string | null;
  onRemove: (sectionKey: string) => void;
  removable?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
}) {
  const range = hourRange(blocks);
  const hours: number[] = [];
  for (let minute = range.start; minute < range.end; minute += 60) {
    hours.push(minute);
  }

  const span = range.end - range.start;

  return (
    <section
      aria-label="Week"
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        background: theme.sheet,
        border: `1px solid ${theme.line}`,
        borderRadius: 14,
        boxShadow: "var(--shadow)",
        overflow: "hidden",
      }}
    >
      {header ? (
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 12, padding: "16px 16px 12px" }}>
          {header}
        </div>
      ) : null}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          flex: 1,
          minHeight: Math.max(520, hours.length * 48),
          minWidth: 960,
          display: "grid",
          gridTemplateColumns: `72px repeat(${days.length}, minmax(0, 1fr))`,
          gridTemplateRows: "auto minmax(0, 1fr)",
        }}
      >
        <div
          style={{
            padding: "12px 8px",
            textAlign: "right",
            color: theme.muted,
            fontSize: 13,
            fontWeight: 600,
            borderBottom: `1px solid ${theme.line}`,
          }}
        >
          Time
        </div>
        {days.map((day) => (
          <div
            key={day}
            style={{
              padding: "12px 8px",
              textAlign: "center",
              fontWeight: 600,
              borderBottom: `1px solid ${theme.line}`,
              borderLeft: `1px solid ${theme.line}`,
            }}
          >
            {DAY_NAME[day]}
          </div>
        ))}
        <div style={{ position: "relative" }}>
          {hours.map((minute) => (
            <div
              key={minute}
              style={{
                position: "absolute",
                top: `${((minute - range.start) / span) * 100}%`,
                right: 8,
                color: theme.muted,
                fontSize: 13,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatClock(minute)}
            </div>
          ))}
          <div
            style={{
              position: "absolute",
              right: 8,
              bottom: 0,
              color: theme.muted,
              fontSize: 13,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatClock(range.end)}
          </div>
        </div>
        {days.map((day) => (
          <div key={day} style={{ position: "relative", borderLeft: `1px solid ${theme.line}` }}>
            {hours.map((minute) => (
              <div
                key={minute}
                style={{
                  position: "absolute",
                  top: `${((minute - range.start) / span) * 100}%`,
                  left: 0,
                  right: 0,
                  borderTop: `1px solid ${theme.line}`,
                }}
              />
            ))}
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, borderTop: `1px solid ${theme.line}` }} />
            {blocks
              .filter((block) => block.day === day)
              .map((block) => {
                const top = `${((block.startMinutes - range.start) / span) * 100}%`;
                const height = `${Math.max(((block.endMinutes - block.startMinutes) / span) * 100, 8)}%`;
                const hue = theme.hues[block.hue];
                const time = formatSpan(block.startMinutes, block.endMinutes);
                const proposalBlock = block.kind === "proposal";
                const previewBlock = block.kind === "preview";
                const removing = removingKey === block.sectionKey;
                return (
                  <div
                    key={`${block.sectionKey}-${block.day}-${block.startMinutes}`}
                    data-kind={block.kind}
                    style={{
                      position: "absolute",
                      top,
                      height,
                      left: 6,
                      right: 6,
                      background: previewBlock
                        ? "transparent"
                        : proposalBlock
                        ? proposalFill(hue.background)
                        : hue.background,
                      color: hue.text,
                      borderTop: previewBlock
                        ? `1.5px dotted ${hue.edge}`
                        : proposalBlock
                        ? `1.5px dashed ${hue.edge}`
                        : undefined,
                      borderRight: previewBlock
                        ? `1.5px dotted ${hue.edge}`
                        : proposalBlock
                        ? `1.5px dashed ${hue.edge}`
                        : undefined,
                      borderBottom: previewBlock
                        ? `1.5px dotted ${hue.edge}`
                        : proposalBlock
                        ? `1.5px dashed ${hue.edge}`
                        : undefined,
                      borderLeft: `3px solid ${hue.edge}`,
                      boxSizing: "border-box",
                      borderRadius: 6,
                      padding: block.kind !== "saved" || !removable ? "6px 8px" : "6px 28px 6px 8px",
                      overflow: "hidden",
                      boxShadow: block.conflict ? `inset 0 0 0 2px ${theme.rose}` : undefined,
                      zIndex: block.conflict ? 1 : 0,
                      animation: "none",
                      transition: "none",
                    }}
                    className="group"
                  >
                    {block.kind !== "saved" || !removable ? null : (
                      <button
                        type="button"
                        onClick={() => onRemove(block.sectionKey)}
                        disabled={removing}
                        aria-label={`Remove ${block.courseCode} ${DAY_NAME[block.day]} ${time}`}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100"
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          minWidth: 24,
                          minHeight: 24,
                          border: "none",
                          background: "transparent",
                          color: "inherit",
                          font: "inherit",
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: "underline",
                          textUnderlineOffset: 3,
                          padding: "2px 4px",
                          cursor: removing ? "default" : "pointer",
                          opacity: removing ? 1 : undefined,
                        }}
                      >
                        {removing ? "Removing…" : "×"}
                      </button>
                    )}
                    <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{block.courseCode}</div>
                    <p
                      title={block.title}
                      style={{
                        margin: "2px 0 0",
                        fontSize: 13,
                        lineHeight: 1.3,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {previewBlock
                        ? `${block.title} · Preview`
                        : proposalBlock
                        ? `${block.title} · Proposal`
                        : block.title}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>{time}</p>
                    {block.conflict ? <p style={srOnly}>Scheduling conflict</p> : null}
                  </div>
                );
              })}
          </div>
        ))}
      </div>
      </div>
      {footer ? (
        <div
          style={{
            flex: "0 0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: "12px 16px",
            background: "#FAFBFD",
            borderTop: `1px solid ${theme.line}`,
          }}
        >
          {footer}
        </div>
      ) : null}
    </section>
  );
}

const srOnly = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
} as const;
