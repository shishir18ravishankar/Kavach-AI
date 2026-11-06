/**
 * In-memory, metadata-only server log for the demo "proof" screen.
 * NEVER put document content, prompts, answers, keys or filenames here:
 * only sizes, hashes, root hashes, durations and status codes.
 * Per serverless instance; resets on cold start.
 */
export interface LogEntry {
  ts: string;
  route: string;
  event: string;
  meta: Record<string, string | number | boolean | null>;
}

const MAX = 200;
const g = globalThis as unknown as { __kavachLog?: LogEntry[] };
const entries: LogEntry[] = (g.__kavachLog ??= []);

export function logEvent(route: string, event: string, meta: LogEntry["meta"] = {}): void {
  const e: LogEntry = { ts: new Date().toISOString(), route, event, meta };
  entries.push(e);
  if (entries.length > MAX) entries.splice(0, entries.length - MAX);
  console.log(`[kavach] ${e.ts} ${route} ${event} ${JSON.stringify(meta)}`);
}

export function getLog(): LogEntry[] {
  return [...entries].reverse();
}

/** Very small per-IP fixed-window limiter (per instance). */
const buckets = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) { buckets.set(key, { n: 1, reset: now + windowMs }); return true; }
  b.n += 1;
  return b.n <= limit;
}

export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
}
