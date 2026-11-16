import type { ReviewCompleter } from "./understand";

/**
 * DeepSeek chat completion for review understanding.
 * Uses the same model and host as the planning assistant. Returns null when the key is missing or the call fails.
 * The API key is not logged.
 */
export function deepseekReviewCompleter(fetchImpl: typeof fetch = fetch): ReviewCompleter | null {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) return null;
  return async (prompt) => {
    try {
      const response = await fetchImpl("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek-flash",
          temperature: 0,
          messages: [
            {
              role: "system",
              content: "Return only JSON. Do not add facts that are not in the comments.",
            },
            { role: "user", content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as { choices?: { message?: { content?: unknown } }[] };
      const content = payload.choices?.[0]?.message?.content;
      return typeof content === "string" && content.trim() ? content : null;
    } catch {
      return null;
    }
  };
}
