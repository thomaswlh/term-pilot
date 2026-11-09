import { describe, expect, it } from "vitest";
import { loadCatalogue } from "../src/domain/catalogue";
import { scoreSectionsLegacy, searchSectionsLegacy } from "../src/domain/search-legacy";
import type { Catalogue, Section } from "../src/domain/types";
import { mrr, recallAt5 } from "../src/domain/retrieval/metrics";
import fs from "node:fs";
import path from "node:path";

function section(partial: Pick<Section, "courseCode" | "section"> & Partial<Section>): Section {
  return {
    title: "",
    unit: "",
    department: "",
    teacher: "",
    notes: "",
    restriction: "",
    meetings: [],
    ...partial,
  };
}

const algebra: Catalogue = {
  sections: [
    section({
      courseCode: "TEST101",
      section: "001",
      title: "Introductory Algebra Workshop",
      department: "MATH",
      teacher: "Jones",
      notes: "Morning section",
    }),
  ],
  prerequisites: [],
  majors: [],
};

describe("searchSectionsLegacy", () => {
  it("does not match a title word and still matches the instructor", () => {
    expect(searchSectionsLegacy(algebra, "algebra")).toEqual([]);
    expect(searchSectionsLegacy(algebra, "Jones").some((hit) => hit.sectionKey === "TEST101:001")).toBe(true);
  });

  it("does not treat CSCI1004:001 as a section-key token", () => {
    const catalogue: Catalogue = {
      sections: [section({ courseCode: "CSCI1004", section: "001", title: "Introduction to Computer Science" })],
      prerequisites: [],
      majors: [],
    };
    expect(searchSectionsLegacy(catalogue, "CSCI1004:001")).toEqual([]);
    expect(searchSectionsLegacy(catalogue, "CSCI1004").map((hit) => hit.sectionKey)).toEqual(["CSCI1004:001"]);
  });

  it("locks Recall@5 and MRR on the add-drop catalogue", () => {
    const catalogue = loadCatalogue();
    const queries = JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests/retrieval/queries.json"), "utf8")) as {
      text: string;
      relevant: string[];
    }[];
    const recalls: number[] = [];
    const mrrs: number[] = [];
    for (const row of queries) {
      const ranked = searchSectionsLegacy(catalogue, row.text, 50).map((hit) => hit.sectionKey);
      recalls.push(recallAt5(row.relevant, ranked));
      mrrs.push(mrr(row.relevant, ranked));
    }
    const meanRecall = recalls.reduce((a, b) => a + b, 0) / recalls.length;
    const meanMrr = mrrs.reduce((a, b) => a + b, 0) / mrrs.length;
    expect(meanMrr).toBe(1);
    expect(meanRecall).toBe((18 + 5 / 7 + 5 / 8) / 20);
  });

  it("returns scores without dropping a positive section before the caller limits them", () => {
    const scored = scoreSectionsLegacy(algebra, "Jones");
    expect(scored).toHaveLength(1);
    expect(scored[0]?.score).toBeGreaterThan(0);
  });
});
