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

/** Upload opaque bytes (already-encrypted ciphertext) to 0G Storage. */
export async function uploadBytes(bytes: Uint8Array): Promise<StoredBlob> {
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
