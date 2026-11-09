"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  XIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ClockIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { theme } from "@/domain/theme";
import type { Section } from "@/domain/types";
import {
  evaluateSectionFit,
  filterCourseGroups,
  groupHitsByCourse,
  type CourseGroup,
  type FitStatus,
  type SearchHitDetail,
} from "@/domain/course-group";

export type CourseSearchPanelProps = {
  open: boolean;
  onToggleOpen: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  hits: SearchHitDetail[];
  searching: boolean;
  savedSections: Section[];
  savedKeys: string[];
  majorCode: string | null;
  openProposal: boolean;
  hoveredKey: string | null;
  onHoverKey: (key: string | null) => void;
  pinnedKey: string | null;
  onPinKey: (key: string | null) => void;
  onAddSection: (hit: SearchHitDetail) => void;
  busyKey: string | null;
  recentQueries: string[];
  notice: string | null;
  noticeTone?: "error" | "info";
  focusNonce: number;
  activeFilter?: "all" | "fits" | "major";
};

function formatPrerequisites(hit: SearchHitDetail): string | null {
  const codes = [
    ...new Set((hit.prerequisites ?? []).map((row) => row.requiredCourseCode.trim()).filter((code) => code.length > 0)),
  ];
  if (codes.length === 0) return null;
  return `Prerequisite: ${codes.join(", ")}`;
}

type QuickFilter = "all" | "fits" | "major";

function getHiddenFilterMessage(
  pinnedHit: SearchHitDetail | null,
  filter: QuickFilter,
  savedSections: Section[],
  savedKeys: string[],
  majorCode: string | null,
  isPinnedInFiltered: boolean,
): string | null {
  if (!pinnedHit || isPinnedInFiltered) return null;
  if (filter === "major") {
    return `This section is hidden by Major Eligible because it is not for ${majorCode ?? ""}.`;
  }
  if (filter === "fits") {
    const fit = evaluateSectionFit(pinnedHit, savedSections, savedKeys, null);
    const code = fit.status === "overlap" ? fit.conflictingCourseCode : "";
    return `This section is hidden by Fits Schedule because it overlaps ${code}.`;
  }
  return null;
}

const DAY_SHORT: Record<string, string> = {
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
  SUN: "Sun",
};

function formatClock(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function CourseSearchPanel({
  open,
  onToggleOpen,
  query,
  onQueryChange,
  hits,
  searching,
  savedSections,
  savedKeys,
  majorCode,
  openProposal,
  hoveredKey,
  onHoverKey,
  pinnedKey,
  onPinKey,
  onAddSection,
  busyKey,
  recentQueries,
  notice,
  noticeTone = "error",
  focusNonce,
  activeFilter = "all",
}: CourseSearchPanelProps) {
  const [filter, setFilter] = useState<QuickFilter>(activeFilter);
  const [prevActiveFilter, setPrevActiveFilter] = useState(activeFilter);
  if (prevActiveFilter !== activeFilter) {
    setPrevActiveFilter(activeFilter);
    setFilter(activeFilter);
  }

  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(() => {
    if (!pinnedKey) return new Set();
    const courseCode = pinnedKey.split(":")[0];
    return courseCode ? new Set([courseCode]) : new Set();
  });
  const [prevQuery, setPrevQuery] = useState(query);
  const [prevPinnedKey, setPrevPinnedKey] = useState(pinnedKey);
  if (prevQuery !== query) {
    setPrevQuery(query);
    setExpandedCourses(new Set());
  }
  if (prevPinnedKey !== pinnedKey && pinnedKey) {
    setPrevPinnedKey(pinnedKey);
    const courseCode = pinnedKey.split(":")[0];
    if (courseCode) {
      setExpandedCourses((prev) => {
        if (prev.has(courseCode)) return prev;
        const next = new Set(prev);
        next.add(courseCode);
        return next;
      });
    }
  } else if (prevPinnedKey !== pinnedKey) {
    setPrevPinnedKey(pinnedKey);
  }

  const [hoveredCourse, setHoveredCourse] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const toggleCourseExpanded = useCallback((courseCode: string) => {
    setExpandedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(courseCode)) {
        next.delete(courseCode);
      } else {
        next.add(courseCode);
      }
      return next;
    });
  }, []);
  const rawGroups = groupHitsByCourse(hits);
  const filteredGroups = filterCourseGroups(rawGroups, filter, savedSections, savedKeys, majorCode);
  const pinnedHit = pinnedKey ? hits.find((h) => h.sectionKey === pinnedKey) ?? null : null;
  const courseGroup = pinnedHit ? rawGroups.find((g) => g.courseCode === pinnedHit.courseCode) ?? null : null;
  const pinnedSiblings = courseGroup ? courseGroup.sections : (pinnedHit ? [pinnedHit] : []);
  const pinnedIndex = pinnedHit ? pinnedSiblings.findIndex((section) => section.sectionKey === pinnedHit.sectionKey) : -1;
  const isPinnedInFiltered = pinnedHit
    ? filteredGroups.some((group) => group.sections.some((s) => s.sectionKey === pinnedHit.sectionKey))
    : false;

  const hiddenMessage = getHiddenFilterMessage(
    pinnedHit,
    filter,
    savedSections,
    savedKeys,
    majorCode,
    isPinnedInFiltered,
  );

  const stepPinnedRef = useRef<(direction: "prev" | "next") => void>(() => {});
  useEffect(() => {
    stepPinnedRef.current = (direction: "prev" | "next") => {
      if (!pinnedHit || pinnedSiblings.length <= 1 || pinnedIndex < 0) return;
      const nextIndex =
        direction === "prev"
          ? (pinnedIndex - 1 + pinnedSiblings.length) % pinnedSiblings.length
          : (pinnedIndex + 1) % pinnedSiblings.length;
      onPinKey(pinnedSiblings[nextIndex].sectionKey);
    };
  });

  const stepPinned = (direction: "prev" | "next") => {
    stepPinnedRef.current(direction);
  };

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open, focusNonce]);

  useEffect(() => {
    if (!open || !pinnedKey) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }
      event.preventDefault();
      stepPinnedRef.current(event.key === "ArrowUp" ? "prev" : "next");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pinnedKey]);

  if (!open) {
    return (
      <aside
        aria-label="Course Discovery Rail"
        style={{
          width: 46,
          flex: "0 0 46px",
          background: theme.sheet,
          border: `1px solid ${theme.line}`,
          borderRadius: 14,
          boxShadow: "var(--shadow)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "12px 0",
          minHeight: 0,
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            width: "100%",
            paddingTop: 4,
            flexShrink: 0,
          }}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Expand course discovery"
            onClick={onToggleOpen}
            style={{ borderRadius: 8, width: 28, height: 28 }}
          >
            <ChevronLeftIcon aria-hidden style={{ width: 16, height: 16 }} />
          </Button>
          <span
            style={{
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: theme.muted,
              userSelect: "none",
            }}
          >
            FIND COURSES
          </span>
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Course Discovery"
      style={{
        width: 360,
        flex: "0 0 360px",
        background: theme.sheet,
        border: `1px solid ${theme.line}`,
        borderRadius: 14,
        boxShadow: "var(--shadow)",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Pinned Header */}
      <div
        style={{
          height: 54,
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${theme.line}`,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600 }}>Find Courses</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Collapse course discovery"
          onClick={onToggleOpen}
          style={{ width: 28, height: 28, borderRadius: 8 }}
        >
          <ChevronRightIcon aria-hidden style={{ width: 16, height: 16 }} />
        </Button>
      </div>

      {/* AI Proposal Notice */}
      {openProposal ? (
        <div
          role="alert"
          style={{
            padding: "8px 14px",
            background: "#FBEAE9",
            borderBottom: "1px solid #F4C7C3",
            color: theme.rose,
            fontSize: 12.5,
            lineHeight: 1.4,
            fontWeight: 500,
          }}
        >
          Finish reviewing the open AI proposal to add courses manually.
        </div>
      ) : null}
      {notice ? (
        <div
          role="alert"
          style={{
            padding: "8px 14px",
            color: noticeTone === "error" ? theme.rose : theme.muted,
            fontSize: 12.5,
            lineHeight: 1.4,
          }}
        >
          {notice}
        </div>
      ) : null}

      {/* Search Bar & Quick Filters */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <SearchIcon
            aria-hidden
            style={{
              position: "absolute",
              left: 10,
              width: 16,
              height: 16,
              color: theme.muted,
              pointerEvents: "none",
            }}
          />
          <input
            id="course-search-query"
            ref={inputRef}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={(event) => {
              event.currentTarget.style.borderColor = theme.accent;
            }}
            onBlur={(event) => {
              event.currentTarget.style.borderColor = theme.line;
            }}
            placeholder="Course code, title, or instructor"
            style={{
              width: "100%",
              height: 38,
              paddingLeft: 34,
              paddingRight: query ? 32 : 10,
              fontSize: 13.5,
              borderRadius: 8,
              border: `1px solid ${theme.line}`,
              background: theme.field,
              color: theme.ink,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search query"
              onClick={() => onQueryChange("")}
              style={{
                position: "absolute",
                right: 8,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 4,
                color: theme.muted,
              }}
            >
              <XIcon style={{ width: 14, height: 14 }} />
            </button>
          ) : null}
        </div>

        {/* Filter Pills */}
        <div style={{ display: "flex", gap: 6 }}>
          {(
            [
              { id: "all", label: "All" },
              { id: "fits", label: "Fits Schedule" },
              { id: "major", label: "Major Eligible" },
            ] as const
          ).map((item) => {
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                style={{
                  height: 26,
                  padding: "0 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: active ? 600 : 500,
                  border: active ? `1px solid ${theme.accent}` : `1px solid transparent`,
                  background: active ? theme.accentLight : theme.field,
                  color: active ? theme.accentInk : theme.ink,
                  cursor: "pointer",
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stream of Results */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "0 14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {searching ? (
          <div aria-busy="true" style={{ display: "flex", flexDirection: "column", gap: 8, padding: 8 }}>
            <p style={{ margin: 0, color: theme.muted, fontSize: 13 }}>Searching…</p>
            {[0, 1, 2].map((row) => (
              <div key={row} style={{ height: 52, borderRadius: 8, background: theme.field }} />
            ))}
          </div>
        ) : query.trim() && filteredGroups.length === 0 ? (
          <p style={{ margin: 0, padding: 8, color: theme.muted, fontSize: 13 }}>
            No courses match &apos;{query}&apos;. Try a course code, a title word, or an instructor name.
          </p>
        ) : !query.trim() ? (
          <div style={{ padding: "12px 8px", color: theme.muted, fontSize: 12.5, lineHeight: 1.5 }}>
            {recentQueries.length > 0 ? (
              <>
                <p style={{ margin: "0 0 8px", fontWeight: 600, color: theme.ink }}>Recent searches</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {recentQueries.map((recent) => (
                    <button
                      key={recent}
                      type="button"
                      onClick={() => onQueryChange(recent)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: `1px solid ${theme.line}`,
                        background: theme.field,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {recent}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : (
          filteredGroups.map((group) => {
            const isExpanded = expandedCourses.has(group.courseCode);
            const sectionsPanelId = `course-sections-${group.courseCode}`;
            const isHovered = hoveredCourse === group.courseCode;

            return (
              <article
                key={group.courseCode}
                onPointerEnter={() => setHoveredCourse(group.courseCode)}
                onPointerLeave={() => setHoveredCourse(null)}
                style={{
                  background: isHovered && !isExpanded ? "#FAFBFD" : theme.sheet,
                  border: `1px solid ${isExpanded ? theme.accent : theme.line}`,
                  borderRadius: 8,
                  boxShadow: "0 1px 2px rgba(22, 27, 32, 0.04)",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={sectionsPanelId}
                  onClick={() => toggleCourseExpanded(group.courseCode)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    background: isExpanded ? theme.ground : "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    boxSizing: "border-box",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: 13.5,
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        color: theme.ink,
                      }}
                    >
                      {group.courseCode}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span
                        style={{
                          fontSize: 12,
                          color: theme.muted,
                          whiteSpace: "nowrap",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {group.credits} credits · {group.sections.length}{" "}
                        {group.sections.length === 1 ? "section" : "sections"}
                      </span>
                      <ChevronDownIcon
                        aria-hidden
                        style={{
                          width: 16,
                          height: 16,
                          flexShrink: 0,
                          color: theme.muted,
                          transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.15s ease",
                        }}
                      />
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 14,
                      fontWeight: 600,
                      color: theme.ink,
                      lineHeight: 1.45,
                    }}
                  >
                    {group.title}
                  </div>
                </button>

                {isExpanded ? (
                  <div
                    id={sectionsPanelId}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      borderTop: `1px solid ${theme.line}`,
                      background: theme.sheet,
                    }}
                  >
                    {group.sections.map((section, idx) => {
                  const fit = evaluateSectionFit(section, savedSections, savedKeys, majorCode);
                  const isHovered = hoveredKey === section.sectionKey;
                  const isPinned = pinnedKey === section.sectionKey;
                  const isAdded = fit.status === "added";
                  const isBusy = busyKey === section.sectionKey;
                  const conflict = fit.status === "overlap" || fit.status === "restriction";

                  return (
                    <div
                      key={section.sectionKey}
                      onPointerEnter={() => onHoverKey(section.sectionKey)}
                      onPointerLeave={() => onHoverKey(null)}
                      onClick={() => onPinKey(isPinned ? null : section.sectionKey)}
                      style={{
                        padding: "10px 14px",
                        borderTop: idx === 0 ? "none" : `1px solid ${theme.line}`,
                        background: isPinned
                          ? theme.accentLight
                          : isHovered
                          ? theme.field
                          : "transparent",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontWeight: 600, fontSize: 12.5 }}>Sec {section.section}</span>
                        {renderFitBadge(fit)}
                      </div>

                      <div style={{ fontSize: 12, color: theme.muted }}>
                        {section.teacher ? <span>{section.teacher} · </span> : null}
                        <span>
                          {section.meetings.length === 0
                            ? "Untimed"
                            : section.meetings
                                .map(
                                  (m) =>
                                    `${DAY_SHORT[m.day]} ${formatClock(m.startMinutes)}–${formatClock(m.endMinutes)}`,
                                )
                                .join(", ")}
                        </span>
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 2 }}>
                        {conflict ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(event) => {
                              event.stopPropagation();
                              onPinKey(section.sectionKey);
                            }}
                            style={{ height: 28, padding: "0 10px", fontSize: 12, borderRadius: 6 }}
                          >
                            Preview
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            disabled={isAdded || openProposal || isBusy}
                            onClick={(event) => {
                              event.stopPropagation();
                              onAddSection(section);
                            }}
                            style={{
                              height: 28,
                              padding: "0 10px",
                              fontSize: 12,
                              borderRadius: 6,
                              background: isAdded ? theme.field : theme.ink,
                              color: isAdded ? theme.muted : "#FFFFFF",
                            }}
                          >
                            {isBusy ? "Adding…" : isAdded ? "Added" : "+ Add"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                    })}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>

      {/* Pinned Section Inspector */}
      {pinnedHit ? (
        <div
          style={{
            borderTop: `1px solid ${theme.line}`,
            background: "#FAFBFD",
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{pinnedHit.sectionKey}</span>
              <span style={{ fontSize: 12, color: theme.muted, marginLeft: 6 }}>
                ({(pinnedIndex >= 0 ? pinnedIndex + 1 : 1)} of {pinnedSiblings.length})
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => stepPinned("prev")}
                disabled={pinnedSiblings.length <= 1}
                style={{ height: 24, padding: "0 6px", fontSize: 11 }}
              >
                <ArrowUpIcon style={{ width: 12, height: 12, marginRight: 2 }} /> Prev
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => stepPinned("next")}
                disabled={pinnedSiblings.length <= 1}
                style={{ height: 24, padding: "0 6px", fontSize: 11 }}
              >
                Next <ArrowDownIcon style={{ width: 12, height: 12, marginLeft: 2 }} />
              </Button>
              <button
                type="button"
                aria-label="Close inspector"
                onClick={() => onPinKey(null)}
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2 }}
              >
                <XIcon style={{ width: 14, height: 14, color: theme.muted }} />
              </button>
            </div>
          </div>

          <div style={{ fontSize: 12, color: theme.ink, lineHeight: 1.4 }}>
            <div>{pinnedHit.title}</div>
            {hiddenMessage ? (
              <div style={{ color: theme.rose, marginTop: 4 }}>{hiddenMessage}</div>
            ) : null}
            {pinnedHit.notes ? <div style={{ color: theme.muted, marginTop: 4 }}>Note: {pinnedHit.notes}</div> : null}
            {formatPrerequisites(pinnedHit) ? (
              <div style={{ marginTop: 4 }}>{formatPrerequisites(pinnedHit)}</div>
            ) : null}
            {pinnedHit.restriction ? (
              <div style={{ color: theme.rose, marginTop: 4 }}>{pinnedHit.restriction}</div>
            ) : null}
            {pinnedHit.meetings.length === 0 ? (
              <div style={{ color: theme.muted, marginTop: 4 }}>
                This section has no scheduled meetings and will not appear on the weekly calendar.
              </div>
            ) : null}
          </div>

          <Button
            type="button"
            disabled={savedKeys.includes(pinnedHit.sectionKey) || openProposal || busyKey === pinnedHit.sectionKey}
            onClick={() => onAddSection(pinnedHit)}
            style={{
              width: "100%",
              height: 34,
              borderRadius: 8,
              background: theme.accent,
              color: "#FFFFFF",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {busyKey === pinnedHit.sectionKey
              ? "Adding…"
              : savedKeys.includes(pinnedHit.sectionKey)
              ? "Already on Timetable"
              : "+ Add to Timetable"}
          </Button>
        </div>
      ) : null}
    </aside>
  );
}

function renderFitBadge(fit: FitStatus) {
  if (fit.status === "fits") {
    return (
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          background: "#D8EDE1",
          color: "#144425",
          border: "1px solid #BCE1CB",
          borderRadius: 4,
          padding: "1px 6px",
        }}
      >
        {fit.label}
      </span>
    );
  }
  if (fit.status === "overlap" || fit.status === "restriction") {
    return (
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          background: "#FBEAE9",
          color: theme.rose,
          border: "1px solid #F4C7C3",
          borderRadius: 4,
          padding: "1px 6px",
        }}
      >
        {fit.label}
      </span>
    );
  }
  if (fit.status === "added") {
    return (
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          background: theme.field,
          color: theme.ink,
          borderRadius: 4,
          padding: "1px 6px",
        }}
      >
        {fit.label}
      </span>
    );
  }
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        background: theme.field,
        color: theme.muted,
        borderRadius: 4,
        padding: "1px 6px",
      }}
    >
      <ClockIcon style={{ width: 10, height: 10, display: "inline", marginRight: 2 }} />
      {fit.label}
    </span>
  );
}
