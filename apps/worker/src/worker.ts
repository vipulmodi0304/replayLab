import { Worker } from "bullmq";
import { Redis } from "ioredis";
import pino from "pino";
import { config } from "../../api/src/config";
import { postgresDatabase, prisma } from "../../api/src/database";
import { nodeTransport } from "../../api/src/transport";
import { processRun, requeueStranded } from "../../../packages/core/replay";
import { replayQueue } from "../../api/src/queue";
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
// Pick up runs that were saved but never queued (for example, if the API
// crashed in between). Job ids are run ids, so a run is never queued twice.
const { queue: requeue, connection: requeueConnection } = replayQueue(config.REDIS_URL);
async function sweep() {
  try {
    const count = await requeueStranded(db, async (runId) => {
      await requeue.add("replay", { runId }, { jobId: runId });
    });
    if (count) logger.info({ count }, "Re-queued stranded replay runs");
  } catch {
    logger.error("Could not check for stranded replay runs");
  }
}
void sweep();
const sweeper = setInterval(sweep, 5 * 60 * 1000);
async function shutdown() {
  clearInterval(sweeper);
  await worker.close();
  await requeue.close();
  await requeueConnection.quit();
  await connection.quit();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
