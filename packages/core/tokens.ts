/**
 * Personal API tokens for CI. The token is shown once; only its SHA-256 hash
 * is stored, so a database leak doesn't expose usable tokens.
 */
export const TOKEN_PREFIX = "rl_";

export async function hashToken(token: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createApiToken() {
  const random = crypto.getRandomValues(new Uint8Array(32));
  const body = btoa(String.fromCharCode(...random)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const token = `${TOKEN_PREFIX}${body}`;
  return { token, hash: await hashToken(token), prefix: token.slice(0, 10) };
}
