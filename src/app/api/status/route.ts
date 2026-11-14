import { NextResponse } from "next/server";
import { pickProvider } from "@/lib/server/zgCompute";
import { serverWalletAddress, walletHasBudget } from "@/lib/server/zgStorage";
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
    const budget = await walletHasBudget();
    out.storage = {
      reason: budget.ok ? null : `wallet has ${budget.balance0G} 0G; one upload needs about ${budget.costPerUpload0G} 0G at ${budget.gasPriceGwei} gwei`,
      wallet: serverWalletAddress(),
      ...budget,
      indexer: ZG.indexerUrl,
    };
  } catch (e) {
    out.storage = { ok: false, reason: (e as Error).message.slice(0, 200) };
  }
  try {
    const { provider, account } = await pickProvider();
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
