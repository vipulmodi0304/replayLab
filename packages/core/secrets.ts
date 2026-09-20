import { AppError } from "./database";
function bytes(s: string) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
export async function encryptSecret(
  secret: string,
  key?: string,
): Promise<string> {
  if (!secret) return "";
  if (!key)
    throw new AppError(
      "SECRET_STORAGE_DISABLED",
      "Encrypted secrets require an ENCRYPTION_KEY on the server.",
    );
  const raw = bytes(key);
  if (raw.length !== 32)
    throw new AppError(
      "SECRET_STORAGE_DISABLED",
      "Secret storage is not configured correctly.",
      503,
    );
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    new TextEncoder().encode(secret),
  );
  return btoa(String.fromCharCode(...iv, ...new Uint8Array(ciphertext)));
}
export async function decryptSecret(
  value: string,
  key?: string,
): Promise<string> {
  if (!value) return "";
  if (!key)
    throw new AppError(
      "SECRET_STORAGE_DISABLED",
      "Secret storage is unavailable.",
      503,
    );
  const payload = bytes(value);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    bytes(key),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: payload.slice(0, 12) },
      cryptoKey,
      payload.slice(12),
    ),
  );
}
export const sensitiveHeader = (name: string) =>
  /authorization|cookie|token|api[-_]key|secret/i.test(name);
export function redactHeaders(headers: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(headers).filter(([key]) => !sensitiveHeader(key)),
  );
}
