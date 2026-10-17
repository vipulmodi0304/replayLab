import { describe, expect, it } from "vitest";
import { parseCurl, shellWords } from "../packages/core/curl";

describe("shellWords", () => {
  it("handles quotes, escapes and line continuations", () =>
    expect(shellWords(`curl 'a b' "c \\"d\\"" e\\ f \\\n  g`)).toEqual(["curl", "a b", 'c "d"', "e f", "g"]));
  it("rejects unclosed quotes", () => expect(() => shellWords("curl 'oops")).toThrow(/unclosed/));
});

describe("parseCurl", () => {
  it("parses a plain GET with query", () => {
    const r = parseCurl("curl https://api.example.com/users/42?expand=profile");
    expect(r).toMatchObject({ method: "GET", baseUrl: "https://api.example.com", path: "/users/42", query: { expand: "profile" }, body: null, secret: null });
  });

  it("infers POST from a JSON body and keeps it as JSON", () => {
    const r = parseCurl(`curl -X POST https://api.example.com/orders -H 'Content-Type: application/json' -d '{"sku":"A1","qty":2}'`);
    expect(r.method).toBe("POST");
    expect(r.body).toEqual({ sku: "A1", qty: 2 });
    expect(r.headers).toEqual({});
  });

  it("moves Authorization into the secret and never into headers", () => {
    const r = parseCurl(`curl https://api.example.com/me -H "Authorization: Bearer abc123" -H "Accept: application/json"`);
    expect(r.secret).toBe("Bearer abc123");
    expect(r.headers).toEqual({ Accept: "application/json" });
  });

  it("turns -u into a Basic credential", () =>
    expect(parseCurl("curl -u alice:pw https://api.example.com/x").secret).toBe(`Basic ${btoa("alice:pw")}`));

  it("skips secret-looking and restricted headers with a warning", () => {
    const r = parseCurl(`curl https://a.example.com/ -H 'X-Api-Key: k' -H 'Host: evil' -H 'X-Team: core'`);
    expect(r.headers).toEqual({ "X-Team": "core" });
    expect(r.warnings).toHaveLength(2);
  });

  it("supports --json, --data-raw and --flag=value", () => {
    expect(parseCurl(`curl --json '{"a":1}' https://a.example.com/p`)).toMatchObject({ method: "POST", body: { a: 1 } });
    expect(parseCurl(`curl --request=PATCH --data-raw='{"b":2}' https://a.example.com/p`)).toMatchObject({ method: "PATCH", body: { b: 2 } });
  });

  it("moves -G data into the query string", () =>
    expect(parseCurl("curl -G https://a.example.com/search -d q=shoes -d page=2")).toMatchObject({ method: "GET", query: { q: "shoes", page: "2" }, body: null }));

  it("leaves out non-JSON bodies with a warning", () => {
    const r = parseCurl("curl -d 'a=1&b=2' https://a.example.com/form");
    expect(r.body).toBeNull();
    expect(r.warnings[0]).toMatch(/isn't JSON/);
  });

  it("ignores harmless flags and adds https when missing", () =>
    expect(parseCurl("curl -sSL --compressed -m 10 api.example.com/health")).toMatchObject({ baseUrl: "https://api.example.com", path: "/health" }));

  it("parses a multi-line command copied from browser dev tools", () => {
    const r = parseCurl(`curl 'https://api.example.com/v2/cart' \\\n  -H 'accept: */*' \\\n  -H 'cookie: s=1' \\\n  --data-raw '{"items":[1]}'`);
    expect(r).toMatchObject({ method: "POST", path: "/v2/cart", body: { items: [1] }, headers: { accept: "*/*" } });
    expect(r.warnings[0]).toMatch(/Cookies/);
  });

  it("rejects commands that aren't curl, lack a URL or use other methods", () => {
    expect(() => parseCurl("wget https://a.example.com")).toThrow(/starts with curl/);
    expect(() => parseCurl("curl -X GET")).toThrow(/URL/);
    expect(() => parseCurl("curl -X OPTIONS https://a.example.com")).toThrow(/OPTIONS/);
  });
});
