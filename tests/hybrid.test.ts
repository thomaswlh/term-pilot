import { describe, expect, it } from "vitest";
import { FUSION_DEPTH, RRF_K, fuseCourses } from "../src/domain/retrieval/hybrid";

describe("fuseCourses", () => {
  it("uses constant 60 and keeps a course that appears in only one list", () => {
    expect(RRF_K).toBe(60);
    expect(FUSION_DEPTH).toBe(50);
    expect(fuseCourses(["A", "B"], ["B", "C"])).toEqual(["B", "A", "C"]);
  });

  it("breaks an equal fused score by course code", () => {
    expect(fuseCourses(["Z"], ["M"])).toEqual(["M", "Z"]);
  });

  it("reads at most 50 courses from each list", () => {
    const bm25 = Array.from({ length: 60 }, (_, index) => `B${String(index).padStart(2, "0")}`);
    const dense = ["ONLY"];
    const fused = fuseCourses(bm25, dense);
    expect(fused).toContain("ONLY");
    expect(fused).not.toContain("B50");
    expect(fused[0]).toBe("B00");
  });
});
