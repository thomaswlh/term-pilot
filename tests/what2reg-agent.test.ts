import { describe, expect, it } from "vitest";
import { createTools, type AgentBudget } from "../src/agent/turn";
import { memoryStore } from "../src/db/store";
import type { Catalogue } from "../src/domain/types";
import type { ReviewLookup } from "../src/domain/what2reg/types";

const catalogue: Catalogue = {
  sections: [],
  prerequisites: [],
  majors: [],
  specializations: [],
};

function budget(): AgentBudget {
  return { calls: 0, start: 0, maxCalls: 12, maxMs: 60_000 };
}

describe("readReviews tool", () => {
  it("fails open when the student has not connected", async () => {
    const tools = createTools({
      store: memoryStore(),
      userId: "user_1",
      timetableId: "tt",
      catalogue,
      now: () => 0,
      budget: budget(),
    });
    const result = await tools.readReviews({ courseCode: "CSCI1001" });
    expect(result.status).toBe("unauthorized");
    expect(result.mayRejectLegalCourse).toBe(false);
    expect(result.instruction).toContain("Do not drop a legal course");
  });

  it("stops after four lookups and does not call the reader again", async () => {
    let calls = 0;
    const lookup = async (): Promise<ReviewLookup> => {
      calls += 1;
      return {
        status: "empty",
        courseCode: "CSCI1001",
        attribution: "澳大選咩課 / What2Reg @ UM",
        disclaimer: "Community opinions from 澳大選咩課 / What2Reg @ UM. They are not official University of Macau statements.",
        instructors: [],
        understanding: null,
        mayRejectLegalCourse: false,
      };
    };
    const tools = createTools({
      store: memoryStore(),
      userId: "user_1",
      timetableId: "tt",
      catalogue,
      now: () => 0,
      budget: budget(),
      reviews: {
        lookup,
        notesFor: async () => [],
      },
    });
    for (let index = 0; index < 4; index += 1) {
      const result = await tools.readReviews({ courseCode: "CSCI1001", instructor: "CHAN TAI MAN" });
      expect(result.status).toBe("empty");
    }
    const limited = await tools.readReviews({ courseCode: "CSCI1004" });
    expect(limited.instruction).toContain("limit");
    expect(limited.mayRejectLegalCourse).toBe(false);
    expect(calls).toBe(4);
  });
});
