import type { Json } from "./types";

/**
 * Turns a pasted cURL command into the pieces of a saved request.
 * Pure and dependency-free, so it runs in the browser and in tests.
 *
 * Secrets are never returned as plain headers: an Authorization header
 * (or -u user:pass) comes back as `secret`, meant for the environment's
 * encrypted token field. Anything we can't store is listed in `warnings`.
 */
export interface ParsedCurl {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  baseUrl: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: Json;
  secret: string | null;
  warnings: string[];
}

const RESTRICTED = /^(host|cookie|set-cookie|connection|content-length|transfer-encoding|proxy-authorization)$/i;
const SECRET_LIKE = /token|api[-_]key|secret/i;
// Flags that take a value we don't use, so the value isn't mistaken for the URL.
const IGNORED_WITH_VALUE = new Set(["-o", "--output", "-m", "--max-time", "--connect-timeout", "-w", "--write-out", "--retry", "-x", "--proxy"]);

/** Split a shell command into words, honouring quotes, escapes and line continuations. */
export function shellWords(input: string): string[] {
  const words: string[] = [];
  let current = "";
  let inWord = false;
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (quote === "'") {
      if (ch === "'") quote = null;
      else current += ch;
      continue;
    }
    if (quote === '"') {
      if (ch === '"') quote = null;
      else if (ch === "\\" && i + 1 < input.length && '"\\$`'.includes(input[i + 1]!)) current += input[++i];
      else current += ch;
      continue;
    }
    if (ch === "\\" && (input[i + 1] === "\n" || input[i + 1] === "\r")) {
      i += input[i + 1] === "\r" && input[i + 2] === "\n" ? 2 : 1;
      continue;
    }
    if (ch === "\\" && i + 1 < input.length) {
      current += input[++i];
      inWord = true;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      inWord = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (inWord) words.push(current);
      current = "";
      inWord = false;
      continue;
    }
    current += ch;
    inWord = true;
  }
  if (quote) throw new Error("The command has an unclosed quote.");
  if (inWord) words.push(current);
  return words;
}

export function parseCurl(command: string): ParsedCurl {
  const words = shellWords(command.trim());
  if (words[0] !== "curl") throw new Error("Paste a command that starts with curl.");

  let method: string | null = null;
  let url: string | null = null;
  let getMode = false;
  const headers: [string, string][] = [];
  const data: string[] = [];
  let basicAuth: string | null = null;
  const warnings: string[] = [];

  for (let i = 1; i < words.length; i++) {
    let word = words[i]!;
    let inline: string | undefined;
    // --flag=value form
    if (word.startsWith("--") && word.includes("=")) {
      inline = word.slice(word.indexOf("=") + 1);
      word = word.slice(0, word.indexOf("="));
    }
    const value = () => {
      if (inline !== undefined) return inline;
      const next = words[++i];
      if (next === undefined) throw new Error(`${word} needs a value.`);
      return next;
    };
    switch (word) {
      case "-X":
      case "--request":
        method = value().toUpperCase();
        break;
      case "-H":
      case "--header": {
        const raw = value();
        const colon = raw.indexOf(":");
        if (colon < 1) warnings.push(`Skipped a header that isn't "Name: value": ${raw}`);
        else headers.push([raw.slice(0, colon).trim(), raw.slice(colon + 1).trim()]);
        break;
      }
      case "-d":
      case "--data":
      case "--data-raw":
      case "--data-binary":
      case "--data-ascii":
        data.push(value());
        break;
      case "--json":
        data.push(value());
        headers.push(["Content-Type", "application/json"], ["Accept", "application/json"]);
        break;
      case "-u":
      case "--user": {
        const creds = value();
        basicAuth = `Basic ${btoa(creds)}`;
        break;
      }
      case "-A":
      case "--user-agent":
        headers.push(["User-Agent", value()]);
        break;
      case "-e":
      case "--referer":
        headers.push(["Referer", value()]);
        break;
      case "-b":
      case "--cookie":
        value();
        warnings.push("Cookies were skipped. ReplayLab doesn't send cookies.");
        break;
      case "-G":
      case "--get":
        getMode = true;
        break;
      case "--url":
        url = value();
        break;
      default:
        if (IGNORED_WITH_VALUE.has(word)) value();
        else if (word.startsWith("-")) {
          /* flags such as -s, -L, --compressed don't change the request */
        } else if (!url) url = word;
        else warnings.push(`Ignored extra argument: ${word}`);
    }
  }

  if (!url) throw new Error("The command doesn't include a URL.");
  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
  } catch {
    throw new Error(`"${url}" isn't a valid URL.`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only HTTP and HTTPS URLs are supported.");

  const query: Record<string, string> = {};
  parsed.searchParams.forEach((v, k) => (query[k] = v));

  const payload = data.join("&");
  if (getMode && payload) {
    for (const [k, v] of new URLSearchParams(payload)) query[k] = v;
  }

  const finalMethod = (method || (data.length && !getMode ? "POST" : "GET")) as ParsedCurl["method"];
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(finalMethod))
    throw new Error(`ReplayLab supports GET, POST, PUT, PATCH and DELETE, not ${finalMethod}.`);

  let body: Json = null;
  if (payload && !getMode) {
    try {
      body = JSON.parse(payload) as Json;
    } catch {
      warnings.push("The body isn't JSON, so it was left out. ReplayLab sends JSON bodies only.");
    }
  }

  let secret = basicAuth;
  const kept: Record<string, string> = {};
  for (const [name, val] of headers) {
    if (/^authorization$/i.test(name)) {
      if (secret) warnings.push("More than one credential was found. Only the first is kept.");
      else secret = val;
    } else if (/^cookie$/i.test(name)) warnings.push("Cookies were skipped. ReplayLab doesn't send cookies.");
    else if (RESTRICTED.test(name)) warnings.push(`Skipped the ${name} header, which ReplayLab sets itself.`);
    else if (SECRET_LIKE.test(name)) warnings.push(`Skipped ${name}. Secret headers can't be saved; use the environment's token field for Authorization.`);
    else if (/^content-type$/i.test(name) && /json/i.test(val)) {
      /* added automatically for JSON bodies */
    } else kept[name] = val;
  }

  return {
    method: finalMethod,
    baseUrl: parsed.origin,
    path: (parsed.pathname || "/") as string,
    query,
    headers: kept,
    body,
    secret,
    warnings,
  };
}
