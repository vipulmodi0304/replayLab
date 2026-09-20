import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import pino from "pino";
import { existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import { handleApi, type ApiContext } from "../../../packages/core/api";
import { demoSnapshot } from "../../../packages/core/demo";
import { openapi } from "../../../packages/core/openapi";
import { authRouter, sessionUser } from "./auth";
export function createApp(
  options: Omit<ApiContext, "user" | "runtime"> & {
    production?: boolean;
    webUrl?: string;
    webDirectory?: string;
    trustProxyHops?: number;
    ready?: () => Promise<void>;
  },
) {
  const app = express();
  const logger = pino({
    level: process.env.LOG_LEVEL || "info",
    redact: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "secret",
      "token",
    ],
  });
  app.disable("x-powered-by");
  app.set("trust proxy", options.trustProxyHops || false);
  app.use((req, res, next) => {
    const requestId = crypto.randomUUID();
    res.setHeader("X-Request-ID", requestId);
    res.setHeader("X-Content-Type-Options", "nosniff");
    const start = performance.now();
    res.on("finish", () =>
      logger.info({
        requestId,
        method: req.method,
        route: req.path.split("/").slice(0, 4).join("/"),
        status: res.statusCode,
        durationMs: Math.round(performance.now() - start),
      }),
    );
    next();
  });
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/ready", async (_req, res) => {
    try {
      await options.db.get("SELECT 1");
      await options.ready?.();
      res.json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });
  app.get("/api/v1/openapi", (_req, res) => res.json(openapi));
  if (!options.webDirectory)
    app.get("/docs", (_req, res) =>
      res
        .type("html")
        .send(
          '<!doctype html><html><head><meta charset="utf-8"><title>ReplayLab API</title></head><body style="font:16px system-ui;max-width:900px;margin:60px auto;padding:24px"><h1>ReplayLab API</h1><p>Version 1.0.0. All product endpoints require an authenticated session.</p><p><a href="/api/v1/openapi">Download the OpenAPI specification</a></p><p>See the web app documentation for the workflow, endpoint examples, and configuration.</p></body></html>',
        ),
    );
  app.get("/demo/:version/{*endpoint}", async (req, res) => {
    const version = req.params.version === "v2" ? "v2" : "v1",
      endpoint = req.params.endpoint;
    const path =
      "/" + (Array.isArray(endpoint) ? endpoint.join("/") : endpoint);
    const response = demoSnapshot(version, path);
    await new Promise((r) => setTimeout(r, response.latencyMs));
    res.status(response.status).set(response.headers).json(response.body);
  });
  app.use(express.json({ limit: "100kb" }));
  app.use((req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.headers.origin;
      if (
        origin &&
        origin !== options.webUrl &&
        origin !== `${req.protocol}://${req.get("host")}`
      ) {
        res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "Cross-origin writes are not allowed.",
          },
        });
        return;
      }
      if (req.headers["sec-fetch-site"] === "cross-site") {
        res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "Cross-site writes are not allowed.",
          },
        });
        return;
      }
    }
    next();
  });
  app.use("/api/v1/auth", authRouter(options.db, options.production));
  app.use("/api/v1", async (req, res) => {
    const user = await sessionUser(options.db, req);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers))
      if (typeof value === "string") headers.set(key, value);
    const origin = options.webUrl || `${req.protocol}://${req.get("host")}`;
    const request = new Request(new URL(req.originalUrl, origin), {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method)
        ? undefined
        : JSON.stringify(req.body ?? {}),
    });
    const response = await handleApi(request, {
      ...options,
      user,
      runtime: "node",
    });
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.send(await response.text());
  });
  app.use("/api", (_req, res) => {
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Unknown API endpoint." } });
  });
  if (options.webDirectory) {
    const directory = resolve(options.webDirectory);
    const index = resolve(directory, "index.html");
    if (!existsSync(index))
      throw new Error(
        "Frontend build is missing. Run pnpm build before starting the server.",
      );
    app.use(
      express.static(directory, {
        index: false,
        dotfiles: "ignore",
        setHeaders(res, file) {
          res.setHeader(
            "Cache-Control",
            file.startsWith(resolve(directory, "assets") + sep)
              ? "public, max-age=31536000, immutable"
              : "no-cache",
          );
        },
      }),
    );
    app.get(
      [
        "/",
        "/app",
        "/app/{*path}",
        "/login",
        "/register",
        "/settings",
        "/docs",
      ],
      (_req, res) => {
        res.setHeader("Cache-Control", "no-cache");
        res.sendFile(index);
      },
    );
  }
  app.use((_req, res) => {
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Page not found." } });
  });
  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      void _next;
      const tooLarge =
        (error as { type?: string })?.type === "entity.too.large";
      res.status(tooLarge ? 413 : 500).json({
        error: {
          code: tooLarge ? "BODY_TOO_LARGE" : "INTERNAL_ERROR",
          message: tooLarge
            ? "Request exceeds the 100 KB limit."
            : "The request could not be completed.",
        },
      });
    },
  );
  return app;
}
