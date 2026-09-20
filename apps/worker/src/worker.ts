import { Worker } from "bullmq";
import { Redis } from "ioredis";
import pino from "pino";
import { config } from "../../api/src/config";
import { postgresDatabase, prisma } from "../../api/src/database";
import { nodeTransport } from "../../api/src/transport";
import { processRun } from "../../../packages/core/replay";
const logger = pino();
const connection = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  family: 0,
});
const db = postgresDatabase();
const worker = new Worker<{ runId: string }>(
  "replay-runs",
  async (job) => {
    await processRun(
      db,
      job.data.runId,
      nodeTransport(config.ALLOW_PRIVATE_NETWORK_TARGETS === "true"),
      config.ENCRYPTION_KEY,
    );
  },
  { connection, concurrency: 2, maxStalledCount: 0 },
);
worker.on("completed", (job) =>
  logger.info({ runId: job.data.runId }, "Replay completed"),
);
worker.on("failed", async (job) => {
  if (job)
    await db.run(
      "UPDATE runs SET status = ?, completed_at = ? WHERE id = ? AND status IN (?,?)",
      ["failed", new Date().toISOString(), job.data.runId, "queued", "running"],
    );
  logger.error({ runId: job?.data.runId }, "Replay failed");
});
worker.on("error", () => logger.error("Replay worker connection error"));
async function shutdown() {
  await worker.close();
  await connection.quit();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
