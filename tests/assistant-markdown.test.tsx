import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssistantMarkdown } from "../src/components/ai/markdown";

describe("assistant markdown", () => {
  it("renders bold, lists, and fenced code", () => {
    const bold = renderToStaticMarkup(<AssistantMarkdown>{"**Room change**"}</AssistantMarkdown>);
    expect(bold).toMatch(/<strong\b/);
    expect(bold).toContain("Room change");

    const list = renderToStaticMarkup(
      <AssistantMarkdown>{"- First item\n- Second item"}</AssistantMarkdown>,
    );
    expect(list.match(/<li/g)?.length).toBe(2);

    const code = renderToStaticMarkup(
      <AssistantMarkdown>{"```\nCISC1000\n```"}</AssistantMarkdown>,
    );
    expect(code).toContain("<pre");
    expect(code).toContain("<code");
    expect(code).toContain("CISC1000");
    expect(code).not.toContain("```");
  });

  it("blocks images and javascript links", () => {
    const imgTag = renderToStaticMarkup(
      <AssistantMarkdown>{"<img src=\"https://attacker.example/p\">"}</AssistantMarkdown>,
    );
    expect(imgTag).not.toMatch(/<img\b/i);

    const mdImg = renderToStaticMarkup(
      <AssistantMarkdown>{"![x](https://attacker.example/p)"}</AssistantMarkdown>,
    );
    expect(mdImg).not.toMatch(/src=["']https:\/\/attacker\.example/);

    const jsLink = renderToStaticMarkup(
      <AssistantMarkdown>{"[go](javascript:alert(1))"}</AssistantMarkdown>,
    );
    expect(jsLink).not.toContain("javascript:");
  });
});
