export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    method: options.method || "GET",
    credentials: "same-origin",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok)
    throw new ApiError(
      data.error?.message || "The request could not be completed.",
      response.status,
    );
  return data as T;
}
/** For endpoints that return text, such as the Markdown run report. */
export async function apiText(path: string): Promise<string> {
  const response = await fetch(`/api/v1${path}`, { credentials: "same-origin" });
  const text = await response.text();
  if (!response.ok) {
    let message = "The request could not be completed.";
    try {
      message = (JSON.parse(text) as { error?: { message?: string } }).error?.message || message;
    } catch {
      /* not JSON */
    }
    throw new ApiError(message, response.status);
  }
  return text;
}
