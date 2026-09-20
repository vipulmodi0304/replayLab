import "dotenv/config";
import { z } from "zod";
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  PORT: z.coerce.number().int().min(1).max(65535).optional(),
  WEB_URL: z.string().url().default("http://localhost:5173"),
  SERVE_WEB: z.enum(["true", "false"]).optional(),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  ENCRYPTION_KEY: z
    .string()
    .refine(
      (v) => Buffer.from(v, "base64").length === 32,
      "Use a base64 encoded 32-byte key",
    ),
  ALLOW_PRIVATE_NETWORK_TARGETS: z.enum(["true", "false"]).default("false"),
  AI_ENABLED: z.enum(["true", "false"]).default("false"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
});
export const config = schema.parse(process.env);
if (config.NODE_ENV === "production" && !process.env.WEB_URL)
  throw new Error(
    "WEB_URL must be set to the public HTTPS origin in production",
  );
if (
  config.NODE_ENV === "production" &&
  new URL(config.WEB_URL).protocol !== "https:"
)
  throw new Error(
    "Production WEB_URL must use HTTPS for secure session cookies",
  );
if (
  config.NODE_ENV === "production" &&
  config.ALLOW_PRIVATE_NETWORK_TARGETS === "true"
)
  throw new Error("Private-network targets must be disabled in production");
