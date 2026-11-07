import { describe, expect, it } from "vitest";
import { CATALOGUE_FILES, loadCatalogue, sectionKey, timedMeetings } from "../src/domain/catalogue";

describe("catalogue", () => {
  const catalogue = loadCatalogue();

  it("reads only the three add-drop sources", () => {
    expect(CATALOGUE_FILES.schedule.file).toContain("Class Schedules for 1st Semester");
    expect(CATALOGUE_FILES.schedule.sheet).toBe("Class Information");
    expect(CATALOGUE_FILES.prerequisites.sheet).toBe("Pre-requisite Requirements");
    expect(CATALOGUE_FILES.majors.sheet).toBe("Major & Spec List");
    const listed = JSON.stringify(CATALOGUE_FILES);
    expect(listed).not.toContain("pre-enrollment");
    expect(listed).not.toContain("GE Offering");
    expect(listed).not.toContain("Minor List");
  });

  it("groups every meeting of a section and keeps timed meetings", () => {
    const section = catalogue.sections.find((item) => sectionKey(item) === "GELH1012:001");
    expect(section?.title).toContain("Art Appreciation");
    expect(timedMeetings(section!).map((meeting) => [meeting.day, meeting.startMinutes, meeting.endMinutes])).toEqual([
      ["TUE", 13 * 60, 14 * 60 + 15],
      ["FRI", 13 * 60, 14 * 60 + 15],
    ]);
  });

  it("keeps an untimed section searchable and off the grid", () => {
    const section = catalogue.sections.find((item) => sectionKey(item) === "ENGL4000:001");
    expect(section).toBeTruthy();
    expect(timedMeetings(section!)).toEqual([]);
  });

  it("loads majors and the CHLL2004 need-1 rows", () => {
    expect(catalogue.majors).toContainEqual({ code: "CPS19", name: "COMPUTER SCIENCE" });
    expect(catalogue.majors).toContainEqual({ code: "CLL19", name: "CHINESE LANGUAGE AND LITERATURE" });
    const rows = catalogue.prerequisites.filter((row) => row.courseCode === "CHLL2004");
    expect(rows.map((row) => row.requiredCourseCode).sort()).toEqual(["CHLL1003", "CHLL1004"]);
    expect(new Set(rows.map((row) => row.requiredCount))).toEqual(new Set([1]));
  });
});
