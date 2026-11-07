import { describe, expect, it } from "vitest";
import {
  evaluateSectionFit,
  filterCourseGroups,
  groupHitsByCourse,
  type SearchHitDetail,
} from "../src/domain/course-group";
import type { Section } from "../src/domain/types";

const mockHit1: SearchHitDetail = {
  sectionKey: "MATH1001:001",
  courseCode: "MATH1001",
  section: "001",
  title: "Calculus I",
  teacher: "Dr. Euler",
  unit: "FSC",
  department: "FST",
  notes: "",
  restriction: "",
  prerequisites: [],
  meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 + 15 }],
};

const mockHit2: SearchHitDetail = {
  ...mockHit1,
  sectionKey: "MATH1001:002",
  section: "002",
  teacher: "Dr. Gauss",
  meetings: [{ day: "TUE", startMinutes: 14 * 60, endMinutes: 15 * 60 + 15 }],
};

const mockHit3: SearchHitDetail = {
  sectionKey: "CSCI1004:001",
  courseCode: "CSCI1004",
  section: "001",
  title: "Intro to Programming",
  teacher: "Dr. Turing",
  unit: "FSC",
  department: "FST",
  notes: "",
  restriction: "CLASS NOT FOR: CLL19 STUDENTS",
  prerequisites: [],
  meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 + 15 }],
};

const mockSavedSection: Section = {
  courseCode: "GELH1012",
  section: "001",
  title: "World History",
  unit: "3",
  department: "FAH",
  teacher: "Dr. Smith",
  notes: "",
  restriction: "",
  meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
};

describe("groupHitsByCourse", () => {
  it("groups multiple sections under the same course code preserving order", () => {
    const groups = groupHitsByCourse([mockHit1, mockHit2, mockHit3]);
    expect(groups).toHaveLength(2);
    expect(groups[0].courseCode).toBe("MATH1001");
    expect(groups[0].title).toBe("Calculus I");
    expect(groups[0].credits).toBe(3);
    expect(groups[0].sections).toHaveLength(2);
    expect(groups[1].courseCode).toBe("CSCI1004");
    expect(groups[1].sections).toHaveLength(1);
  });
});

describe("evaluateSectionFit", () => {
  it("returns 'added' when the sectionKey is already in savedKeys", () => {
    const fit = evaluateSectionFit(mockHit1, [mockSavedSection], ["MATH1001:001"], "CLL19");
    expect(fit.status).toBe("added");
    expect(fit.label).toBe("Added");
  });

  it("returns 'overlap' when meetings clash with a saved section", () => {
    const fit = evaluateSectionFit(mockHit1, [mockSavedSection], ["GELH1012:001"], "CLL19");
    expect(fit.status).toBe("overlap");
    expect(fit.label).toBe("Overlaps GELH1012");
  });

  it("returns 'restriction' when major is in CLASS NOT FOR restriction", () => {
    const fit = evaluateSectionFit(mockHit3, [], [], "CLL19");
    expect(fit.status).toBe("restriction");
    expect(fit.label).toBe("Not for CLL19");
  });

  it("returns 'fits' when schedule is free and major is allowed", () => {
    const fit = evaluateSectionFit(mockHit2, [mockSavedSection], ["GELH1012:001"], "CLL19");
    expect(fit.status).toBe("fits");
    expect(fit.label).toBe("Fits schedule");
  });

  it("returns 'untimed' when meetings array is empty", () => {
    const untimedHit: SearchHitDetail = {
      ...mockHit1,
      sectionKey: "THES4000:001",
      courseCode: "THES4000",
      meetings: [],
    };
    const fit = evaluateSectionFit(untimedHit, [], [], "CLL19");
    expect(fit.status).toBe("untimed");
    expect(fit.label).toBe("Untimed Course");
  });
});

describe("filterCourseGroups", () => {
  it("filters courses based on 'fits' selection", () => {
    const groups = groupHitsByCourse([mockHit1, mockHit2, mockHit3]);
    const filtered = filterCourseGroups(groups, "fits", [mockSavedSection], ["GELH1012:001"], "CLL19");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].courseCode).toBe("MATH1001");
    expect(filtered[0].sections).toHaveLength(1);
    expect(filtered[0].sections[0].sectionKey).toBe("MATH1001:002");
  });

  it("keeps a restricted section with no time overlap under Fits Schedule", () => {
    const restrictedFree: SearchHitDetail = {
      ...mockHit2,
      sectionKey: "CSCI1004:002",
      courseCode: "CSCI1004",
      section: "002",
      restriction: "CLASS NOT FOR: CLL19 STUDENTS",
    };
    const groups = groupHitsByCourse([restrictedFree, mockHit1]);
    const filtered = filterCourseGroups(groups, "fits", [mockSavedSection], ["GELH1012:001"], "CLL19");
    expect(filtered.map((group) => group.courseCode)).toEqual(["CSCI1004"]);
  });

  it("keeps an untimed section under Fits Schedule", () => {
    const untimed: SearchHitDetail = { ...mockHit1, sectionKey: "THES4000:001", courseCode: "THES4000", meetings: [] };
    const groups = groupHitsByCourse([untimed, mockHit1]);
    const filtered = filterCourseGroups(groups, "fits", [mockSavedSection], ["GELH1012:001"], "CLL19");
    expect(filtered.map((group) => group.courseCode)).toEqual(["THES4000"]);
  });

  it("filters courses based on 'major' selection", () => {
    const groups = groupHitsByCourse([mockHit1, mockHit2, mockHit3]);
    const filtered = filterCourseGroups(groups, "major", [], [], "CLL19");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].courseCode).toBe("MATH1001");
  });
});
