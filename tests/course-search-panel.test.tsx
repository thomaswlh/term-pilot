import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CourseSearchPanel } from "../src/components/course-search-panel";
import { statusLine } from "../src/domain/academic";
import type { SearchHitDetail } from "../src/domain/course-group";

const mockHit: SearchHitDetail = {
  sectionKey: "MATH1001:001",
  courseCode: "MATH1001",
  section: "001",
  title: "Calculus I",
  teacher: "Dr. Euler",
  unit: "3",
  department: "FST",
  notes: "Requires graphic calculator",
  restriction: "",
  prerequisites: [
    {
      preRequisiteFor: "ALL",
      majorList: "",
      requiredCount: 1,
      groupNo: "1",
      requiredCourseCode: "MATH1000",
    },
  ],
  meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 + 15 }],
  credits: 3,
};

const mockSiblingHit: SearchHitDetail = {
  sectionKey: "MATH1001:002",
  courseCode: "MATH1001",
  section: "002",
  title: "Calculus I",
  teacher: "Dr. Gauss",
  unit: "3",
  department: "FST",
  notes: "",
  restriction: "",
  prerequisites: [],
  meetings: [{ day: "TUE", startMinutes: 14 * 60, endMinutes: 15 * 60 + 15 }],
  credits: 3,
};

describe("CourseSearchPanel", () => {
  it("renders the 46px collapsed rail when closed", () => {
    const html = renderToStaticMarkup(
      <CourseSearchPanel
        open={false}
        onToggleOpen={() => {}}
        query=""
        onQueryChange={() => {}}
        hits={[]}
        searching={false}
        savedSections={[]}
        savedKeys={[]}
        majorCode="CPS19"
        openProposal={false}
        hoveredKey={null}
        onHoverKey={() => {}}
        pinnedKey={null}
        onPinKey={() => {}}
        onAddSection={() => {}}
        busyKey={null}
        recentQueries={[]}
        notice={null}
        focusNonce={0}
      />,
    );

    expect(html).toContain("FIND COURSES");
    expect(html).toContain('aria-label="Expand course discovery"');
    expect(html).toContain("border-radius:14px");
    expect(html).toContain("box-shadow:var(--shadow)");
    expect(html).not.toContain('aria-label="Find Courses (⌘K or /)"');
    expect(html).not.toContain("Calculus I");
  });

  it("renders the 360px expanded drawer with header, filter chips, and course cards", () => {
    const html = renderToStaticMarkup(
      <CourseSearchPanel
        open={true}
        onToggleOpen={() => {}}
        query="MATH1001"
        onQueryChange={() => {}}
        hits={[mockHit]}
        searching={false}
        savedSections={[]}
        savedKeys={[]}
        majorCode="CPS19"
        openProposal={false}
        hoveredKey={null}
        onHoverKey={() => {}}
        pinnedKey={null}
        onPinKey={() => {}}
        onAddSection={() => {}}
        busyKey={null}
        recentQueries={[]}
        notice={null}
        focusNonce={0}
      />,
    );

    expect(html).toContain("Find Courses");
    expect(html).not.toContain("⌘K");
    expect(html).toContain('aria-label="Collapse course discovery"');
    expect(html).toContain("All");
    expect(html).toContain("Fits Schedule");
    expect(html).toContain("Major Eligible");
    expect(html).toContain("MATH1001");
    expect(html).toContain("Calculus I");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("3 credits");
    expect(html).not.toContain("Dr. Euler");
    expect(html).not.toContain("Fits schedule");
    expect(html).not.toContain("+ Add");
  });

  it("displays proposal lock banner and disables add button when proposal is open", () => {
    const htmlWithProposal = renderToStaticMarkup(
      <CourseSearchPanel
        open={true}
        onToggleOpen={() => {}}
        query="MATH1001"
        onQueryChange={() => {}}
        hits={[mockHit]}
        searching={false}
        savedSections={[]}
        savedKeys={[]}
        majorCode="CPS19"
        openProposal={true}
        hoveredKey={null}
        onHoverKey={() => {}}
        pinnedKey="MATH1001:001"
        onPinKey={() => {}}
        onAddSection={() => {}}
        busyKey={null}
        recentQueries={[]}
        notice={null}
        focusNonce={0}
      />,
    );

    expect(htmlWithProposal).toContain("Finish reviewing the open AI proposal to add courses manually.");
    expect(htmlWithProposal).toContain("+ Add");
    expect(htmlWithProposal).toContain("+ Add to Timetable");
    expect(htmlWithProposal).toMatch(/<button[^>]*disabled=""[^>]*>\+ Add<\/button>/);
    expect(htmlWithProposal).toMatch(/<button[^>]*disabled=""[^>]*>\+ Add to Timetable<\/button>/);

    const htmlWithoutProposal = renderToStaticMarkup(
      <CourseSearchPanel
        open={true}
        onToggleOpen={() => {}}
        query="MATH1001"
        onQueryChange={() => {}}
        hits={[mockHit]}
        searching={false}
        savedSections={[]}
        savedKeys={[]}
        majorCode="CPS19"
        openProposal={false}
        hoveredKey={null}
        onHoverKey={() => {}}
        pinnedKey="MATH1001:001"
        onPinKey={() => {}}
        onAddSection={() => {}}
        busyKey={null}
        recentQueries={[]}
        notice={null}
        focusNonce={0}
      />,
    );

    expect(htmlWithoutProposal).toContain("+ Add");
    expect(htmlWithoutProposal).toContain("+ Add to Timetable");
    expect(htmlWithoutProposal).not.toMatch(/<button[^>]*disabled=""[^>]*>\+ Add<\/button>/);
    expect(htmlWithoutProposal).not.toMatch(/<button[^>]*disabled=""[^>]*>\+ Add to Timetable<\/button>/);
  });

  it("renders pinned inspector with section stepper when a section is pinned", () => {
    const html = renderToStaticMarkup(
      <CourseSearchPanel
        open={true}
        onToggleOpen={() => {}}
        query="MATH1001"
        onQueryChange={() => {}}
        hits={[{ ...mockHit, restriction: "CLASS FOR: FST19 STUDENTS" }]}
        searching={false}
        savedSections={[]}
        savedKeys={[]}
        majorCode="FST19"
        openProposal={false}
        hoveredKey={null}
        onHoverKey={() => {}}
        pinnedKey="MATH1001:001"
        onPinKey={() => {}}
        onAddSection={() => {}}
        busyKey={null}
        recentQueries={[]}
        notice={null}
        focusNonce={0}
      />,
    );

    expect(html).toContain("+ Add to Timetable");
    expect(html).toContain("Requires graphic calculator");
    expect(html).toContain("CLASS FOR: FST19 STUDENTS");
    expect(html).toContain("Prerequisite: MATH1000");
    expect(html).toContain("Prev");
    expect(html).toContain("Next");
  });

  it("shows recent searches and category jumps for an empty query", () => {
    const html = renderToStaticMarkup(
      <CourseSearchPanel
        open={true}
        onToggleOpen={() => {}}
        query=""
        onQueryChange={() => {}}
        hits={[]}
        searching={false}
        savedSections={[]}
        savedKeys={[]}
        majorCode="CPS19"
        openProposal={false}
        hoveredKey={null}
        onHoverKey={() => {}}
        pinnedKey={null}
        onPinKey={() => {}}
        onAddSection={() => {}}
        busyKey={null}
        recentQueries={["GELH1012"]}
        notice={null}
        focusNonce={0}
      />,
    );

    expect(html).toContain("Recent searches");
    expect(html).toContain("GELH1012");
    expect(html).not.toContain("Categories");
    expect(html).not.toContain("Computer Science");
  });

  it("shows a spacious collapsed course card with wrapping title", () => {
    const html = renderToStaticMarkup(
      <CourseSearchPanel
        open={true}
        onToggleOpen={() => {}}
        query="MATH1001"
        onQueryChange={() => {}}
        hits={[mockHit]}
        searching={false}
        savedSections={[]}
        savedKeys={[]}
        majorCode="CPS19"
        openProposal={false}
        hoveredKey={null}
        onHoverKey={() => {}}
        pinnedKey={null}
        onPinKey={() => {}}
        onAddSection={() => {}}
        busyKey={null}
        recentQueries={[]}
        notice={null}
        focusNonce={0}
      />,
    );

    expect(html).toContain("MATH1001");
    expect(html).toContain("Calculus I");
    expect(html).toContain("border-radius:8px");
    expect(html).toContain("3 credits");
    expect(html).not.toContain("text-overflow:ellipsis");
  });

  it("uses Preview instead of Add when the section overlaps", () => {
    const html = renderToStaticMarkup(
      <CourseSearchPanel
        open={true}
        onToggleOpen={() => {}}
        query="MATH1001"
        onQueryChange={() => {}}
        hits={[mockHit]}
        searching={false}
        savedSections={[
          {
            courseCode: "GELH1012",
            section: "001",
            title: "World History",
            courseType: "",
            unit: "3",
            department: "FAH",
            teacher: "Dr. Smith",
            notes: "",
            restriction: "",
            meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
          },
        ]}
        savedKeys={["GELH1012:001"]}
        majorCode="CPS19"
        openProposal={false}
        hoveredKey={null}
        onHoverKey={() => {}}
        pinnedKey={null}
        onPinKey={() => {}}
        onAddSection={() => {}}
        busyKey={null}
        recentQueries={[]}
        notice={null}
        focusNonce={0}
      />,
    );

    expect(html).not.toContain("Overlaps GELH1012");
    expect(html).not.toContain(">Preview<");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("+ Add");
  });

  it("shows the untimed notice in the pinned inspector", () => {
    const untimed = { ...mockHit, meetings: [], restriction: "" };
    const html = renderToStaticMarkup(
      <CourseSearchPanel
        open={true}
        onToggleOpen={() => {}}
        query="MATH1001"
        onQueryChange={() => {}}
        hits={[untimed]}
        searching={false}
        savedSections={[]}
        savedKeys={[]}
        majorCode="CPS19"
        openProposal={false}
        hoveredKey={null}
        onHoverKey={() => {}}
        pinnedKey="MATH1001:001"
        onPinKey={() => {}}
        onAddSection={() => {}}
        busyKey={null}
        recentQueries={[]}
        notice={null}
        focusNonce={0}
      />,
    );

    expect(html).toContain("Untimed Course");
    expect(html).toContain("This section has no scheduled meetings and will not appear on the weekly calendar.");
    expect(html).toContain("+ Add to Timetable");
    const addRowStart = html.indexOf("+ Add</button>");
    expect(addRowStart).toBeGreaterThan(-1);
    expect(html.slice(Math.max(0, addRowStart - 120), addRowStart)).not.toContain("disabled=");
    expect(html).not.toMatch(/\+ Add to Timetable[\s\S]{0,400}disabled/);
  });

  it("supports stepper across filtered-out sections and explains Fits Schedule removal", () => {
    const savedOverlap = {
      courseCode: "GELH1012",
      section: "001",
      title: "World History",
      courseType: "",
      unit: "3",
      department: "FAH",
      teacher: "Dr. Smith",
      notes: "",
      restriction: "",
      meetings: [{ day: "MON" as const, startMinutes: 10 * 60, endMinutes: 11 * 60 }],
    };

    const html = renderToStaticMarkup(
      <CourseSearchPanel
        open={true}
        onToggleOpen={() => {}}
        query="MATH1001"
        onQueryChange={() => {}}
        hits={[mockHit, mockSiblingHit]}
        searching={false}
        savedSections={[savedOverlap]}
        savedKeys={["GELH1012:001"]}
        majorCode="CPS19"
        openProposal={false}
        hoveredKey={null}
        onHoverKey={() => {}}
        pinnedKey="MATH1001:001"
        onPinKey={() => {}}
        onAddSection={() => {}}
        busyKey={null}
        recentQueries={[]}
        notice={null}
        focusNonce={0}
        activeFilter="fits"
      />,
    );

    // The result list omits the overlapping section
    expect(html).not.toContain("Sec 001");
    expect(html).toContain("Sec 002");
    // Inspector shows (1 of 2), both Prev and Next, and the Fits Schedule hidden notice
    expect(html).toContain("(1 of 2)");
    expect(html).toContain("Prev");
    expect(html).toContain("Next");
    expect(html).toContain("This section is hidden by Fits Schedule because it overlaps GELH1012.");
  });

  it("explains Fits Schedule removal for restriction and unverified, not overlap", () => {
    const restrictedHit: SearchHitDetail = {
      ...mockHit,
      sectionKey: "CSCI1004:001",
      courseCode: "CSCI1004",
      section: "001",
      restriction: "Class not for : - CLL19",
    };
    const unverifiedHit: SearchHitDetail = {
      sectionKey: "BECO4007:001",
      courseCode: "BECO4007",
      section: "001",
      title: "Topic",
      teacher: "",
      unit: "FBA",
      department: "BEC",
      restriction: "Class for : - FBA - THIRD YEAR / FOURTH YEAR",
      meetings: [{ day: "WED", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      credits: 3,
    };
    const fitContext = {
      yearOfStudy: null,
      programme: "FBA",
      known: {
        majors: ["CLL19", "ACC21"],
        programmes: ["FBA"],
        specializations: [] as { majorCode: string; code: string }[],
      },
    };

    const restrictedHtml = renderToStaticMarkup(
      <CourseSearchPanel
        open={true}
        onToggleOpen={() => {}}
        query="CSCI"
        onQueryChange={() => {}}
        hits={[restrictedHit, mockSiblingHit]}
        searching={false}
        savedSections={[]}
        savedKeys={[]}
        majorCode="CLL19"
        fitContext={fitContext}
        openProposal={false}
        hoveredKey={null}
        onHoverKey={() => {}}
        pinnedKey="CSCI1004:001"
        onPinKey={() => {}}
        onAddSection={() => {}}
        busyKey={null}
        recentQueries={[]}
        notice={null}
        focusNonce={0}
        activeFilter="fits"
      />,
    );

    expect(restrictedHtml).toContain("This section is hidden by Fits Schedule because Not for CLL19");
    expect(restrictedHtml).not.toContain("because it overlaps");

    const unverifiedHtml = renderToStaticMarkup(
      <CourseSearchPanel
        open={true}
        onToggleOpen={() => {}}
        query="BECO"
        onQueryChange={() => {}}
        hits={[unverifiedHit, mockSiblingHit]}
        searching={false}
        savedSections={[]}
        savedKeys={[]}
        majorCode="ACC21"
        fitContext={fitContext}
        openProposal={false}
        hoveredKey={null}
        onHoverKey={() => {}}
        pinnedKey="BECO4007:001"
        onPinKey={() => {}}
        onAddSection={() => {}}
        busyKey={null}
        recentQueries={[]}
        notice={null}
        focusNonce={0}
        activeFilter="fits"
      />,
    );

    expect(unverifiedHtml).toContain("This section is hidden by Fits Schedule because");
    expect(unverifiedHtml).toContain("unverified");
    expect(unverifiedHtml).not.toContain("because it overlaps");
    expect(unverifiedHtml).not.toMatch(/unverified\.\./);
  });

  it("shows all sections and no hidden notice when activeFilter is all", () => {
    const savedOverlap = {
      courseCode: "GELH1012",
      section: "001",
      title: "World History",
      courseType: "",
      unit: "3",
      department: "FAH",
      teacher: "Dr. Smith",
      notes: "",
      restriction: "",
      meetings: [{ day: "MON" as const, startMinutes: 10 * 60, endMinutes: 11 * 60 }],
    };

    const html = renderToStaticMarkup(
      <CourseSearchPanel
        open={true}
        onToggleOpen={() => {}}
        query="MATH1001"
        onQueryChange={() => {}}
        hits={[mockHit, mockSiblingHit]}
        searching={false}
        savedSections={[savedOverlap]}
        savedKeys={["GELH1012:001"]}
        majorCode="CPS19"
        openProposal={false}
        hoveredKey={null}
        onHoverKey={() => {}}
        pinnedKey="MATH1001:001"
        onPinKey={() => {}}
        onAddSection={() => {}}
        busyKey={null}
        recentQueries={[]}
        notice={null}
        focusNonce={0}
        activeFilter="all"
      />,
    );

    expect(html).toContain("Sec 001");
    expect(html).toContain("Sec 002");
    expect(html).not.toContain("hidden by");
  });

  it("explains Major Eligible removal while preserving full course stepper count", () => {
    const restrictedHit: SearchHitDetail = {
      sectionKey: "MATH1001:001",
      courseCode: "MATH1001",
      section: "001",
      title: "Calculus I",
      teacher: "Dr. Euler",
      unit: "3",
      department: "FST",
      notes: "",
      restriction: "Class not for : - CLL19",
      prerequisites: [],
      meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
    };
    const fitContext = {
      yearOfStudy: null,
      known: {
        majors: ["CLL19"],
        programmes: [] as string[],
        specializations: [] as { majorCode: string; code: string }[],
      },
    };

    const html = renderToStaticMarkup(
      <CourseSearchPanel
        open={true}
        onToggleOpen={() => {}}
        query="MATH1001"
        onQueryChange={() => {}}
        hits={[restrictedHit, mockSiblingHit]}
        searching={false}
        savedSections={[]}
        savedKeys={[]}
        majorCode="CLL19"
        fitContext={fitContext}
        openProposal={false}
        hoveredKey={null}
        onHoverKey={() => {}}
        pinnedKey="MATH1001:001"
        onPinKey={() => {}}
        onAddSection={() => {}}
        busyKey={null}
        recentQueries={[]}
        notice={null}
        focusNonce={0}
        activeFilter="major"
      />,
    );

    expect(html).toContain("This section is hidden by Major Eligible because it is not for CLL19.");
    expect(html).toContain("(1 of 2)");
    expect(html).not.toContain("Sec 001");
    expect(html).toContain("Sec 002");
  });

  it("renders notice with error tone by default and muted color for info tone", () => {
    const errorHtml = renderToStaticMarkup(
      <CourseSearchPanel
        open={true}
        onToggleOpen={() => {}}
        query=""
        onQueryChange={() => {}}
        hits={[]}
        searching={false}
        savedSections={[]}
        savedKeys={[]}
        majorCode="CPS19"
        openProposal={false}
        hoveredKey={null}
        onHoverKey={() => {}}
        pinnedKey={null}
        onPinKey={() => {}}
        onAddSection={() => {}}
        busyKey={null}
        recentQueries={[]}
        notice="Could not reach the server."
        focusNonce={0}
      />,
    );

    expect(errorHtml).toContain("Could not reach the server.");
    expect(errorHtml).toContain('color:#B3261E');

    const infoHtml = renderToStaticMarkup(
      <CourseSearchPanel
        open={true}
        onToggleOpen={() => {}}
        query=""
        onQueryChange={() => {}}
        hits={[]}
        searching={false}
        savedSections={[]}
        savedKeys={[]}
        majorCode="CPS19"
        openProposal={false}
        hoveredKey={null}
        onHoverKey={() => {}}
        pinnedKey={null}
        onPinKey={() => {}}
        onAddSection={() => {}}
        busyKey={null}
        recentQueries={[]}
        notice="Saved as a new timetable."
        noticeTone="info"
        focusNonce={0}
      />,
    );

    expect(infoHtml).toContain("Saved as a new timetable.");
    expect(infoHtml).toContain('color:#596573');
    expect(infoHtml).not.toContain('color:#B3261E');
  });

  it("shows a student-reported status line for a profile course and keeps the section addable", () => {
    const line = statusLine("waived", true);
    const html = renderToStaticMarkup(
      <CourseSearchPanel
        open={true}
        onToggleOpen={() => {}}
        query="MATH1001"
        onQueryChange={() => {}}
        hits={[mockHit, { ...mockSiblingHit, courseCode: "PHYS1001", sectionKey: "PHYS1001:002", title: "Physics I" }]}
        searching={false}
        savedSections={[]}
        savedKeys={[]}
        majorCode="CPS19"
        openProposal={false}
        hoveredKey={null}
        onHoverKey={() => {}}
        pinnedKey="MATH1001:001"
        onPinKey={() => {}}
        onAddSection={() => {}}
        busyKey={null}
        recentQueries={[]}
        notice={null}
        focusNonce={0}
        courses={[
          {
            courseCode: "MATH1001",
            status: "waived",
            recognizesPrerequisite: true,
            reason: null,
          },
        ]}
      />,
    );

    expect(html.split(line)).toHaveLength(2);
    expect(html).toContain("Fits schedule");
    expect(html).toContain("+ Add");
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>\+ Add<\/button>/);
    expect(html).toContain("MATH1001");
    expect(html).toContain("PHYS1001");
  });
});
