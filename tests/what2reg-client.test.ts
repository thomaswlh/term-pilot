import { describe, expect, it } from "vitest";
import { createReviewCache } from "../src/domain/what2reg/cache";
import { createWhat2RegClient, parseMcpMessage, type McpTransport } from "../src/domain/what2reg/client";
import { lookupCourseReviews } from "../src/domain/what2reg/lookup";

const COURSE = {
  course: {
    courseCode: "CSCI1001",
    titleEn: "Programming",
    url: "https://umeh.top/course/CSCI1001",
  },
  page: 1,
  hasMore: false,
  totalCount: 1,
  instructors: [
    {
      name: "CHAN TAI MAN",
      commentCount: 2,
      result: 4,
      attendance: null,
      grade: 3.5,
      difficulty: 4,
      reward: 4.2,
      isOffered: true,
      reviewUrl: "https://umeh.top/reviews/CSCI1001/CHAN%20TAI%20MAN",
    },
  ],
};

const REVIEWS = {
  courseCode: "CSCI1001",
  instructor: "CHAN TAI MAN",
  page: 1,
  hasMore: true,
  url: "https://umeh.top/reviews/CSCI1001/CHAN%20TAI%20MAN",
  reviews: [
    {
      publishedAt: "2025-01-02",
      content: "作業偏多",
      contentEn: "The assignments take time.",
      result: 4,
      upvotes: 3,
      downvotes: 0,
      verified: true,
      url: "https://www.umeh.top/reviews/CSCI1001/CHAN%20TAI%20MAN",
      email: "student@example.com",
      userId: "user_secret",
    },
  ],
};

function rpc(id: number, result: unknown): string {
  return JSON.stringify({ jsonrpc: "2.0", id, result });
}

function toolResult(data: unknown, id = 2): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    result: {
      content: [{ type: "text", text: "ok" }],
      structuredContent: data,
    },
  });
}

function scriptedTransport(handler: (body: string) => { status?: number; body: string; contentType?: string }): {
  transport: McpTransport;
  calls: string[];
} {
  const calls: string[] = [];
  const transport: McpTransport = async (request) => {
    calls.push(request.body);
    expect(request.headers.authorization).toBe("Bearer student-token");
    expect(request.url).toBe("https://umeh.top/mcp");
    const response = handler(request.body);
    return {
      status: response.status ?? 200,
      headers: { "content-type": response.contentType ?? "application/json" },
      body: response.body,
    };
  };
  return { transport, calls };
}

describe("What2Reg MCP client", () => {
  it("reads a course and keeps only public review fields", async () => {
    const { transport, calls } = scriptedTransport((body) => {
      const message = JSON.parse(body) as { method: string; id?: number };
      if (message.method === "initialize") return { body: rpc(message.id ?? 1, { protocolVersion: "2025-03-26" }) };
      if (message.method === "notifications/initialized") return { status: 202, body: "" };
      const params = (JSON.parse(body) as { params: { name: string } }).params;
      if (params.name === "get_course") return { body: toolResult(COURSE, message.id) };
      return { body: toolResult(REVIEWS, message.id) };
    });
    const client = createWhat2RegClient({ accessToken: "student-token", transport });
    const course = await client.callTool("get_course", { code: "csci1001", page: 1 });
    const reviews = await client.callTool("get_course_reviews", { code: "CSCI1001", instructor: "CHAN TAI MAN", limit: 50 });
    expect(course.ok).toBe(true);
    expect(reviews.ok).toBe(true);
    if (!reviews.ok) return;
    const payload = reviews.data as { reviews: { email?: string; contentEn: string }[] };
    expect(payload.reviews[0]?.contentEn).toBe("The assignments take time.");
    const reviewCall = calls.map((body) => JSON.parse(body) as { method?: string; params?: { arguments?: { limit?: number } } }).find((row) => row.method === "tools/call" && row.params?.arguments?.limit);
    expect(reviewCall?.params?.arguments?.limit).toBe(10);
  });

  it("parses an SSE tool result", () => {
    const message = parseMcpMessage(
      "text/event-stream",
      `event: message\ndata: ${toolResult({ reviews: [] })}\n\n`,
    ) as { result: { structuredContent: { reviews: unknown[] } } };
    expect(message.result.structuredContent.reviews).toEqual([]);
  });

  it("fails open when the server errors", async () => {
    const { transport } = scriptedTransport((body) => {
      const message = JSON.parse(body) as { method: string; id?: number };
      if (message.method === "initialize") return { body: rpc(message.id ?? 1, { protocolVersion: "2025-03-26" }) };
      if (message.method === "notifications/initialized") return { status: 202, body: "" };
      return { status: 503, body: "" };
    });
    const client = createWhat2RegClient({ accessToken: "student-token", transport });
    const result = await client.callTool("get_course", { code: "CSCI1001" });
    expect(result).toEqual({ ok: false, code: "unavailable" });
  });

  it("reports unauthorized and rate limits without throwing", async () => {
    const unauthorized = scriptedTransport(() => ({ status: 401, body: "" }));
    const limited = scriptedTransport((body) => {
      const message = JSON.parse(body) as { method: string; id?: number };
      if (message.method === "initialize") return { body: rpc(message.id ?? 1, {}) };
      if (message.method === "notifications/initialized") return { status: 202, body: "" };
      return {
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: message.id,
          result: { isError: true, content: [{ type: "text", text: "Too many requests. Try again shortly." }] },
        }),
      };
    });
    const denied = await createWhat2RegClient({ accessToken: "student-token", transport: unauthorized.transport }).callTool("get_course", { code: "CSCI1001" });
    const rate = await createWhat2RegClient({ accessToken: "student-token", transport: limited.transport }).callTool("get_course", { code: "CSCI1001" });
    expect(denied).toEqual({ ok: false, code: "unauthorized" });
    expect(rate).toEqual({ ok: false, code: "rate_limited" });
  });
});

describe("lookupCourseReviews", () => {
  it("does not call the MCP when the student has no token", async () => {
    let calls = 0;
    const result = await lookupCourseReviews({
      accessToken: null,
      courseCode: "CSCI1001",
      instructors: ["Chan Tai Man"],
      cache: createReviewCache(),
      callTool: async () => {
        calls += 1;
        return { ok: true, data: COURSE };
      },
    });
    expect(calls).toBe(0);
    expect(result.status).toBe("unauthorized");
    expect(result.mayRejectLegalCourse).toBe(false);
    expect(result.instructors).toEqual([]);
  });

  it("returns an empty public summary and caches the next lookup", async () => {
    let calls = 0;
    const cache = createReviewCache({ now: () => 1_000 });
    const callTool = async (name: string) => {
      calls += 1;
      if (name === "get_course") return { ok: true as const, data: { ...COURSE, instructors: [] } };
      return { ok: true as const, data: { ...REVIEWS, reviews: [] } };
    };
    const first = await lookupCourseReviews({
      accessToken: "student-token",
      courseCode: "csci1001",
      instructors: ["Chan Tai Man"],
      cache,
      callTool,
    });
    const second = await lookupCourseReviews({
      accessToken: "student-token",
      courseCode: "CSCI1001",
      instructors: ["CHAN TAI MAN"],
      cache,
      callTool,
    });
    expect(first.status).toBe("empty");
    expect(second.status).toBe("empty");
    expect(calls).toBe(2);
  });

  it("hides commenter identity fields and skips a second network read", async () => {
    let calls = 0;
    const cache = createReviewCache();
    const callTool = async (name: string, args: Record<string, unknown>) => {
      calls += 1;
      if (name === "get_course_reviews") {
        expect(args.page).toBe(1);
        expect(args.limit).toBe(5);
        return { ok: true as const, data: REVIEWS };
      }
      return { ok: true as const, data: COURSE };
    };
    const result = await lookupCourseReviews({
      accessToken: "student-token",
      courseCode: "CSCI1001",
      instructors: ["Chan Tai Man"],
      cache,
      callTool,
    });
    expect(result.status).toBe("ok");
    expect(result.instructors[0]).toMatchObject({
      grade: 3.5,
      difficulty: 4,
      usefulness: 4.2,
    });
    expect(result.instructors[0]?.summaries[0]?.text).toBe("The assignments take time.");
    expect(result.instructors[0]?.summaries[0]?.url).toBe("https://www.umeh.top/reviews/CSCI1001/CHAN%20TAI%20MAN");
    expect(JSON.stringify(result)).not.toContain("student@example.com");
    expect(JSON.stringify(result)).not.toContain("user_secret");
    const again = await lookupCourseReviews({
      accessToken: "student-token",
      courseCode: "CSCI1001",
      instructors: ["CHAN TAI MAN"],
      cache,
      callTool,
    });
    expect(again.instructors[0]?.summaries).toHaveLength(1);
    expect(calls).toBe(2);
  });

  it("fails open when the course lookup errors", async () => {
    const result = await lookupCourseReviews({
      accessToken: "student-token",
      courseCode: "CSCI1001",
      instructors: ["CHAN TAI MAN"],
      cache: createReviewCache(),
      callTool: async () => {
        throw new Error("socket hang up");
      },
    });
    expect(result.status).toBe("unavailable");
    expect(result.instructors).toEqual([]);
    expect(result.mayRejectLegalCourse).toBe(false);
  });

  it("drops links that are not on umeh.top", async () => {
    const result = await lookupCourseReviews({
      accessToken: "student-token",
      courseCode: "CSCI1001",
      instructors: ["CHAN TAI MAN"],
      cache: createReviewCache(),
      callTool: async (name) => {
        if (name === "get_course") {
          return {
            ok: true,
            data: {
              ...COURSE,
              course: { url: "https://evil.example/course" },
              instructors: [{ ...COURSE.instructors[0], reviewUrl: "http://umeh.top/reviews/CSCI1001/CHAN" }],
            },
          };
        }
        return {
          ok: true,
          data: {
            ...REVIEWS,
            url: "https://umeh.top.evil.example/reviews",
            reviews: [{ ...REVIEWS.reviews[0], url: "https://example.com/review" }],
          },
        };
      },
    });
    expect(result.instructors[0]?.url).toBe("https://umeh.top/course/CSCI1001");
    expect(result.instructors[0]?.summaries[0]?.url).toBeNull();
  });
});
