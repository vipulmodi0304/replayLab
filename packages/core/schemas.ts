import { z } from "zod";
export const idSchema = z.string().uuid();
const headers = z
  .record(z.string().max(100), z.string().max(4000))
  .refine((h) => Object.keys(h).length <= 40, "Too many headers")
  .refine(
    (h) =>
      Object.entries(h).every(
        ([k, v]) =>
          /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(k) && !/[\r\n]/.test(v),
      ),
    "Invalid header",
  )
  .refine(
    (h) =>
      !Object.keys(h).some((k) =>
        /^(host|cookie|set-cookie|connection|content-length|transfer-encoding|proxy-authorization)$/i.test(
          k,
        ),
      ),
    "Restricted header",
  );
export const publicHeaders = headers.refine(
  (h) =>
    !Object.keys(h).some((k) =>
      /authorization|token|api[-_]key|secret/i.test(k),
    ),
  "Use the encrypted environment token field for secrets",
);
export const projectSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().max(400).default(""),
});
export const environmentSchema = z.object({
  name: z.string().trim().min(2).max(60),
  baseUrl: z
    .string()
    .url()
    .max(2000)
    .refine((v) => /^https?:\/\//.test(v), "Use HTTP or HTTPS"),
  headers: publicHeaders.default({}),
  secret: z.string().max(4000).optional(),
  kind: z.enum(["external", "demo-v1", "demo-v2"]).default("external"),
});
export const caseSchema = z.object({
  name: z.string().trim().min(2).max(100),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z
    .string()
    .min(1)
    .max(2000)
    .refine(
      (v) =>
        v.startsWith("/") &&
        !v.startsWith("//") &&
        !v.includes("\\") &&
        !/[\r\n#]/.test(v),
      "Use a relative path beginning with /",
    ),
  query: z.record(z.string().max(100), z.string().max(2000)).default({}),
  headers: publicHeaders.default({}),
  body: z.unknown().default(null),
  timeoutMs: z.number().int().min(1000).max(30000).default(10000),
  enabled: z.boolean().default(true),
});
export const rulesSchema = z
  .object({
    ignoredPaths: z.array(z.string().min(1).max(150)).max(50),
    ignoredHeaders: z.array(z.string().min(1).max(100)).max(50),
    latencyThresholdMs: z.number().min(1).max(120000),
    latencyPercentageThreshold: z.number().min(0).max(10000),
    latencyFailureMs: z.number().min(1).max(120000),
    compareHeaders: z.boolean(),
    arrayMode: z.enum(["ordered", "unordered"]),
    numericTolerance: z.number().min(0).max(1e10),
    allowAdditionalFields: z.boolean(),
    caseSensitiveStrings: z.boolean(),
  })
  .refine(
    (r) => r.latencyFailureMs >= r.latencyThresholdMs,
    "Failure threshold must be at least the warning threshold",
  );
export const replaySchema = z.object({
  sourceEnvironmentId: idSchema,
  targetEnvironmentId: idSchema,
  caseIds: z.array(idSchema).min(1).max(100).optional(),
});
export const authSchema = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(10).max(72),
  name: z.string().trim().min(2).max(80).optional(),
});
