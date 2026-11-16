import { WHAT2REG_MCP_URL, WHAT2REG_PROTOCOL_VERSION } from "./types";

export type McpTransportResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
};

export type McpTransport = (request: {
  url: string;
  headers: Record<string, string>;
  body: string;
}) => Promise<McpTransportResponse>;

export type ToolFailure = "unauthorized" | "forbidden" | "rate_limited" | "not_found" | "unavailable";

export type ToolCallResult =
  | { ok: true; data: unknown }
  | { ok: false; code: ToolFailure };

const TOOL_LIMITS: Record<string, { field: string; max: number } | undefined> = {
  search_catalog: { field: "limit", max: 10 },
  get_instructor: { field: "limit", max: 20 },
  get_course_reviews: { field: "limit", max: 10 },
};

function header(headers: Record<string, string>, name: string): string | undefined {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return value;
  }
  return undefined;
}

export function parseMcpMessage(contentType: string, body: string): unknown {
  const trimmed = body.trim();
  if (!trimmed) return null;
  if (contentType.toLowerCase().includes("text/event-stream")) {
    const data = trimmed
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter((line) => line.length > 0 && line !== "[DONE]");
    const last = data.at(-1);
    if (!last) return null;
    return JSON.parse(last) as unknown;
  }
  return JSON.parse(trimmed) as unknown;
}

function clampArguments(name: string, args: Record<string, unknown>): Record<string, unknown> {
  const limit = TOOL_LIMITS[name];
  if (!limit) return args;
  const value = args[limit.field];
  if (typeof value !== "number" || value <= limit.max) return args;
  return { ...args, [limit.field]: limit.max };
}

function failureFromText(text: string): ToolFailure {
  const lower = text.toLowerCase();
  if (lower.includes("rate") || lower.includes("too many")) return "rate_limited";
  if (lower.includes("forbidden") || lower.includes("scope")) return "forbidden";
  if (lower.includes("sign in") || lower.includes("unauthorized")) return "unauthorized";
  if (lower.includes("not found") || lower.includes("no matching")) return "not_found";
  return "unavailable";
}

function resultFromMessage(message: unknown, httpStatus: number): ToolCallResult {
  if (httpStatus === 401) return { ok: false, code: "unauthorized" };
  if (httpStatus === 403) return { ok: false, code: "forbidden" };
  if (httpStatus === 429) return { ok: false, code: "rate_limited" };
  if (httpStatus === 404) return { ok: false, code: "not_found" };
  if (httpStatus < 200 || httpStatus >= 300) return { ok: false, code: "unavailable" };
  if (!message || typeof message !== "object") return { ok: false, code: "unavailable" };
  const row = message as Record<string, unknown>;
  if (row.error) return { ok: false, code: "unavailable" };
  const result = row.result;
  if (!result || typeof result !== "object") return { ok: false, code: "unavailable" };
  const payload = result as Record<string, unknown>;
  if (payload.isError === true) {
    const content = Array.isArray(payload.content) ? payload.content : [];
    const text = content
      .map((item) => (item && typeof item === "object" && "text" in item ? String(item.text) : ""))
      .join(" ");
    return { ok: false, code: failureFromText(text) };
  }
  if ("structuredContent" in payload && payload.structuredContent && typeof payload.structuredContent === "object") {
    return { ok: true, data: payload.structuredContent };
  }
  return { ok: true, data: payload };
}

export function createWhat2RegClient(input: {
  accessToken: string;
  transport: McpTransport;
  endpoint?: string;
}) {
  const endpoint = input.endpoint ?? WHAT2REG_MCP_URL;
  let sessionId: string | null = null;
  let ready = false;
  let nextId = 1;

  async function post(message: unknown): Promise<ToolCallResult & { empty?: boolean }> {
    let response: McpTransportResponse;
    try {
      const headers: Record<string, string> = {
        authorization: `Bearer ${input.accessToken}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      };
      if (sessionId) headers["mcp-session-id"] = sessionId;
      response = await input.transport({
        url: endpoint,
        headers,
        body: JSON.stringify(message),
      });
    } catch {
      return { ok: false, code: "unavailable" };
    }
    const sid = header(response.headers, "mcp-session-id");
    if (sid) sessionId = sid;
    if (response.status === 401) return { ok: false, code: "unauthorized" };
    if (response.status === 403) return { ok: false, code: "forbidden" };
    if (response.status === 429) return { ok: false, code: "rate_limited" };
    if (response.status < 200 || response.status >= 300) return { ok: false, code: "unavailable" };
    if (!response.body.trim()) return { ok: true, data: null, empty: true };
    try {
      const messageBody = parseMcpMessage(header(response.headers, "content-type") ?? "", response.body);
      return resultFromMessage(messageBody, response.status);
    } catch {
      return { ok: false, code: "unavailable" };
    }
  }

  async function ensureSession(): Promise<ToolCallResult | null> {
    if (ready) return null;
    const initialized = await post({
      jsonrpc: "2.0",
      id: nextId++,
      method: "initialize",
      params: {
        protocolVersion: WHAT2REG_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "termpilot", version: "1.0.0" },
      },
    });
    if (!initialized.ok) return initialized;
    await post({ jsonrpc: "2.0", method: "notifications/initialized" });
    ready = true;
    return null;
  }

  return {
    async callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
      const session = await ensureSession();
      if (session) return session;
      const called = await post({
        jsonrpc: "2.0",
        id: nextId++,
        method: "tools/call",
        params: { name, arguments: clampArguments(name, args) },
      });
      if (!called.ok) return called;
      return { ok: true, data: called.data };
    },
  };
}
