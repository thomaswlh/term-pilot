import { describe, expect, it } from "vitest";
import { rankByCosine } from "../src/domain/retrieval/vector";

describe("rankByCosine", () => {
  it("ranks the closer vector first and breaks ties by course code", () => {
    const ranked = rankByCosine(
      [
        { courseCode: "BBB", vector: [1, 0] },
        { courseCode: "AAA", vector: [1, 0] },
        { courseCode: "CCC", vector: [0, 1] },
      ],
      [1, 0],
      3,
    );
    expect(ranked.map((row) => row.courseCode)).toEqual(["AAA", "BBB", "CCC"]);
    expect(ranked[0]?.score).toBeCloseTo(1);
    expect(ranked[2]?.score).toBeCloseTo(0);
  });
});
