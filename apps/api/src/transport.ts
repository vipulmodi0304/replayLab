import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
import { Agent, fetch as undiciFetch } from "undici";
import { AppError } from "../../../packages/core/database";
import type { HttpTransport } from "../../../packages/core/http";
export function isPublicAddress(address: string) {
  try {
    const ip = ipaddr.process(address);
    return ip.range() === "unicast";
  } catch {
    return false;
  }
}
export function nodeTransport(allowPrivate = false): HttpTransport {
  return {
    async send(url, init) {
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new AppError("UNSAFE_URL", "Invalid target URL.");
      const host = url.hostname.replace(/^\[|\]$/g, "");
      const resolved = await lookup(host, { all: true, verbatim: true });
      if (
        !resolved.length ||
        (!allowPrivate && resolved.some((a) => !isPublicAddress(a.address)))
      )
        throw new AppError(
          "UNSAFE_URL",
          "Private, loopback, link-local, and reserved targets are blocked.",
        );
      // Pin the validated DNS answer for this connection to prevent DNS rebinding.
      const selected = resolved[0];
      const dispatcher = new Agent({
        connect: {
          lookup: (_hostname, options, callback) => {
            if (options.all) callback(null, [selected]);
            else callback(null, selected.address, selected.family);
          },
        },
      });
      try {
        const response = await undiciFetch(url, {
          method: init.method,
          headers: init.headers as Record<string, string>,
          body: init.body as string | undefined,
          signal: init.signal,
          redirect: "error",
          dispatcher,
        });
        const reader = response.body?.getReader();
        const stream = reader
          ? new ReadableStream<Uint8Array>({
              async pull(controller) {
                try {
                  const { done, value } = await reader.read();
                  if (done) {
                    controller.close();
                    await dispatcher.close();
                  } else controller.enqueue(value);
                } catch (e) {
                  controller.error(e);
                  await dispatcher.destroy();
                }
              },
              async cancel() {
                await reader.cancel();
                await dispatcher.destroy();
              },
            })
          : null;
        if (!stream) await dispatcher.close();
        return new Response(stream, {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
        });
      } catch (error) {
        await dispatcher.destroy();
        throw error;
      }
    },
  };
}
