const error = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        requestId: { type: "string" },
      },
    },
  },
};
const requestCase = {
  type: "object",
  required: ["name", "method", "path"],
  properties: {
    name: { type: "string", example: "Get User" },
    method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
    path: { type: "string", example: "/users/42" },
    headers: { type: "object", additionalProperties: { type: "string" } },
    query: { type: "object", additionalProperties: { type: "string" } },
    body: { nullable: true },
    timeoutMs: {
      type: "integer",
      minimum: 1000,
      maximum: 30000,
      default: 10000,
    },
    enabled: { type: "boolean", default: true },
  },
};
const routes: [string, string[], string][] = [
  ["/config", ["get"], "Runtime capabilities"],
  ["/auth/register", ["post"], "Register a local account"],
  ["/auth/login", ["post"], "Sign in to the local backend"],
  ["/auth/logout", ["post"], "Sign out"],
  ["/auth/me", ["get"], "Current user"],
  ["/workspace", ["get"], "Workspace overview"],
  ["/projects", ["get", "post"], "List or create projects"],
  ["/projects/{projectId}", ["get", "patch", "delete"], "Project details"],
  [
    "/projects/{projectId}/environments",
    ["get", "post"],
    "Project environments",
  ],
  ["/projects/{projectId}/cases", ["get", "post"], "Saved request cases"],
  ["/projects/{projectId}/rules", ["patch"], "Comparison rules"],
  [
    "/projects/{projectId}/replays",
    ["get", "post"],
    "Replay history and initiation",
  ],
  [
    "/environments/{environmentId}",
    ["patch", "delete"],
    "Environment configuration",
  ],
  ["/cases/{caseId}", ["get", "patch", "delete"], "Saved request"],
  ["/cases/{caseId}/duplicate", ["post"], "Duplicate a request"],
  ["/cases/{caseId}/send", ["post"], "Send and record a response"],
  ["/cases/{caseId}/baseline", ["post"], "Approve recorded response"],
  ["/replays/{runId}", ["get"], "Replay status and results"],
  ["/results/{resultId}", ["get"], "Structured result"],
  ["/results/{resultId}/explain", ["post"], "Optional AI explanation"],
];
const paths: Record<string, unknown> = {};
for (const [path, methods, summary] of routes) {
  paths[path] = Object.fromEntries(
    methods.map((method) => [
      method,
      {
        summary,
        operationId: method + path.replace(/[{}]/g, "").replaceAll("/", "_"),
        parameters: [...path.matchAll(/\{([^}]+)\}/g)].map((match) => ({
          name: match[1],
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        })),
        responses: {
          200: {
            description: "Successful response",
            content: { "application/json": { schema: { type: "object" } } },
          },
          400: {
            description: "Invalid request",
            content: { "application/json": { schema: error } },
          },
          401: { description: "Authentication required" },
          404: { description: "Resource not found" },
          429: { description: "Rate limit exceeded" },
        },
        ...(method === "post" || method === "patch"
          ? {
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema:
                      path.includes("/cases") &&
                      !path.includes("send") &&
                      !path.includes("baseline") &&
                      !path.includes("duplicate")
                        ? requestCase
                        : path.endsWith("/replays")
                          ? {
                              type: "object",
                              required: [
                                "sourceEnvironmentId",
                                "targetEnvironmentId",
                              ],
                              properties: {
                                sourceEnvironmentId: {
                                  type: "string",
                                  format: "uuid",
                                },
                                targetEnvironmentId: {
                                  type: "string",
                                  format: "uuid",
                                },
                                caseIds: {
                                  type: "array",
                                  items: { type: "string", format: "uuid" },
                                },
                              },
                            }
                          : path.endsWith("/baseline")
                            ? {
                                type: "object",
                                required: ["recordingId"],
                                properties: {
                                  recordingId: {
                                    type: "string",
                                    format: "uuid",
                                  },
                                  replace: { type: "boolean" },
                                },
                              }
                            : path.endsWith("/send")
                              ? {
                                  type: "object",
                                  required: ["environmentId"],
                                  properties: {
                                    environmentId: {
                                      type: "string",
                                      format: "uuid",
                                    },
                                  },
                                }
                              : { type: "object" },
                  },
                },
              },
            }
          : {}),
      },
    ]),
  );
}
export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "ReplayLab API",
    version: "1.0.0",
    description:
      "Owner-scoped API regression testing with HttpOnly session cookies. Mutation requests must be same-origin.",
  },
  servers: [{ url: "/api/v1" }],
  security: [{ session: [] }],
  components: {
    securitySchemes: {
      session: { type: "apiKey", in: "cookie", name: "replaylab_session" },
    },
    schemas: {
      RequestCase: requestCase,
      Error: error,
      DiffEntry: {
        type: "object",
        properties: {
          path: { type: "string" },
          category: { type: "string" },
          severity: {
            type: "string",
            enum: ["pass", "info", "warning", "breaking", "critical"],
          },
          baselineValue: {},
          targetValue: {},
          message: { type: "string" },
        },
      },
    },
  },
  paths,
};
