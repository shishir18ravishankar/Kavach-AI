/** Thin typed fetch helpers with readable errors. */
export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public body?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

export async function readError(res: Response): Promise<ApiError> {
  let body: unknown = null;
  let msg = `${res.status} ${res.statusText}`;
  try {
    body = await res.json();
    const b = body as { error?: string | { message?: string }; code?: string };
    if (typeof b.error === "string") msg = b.error;
    else if (b.error && typeof b.error.message === "string") msg = b.error.message;
    return new ApiError(msg, res.status, (body as { code?: string }).code, body);
  } catch {
    return new ApiError(msg, res.status, undefined, body);
  }
}

export async function fetchWithTimeout(input: string, init: RequestInit = {}, ms = 60_000): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctl.signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new ApiError(`Request timed out after ${Math.round(ms / 1000)}s`, 0, "timeout");
    throw new ApiError(`Network error: ${(e as Error).message}`, 0, "network");
  } finally {
    clearTimeout(timer);
  }
}
