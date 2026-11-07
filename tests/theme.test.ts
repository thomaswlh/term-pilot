import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { theme } from "../src/domain/theme";

describe("theme", () => {
  it("matches the approved Slate Atelier direction", () => {
    expect(theme.ground).toBe("#EFF2F5");
    expect(theme.sheet).toBe("#FFFFFF");
    expect(theme.ink).toBe("#161B20");
    expect(theme.muted).toBe("#596573");
    expect(theme.line).toBe("#DCE2E6");
    expect(theme.field).toBe("#E8EEF2");
    expect(theme.accent).toBe("#1B5E6B");
    expect(theme.accentHover).toBe("#134650");
    expect(theme.accentLight).toBe("#E0EFF2");
    expect(theme.accentInk).toBe("#0E363D");
    expect(theme.focus).toBe("#1B5E6B");
    expect(theme.rose).toBe("#B3261E");
    expect(theme.selection).toBe("#CFE3E7");

    expect(theme.hues.green).toEqual({ background: "#D8EDE1", edge: "#235E38", text: "#144425" });
    expect(theme.hues.amber).toEqual({ background: "#F4EBD4", edge: "#7E5A18", text: "#543A0C" });
    expect(theme.hues.teal).toEqual({ background: "#D5ECEB", edge: "#1C6360", text: "#114240" });
    expect(theme.hues.blue).toEqual({ background: "#D8E5F3", edge: "#234E7B", text: "#153456" });

    const css = readFileSync("src/app/globals.css", "utf8");
    for (const hex of ["#EFF2F5", "#FFFFFF", "#161B20", "#596573", "#DCE2E6", "#1B5E6B", "#B3261E", "#D8EDE1"]) {
      expect(css).toContain(hex);
    }
  });
});
