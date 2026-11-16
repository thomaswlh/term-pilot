import type { FormPoster } from "./oauth";
import type { McpTransport } from "./client";

export function fetchTransport(fetchImpl: typeof fetch = fetch): McpTransport {
  return async (request) => {
    const response = await fetchImpl(request.url, {
      method: "POST",
      headers: request.headers,
      body: request.body,
      signal: AbortSignal.timeout(10_000),
    });
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return { status: response.status, headers, body: await response.text() };
  };
}

export function fetchForm(fetchImpl: typeof fetch = fetch): FormPoster {
  return async (url, body) => {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    return { status: response.status, body: await response.text() };
  };
}
