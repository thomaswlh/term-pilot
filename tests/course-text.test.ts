import { describe, expect, it } from "vitest";
import { courseEmbeddingText, courseFields } from "../src/domain/retrieval/course-text";
import type { Section } from "../src/domain/types";

function section(partial: Pick<Section, "courseCode" | "section"> & Partial<Section>): Section {
  return { title: "", unit: "", department: "", teacher: "", notes: "", restriction: "", meetings: [], ...partial };
}

describe("course text", () => {
  it("joins distinct field values in lexicographic order and omits meetings", () => {
    const sections = [
      section({
        courseCode: "MATH1001",
        section: "002",
        title: "Linear Algebra I",
        department: "MTH",
        teacher: "SUN HAIWEI",
        notes: "Tutorial",
        meetings: [{ day: "TUE", startMinutes: 13 * 60, endMinutes: 14 * 60 }],
      }),
      section({
        courseCode: "MATH1001",
        section: "001",
        title: "Linear Algebra I",
        department: "MTH",
        teacher: "JIN XIAO QING",
        notes: "",
      }),
    ];
    expect(courseFields(sections)).toEqual({
      title: "Linear Algebra I",
      department: "MTH",
      instructor: "JIN XIAO QING | SUN HAIWEI",
      notes: "Tutorial",
    });
    expect(courseEmbeddingText("MATH1001", sections)).toBe(
      "MATH1001 Linear Algebra I MTH JIN XIAO QING | SUN HAIWEI Tutorial",
    );
    expect(courseEmbeddingText("MATH1001", sections)).not.toContain("TUE");
  });
});
