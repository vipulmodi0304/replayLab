import { Queue } from "bullmq";
import { Redis } from "ioredis";
export function replayQueue(redisUrl: string) {
  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    family: 0,
  });
  const queue = new Queue("replay-runs", {
    connection,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  });
  return { queue, connection };
}
