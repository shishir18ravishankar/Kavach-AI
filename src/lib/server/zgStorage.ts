import { Indexer, MemData } from "@0gfoundation/0g-storage-ts-sdk";
import { ethers } from "ethers";
import { ZG, getPrivateKey } from "./config";

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

async function uploadWithRetry(bytes: Uint8Array): Promise<StoredBlob> {
  let last: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await uploadOnce(bytes);
    } catch (e) {
      last = e as Error;
      // Nonce races (another instance using the same wallet) are retryable.
      if (!/nonce|replacement|underpriced|timeout|ECONNRESET|socket hang up/i.test(last.message)) break;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw last ?? new Error("0G upload failed");
}

async function uploadOnce(bytes: Uint8Array): Promise<StoredBlob> {
  if (bytes.length === 0) throw new Error("Refusing to upload empty blob");
  const file = new MemData(bytes);
  const [tree, treeErr] = await file.merkleTree();
  if (treeErr || !tree) throw new Error(`Merkle tree failed: ${treeErr?.message ?? "unknown"}`);
  const expectedRoot = tree.rootHash();
  const indexer = new Indexer(ZG.indexerUrl);
  const [res, err] = await indexer.upload(file, ZG.rpcUrl, getSigner());
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
