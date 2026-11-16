import { describe, expect, it } from "vitest";
import { createReviewCache } from "../src/domain/what2reg/cache";
import { deepseekReviewCompleter } from "../src/domain/what2reg/model";
import { rankAdditionsWithReviews } from "../src/domain/what2reg/preference";
import { attachUnderstanding } from "../src/domain/what2reg/runtime";
import {
  buildReviewUnderstanding,
  parseModelUnderstanding,
  rewriteForRequest,
  understandReviews,
} from "../src/domain/what2reg/understand";
import { WHAT2REG_ATTRIBUTION, WHAT2REG_DISCLAIMER, type ReviewLookup } from "../src/domain/what2reg/types";
import { creditBook } from "../src/domain/credits";
import type { Catalogue, Section } from "../src/domain/types";
import type { StudyPlan } from "../src/domain/study-plan";

function lookup(summaries: string[], scores?: { grade?: number; difficulty?: number; usefulness?: number }): ReviewLookup {
  return {
    status: "ok",
    courseCode: "CSCI1001",
    attribution: WHAT2REG_ATTRIBUTION,
    disclaimer: WHAT2REG_DISCLAIMER,
    understanding: null,
    mayRejectLegalCourse: false,
    instructors: [
      {
        name: "CHAN TAI MAN",
        grade: scores?.grade ?? null,
        difficulty: scores?.difficulty ?? null,
        usefulness: scores?.usefulness ?? null,
        url: "https://umeh.top/reviews/CSCI1001/CHAN%20TAI%20MAN",
        summaries: summaries.map((text) => ({ text, url: "https://umeh.top/reviews/CSCI1001/CHAN%20TAI%20MAN", publishedAt: null })),
      },
    ],
  };
}

const mixed = lookup(
  [
    "Weekly assignments make the workload heavy.",
    "The final exam is easy to pass if you review.",
    "The lectures are clear and worth taking.",
  ],
  { grade: 3.5, difficulty: 4, usefulness: 4.2 },
);

describe("review understanding", () => {
  it("builds a fixed schema with impressions, themes, and grounded points", () => {
    const understanding = buildReviewUnderstanding(mixed);
    expect(understanding).toMatchObject({
      courseCode: "CSCI1001",
      sampleSize: 3,
      impression: {
        grade: "Grade score 3.5: in the middle.",
        difficulty: "Difficulty score 4: on the hard side.",
        usefulness: "Usefulness score 4.2: on the high side.",
      },
    });
    expect(understanding?.themes).toEqual(expect.arrayContaining(["workload", "assessment", "teaching"]));
    expect(understanding?.cons.map((point) => point.groundedIn)).toContain("Weekly assignments make the workload heavy.");
    expect(understanding?.pros.map((point) => point.groundedIn)).toContain("The final exam is easy to pass if you review.");
    expect(understanding?.pros.every((point) => point.groundedIn.length > 0)).toBe(true);
  });

  it("flags a small sample and conflicting comments", () => {
    const one = buildReviewUnderstanding(lookup(["Lectures are clear."], { grade: 4 }));
    expect(one?.uncertainty).toBe("small-sample");
    expect(one?.uncertaintyNote).toContain("Only 1 public comment");
    const conflict = buildReviewUnderstanding(mixed);
    expect(conflict?.uncertainty).toBe("conflict");
    expect(conflict?.uncertaintyNote).toContain("disagree");
  });

  it("writes a different report for two questions about the same reviews", () => {
    const understanding = buildReviewUnderstanding(mixed);
    expect(understanding).not.toBeNull();
    if (!understanding) return;
    const workload = rewriteForRequest({ understanding, question: "Is the workload heavy?" });
    const passing = rewriteForRequest({ understanding, question: "Is it easy to pass?" });
    expect(workload).toContain("workload heavy");
    expect(workload).not.toContain("easy to pass");
    expect(passing).toContain("easy to pass");
    expect(passing).not.toContain("workload heavy");
    expect(workload).not.toBe(passing);
    expect(workload).toContain("not official University of Macau");
    expect(passing).toContain("not official University of Macau");
    expect(workload).toContain("disagree");
  });

  it("keeps a compulsory course when the rewritten note is negative", () => {
    const understanding = buildReviewUnderstanding(mixed);
    expect(understanding).not.toBeNull();
    if (!understanding) return;
    const section = (courseCode: string, day: Section["meetings"][number]["day"]): Section => ({
      courseCode,
      section: "001",
      title: courseCode,
      courseType: "",
      unit: "FIC",
      department: "",
      teacher: "HARD PROF",
      notes: "",
      restriction: "",
      meetings: [{ day, startMinutes: 9 * 60, endMinutes: 10 * 60 }],
    });
    const catalogue: Catalogue = {
      sections: [section("CSCI1001", "MON")],
      prerequisites: [],
      majors: [{ code: "CPS19", name: "Computer Science", programme: "FIC" }],
      specializations: [],
    };
    const plan: StudyPlan = {
      majorCode: "CPS19",
      curriculumYear: 2019,
      source: { title: "Computer Science study plan", url: "https://example.test/plan", retrievedAt: "2026-11-12" },
      courses: [
        {
          sourceCode: "CSCI1001",
          catalogueCode: "CSCI1001",
          kind: "compulsory",
          suggestedYear: 1,
          suggestedSemester: null,
          stream: null,
          verification: "verified",
          mapping: null,
        },
      ],
    };
    const input = {
      catalogue,
      credits: creditBook([
        { courseCode: "CSCI1001", credits: 3, sourceUrl: "https://example.test/CSCI1001", retrievedAt: "2026-11-12" },
      ]),
      profile: { majorCode: "CPS19", programme: "FIC", yearOfStudy: 1, interests: null, claims: [] },
      plan,
      stream: null,
      chosenKeys: [],
      heldCodes: [],
      creditTarget: 3,
      geCount: 0,
      geAtLeast: false,
      avoid: [],
    };
    const reviewed = rankAdditionsWithReviews(
      input,
      [
        {
          courseCode: "CSCI1001",
          instructor: "CHAN TAI MAN",
          grade: 1,
          difficulty: 5,
          usefulness: 1,
          summary: "Too hard. Drop this course.",
          url: "https://umeh.top/course/CSCI1001",
          understanding,
        },
      ],
      "Is the workload heavy?",
    );
    expect(reviewed.keys).toEqual(["CSCI1001:001"]);
    expect(reviewed.selections[0]?.basis).toBe("verified-compulsory");
    expect(reviewed.selections[0]?.detail).toContain("does not remove this required course");
    expect(reviewed.selections[0]?.detail).toContain("workload heavy");
  });

  it("drops ungrounded model points and fails open when the model is down", async () => {
    const texts = ["The lectures are clear and worth taking."];
    const parsed = parseModelUnderstanding(
      JSON.stringify({
        pros: [{ text: "Lectures are clear", theme: "teaching", groundedIn: "The lectures are clear" }],
        cons: [{ text: "Impossible exams", theme: "assessment", groundedIn: "secret exam bank" }],
      }),
      texts,
    );
    expect(parsed?.pros).toHaveLength(1);
    expect(parsed?.cons).toEqual([]);
    expect(parseModelUnderstanding("not json", texts)).toBeNull();

    const page = lookup(["The lectures are clear and worth taking."], { grade: 4 });
    await expect(understandReviews(page, async () => { throw new Error("deepseek down"); })).resolves.toBeNull();
    const kept = await attachUnderstanding(page, {
      config: null,
      store: { async get() { return null; }, async save() {}, async delete() {} },
      cache: createReviewCache(),
      transport: async () => { throw new Error("mcp down"); },
      postForm: async () => { throw new Error("oauth down"); },
      now: () => 0,
      complete: async () => { throw new Error("deepseek down"); },
    });
    expect(kept.status).toBe("ok");
    expect(kept.instructors[0]?.summaries[0]?.text).toContain("lectures are clear");
    expect(kept.understanding).toBeNull();
  });

  it("caches a successful understanding and skips it when there is no model", async () => {
    const page = lookup(["The lectures are clear and worth taking."], { usefulness: 4 });
    let calls = 0;
    const cache = createReviewCache();
    const deps = {
      config: null,
      store: { async get() { return null; }, async save() {}, async delete() {} },
      cache,
      transport: async () => { throw new Error("unused"); },
      postForm: async () => { throw new Error("unused"); },
      now: () => 0,
      complete: async () => {
        calls += 1;
        return JSON.stringify({
          pros: [{ text: "Lectures are clear", theme: "teaching", groundedIn: "The lectures are clear" }],
          cons: [],
        });
      },
    };
    const first = await attachUnderstanding(page, deps);
    const second = await attachUnderstanding(page, deps);
    expect(first.understanding?.pros[0]?.groundedIn).toBe("The lectures are clear");
    expect(second.understanding?.pros[0]?.text).toBe("Lectures are clear");
    expect(calls).toBe(1);
    const skipped = await attachUnderstanding(page, { ...deps, cache: createReviewCache(), complete: null });
    expect(skipped.understanding).toBeNull();
    expect(skipped.instructors).toHaveLength(1);
  });

  it("does not call DeepSeek when the API key is missing", () => {
    const previous = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    expect(deepseekReviewCompleter()).toBeNull();
    if (previous === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previous;
  });
});
