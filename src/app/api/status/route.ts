import { NextResponse } from "next/server";
import { getAccountInfo, getProviderInfo } from "@/lib/server/zgCompute";
import { serverWalletAddress, walletBalance0G } from "@/lib/server/zgStorage";
import { hasPrivateKey, ZG } from "@/lib/server/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public health info for the UI banner. Contains no secrets. */
export async function GET() {
  if (!hasPrivateKey()) {
    return NextResponse.json({ configured: false, storage: { ok: false }, inference: { ok: false, reason: "ZG_PRIVATE_KEY not set" } });
  }
  const out: Record<string, unknown> = { configured: true, network: "0G Galileo testnet", chainId: ZG.chainId };
  try {
    out.storage = { ok: true, wallet: serverWalletAddress(), balance0G: await walletBalance0G(), indexer: ZG.indexerUrl };
  } catch (e) {
    out.storage = { ok: false, reason: (e as Error).message.slice(0, 200) };
  }
  try {
    const [provider, account] = await Promise.all([getProviderInfo(ZG.computeProvider), getAccountInfo(ZG.computeProvider)]);
    out.inference = {
      ok: account.exists && account.fundedEnough,
      reason: !account.exists ? "compute sub-account not created" : !account.fundedEnough ? `provider requires ≥1 0G locked; app has ${account.balance0G} 0G` : null,
      provider,
      account,
    };
  } catch (e) {
    out.inference = { ok: false, reason: (e as Error).message.slice(0, 200) };
  }
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
