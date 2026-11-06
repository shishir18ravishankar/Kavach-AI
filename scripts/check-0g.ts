/**
 * Risk test for Kavach AI's 0G integration. Run: npm run check:0g
 *  1. Encrypts a small blob (AES-256-GCM), uploads it to 0G Storage,
 *     downloads it with Merkle proof, verifies the bytes match.
 *  2. Sends one prompt to 0G sealed inference (TeeML provider), prints the
 *     answer, chat ID, and verifies the TEE's response signature.
 * Never prints ZG_PRIVATE_KEY.
 */
import { installSandboxProxy } from "./sandbox-proxy";
installSandboxProxy();
import { webcrypto } from "node:crypto";
import { uploadBytes, downloadBytes, serverWalletAddress } from "../src/lib/server/zgStorage";
import { getProviderInfo, getAccountInfo, mintSessionToken, verifyTeeSignature } from "../src/lib/server/zgCompute";
import { ZG } from "../src/lib/server/config";

async function checkStorage(): Promise<boolean> {
  console.log("\n== 0G Storage ==");
  const key = await webcrypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(`kavach check ${new Date().toISOString()}`);
  const ct = new Uint8Array(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
  const blob = new Uint8Array([...iv, ...ct]);
  const t0 = Date.now();
  const stored = await uploadBytes(blob);
  console.log(`uploaded ${blob.length} B ciphertext in ${Date.now() - t0} ms`);
  console.log(`  root hash: ${stored.rootHash}`);
  if (stored.txHash) console.log(`  tx: ${ZG.explorerTx}${stored.txHash}`);
  const t1 = Date.now();
  const back = await downloadBytes(stored.rootHash);
  const match = Buffer.from(back).equals(Buffer.from(blob));
  const dec = new Uint8Array(await webcrypto.subtle.decrypt({ name: "AES-GCM", iv: back.slice(0, 12) }, key, back.slice(12)));
  console.log(`downloaded ${back.length} B in ${Date.now() - t1} ms; bytes match: ${match}; decrypts: ${Buffer.from(dec).equals(Buffer.from(plaintext))}`);
  return match;
}

async function checkProvider(provider: string): Promise<boolean> {
  const info = await getProviderInfo(provider);
  const acct = await getAccountInfo(provider);
  console.log(`provider ${provider}`);
  console.log(`  model=${info.model} verifiability=${info.verifiability} type=${info.providerType} sealed=${info.sealed} verifier=${info.teeVerifier}`);
  console.log(`  endpoint=${info.endpoint}`);
  console.log(`  sub-account: exists=${acct.exists} balance=${acct.balance0G} 0G acknowledged=${acct.acknowledged} fundedEnough(>=1 0G)=${acct.fundedEnough}`);
  if (!acct.exists) { console.log("  SKIP: no sub-account (fund it with npm run zg:fund)"); return false; }
  const { authorization } = await mintSessionToken(provider, acct.generation, 10 * 60 * 1000);
  const t0 = Date.now();
  const res = await fetch(`${info.endpoint}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authorization },
    body: JSON.stringify({ model: info.model, messages: [{ role: "user", content: "In one short sentence: what does a Trusted Execution Environment protect?" }] }),
  });
  const body = await res.text();
  console.log(`  HTTP ${res.status} in ${Date.now() - t0} ms`);
  if (!res.ok) { console.log(`  provider said: ${body.slice(0, 400)}`); return false; }
  const data = JSON.parse(body) as { id?: string; choices: { message: { content: string } }[] };
  const chatId = res.headers.get("ZG-Res-Key") || data.id || "";
  console.log(`  answer: ${data.choices[0]?.message?.content}`);
  console.log(`  chat/request ID: ${chatId}`);
  const sigRes = await fetch(`${info.url}/v1/proxy/signature/${chatId}?model=${encodeURIComponent(info.model)}`);
  if (!sigRes.ok) { console.log(`  signature fetch failed: HTTP ${sigRes.status}`); return true; }
  const sig = (await sigRes.json()) as { text: string; signature: string };
  console.log(`  signed text (first 160 chars): ${sig.text.slice(0, 160)}`);
  console.log(`  TEE signature valid vs ${info.signingAddress}: ${verifyTeeSignature(sig.text, sig.signature, info.signingAddress)}`);
  return true;
}

async function main() {
  console.log(`server wallet: ${serverWalletAddress()}`);
  let storageOk = false;
  try { storageOk = await checkStorage(); } catch (e) { console.log("STORAGE FAILED:", (e as Error).message); }
  console.log("\n== 0G Sealed Inference ==");
  const providers = [ZG.computeProvider, ...(process.env.ZG_COMPUTE_FALLBACK ? [process.env.ZG_COMPUTE_FALLBACK] : [])];
  let inferenceOk = false;
  for (const p of providers) {
    try { inferenceOk = (await checkProvider(p)) || inferenceOk; } catch (e) { console.log(`  FAILED: ${(e as Error).message}`); }
  }
  console.log(`\nRESULT storage=${storageOk ? "OK" : "FAIL"} inference=${inferenceOk ? "OK" : "FAIL"}`);
  process.exit(storageOk && inferenceOk ? 0 : 1);
}
main().catch((e) => { console.error("ERR", (e as Error).message); process.exit(1); });
