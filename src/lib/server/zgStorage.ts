import { Indexer, MemData } from "@0gfoundation/0g-storage-ts-sdk";
import { ethers } from "ethers";
import { ZG, getPrivateKey } from "./config";
import {
  DEFAULT_GAS_PRICE_WEI,
  FLOOR_TTL_MS,
  InsufficientFundsError,
  MAX_GAS_PRICE_WEI,
  classifyUploadError,
  parseMinPriorityFee,
  to0G,
  uploadCostWei,
} from "./uploadCost";

export interface StoredBlob {
  rootHash: string;
  txHash: string | null;
  txSeq: number | null;
}

let signer: ethers.Wallet | null = null;
function getSigner(): ethers.Wallet {
  if (!signer) {
    const provider = new ethers.JsonRpcProvider(ZG.rpcUrl);
    signer = new ethers.Wallet(getPrivateKey(), provider);
  }
  return signer;
}

export function serverWalletAddress(): string {
  return getSigner().address;
}

// Serialize uploads per instance: they share one wallet nonce sequence.
let queue: Promise<unknown> = Promise.resolve();

/** Upload opaque bytes (already-encrypted ciphertext) to 0G Storage. */
export function uploadBytes(bytes: Uint8Array): Promise<StoredBlob> {
  const run = queue.then(() => uploadWithRetry(bytes));
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Gas price we pay. Starts at DEFAULT_GAS_PRICE_WEI and follows the network's
 * minimum priority fee, learned from the node's rejection message, so we
 * never pay the RPC's inflated suggestion.
 */
let gasPriceWei = DEFAULT_GAS_PRICE_WEI;
let raisedAt = 0;
export function currentGasPriceWei(): bigint {
  // The floor moves (100 ↔ 1,000 gwei observed); try the cheap price again after a while.
  if (gasPriceWei !== DEFAULT_GAS_PRICE_WEI && Date.now() - raisedAt > FLOOR_TTL_MS) gasPriceWei = DEFAULT_GAS_PRICE_WEI;
  return gasPriceWei;
}

async function uploadWithRetry(bytes: Uint8Array): Promise<StoredBlob> {
  let last: Error | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    currentGasPriceWei();
    const balance = await getSigner().provider!.getBalance(getSigner().address);
    const needed = uploadCostWei(gasPriceWei, bytes.length);
    if (balance < needed) throw new InsufficientFundsError(balance, needed, gasPriceWei);
    // A transaction from this wallet stuck in the mempool (e.g. underpriced)
    // would block every later nonce. Reuse its nonce at 2× price so this
    // upload replaces it instead of queuing behind it.
    const [latest, pending] = await Promise.all([
      getSigner().provider!.getTransactionCount(getSigner().address, "latest"),
      getSigner().provider!.getTransactionCount(getSigner().address, "pending"),
    ]);
    let price = gasPriceWei;
    let nonce: bigint | undefined;
    if (pending > latest) {
      nonce = BigInt(latest);
      price = gasPriceWei * 2n > MAX_GAS_PRICE_WEI ? MAX_GAS_PRICE_WEI : gasPriceWei * 2n;
      console.log(`[kavach] replacing stuck tx at nonce ${latest} with gas price ${price / 1_000_000_000n} gwei`);
    }
    try {
      return await uploadOnce(bytes, price, nonce);
    } catch (e) {
      last = e as Error;
      const kind = classifyUploadError(last.message);
      if (kind === "underpriced") {
        const floor = parseMinPriorityFee(last.message);
        if (floor === null || floor <= gasPriceWei) throw last;
        if (floor > MAX_GAS_PRICE_WEI) {
          throw new Error(`0G now requires a priority fee of ${floor / 1_000_000_000n} gwei, above this server's cap (ZG_MAX_GAS_PRICE_GWEI).`);
        }
        gasPriceWei = floor; // follow the network's minimum and retry at once
        raisedAt = Date.now();
        continue;
      }
      if (kind === "funds") {
        const bal = await getSigner().provider!.getBalance(getSigner().address);
        throw new InsufficientFundsError(bal, uploadCostWei(gasPriceWei, bytes.length), gasPriceWei);
      }
      if (kind !== "transient") break;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw last ?? new Error("0G upload failed");
}

async function uploadOnce(bytes: Uint8Array, gasPrice: bigint, nonce?: bigint): Promise<StoredBlob> {
  if (bytes.length === 0) throw new Error("Refusing to upload empty blob");
  const file = new MemData(bytes);
  const [tree, treeErr] = await file.merkleTree();
  if (treeErr || !tree) throw new Error(`Merkle tree failed: ${treeErr?.message ?? "unknown"}`);
  const expectedRoot = tree.rootHash();
  const indexer = new Indexer(ZG.indexerUrl);
  const [res, err] = await indexer.upload(file, ZG.rpcUrl, getSigner(), nonce === undefined ? undefined : { nonce }, undefined, { gasPrice });
  if (err) {
    // Already-uploaded identical data is fine: the root is content-addressed.
    if (/already exists|already uploaded|finalized/i.test(err.message) && expectedRoot) {
      return { rootHash: expectedRoot, txHash: null, txSeq: null };
    }
    throw new Error(`0G upload failed: ${err.message}`);
  }
  if ("rootHash" in res) {
    return { rootHash: res.rootHash, txHash: res.txHash, txSeq: res.txSeq };
  }
  return { rootHash: res.rootHashes[0], txHash: res.txHashes[0] ?? null, txSeq: res.txSeqs[0] ?? null };
}

/** Download bytes from 0G Storage by Merkle root, with proof verification. */
export async function downloadBytes(rootHash: string): Promise<Uint8Array> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(rootHash)) throw new Error("Invalid root hash");
  const indexer = new Indexer(ZG.indexerUrl);
  const [blob, err] = await indexer.downloadToBlob(rootHash, { proof: true });
  if (err) throw new Error(`0G download failed: ${err.message}`);
  return new Uint8Array(await blob.arrayBuffer());
}

export async function walletBalance0G(): Promise<string> {
  const s = getSigner();
  return ethers.formatEther(await s.provider!.getBalance(s.address));
}

/**
 * Public-demo guard, based on the real cost of an upload: refuse when the
 * shared wallet can't pay for one more upload at the current gas price plus
 * a small extra reserve (ZG_MIN_RESERVE_0G, default 0.005 0G). The visitor's
 * document then stays encrypted on their device. Balance cached for 60 s.
 */
const RESERVE_WEI = BigInt(Math.round(Number(process.env.ZG_MIN_RESERVE_0G || "0.005") * 1e6)) * 10n ** 12n;
let balanceCache: { at: number; wei: bigint } | null = null;
export interface Budget {
  ok: boolean;
  balance0G: string;
  costPerUpload0G: string;
  gasPriceGwei: string;
  uploadsAffordable: number;
  reserve0G: string;
}
export async function walletHasBudget(bytes = 4096): Promise<Budget> {
  if (!balanceCache || Date.now() - balanceCache.at > 60_000) {
    const s = getSigner();
    balanceCache = { at: Date.now(), wei: await s.provider!.getBalance(s.address) };
  }
  const cost = uploadCostWei(currentGasPriceWei(), bytes);
  const spendable = balanceCache.wei > RESERVE_WEI ? balanceCache.wei - RESERVE_WEI : 0n;
  return {
    ok: spendable >= cost,
    balance0G: to0G(balanceCache.wei),
    costPerUpload0G: to0G(cost),
    gasPriceGwei: (gasPriceWei / 1_000_000_000n).toString(),
    uploadsAffordable: Number(spendable / cost),
    reserve0G: to0G(RESERVE_WEI),
  };
}

export function invalidateBalanceCache(): void {
  balanceCache = null;
}
