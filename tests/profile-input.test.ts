import { describe, expect, it } from "vitest";
import { mergeLegacyCompleted, parseProfileInput } from "../src/domain/profile-input";

const majors = ["CPS19"];

describe("parseProfileInput", () => {
  it("accepts an empty course list and blank optional fields", () => {
    const result = parseProfileInput({ majorCode: "cps19", courses: [] }, majors);
    expect(result).toEqual({
      ok: true,
      value: {
        majorCode: "CPS19",
        courses: [],
        yearOfStudy: null,
        admissionCohort: null,
        interests: null,
      },
    });
  });

  it("strips the checkbox and reason from a completed course", () => {
    const result = parseProfileInput(
      {
        majorCode: "CPS19",
        courses: [
          {
            courseCode: "csci1001",
            status: "completed",
            recognizesPrerequisite: true,
            reason: "nope",
          },
        ],
      },
      majors,
    );
    expect(result.ok && result.value.courses[0]).toEqual({
      courseCode: "CSCI1001",
      status: "completed",
      recognizesPrerequisite: false,
      reason: null,
    });
  });

  it("rejects a duplicate, a bad code, a long reason, and an unknown cohort", () => {
    expect(
      parseProfileInput({ majorCode: "CPS19", courses: [{ courseCode: "NOPE", status: "completed" }] }, majors).ok,
    ).toBe(false);
    expect(
      parseProfileInput(
        {
          majorCode: "CPS19",
          courses: [
            { courseCode: "CSCI1001", status: "waived" },
            { courseCode: "CSCI1001", status: "transfer" },
          ],
        },
        majors,
      ).ok,
    ).toBe(false);
    expect(parseProfileInput({ majorCode: "CPS19", courses: [], admissionCohort: "1990/1991" }, majors).ok).toBe(
      false,
    );
    expect(
      parseProfileInput(
        {
          majorCode: "CPS19",
          courses: [{ courseCode: "EELC1011", status: "waived", reason: "x".repeat(161) }],
        },
        majors,
      ).ok,
    ).toBe(false);
  });

  it("parses a legacy completed list without inventing an empty course list", () => {
    const result = parseProfileInput({ majorCode: "CPS19", completed: ["csci1001"] }, majors);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toHaveProperty("courses");
    expect(result).toEqual({
      ok: true,
      value: {
        majorCode: "CPS19",
        completedCodes: ["CSCI1001"],
        yearOfStudy: null,
        admissionCohort: null,
        interests: null,
      },
    });
  });

  it("keeps waived and transfer rows when a legacy completed list replaces completed rows", () => {
    expect(
      mergeLegacyCompleted(
        [
          {
            courseCode: "CSCI1001",
            status: "completed",
            recognizesPrerequisite: false,
            reason: null,
          },
          {
            courseCode: "EELC1011",
            status: "waived",
            recognizesPrerequisite: false,
            reason: "placement",
          },
          {
            courseCode: "ACCT1000",
            status: "transfer",
            recognizesPrerequisite: true,
            reason: "exchange",
          },
        ],
        ["CSCI1000"],
      ),
    ).toEqual([
      {
        courseCode: "CSCI1000",
        status: "completed",
        recognizesPrerequisite: false,
        reason: null,
      },
      {
        courseCode: "EELC1011",
        status: "waived",
        recognizesPrerequisite: false,
        reason: "placement",
      },
      {
        courseCode: "ACCT1000",
        status: "transfer",
        recognizesPrerequisite: true,
        reason: "exchange",
      },
    ]);
  });

  it("treats an explicit empty course list as authoritative over a legacy completed field", () => {
    const result = parseProfileInput(
      { majorCode: "CPS19", courses: [], completed: ["CSCI1001"] },
      majors,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        majorCode: "CPS19",
        courses: [],
        yearOfStudy: null,
        admissionCohort: null,
        interests: null,
      },
    });
  });
});
