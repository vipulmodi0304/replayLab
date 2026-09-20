import { config } from "./config";
import { resolve } from "node:path";
import { createApp } from "./app";
import { postgresDatabase, prisma } from "./database";
import { replayQueue } from "./queue";
import { nodeTransport } from "./transport";
import { OpenAICompatibleProvider } from "../../../packages/core/ai";
const { queue, connection } = replayQueue(config.REDIS_URL);
const app = createApp({
  db: postgresDatabase(),
  transport: nodeTransport(config.ALLOW_PRIVATE_NETWORK_TARGETS === "true"),
  production: config.NODE_ENV === "production",
  webUrl: config.WEB_URL,
  webDirectory:
    config.SERVE_WEB === "true" ||
    (config.SERVE_WEB !== "false" && config.NODE_ENV === "production")
      ? resolve("apps/web/dist")
      : undefined,
  trustProxyHops: config.TRUST_PROXY_HOPS,
  encryptionKey: config.ENCRYPTION_KEY,
  externalEnabled: true,
  enqueue: async (id) => {
    await queue.add("replay", { runId: id }, { jobId: id });
  },
  ready: async () => {
    await connection.ping();
  },
  ai:
    config.AI_ENABLED === "true" && config.OPENAI_API_KEY && config.OPENAI_MODEL
      ? new OpenAICompatibleProvider(config.OPENAI_API_KEY, config.OPENAI_MODEL)
      : undefined,
});
const port = config.PORT ?? config.API_PORT;
const server = app.listen(port, "::", () =>
  console.info(`ReplayLab listening on ${port}`),
);
async function shutdown() {
  server.close(async () => {
    await queue.close();
    await connection.quit();
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 15000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
