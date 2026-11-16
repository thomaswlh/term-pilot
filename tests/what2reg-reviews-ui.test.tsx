import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CommunityReviewBody } from "../src/components/course-community-reviews";
import { CourseSearchPanel } from "../src/components/course-search-panel";
import type { SearchHitDetail } from "../src/domain/course-group";
import { WHAT2REG_DISCLAIMER } from "../src/domain/what2reg/types";

const hit: SearchHitDetail = {
  sectionKey: "CSCI1001:001",
  courseCode: "CSCI1001",
  section: "001",
  title: "Programming",
  teacher: "CHAN TAI MAN",
  unit: "FIC",
  department: "CIS",
  notes: "",
  restriction: "",
  prerequisites: [],
  meetings: [{ day: "MON", startMinutes: 9 * 60, endMinutes: 10 * 60 }],
  credits: 3,
};

describe("community review UI", () => {
  it("shows ratings, a source link, and the community-opinion disclaimer", () => {
    const html = renderToStaticMarkup(
      <CommunityReviewBody
        lookup={{
          status: "ok",
          attribution: "澳大選咩課 / What2Reg @ UM",
          disclaimer: WHAT2REG_DISCLAIMER,
          understanding: {
            courseCode: "CSCI1001",
            impression: { grade: "Grade score 3.5: in the middle.", difficulty: null, usefulness: null },
            themes: ["workload"],
            pros: [],
            cons: [{ text: "The assignments take time.", theme: "workload", groundedIn: "The assignments take time." }],
            uncertainty: "small-sample",
            uncertaintyNote: "Only 1 public comment.",
            sampleSize: 1,
          },
          instructors: [
            {
              name: "CHAN TAI MAN",
              grade: 3.5,
              difficulty: 4,
              usefulness: 4.2,
              url: "https://www.umeh.top/reviews/CSCI1001/CHAN%20TAI%20MAN",
              summaries: [{ text: "The assignments take time.", url: "https://umeh.top/reviews/CSCI1001/CHAN%20TAI%20MAN", publishedAt: null }],
            },
          ],
        }}
      />,
    );
    expect(html).toContain("Grade score 3.5");
    expect(html).toContain("Only 1 public comment.");
    expect(html).toContain("Grade 3.5");
    expect(html).toContain("Difficulty 4");
    expect(html).toContain("Usefulness 4.2");
    expect(html).toContain("The assignments take time.");
    expect(html).toContain("https://www.umeh.top/reviews/CSCI1001/CHAN%20TAI%20MAN");
    expect(html).toContain("not official University of Macau");
    expect(html).not.toContain("What2Reg logo");
  });

  it("shows Connect 選咩課 when the student has not authorized", () => {
    const html = renderToStaticMarkup(
      <CommunityReviewBody
        lookup={{
          status: "unauthorized",
          attribution: "澳大選咩課 / What2Reg @ UM",
          disclaimer: WHAT2REG_DISCLAIMER,
          understanding: null,
          instructors: [],
        }}
      />,
    );
    expect(html).toContain("Connect 選咩課");
    expect(html).toContain('href="/what2reg"');
  });

  it("keeps the opened course card usable when reviews have not loaded", () => {
    const html = renderToStaticMarkup(
      <CourseSearchPanel
        open
        onToggleOpen={() => {}}
        query="CSCI1001"
        onQueryChange={() => {}}
        hits={[hit]}
        searching={false}
        savedSections={[]}
        savedKeys={[]}
        majorCode="CPS19"
        openProposal={false}
        hoveredKey={null}
        onHoverKey={() => {}}
        pinnedKey="CSCI1001:001"
        onPinKey={() => {}}
        onAddSection={() => {}}
        busyKey={null}
        recentQueries={[]}
        notice={null}
        focusNonce={0}
      />,
    );
    expect(html).toContain("+ Add");
    expect(html).toContain(WHAT2REG_DISCLAIMER);
    expect(html).toContain("Looking up community reviews");
  });
});
