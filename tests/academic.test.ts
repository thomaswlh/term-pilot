import { describe, expect, it } from "vitest";
import {
  addPresetCourses,
  automaticSkipSentence,
  coursesFromCompleted,
  declaredStatusSentence,
  prerequisiteClaims,
  prerequisiteReportedSentence,
  resolveCourseRecords,
  statusLine,
  UNIVERSITY_ENGLISH_CODES,
} from "../src/domain/academic";

describe("academic records", () => {
  it("builds claims without copying waived courses into completed", () => {
    const claims = prerequisiteClaims([
      { courseCode: "CSCI1001", status: "completed", recognizesPrerequisite: false, reason: null },
      { courseCode: "EELC1011", status: "waived", recognizesPrerequisite: false, reason: null },
      { courseCode: "ACCT1000", status: "transfer", recognizesPrerequisite: true, reason: "exchange" },
    ]);
    expect(claims).toEqual([
      { courseCode: "CSCI1001", basis: "completed" },
      { courseCode: "ACCT1000", basis: "transfer" },
    ]);
  });

  it("treats null course records as legacy completed codes and an empty array as cleared", () => {
    expect(resolveCourseRecords({ courseRecords: null, completed: ["CSCI1001"] })).toEqual(
      coursesFromCompleted(["CSCI1001"]),
    );
    expect(resolveCourseRecords({ courseRecords: [], completed: ["CSCI1001"] })).toEqual([]);
  });

  it("adds only selected English codes that are not already listed", () => {
    const existing = coursesFromCompleted(["EELC1012"]);
    const next = addPresetCourses(existing, [UNIVERSITY_ENGLISH_CODES[0], "EELC1012"]);
    expect(next.map((course) => course.courseCode)).toEqual(["EELC1012", "EELC1011"]);
    expect(next[1]).toMatchObject({ status: "waived", recognizesPrerequisite: false, reason: null });
  });

  it("adds nothing when the English selection is empty", () => {
    expect(addPresetCourses(coursesFromCompleted(["CSCI1000"]), [])).toEqual(
      coursesFromCompleted(["CSCI1000"]),
    );
  });

  it("uses the specified sentences", () => {
    expect(declaredStatusSentence("EELC1011", "waived")).toBe(
      "You reported EELC1011 as waived or tested out. Placed because you asked for it.",
    );
    expect(automaticSkipSentence("EELC1011", "waived")).toBe(
      "You reported EELC1011 as waived or tested out, so it was not added automatically.",
    );
    expect(prerequisiteReportedSentence("CSCI2000:001", "CSCI1001", "transfer")).toBe(
      "Prerequisite for CSCI2000:001 uses your report that UM recognized CSCI1001 (a transfer equivalent). This is student-reported.",
    );
    expect(statusLine("completed", false)).toBe("You reported this as completed.");
    expect(statusLine("waived", true)).toBe(
      "You reported this as waived or tested out. You reported that UM recognized this for prerequisites.",
    );
  });
});
