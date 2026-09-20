import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { rateLimit } from "express-rate-limit";
import { Router, type Request, type Response } from "express";
import type { Database } from "../../../packages/core/database";
import { authSchema } from "../../../packages/core/schemas";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export async function sessionUser(db: Database, request: Request) {
  const token = request.headers.cookie
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("replaylab_session="))
    ?.slice("replaylab_session=".length);
  if (!token) return null;
  return (
    (await db.get<{ id: string; email: string; name: string }>(
      "SELECT u.id,u.email,u.name FROM users u JOIN sessions s ON s.user_id = u.id WHERE s.id = ? AND s.expires_at > ?",
      [hash(token), Date.now()],
    )) || null
  );
}
export function authRouter(db: Database, production = false) {
  const router = Router();
  router.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: production ? 20 : 100,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: {
          code: "RATE_LIMITED",
          message: "Too many authentication attempts. Try again later.",
        },
      },
    }),
  );
  async function signIn(res: Response, userId: string) {
    const token = randomBytes(32).toString("hex");
    await db.run("DELETE FROM sessions WHERE expires_at < ?", [Date.now()]);
    await db.run(
      "INSERT INTO sessions (id,user_id,expires_at) VALUES (?,?,?)",
      [hash(token), userId, Date.now() + 7 * 86400000],
    );
    res.cookie("replaylab_session", token, {
      httpOnly: true,
      secure: production,
      sameSite: "strict",
      maxAge: 7 * 86400000,
      path: "/",
    });
  }
  router.post("/register", async (req, res) => {
    const parsed = authSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Use a valid email and a password of 10–72 characters.",
          },
        });
      return;
    }
    const { email, password, name } = parsed.data;
    const existing = await db.get("SELECT id FROM users WHERE email = ?", [
      email,
    ]);
    if (existing) {
      res
        .status(400)
        .json({
          error: {
            code: "REGISTRATION_FAILED",
            message: "Unable to create this account. Try signing in.",
          },
        });
      return;
    }
    const id = crypto.randomUUID();
    await db.run(
      "INSERT INTO users (id,email,name,password_hash,seeded,created_at) VALUES (?,?,?,?,0,?)",
      [
        id,
        email,
        name || email.split("@")[0],
        await bcrypt.hash(password, 12),
        new Date().toISOString(),
      ],
    );
    await signIn(res, id);
    res.status(201).json({ user: { id, email, name } });
  });
  router.post("/login", async (req, res) => {
    const parsed = authSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(401)
        .json({
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password.",
          },
        });
      return;
    }
    const user = await db.get<{ id: string; password_hash: string }>(
      "SELECT id,password_hash FROM users WHERE email = ?",
      [parsed.data.email],
    );
    const valid = await bcrypt.compare(
      parsed.data.password,
      user?.password_hash ||
        "$2b$12$J8HvWE3pCcKU4Qbq8TdaIOcfkBb4P40N4uvEROrFKmZFwUljRcaUW",
    );
    if (!user || !valid) {
      res
        .status(401)
        .json({
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password.",
          },
        });
      return;
    }
    await signIn(res, user.id);
    res.json({ ok: true });
  });
  router.post("/logout", async (req, res) => {
    const token = req.headers.cookie
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("replaylab_session="))
      ?.slice("replaylab_session=".length);
    if (token) await db.run("DELETE FROM sessions WHERE id = ?", [hash(token)]);
    res.clearCookie("replaylab_session", {
      path: "/",
      sameSite: "strict",
      secure: production,
      httpOnly: true,
    });
    res.json({ ok: true });
  });
  return router;
}
