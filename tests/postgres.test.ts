import { describe, it, expect } from "vitest";
import { Queue, QueueEvents, Worker } from "bullmq";
import { Redis } from "ioredis";
import { postgresDatabase, prisma } from "../apps/api/src/database";
import { ensureDemo } from "../packages/core/seed";
import { Repository } from "../packages/core/repository";
import { createReplay, processRun } from "../packages/core/replay";
const available = Boolean(process.env.DATABASE_URL && process.env.REDIS_URL);
describe.skipIf(!available)("PostgreSQL and BullMQ integration", () => {
  it("persists a queued replay through Prisma and a Redis-backed worker", async () => {
    const db = postgresDatabase(),
      id = crypto.randomUUID(),
      user = {
        id,
        email: `${id}@test.replaylab.dev`,
        name: "Integration Test",
      };
    const connection = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null,
    });
    const queueName = `replaylab-test-${id}`;
    const queue = new Queue(queueName, { connection });
    const events = new QueueEvents(queueName, { connection });
    const worker = new Worker<{ runId: string }>(
      queueName,
      async (job) =>
        processRun(db, job.data.runId, {
          send: async () => new Response("{}"),
        }),
      { connection, concurrency: 1 },
    );
    try {
      await ensureDemo(db, user);
      const repo = new Repository(db, id),
        project = (await repo.projects())[0],
        envs = await repo.environments(project.id);
      const run = await createReplay(
        repo,
        project.id,
        envs.find((e) => e.kind === "demo-v1")!.id,
        envs.find((e) => e.kind === "demo-v2")!.id,
      );
      await events.waitUntilReady();
      const job = await queue.add(
        "replay",
        { runId: run.id },
        { jobId: run.id },
      );
      await job.waitUntilFinished(events, 15000);
      expect(await repo.run(run.id)).toMatchObject({
        status: "completed",
        passed: 1,
        warnings: 1,
        failed: 1,
      });
      expect(await repo.results(run.id)).toHaveLength(3);
    } finally {
      await worker.close();
      await events.close();
      await queue.obliterate({ force: true });
      await queue.close();
      await connection.quit();
      await db.run("DELETE FROM users WHERE id = ?", [id]);
      await prisma.$disconnect();
    }
  }, 25000);
});
