import { NextResponse } from "next/server";
import { isEnvelope } from "@/lib/crypto/aes";
import { sha256Hex } from "@/lib/crypto/bytes";
import { invalidateBalanceCache, uploadBytes, walletHasBudget } from "@/lib/server/zgStorage";
import { InsufficientFundsError } from "@/lib/server/uploadCost";
import { hasPrivateKey, ZG } from "@/lib/server/config";
import { clientIp, logEvent, rateLimit } from "@/lib/server/log";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 1024 * 1024;

/**
 * Accepts CIPHERTEXT ONLY (a Kavach "KVH1" AES-GCM envelope produced in the
 * browser) and stores it on 0G Storage. The server cannot read it.
 */
export async function POST(req: Request) {
  const t0 = Date.now();
  if (!hasPrivateKey()) {
    return NextResponse.json({ error: "0G is not configured on this server (ZG_PRIVATE_KEY missing)", code: "not_configured" }, { status: 503 });
  }
  if (!rateLimit(`up:${clientIp(req)}`, 15, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many uploads from your network. Please wait a few minutes.", code: "rate_limited" }, { status: 429 });
  }
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > MAX_BYTES) {
    return NextResponse.json({ error: "Encrypted file is larger than 1 MB", code: "too_large" }, { status: 413 });
  }
  if (!isEnvelope(bytes)) {
    logEvent("POST /api/storage", "rejected_not_ciphertext", { bytes: bytes.length });
    return NextResponse.json({ error: "Only Kavach ciphertext envelopes are accepted", code: "not_ciphertext" }, { status: 400 });
  }
  const sha256 = await sha256Hex(bytes);
  try {
    const budget = await walletHasBudget(bytes.length);
    if (!budget.ok) {
      logEvent("POST /api/storage", "budget_exhausted", { bytes: bytes.length, balance0G: budget.balance0G, costPerUpload0G: budget.costPerUpload0G, gasPriceGwei: budget.gasPriceGwei });
      return NextResponse.json(
        {
          error: `The public demo's 0G testnet wallet can't pay for more uploads right now (balance ${budget.balance0G} 0G, one upload costs about ${budget.costPerUpload0G} 0G at ${budget.gasPriceGwei} gwei). Your document stays encrypted on this device; retry the 0G upload later.`,
          code: "budget_exhausted",
          budget,
        },
        { status: 503 },
      );
    }
  } catch {
    /* if the balance check fails, let the upload itself report the error */
  }
  try {
    const r = await uploadBytes(bytes);
    invalidateBalanceCache();
    logEvent("POST /api/storage", "stored_on_0g", { bytes: bytes.length, sha256, rootHash: r.rootHash, txHash: r.txHash, ms: Date.now() - t0 });
    return NextResponse.json({
      rootHash: r.rootHash,
      txHash: r.txHash,
      txSeq: r.txSeq,
      explorerUrl: r.txHash ? `${ZG.explorerTx}${r.txHash}` : null,
      storageScanUrl: `${ZG.storageScan}/submission/${r.txSeq ?? ""}`,
      bytes: bytes.length,
      sha256,
    });
  } catch (e) {
    invalidateBalanceCache();
    if (e instanceof InsufficientFundsError) {
      logEvent("POST /api/storage", "budget_exhausted", { bytes: bytes.length, sha256, ms: Date.now() - t0 });
      return NextResponse.json(
        { error: `The public demo's 0G testnet wallet is out of funds for now. ${e.message} Your document stays encrypted on this device; retry later.`, code: "budget_exhausted" },
        { status: 503 },
      );
    }
    const message = (e as Error).message.slice(0, 300);
    logEvent("POST /api/storage", "upload_failed", { bytes: bytes.length, sha256, ms: Date.now() - t0, error: message });
    return NextResponse.json({ error: `0G Storage upload failed: ${message}`, code: "upload_failed" }, { status: 502 });
  }
}
