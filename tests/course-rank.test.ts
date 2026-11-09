import { describe, expect, it } from "vitest";
import { collapseCourses } from "../src/domain/retrieval/course-rank";

describe("collapseCourses", () => {
  it("keeps the higher section score and breaks ties by course code", () => {
    const ranked = collapseCourses(
      [
        { courseCode: "BBB1000", score: 3 },
        { courseCode: "AAA1000", score: 1 },
        { courseCode: "AAA1000", score: 3 },
      ],
      10,
    );
    expect(ranked).toEqual([
      { courseCode: "AAA1000", score: 3 },
      { courseCode: "BBB1000", score: 3 },
    ]);
  });

  it("honors the limit after collapse", () => {
    const ranked = collapseCourses(
      [
        { courseCode: "AAA1000", score: 2 },
        { courseCode: "BBB1000", score: 1 },
      ],
      1,
    );
    expect(ranked.map((row) => row.courseCode)).toEqual(["AAA1000"]);
  });
});
