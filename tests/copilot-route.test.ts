import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as route from "../src/app/api/copilotkit/[[...slug]]/route";

const routeSource = readFileSync(
  join(import.meta.dirname, "../src/app/api/copilotkit/[[...slug]]/route.ts"),
  "utf8",
);

describe("copilot route", () => {
  it("exports the v2 handlers and does not export a timetable write", () => {
    expect(typeof route.GET).toBe("function");
    expect(typeof route.POST).toBe("function");
    expect("writeSections" in route).toBe(false);
    expect("applyProposal" in route).toBe(false);
  });

  it("uses DeepSeek flash on the server", () => {
    expect(routeSource).toContain("deepseek-flash");
    expect(routeSource).toContain("DEEPSEEK_API_KEY");
    expect(routeSource).toContain("https://api.deepseek.com");
    expect(routeSource).not.toContain("gpt-6-luna");
    expect(routeSource).not.toContain("OPENAI_API_KEY");
  });
});
