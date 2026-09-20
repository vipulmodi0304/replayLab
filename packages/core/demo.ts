import type { Json, Snapshot } from "./types";
export function demoSnapshot(version: "v1" | "v2", path: string): Snapshot {
  const candidate = version === "v2";
  let body: Json;
  let latencyMs = 42;
  let status = 200;
  if (/^\/users\/\d+$/.test(path)) {
    const id = Number(path.split("/").pop());
    body = candidate
      ? { id: String(id), name: "Alice", plan: "pro", profile: { age: "24" } }
      : {
          id,
          name: "Alice",
          email: "alice@example.com",
          plan: "pro",
          profile: { age: 24 },
        };
    latencyMs = candidate ? 124 : 120;
  } else if (/^\/orders\/\d+$/.test(path)) {
    body = {
      id: Number(path.split("/").pop()),
      status: "confirmed",
      total: 129.99,
      currency: "USD",
      items: [{ id: "prod_01", quantity: 2 }],
    };
    latencyMs = candidate ? 460 : 120;
  } else if (path === "/products") {
    body = {
      products: [
        { id: 1, name: "Everyday backpack", price: 64.99 },
        { id: 2, name: "Travel bottle", price: 24.99 },
      ],
      total: 2,
    };
    latencyMs = candidate ? 48 : 45;
  } else {
    body = { error: "Not found" };
    status = 404;
  }
  return {
    status,
    headers: { "content-type": "application/json", "x-api-version": version },
    body,
    contentType: "application/json",
    latencyMs,
    recordedAt: new Date().toISOString(),
  };
}
