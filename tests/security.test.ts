import { describe, it, expect } from "vitest";
import { executeRequest, targetUrl } from "../packages/core/http";
import { isPublicAddress } from "../apps/api/src/transport";
import {
  encryptSecret,
  decryptSecret,
  redactHeaders,
} from "../packages/core/secrets";
import { AppError } from "../packages/core/database";
import type { Environment, RequestCase } from "../packages/core/types";
const env: Environment = {
  id: "e",
  projectId: "p",
  name: "API",
  baseUrl: "https://example.com/v1",
  kind: "external",
  headers: {},
  secretConfigured: false,
};
const req: RequestCase = {
  id: "c",
  projectId: "p",
  name: "Test",
  method: "GET",
  path: "/users",
  query: {},
  headers: {},
  body: null,
  timeoutMs: 1000,
  enabled: true,
  createdAt: "",
};
describe("request security", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "192.168.1.1",
    "172.16.0.1",
    "169.254.169.254",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "0.0.0.0",
  ])("blocks %s", (ip) => expect(isPublicAddress(ip)).toBe(false));
  it("permits a public IP", () =>
    expect(isPublicAddress("1.1.1.1")).toBe(true));
  it("builds paths and query parameters under the base path", () =>
    expect(targetUrl(env.baseUrl, "/users", { q: "hello world" }).href).toBe(
      "https://example.com/v1/users?q=hello+world",
    ));
  it("rejects path origin escapes and credentials", () => {
    expect(() => targetUrl(env.baseUrl, "//evil.test", {})).toThrow();
    expect(() =>
      targetUrl("https://name:pass@example.com", "/users", {}),
    ).toThrow();
  });
  it("rejects oversized streamed responses", async () => {
    await expect(
      executeRequest(env, req, {
        send: async () => new Response("a".repeat(2 * 1024 * 1024 + 1)),
      }),
    ).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
  });
  it("sanitizes connection errors", async () => {
    await expect(
      executeRequest(env, req, {
        send: async () => {
          throw new Error("internal-secret");
        },
      }),
    ).rejects.toMatchObject({ code: "REQUEST_FAILED" });
  });
  it("stores timeout failures clearly", async () => {
    const transport = {
      send: async (_url: URL, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) =>
          init.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          ),
        ),
    };
    await expect(executeRequest(env, req, transport)).rejects.toMatchObject({
      code: "TIMEOUT",
    });
  });
  it("handles malformed JSON as text", async () => {
    const r = await executeRequest(env, req, {
      send: async () =>
        new Response("{broken", {
          headers: { "content-type": "application/json" },
        }),
    });
    expect(r.body).toBe("{broken");
  });
  it("encrypts and authenticates stored tokens", async () => {
    const key = btoa("12345678901234567890123456789012");
    const value = await encryptSecret("Bearer abc", key);
    expect(value).not.toContain("Bearer");
    expect(await decryptSecret(value, key)).toBe("Bearer abc");
    await expect(
      decryptSecret(value, btoa("22345678901234567890123456789012")),
    ).rejects.toThrow();
  });
  it("removes secret response headers", () =>
    expect(
      redactHeaders({
        "Set-Cookie": "secret",
        Authorization: "token",
        "content-type": "json",
      }),
    ).toEqual({ "content-type": "json" }));
  it("requires encryption configuration before storing secrets", async () =>
    await expect(encryptSecret("s")).rejects.toBeInstanceOf(AppError));
});
