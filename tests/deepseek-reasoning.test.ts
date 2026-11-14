import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createDeepSeekFetch } from "../src/agent/deepseek-reasoning";

describe("DeepSeek reasoning echo", () => {
  it("copies reasoning_content onto the assistant tool-call message in the next request", async () => {
    const bodies: unknown[] = [];
    const sse = [
      'data: {"choices":[{"delta":{"reasoning_content":"Check the catalogue."}}]}',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"plan","arguments":"{}"}}]}}]}',
      "data: [DONE]",
    ].join("\n\n");
    const baseFetch: typeof fetch = async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(sse, { headers: { "content-type": "text/event-stream" } });
    };
    const deepseekFetch = createDeepSeekFetch(baseFetch);
    await deepseekFetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      body: JSON.stringify({ messages: [{ role: "user", content: "Plan" }], tools: [{}] }),
    });
    await deepseekFetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        messages: [
          { role: "user", content: "Plan" },
          { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "plan", arguments: "{}" } }] },
        ],
        tools: [{}],
      }),
    });
    const second = bodies[1] as { messages: Array<{ reasoning_content?: string }> };
    expect(second.messages[1].reasoning_content).toBe("Check the catalogue.");
  });

  it("does not share reasoning_content between namespaces with the same assistant text", async () => {
    const seen: Array<{ namespace: string; body: { messages: Array<{ reasoning_content?: string }> } }> = [];
    function harness(namespace: string, reasoning: string) {
      const sse = [
        `data: {"choices":[{"delta":{"reasoning_content":${JSON.stringify(reasoning)}}}]}`,
        'data: {"choices":[{"delta":{"content":"Same answer"}}]}',
        "data: [DONE]",
      ].join("\n\n");
      const baseFetch: typeof fetch = async (_url, init) => {
        seen.push({ namespace, body: JSON.parse(String(init?.body)) });
        return new Response(sse, { headers: { "content-type": "text/event-stream" } });
      };
      return createDeepSeekFetch(baseFetch, namespace);
    }

    const fetchA = harness("user-a", "Reasoning A");
    const fetchB = harness("user-b", "Reasoning B");
    const firstBody = JSON.stringify({
      messages: [{ role: "user", content: "Plan" }],
      tools: [{}],
    });
    const followBody = JSON.stringify({
      messages: [
        { role: "user", content: "Plan" },
        { role: "assistant", content: "Same answer" },
      ],
      tools: [{}],
    });
    await fetchA("https://api.deepseek.com/chat/completions", { method: "POST", body: firstBody });
    await fetchB("https://api.deepseek.com/chat/completions", { method: "POST", body: firstBody });
    await fetchA("https://api.deepseek.com/chat/completions", { method: "POST", body: followBody });
    await fetchB("https://api.deepseek.com/chat/completions", { method: "POST", body: followBody });

    const followA = seen.filter((row) => row.namespace === "user-a")[1];
    const followB = seen.filter((row) => row.namespace === "user-b")[1];
    expect(followA?.body.messages[1]?.reasoning_content).toBe("Reasoning A");
    expect(followB?.body.messages[1]?.reasoning_content).toBe("Reasoning B");
  });

  it('sets reasoning effort to low on the CopilotKit route', () => {
    const route = readFileSync("src/app/api/copilotkit/[[...slug]]/route.ts", "utf8");
    expect(route).toContain('reasoningEffort: "low"');
    expect(route).not.toContain('reasoningEffort: "none"');
  });
});
