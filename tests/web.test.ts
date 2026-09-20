import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import supertest from "supertest";
import { createApp } from "../apps/api/src/app";
import { testDatabase } from "./database";

let store: ReturnType<typeof testDatabase>;
let directory: string;
const html =
  '<!doctype html><html><body><div id="root">ReplayLab</div></body></html>';
beforeEach(() => {
  store = testDatabase();
  directory = mkdtempSync(join(tmpdir(), "replaylab-web-"));
  mkdirSync(join(directory, "assets"));
  writeFileSync(join(directory, "index.html"), html);
  writeFileSync(
    join(directory, "assets", "app-123.js"),
    "export default true;",
  );
  writeFileSync(join(directory, ".env"), "SECRET=should-not-be-public");
});
afterEach(() => {
  store.close();
  rmSync(directory, { recursive: true, force: true });
});
function app() {
  return createApp({
    db: store.db,
    transport: { send: async () => new Response("{}") },
    externalEnabled: false,
    webDirectory: directory,
  });
}
describe("same-origin web hosting", () => {
  it("serves frontend routes, including direct workspace links and docs", async () => {
    const server = app();
    for (const route of [
      "/",
      "/login",
      "/register",
      "/app/replays/example",
      "/settings",
      "/docs",
    ]) {
      const result = await supertest(server).get(route);
      expect(result.status).toBe(200);
      expect(result.text).toBe(html);
      expect(result.headers["cache-control"]).toBe("no-cache");
    }
  });
  it("caches fingerprinted assets while keeping API errors as JSON", async () => {
    const server = app();
    const asset = await supertest(server).get("/assets/app-123.js");
    expect(asset.status).toBe(200);
    expect(asset.headers["cache-control"]).toContain("immutable");
    const api = await supertest(server).get("/api/missing");
    expect(api.status).toBe(404);
    expect(api.body.error.code).toBe("NOT_FOUND");
    const privateApi = await supertest(server).get("/api/v1/workspace");
    expect(privateApi.status).toBe(401);
    expect(privateApi.headers["content-type"]).toContain("application/json");
  });
  it("does not expose dotfiles or return the app for missing assets", async () => {
    const server = app();
    for (const route of [
      "/.env",
      "/assets/missing.js",
      "/package.json",
      "/src/main.tsx",
    ]) {
      const result = await supertest(server).get(route);
      expect(result.status).toBe(404);
      expect(result.text).not.toContain("should-not-be-public");
      expect(result.text).not.toBe(html);
    }
  });
  it("fails startup if the frontend has not been built", () => {
    rmSync(join(directory, "index.html"));
    expect(app).toThrow("Frontend build is missing");
  });
});
