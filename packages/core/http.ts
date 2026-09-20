import { AppError } from "./database";
import { demoSnapshot } from "./demo";
import { redactHeaders } from "./secrets";
import type { Environment, RequestCase, Snapshot, Json } from "./types";
export interface HttpTransport {
  send(url: URL, init: RequestInit): Promise<Response>;
}
export function targetUrl(
  base: string,
  path: string,
  query: Record<string, string>,
): URL {
  const root = new URL(base);
  if (
    !["http:", "https:"].includes(root.protocol) ||
    root.username ||
    root.password ||
    root.search ||
    root.hash
  )
    throw new AppError(
      "UNSAFE_URL",
      "Use an HTTP(S) base URL without credentials, query, or fragment.",
    );
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\"))
    throw new AppError("UNSAFE_PATH", "Request path must be relative.");
  const result = new URL(`${root.toString().replace(/\/$/, "")}${path}`);
  if (result.origin !== root.origin)
    throw new AppError(
      "UNSAFE_URL",
      "Request must stay on the configured origin.",
    );
  for (const [k, v] of Object.entries(query)) result.searchParams.set(k, v);
  return result;
}
export async function executeRequest(
  env: Environment,
  request: RequestCase,
  transport: HttpTransport,
  secret = "",
): Promise<Snapshot> {
  if (env.kind !== "external")
    return demoSnapshot(env.kind === "demo-v1" ? "v1" : "v2", request.path);
  const url = targetUrl(env.baseUrl, request.path, request.query);
  const headers: Record<string, string> = {
    ...env.headers,
    ...request.headers,
    ...(secret ? { Authorization: secret } : {}),
  };
  if (
    request.body !== null &&
    !["GET", "HEAD"].includes(request.method) &&
    !Object.keys(headers).some((k) => k.toLowerCase() === "content-type")
  )
    headers["Content-Type"] = "application/json";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), request.timeoutMs);
  const start = performance.now();
  try {
    const response = await transport.send(url, {
      method: request.method,
      headers,
      body:
        request.body === null || request.method === "GET"
          ? undefined
          : JSON.stringify(request.body),
      signal: controller.signal,
      redirect: "error",
    });
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader)
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 2 * 1024 * 1024) {
          await reader.cancel();
          throw new AppError(
            "RESPONSE_TOO_LARGE",
            "Response exceeded the 2 MB limit.",
          );
        }
        chunks.push(value);
      }
    const combined = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = new TextDecoder().decode(combined);
    let body: Json = text || null;
    const contentType = response.headers.get("content-type") || "text/plain";
    if (contentType.includes("json") && text) {
      try {
        body = JSON.parse(text) as Json;
      } catch {
        body = text;
      }
    }
    return {
      status: response.status,
      headers: redactHeaders(Object.fromEntries(response.headers.entries())),
      body,
      contentType,
      latencyMs: Math.round(performance.now() - start),
      recordedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      controller.signal.aborted ? "TIMEOUT" : "REQUEST_FAILED",
      controller.signal.aborted
        ? "Request timed out."
        : "Target request failed. Check the URL, network policy, and environment configuration.",
    );
  } finally {
    clearTimeout(timer);
  }
}
