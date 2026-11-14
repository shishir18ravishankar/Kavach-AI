/**
 * Measures what 0G Storage uploads cost right now on Galileo, without spending.
 *  1. Finds the nodes' ADMISSION minimum priority fee by sending deliberately
 *     unfundable transactions: the node rejects a too-low fee before it checks
 *     the balance, so a rejection costs nothing and is never mined.
 *     Note: being admitted is not being mined. On 2026-11-14 a 100 gwei
 *     upload was admitted but never mined, while 1,000 gwei was mined in 9 s,
 *     so the app pays DEFAULT_GAS_PRICE_WEI (1,000 gwei) by default.
 *  2. Estimates `Flow.submit` gas for realistic ciphertext sizes.
 *  3. Prints the cost per upload and the balance needed for N uploads.
 * Usage: npm run zg:cost [-- --uploads 20]
 */
import { installSandboxProxy } from "./sandbox-proxy";
installSandboxProxy();
import { MemData, getFlowContract, getMarketContract } from "@0gfoundation/0g-storage-ts-sdk";
import { ethers } from "ethers";
import { webcrypto } from "node:crypto";
import { getPrivateKey } from "../src/lib/server/config";
import { DEFAULT_GAS_PRICE_WEI, UPLOAD_GAS_BUDGET, to0G, uploadCostWei } from "../src/lib/server/uploadCost";

const FLOW = process.env.ZG_FLOW_CONTRACT || "0x22E03a6A89B950F1c82ec5e74F8eCa321a105296";
const RPC = process.env.ZG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const GWEI = 1_000_000_000n;

async function minPriorityFee(w: ethers.Wallet): Promise<bigint | null> {
  const p = w.provider!;
  const nonce = await p.getTransactionCount(w.address, "pending");
  const accepted = async (gwei: bigint) => {
    const prio = gwei * GWEI;
    const raw = await w.signTransaction({ type: 2, chainId: 16602, nonce, to: w.address, value: 0n, gasLimit: 30_000_000n, maxPriorityFeePerGas: prio, maxFeePerGas: prio + 1000n });
    try {
      await (p as ethers.JsonRpcProvider).send("eth_sendRawTransaction", [raw]);
      throw new Error("probe transaction was unexpectedly accepted");
    } catch (e) {
      const m = (e as { error?: { message?: string } }).error?.message ?? (e as Error).message;
      if (/priority fee below/i.test(m)) return { ok: false, hinted: BigInt(/fee\D*(\d+)/.exec(m.slice(m.indexOf("minimum")))?.[1] ?? "0") };
      if (/insufficient funds/i.test(m)) return { ok: true, hinted: 0n };
      throw e;
    }
  };
  const first = await accepted(1n);
  if (first.ok) return GWEI;
  const hinted = first.hinted / GWEI;
  if (hinted > 0n && (await accepted(hinted)).ok) return hinted * GWEI;
  return null;
}

async function main() {
  const uploads = BigInt(process.argv.includes("--uploads") ? process.argv[process.argv.indexOf("--uploads") + 1] : "20");
  const provider = new ethers.JsonRpcProvider(RPC);
  const w = new ethers.Wallet(getPrivateKey(), provider);
  const [balance, fee, block] = await Promise.all([provider.getBalance(w.address), provider.getFeeData(), provider.getBlock("latest")]);
  const floor = await minPriorityFee(w);
  console.log(`wallet ${w.address}: ${to0G(balance, 6)} 0G`);
  console.log(`RPC suggested gas price: ${ethers.formatUnits(fee.gasPrice ?? 0n, "gwei")} gwei · base fee: ${block?.baseFeePerGas ?? "?"} wei`);
  console.log(`mempool admission minimum (probed, not a guarantee of being mined): ${floor === null ? "unknown" : ethers.formatUnits(floor, "gwei") + " gwei"}`);

  const flow = getFlowContract(FLOW, w);
  const pps = await getMarketContract(await flow.market(), provider).pricePerSector();
  console.log(`storage price: ${pps} wei per 256-byte sector\n`);
  console.log("size      sectors  storage fee (0G)   submit gas");
  let maxGas = 0n;
  for (const size of [100, 1500, 1900, 2300, 8_000, 64_000, 1_000_000]) {
    const data = webcrypto.getRandomValues(new Uint8Array(Math.min(size, 65_536)));
    const full = size > 65_536 ? Uint8Array.from({ length: size }, (_, i) => data[i % data.length]) : data;
    const [sub, err] = await new MemData(full).createSubmission("0x", w.address);
    if (err || !sub) throw err ?? new Error("submission failed");
    let sectors = 0n;
    for (const n of sub.data.nodes) sectors += 1n << BigInt(n.height.toString());
    // Estimate at 1 gwei: at higher prices the node caps the simulation by balance / price.
    const gas = await flow.getFunction("submit").estimateGas(sub, { value: sectors * pps, from: w.address, gasPrice: GWEI });
    if (gas > maxGas) maxGas = gas;
    console.log(`${String(size).padEnd(9)} ${String(sectors).padEnd(8)} ${ethers.formatEther(sectors * pps).padEnd(18)} ${gas}`);
  }
  console.log(`\nbudget used by the app: ${UPLOAD_GAS_BUDGET} gas per upload (max measured above: ${maxGas})`);
  for (const [label, price] of [["admission minimum (may never be mined)", floor], ["app default, observed to be mined", DEFAULT_GAS_PRICE_WEI], ["RPC suggestion", fee.gasPrice]] as const) {
    if (!price) continue;
    const one = uploadCostWei(price, 2300);
    console.log(`${label} (${ethers.formatUnits(price, "gwei")} gwei): ~${to0G(one)} 0G per upload · ${to0G(one * uploads)} 0G for ${uploads} uploads · wallet covers ${balance / one}`);
  }
}
main().catch((e) => {
  console.error("ERR", (e as Error).message.slice(0, 300));
  process.exit(1);
});
