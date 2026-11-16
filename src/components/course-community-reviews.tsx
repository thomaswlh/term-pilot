"use client";

import { useEffect, useState } from "react";
import { theme } from "@/domain/theme";
import { understandingBlurb } from "@/domain/what2reg/understand";
import { WHAT2REG_ATTRIBUTION, WHAT2REG_DISCLAIMER, type ReviewLookup } from "@/domain/what2reg/types";

function score(value: number | null): string {
  return value === null ? "—" : String(value);
}

export function CommunityReviewBody({
  lookup,
}: {
  lookup: Pick<ReviewLookup, "status" | "disclaimer" | "instructors" | "attribution" | "understanding">;
}) {
  return (
    <section aria-label="Community reviews" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: theme.muted }}>{lookup.disclaimer}</p>
      {lookup.understanding ? (
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.45, color: theme.ink }}>{understandingBlurb(lookup.understanding)}</p>
      ) : null}
      {lookup.status === "unauthorized" ? (
        <a
          href="/what2reg"
          style={{ fontSize: 13, fontWeight: 600, color: theme.accent, textDecoration: "none" }}
        >
          Connect 選咩課
        </a>
      ) : null}
      {lookup.status === "unavailable" ? (
        <p style={{ margin: 0, fontSize: 12.5, color: theme.muted }}>
          Community reviews are unavailable right now. Course selection still works.
        </p>
      ) : null}
      {lookup.status === "empty" ? (
        <p style={{ margin: 0, fontSize: 12.5, color: theme.muted }}>No public review summaries for this course yet.</p>
      ) : null}
      {lookup.status === "ok"
        ? lookup.instructors.map((instructor) => (
            <div key={instructor.name} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: theme.ink }}>{instructor.name}</p>
              <p style={{ margin: 0, fontSize: 12.5, color: theme.ink }}>
                Grade {score(instructor.grade)} · Difficulty {score(instructor.difficulty)} · Usefulness{" "}
                {score(instructor.usefulness)}
              </p>
              {instructor.summaries.slice(0, 3).map((summary) => (
                <p key={summary.text} style={{ margin: 0, fontSize: 12.5, lineHeight: 1.4, color: theme.ink }}>
                  {summary.text}
                </p>
              ))}
              {instructor.url ? (
                <a href={instructor.url} style={{ fontSize: 12.5, color: theme.accent }} target="_blank" rel="noreferrer">
                  Open on {WHAT2REG_ATTRIBUTION}
                </a>
              ) : null}
            </div>
          ))
        : null}
    </section>
  );
}

export function CourseCommunityReviews({
  courseCode,
  instructors,
}: {
  courseCode: string;
  instructors: string[];
}) {
  const [lookup, setLookup] = useState<ReviewLookup | null>(null);
  const instructorKey = instructors.join("\n");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    params.set("courseCode", courseCode);
    for (const name of instructorKey.length > 0 ? instructorKey.split("\n") : []) {
      if (name.trim()) params.append("instructor", name);
    }
    fetch(`/api/what2reg/reviews?${params.toString()}`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<ReviewLookup>) : Promise.reject(new Error("unavailable"))))
      .then((payload) => {
        if (!controller.signal.aborted) setLookup(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!controller.signal.aborted) {
          setLookup({
            status: "unavailable",
            courseCode,
            attribution: WHAT2REG_ATTRIBUTION,
            disclaimer: WHAT2REG_DISCLAIMER,
            instructors: [],
            understanding: null,
            mayRejectLegalCourse: false,
          });
        }
      });
    return () => controller.abort();
  }, [courseCode, instructorKey]);

  if (!lookup) {
    return (
      <section aria-label="Community reviews" style={{ padding: "0 14px 12px" }}>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: theme.muted }}>{WHAT2REG_DISCLAIMER}</p>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: theme.muted }}>Looking up community reviews…</p>
      </section>
    );
  }

  return (
    <div style={{ padding: "0 14px 12px" }}>
      <CommunityReviewBody lookup={lookup} />
    </div>
  );
}
