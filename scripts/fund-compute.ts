/**
 * Tops up the server wallet's 0G Compute sub-account for the sealed provider
 * so it meets the provider's 1 0G minimum locked balance.
 * Usage: npm run zg:fund            (dry run)
 *        npm run zg:fund -- --yes   (send transactions)
 * Env: ZG_PRIVATE_KEY (required), ZG_COMPUTE_PROVIDER, FUND_TARGET (default 1.2)
 */
import { installSandboxProxy } from "./sandbox-proxy";
installSandboxProxy();
import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk";
import { ZG, getPrivateKey } from "../src/lib/server/config";

const GAS_RESERVE = ethers.parseEther("0.05"); // keep for 0G Storage uploads

async function main() {
  const yes = process.argv.includes("--yes");
  const provider = ZG.computeProvider;
  const target = ethers.parseEther(process.env.FUND_TARGET || "1.2");
  const wallet = new ethers.Wallet(getPrivateKey(), new ethers.JsonRpcProvider(ZG.rpcUrl));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const broker: any = await createZGComputeNetworkBroker(wallet);
  const walletBal = await wallet.provider!.getBalance(wallet.address);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ledger: any = null;
  try { ledger = await broker.ledger.getLedger(); } catch { /* none yet */ }
  const ledgerAvail: bigint = ledger ? BigInt(ledger.availableBalance) : BigInt(0);
  let sub = BigInt(0);
  try { const a = await broker.inference.getAccount(provider); sub = BigInt(a.balance) - BigInt(a.pendingRefund); } catch { /* none yet */ }
  console.log(`wallet ${wallet.address}: ${ethers.formatEther(walletBal)} 0G`);
  console.log(`ledger available: ${ethers.formatEther(ledgerAvail)} 0G (exists: ${!!ledger})`);
  console.log(`provider ${provider} sub-account: ${ethers.formatEther(sub)} 0G, target ${ethers.formatEther(target)} 0G`);
  const deficit = target > sub ? target - sub : BigInt(0);
  if (deficit === BigInt(0)) { console.log("Already funded."); return; }
  const needDeposit = deficit > ledgerAvail ? deficit - ledgerAvail : BigInt(0);
  const needWallet = needDeposit + GAS_RESERVE;
  console.log(`need to move ${ethers.formatEther(deficit)} 0G to provider; deposit ${ethers.formatEther(needDeposit)} 0G from wallet first`);
  if (walletBal < needWallet) {
    console.log(`BLOCKED: wallet needs ${ethers.formatEther(needWallet - walletBal)} 0G more (incl. ${ethers.formatEther(GAS_RESERVE)} 0G gas reserve).`);
    process.exit(2);
  }
  if (!yes) { console.log("Dry run. Re-run with -- --yes to send transactions."); return; }
  if (needDeposit > BigInt(0)) {
    if (ledger) await broker.ledger.ledger.ledgerContract.depositFund(needDeposit.toString());
    else await broker.ledger.ledger.ledgerContract.addLedger(needDeposit, "");
    console.log("deposited");
  }
  await broker.ledger.transferFund(provider, "inference", deficit);
  console.log("transferred; done");
}
main().catch((e) => { console.error("ERR", (e as Error).message); process.exit(1); });
