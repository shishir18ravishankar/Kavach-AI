/**
 * Server-side 0G configuration. Never import this from client components.
 * Secrets are read from env only; they are never logged.
 */
export const ZG = {
  rpcUrl: process.env.ZG_RPC_URL || "https://evmrpc-testnet.0g.ai",
  indexerUrl:
    process.env.ZG_INDEXER_URL || "https://indexer-storage-testnet-turbo.0g.ai",
  chainId: 16602,
  explorerTx: "https://chainscan-galileo.0g.ai/tx/",
  storageScan: "https://storagescan-galileo.0g.ai",
  /**
   * Optional pinned sealed-inference provider. When unset, the app picks a
   * decentralized TeeML chatbot provider from the on-chain service list.
   */
  computeProvider: process.env.ZG_COMPUTE_PROVIDER || null,
} as const;

export function hasPrivateKey(): boolean {
  return typeof process.env.ZG_PRIVATE_KEY === "string" && process.env.ZG_PRIVATE_KEY.length >= 64;
}

export function getPrivateKey(): string {
  const k = process.env.ZG_PRIVATE_KEY;
  if (!k) throw new Error("ZG_PRIVATE_KEY is not configured on the server");
  return k.startsWith("0x") ? k : `0x${k}`;
}
