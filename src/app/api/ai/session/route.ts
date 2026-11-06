import { NextResponse } from "next/server";
import { getAccountInfo, getProviderInfo, mintSessionToken } from "@/lib/server/zgCompute";
import { hasPrivateKey, ZG } from "@/lib/server/config";
import { clientIp, logEvent, rateLimit } from "@/lib/server/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 15 * 60 * 1000;

/**
 * Mints a short-lived session token so the BROWSER can call the 0G sealed
 * inference provider directly. Prompts and answers never pass through here.
 */
export async function POST(req: Request) {
  if (!hasPrivateKey()) {
    return NextResponse.json({ error: "0G is not configured on this server", code: "not_configured" }, { status: 503 });
  }
  if (!rateLimit(`ai:${clientIp(req)}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests, wait a minute", code: "rate_limited" }, { status: 429 });
  }
  try {
    const [provider, account] = await Promise.all([getProviderInfo(ZG.computeProvider), getAccountInfo(ZG.computeProvider)]);
    if (!account.exists || !account.acknowledged) {
      logEvent("POST /api/ai/session", "provider_not_set_up", { provider: provider.provider });
      return NextResponse.json({ error: "The app's 0G compute account for this provider is not set up", code: "not_funded", provider, account }, { status: 503 });
    }
    const { authorization, expiresAt } = await mintSessionToken(provider.provider, account.generation, TTL_MS);
    logEvent("POST /api/ai/session", "session_token_minted", { provider: provider.provider, model: provider.model, ttlSec: TTL_MS / 1000, funded: account.fundedEnough });
    return NextResponse.json({ provider, account, authorization, expiresAt });
  } catch (e) {
    const message = (e as Error).message.slice(0, 300);
    logEvent("POST /api/ai/session", "session_failed", { error: message });
    return NextResponse.json({ error: `Could not reach 0G compute: ${message}`, code: "chain_error" }, { status: 502 });
  }
}
