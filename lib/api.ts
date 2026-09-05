// Thin client for the Guidoo backend. All requests go to same-origin `/be/*`,
// which next.config.ts proxies to the real backend (avoids CORS).

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

type Options = {
  method?: "GET" | "POST";
  body?: unknown;
  token?: string | null;
};

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const { method = "GET", body, token } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers["authorization"] = `Bearer ${token}`;

  const res = await fetch(`/be${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON body — e.g. an upstream 404/502 HTML page from the proxy when
    // the backend route doesn't exist. Fall through to the status-based error.
  }

  const errObj = (data ?? {}) as { error?: string };
  if (!res.ok) {
    throw new ApiError(res.status, errObj.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}
