type GlobalWithMemory = typeof globalThis & {
  termPilotDeepSeekReasoning?: Map<string, string>;
  termPilotDeepSeekReasoningCapture?: Map<string, Promise<void>>;
};

type ChatMessage = {
  role?: string;
  content?: unknown;
  tool_calls?: Array<{ id?: string }>;
  reasoning_content?: string;
};

type ChatBody = {
  messages?: ChatMessage[];
  tools?: unknown;
};

type ObservedTurn = {
  reasoning: string;
  text: string;
  toolCallIds: string[];
};

function reasoningGlobal(): GlobalWithMemory {
  return globalThis as GlobalWithMemory;
}

function reasoningMemory(): Map<string, string> {
  const g = reasoningGlobal();
  if (!(g.termPilotDeepSeekReasoning instanceof Map)) {
    g.termPilotDeepSeekReasoning = new Map();
  }
  return g.termPilotDeepSeekReasoning;
}

function captureChains(): Map<string, Promise<void>> {
  const g = reasoningGlobal();
  if (!(g.termPilotDeepSeekReasoningCapture instanceof Map)) {
    g.termPilotDeepSeekReasoningCapture = new Map();
  }
  return g.termPilotDeepSeekReasoningCapture;
}

function waitForCapture(namespace: string): Promise<void> {
  return captureChains().get(namespace) ?? Promise.resolve();
}

function trackCapture(namespace: string, work: Promise<void>): void {
  const chains = captureChains();
  const previous = chains.get(namespace) ?? Promise.resolve();
  const next = previous
    .then(
      () => work,
      () => work,
    )
    .then(
      () => undefined,
      () => undefined,
    );
  chains.set(namespace, next);
}

function memoryKey(namespace: string, kind: "tool" | "text", value: string): string {
  return `${namespace}\u0000${kind}:${value}`;
}

function decodeBody(body: BodyInit): string | null {
  if (typeof body === "string") return body;
  if (body instanceof URLSearchParams) return body.toString();
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  if (body instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(body));
  return null;
}

function assistantText(content: unknown): string | null {
  if (typeof content === "string") return content.length > 0 ? content : null;
  if (!Array.isArray(content)) return null;
  let text = "";
  for (const part of content) {
    if (typeof part === "string") {
      text += part;
    } else if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
      text += (part as { text: string }).text;
    }
  }
  return text.length > 0 ? text : null;
}

function lookupReasoning(
  memory: Map<string, string>,
  namespace: string,
  message: ChatMessage,
): string | undefined {
  const calls = message.tool_calls;
  if (Array.isArray(calls) && calls.length > 0) {
    for (const call of calls) {
      if (typeof call?.id !== "string" || call.id.length === 0) continue;
      const reasoning = memory.get(memoryKey(namespace, "tool", call.id));
      if (reasoning) return reasoning;
    }
    return undefined;
  }
  const text = assistantText(message.content);
  if (!text) return undefined;
  return memory.get(memoryKey(namespace, "text", text));
}

function echoReasoning(namespace: string, init?: RequestInit): RequestInit | undefined {
  if (!init?.body) return init;
  const raw = decodeBody(init.body);
  if (raw == null) return init;
  let parsed: ChatBody;
  try {
    parsed = JSON.parse(raw) as ChatBody;
  } catch {
    return init;
  }
  if (!Array.isArray(parsed.tools) || !Array.isArray(parsed.messages)) return init;

  const memory = reasoningMemory();
  let changed = false;
  const messages = parsed.messages.map((message) => {
    if (message.role !== "assistant") return message;
    const reasoning = lookupReasoning(memory, namespace, message);
    if (!reasoning || message.reasoning_content === reasoning) return message;
    changed = true;
    return { ...message, reasoning_content: reasoning };
  });
  if (!changed) return init;
  return { ...init, body: JSON.stringify({ ...parsed, messages }) };
}

function readSse(payload: string): ObservedTurn {
  let reasoning = "";
  let text = "";
  const toolCallIds: string[] = [];

  for (const line of payload.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const data = trimmed.slice("data:".length).trim();
    if (!data || data === "[DONE]") continue;

    let json: unknown;
    try {
      json = JSON.parse(data);
    } catch {
      continue;
    }
    if (!json || typeof json !== "object") continue;
    const choices = (json as { choices?: unknown }).choices;
    if (!Array.isArray(choices)) continue;

    for (const choice of choices) {
      if (!choice || typeof choice !== "object") continue;
      const delta = (choice as { delta?: unknown }).delta;
      if (!delta || typeof delta !== "object") continue;
      const record = delta as {
        reasoning_content?: unknown;
        content?: unknown;
        tool_calls?: unknown;
      };
      if (typeof record.reasoning_content === "string") reasoning += record.reasoning_content;
      if (typeof record.content === "string") text += record.content;
      if (!Array.isArray(record.tool_calls)) continue;
      for (const call of record.tool_calls) {
        if (!call || typeof call !== "object") continue;
        const id = (call as { id?: unknown }).id;
        if (typeof id === "string" && id.length > 0 && !toolCallIds.includes(id)) toolCallIds.push(id);
      }
    }
  }

  return { reasoning, text, toolCallIds };
}

function rememberTurn(namespace: string, observed: ObservedTurn): void {
  if (!observed.reasoning) return;
  const memory = reasoningMemory();
  if (observed.toolCallIds.length > 0) {
    for (const id of observed.toolCallIds) memory.set(memoryKey(namespace, "tool", id), observed.reasoning);
    return;
  }
  if (observed.text) memory.set(memoryKey(namespace, "text", observed.text), observed.reasoning);
}

function captureResponse(namespace: string, response: Response): void {
  if (!response.body) return;
  let copy: Response;
  try {
    copy = response.clone();
  } catch {
    return;
  }
  trackCapture(
    namespace,
    copy.text().then(
      (payload) => {
        rememberTurn(namespace, readSse(payload));
      },
      () => undefined,
    ),
  );
}

export function createDeepSeekFetch(baseFetch: typeof fetch, namespace = "test"): typeof fetch {
  return async (input, init) => {
    await waitForCapture(namespace);
    const response = await baseFetch(input, echoReasoning(namespace, init));
    // Capture on a clone so the caller can stream the original body. The next request for this user waits.
    captureResponse(namespace, response);
    return response;
  };
}
