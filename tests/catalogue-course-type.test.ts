import { describe, expect, it } from "vitest";
import { loadCatalogue } from "../src/domain/catalogue";

describe("schedule course type", () => {
  it("reads GE Course from the workbook and leaves other courses blank", () => {
    const catalogue = loadCatalogue();
    const art = catalogue.sections.find((section) => section.courseCode === "GELH1012");
    const chinese = catalogue.sections.find((section) => section.courseCode === "CHLL1000");
    expect(art?.courseType).toBe("GE Course");
    expect(chinese?.courseType).toBe("");
  });
});
