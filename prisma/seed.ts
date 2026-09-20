import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma, postgresDatabase } from "../apps/api/src/database";
import { ensureDemo } from "../packages/core/seed";
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 10)
  throw new Error(
    "Set DEMO_PASSWORD to a local demo password of at least 10 characters.",
  );
const user = await prisma.user.upsert({
  where: { email: "demo@replaylab.dev" },
  update: {},
  create: {
    id: crypto.randomUUID(),
    email: "demo@replaylab.dev",
    name: "Demo developer",
    password_hash: await bcrypt.hash(password, 12),
    created_at: new Date().toISOString(),
  },
});
await ensureDemo(postgresDatabase(), {
  id: user.id,
  email: user.email,
  name: user.name,
});
await prisma.$disconnect();
console.info("Seeded Demo Commerce API for demo@replaylab.dev");
