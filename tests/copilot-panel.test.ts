import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("copilot panel", () => {
  const panel = readFileSync("src/components/copilot-panel.tsx", "utf8");
  const toolState = readFileSync("src/components/plan-tool-state.ts", "utf8");
  const promptInput = readFileSync("src/components/ai/prompt-input.tsx", "utf8");
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  const css = readFileSync("src/app/globals.css", "utf8");

  it("draws shadcn AI Elements from headless CopilotKit hooks with Slate Atelier styling", () => {
    expect(panel).toContain("@copilotkit/react-core/v2/headless");
    expect(panel).toContain("useAgent");
    expect(panel).toContain("useCopilotKit");
    expect(panel).toContain("@/components/ai/chat");
    expect(panel).toContain("@/components/ai/message");
    expect(panel).toContain("@/components/ai/markdown");
    expect(panel).toContain("AssistantMarkdown");
    expect(panel).not.toContain('whiteSpace: "pre-wrap"');
    expect(panel).toContain("@/components/ai/prompt-input");
    expect(panel).toContain("stopAgent");
    expect(promptInput).toContain('aria-label="Stop"');
    expect(promptInput).toContain("onStop");
    expect(panel).toContain("@/components/ai/tool");
    expect(panel).not.toMatch(/CopilotChat|CopilotPopup|CopilotSidebar/);
    expect(panel).not.toContain("@copilotkit/react-core/v2/styles.css");
    expect(panel).not.toContain('from "ai"');
    expect(panel).not.toContain("@ai-sdk/react");
    expect(panel).not.toContain("Apply to the current timetable");
    expect(panel).not.toContain("Apply to timetable");
    expect(panel).toContain("The assistant is unavailable. Search and manual add still work.");
    expect(toolState).toContain("searchSections");
    expect(toolState).toContain("readProfile");
    expect(toolState).toContain("readTimetable");
    expect(toolState).toContain("plan");
    expect(toolState).toContain("validate");
    expect(layout).toContain("CopilotKitProvider");
    expect(layout).toContain("@copilotkit/react-core/v2");
    expect(layout).not.toMatch(/CopilotChat|CopilotPopup|CopilotSidebar/);

    expect(panel).not.toContain("Open proposals");
    expect(panel).toContain("Show on week");
    expect(panel).toContain("Hide from week");
    expect(panel).toContain("onOpenProposal");
    expect(panel).toContain("onHideProposal");
    expect(panel).not.toContain("tp-proposal");
    expect(panel).toContain('borderLeft: "3px solid var(--accent)"');
    const bubbleStart = css.indexOf(".tp-user-bubble");
    const bubble = css.slice(bubbleStart, css.indexOf("}", bubbleStart));
    expect(bubble).toContain("background-color: var(--field)");
    expect(bubble).not.toContain("var(--sheet)");
  });
});
