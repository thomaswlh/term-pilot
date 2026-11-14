import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseStudyPlan } from "../src/domain/study-plan";

describe("checked study-plan files", () => {
  const files = readdirSync("src/domain/data/study-plans").filter((name) => name.endsWith(".json"));

  it("parses only CPS19, CLL19, or JAP25", () => {
    expect(files.every((name) => ["CPS19.json", "CLL19.json", "JAP25.json"].includes(name))).toBe(true);
    for (const name of files) {
      const plan = parseStudyPlan(JSON.parse(readFileSync(`src/domain/data/study-plans/${name}`, "utf8")));
      expect(plan.majorCode).toBe(name.replace(".json", ""));
      expect(plan.source.url.startsWith("https://")).toBe(true);
      for (const course of plan.courses) {
        if (course.sourceCode !== course.catalogueCode) {
          expect(course.mapping?.url.startsWith("https://")).toBe(true);
        }
        if (course.kind === "compulsory-general-education" && course.verification === "verified") {
          expect(course.mapping?.url ?? plan.source.url).toMatch(/^https:/);
        }
      }
    }
  });
});
