import { ethers } from "ethers";
import { ZG, getPrivateKey } from "./config";

/**
 * 0G Compute (Direct path) helpers implemented with plain ethers so the app
 * bundle does not need the full compute SDK.
 *
 * Privacy design (Option A): the server only mints a short-lived, signed
 * session token for one provider. The BROWSER sends the prompt directly to the
 * provider's TEE endpoint, so our server never sees prompts or answers.
 */

/** Galileo testnet InferenceServing contract. */
const INFERENCE_CONTRACT =
  process.env.ZG_INFERENCE_CONTRACT || "0xa79F4c8311FF93C06b8CfB403690cc987c93F91E";

const ABI = [
  "function getService(address provider) view returns ((address provider, string serviceType, string url, uint256 inputPrice, uint256 outputPrice, uint256 updatedAt, string model, string verifiability, string additionalInfo, address teeSignerAddress, bool teeSignerAcknowledged) service)",
  "function getAllServices(uint256 offset, uint256 limit) view returns ((address provider, string serviceType, string url, uint256 inputPrice, uint256 outputPrice, uint256 updatedAt, string model, string verifiability, string additionalInfo, address teeSignerAddress, bool teeSignerAcknowledged)[] services, uint256 total)",
  "function getAccount(address user, address provider) view returns ((address user, address provider, uint256 nonce, uint256 balance, uint256 pendingRefund, (uint256 index, uint256 amount, uint256 createdAt, bool processed)[] refunds, string additionalInfo, bool acknowledged, uint256 validRefundsLength, uint256 generation, uint256 revokedBitmap))",
];

const EPHEMERAL_TOKEN_ID = 255;
/** Minimum locked balance the provider broker enforces (observed: 1 0G). */
export const PROVIDER_MIN_LOCKED = ethers.parseEther("1");

export interface ProviderInfo {
  provider: string;
  url: string;
  endpoint: string;
  model: string;
  verifiability: string;
  /** Address whose EIP-191 signature proves the response came from the TEE. */
  signingAddress: string;
  teeSignerAcknowledged: boolean;
  providerType: "decentralized" | "centralized";
  /** True only for TeeML where the open model itself runs inside the TEE. */
  sealed: boolean;
  teeVerifier: string | null;
  imageDigest: string | null;
}

export interface AccountInfo {
  exists: boolean;
  balanceWei: string;
  balance0G: string;
  acknowledged: boolean;
  generation: number;
  fundedEnough: boolean;
}

let wallet: ethers.Wallet | null = null;
function getWallet(): ethers.Wallet {
  if (!wallet) wallet = new ethers.Wallet(getPrivateKey(), new ethers.JsonRpcProvider(ZG.rpcUrl));
  return wallet;
}

function contract(): ethers.Contract {
  return new ethers.Contract(INFERENCE_CONTRACT, ABI, getWallet());
}

interface RawService {
  provider: string;
  serviceType: string;
  url: string;
  model: string;
  verifiability: string;
  additionalInfo: string;
  teeSignerAddress: string;
  teeSignerAcknowledged: boolean;
}

function toProviderInfo(s: RawService): ProviderInfo {
  let providerType: "decentralized" | "centralized" = "decentralized";
  let signingAddress: string = s.teeSignerAddress;
  let teeVerifier: string | null = null;
  let imageDigest: string | null = null;
  try {
    const info = JSON.parse(s.additionalInfo || "{}") as Record<string, unknown>;
    if (info.ProviderType === "centralized") providerType = "centralized";
    if (info.TargetSeparated === true && providerType === "decentralized" && typeof info.TargetTeeAddress === "string" && info.TargetTeeAddress) {
      signingAddress = info.TargetTeeAddress;
    }
    teeVerifier = typeof info.TEEVerifier === "string" ? info.TEEVerifier : null;
    imageDigest = typeof info.ImageDigest === "string" ? info.ImageDigest : null;
  } catch {
    /* additionalInfo is optional metadata */
  }
  const url: string = s.url;
  return {
    provider: s.provider,
    url,
    endpoint: `${url}/v1/proxy`,
    model: s.model,
    verifiability: s.verifiability,
    signingAddress,
    teeSignerAcknowledged: s.teeSignerAcknowledged,
    providerType,
    sealed: s.verifiability === "TeeML" && providerType === "decentralized",
    teeVerifier,
    imageDigest,
  };
}

export async function getProviderInfo(provider: string): Promise<ProviderInfo> {
  return toProviderInfo(await contract().getService(provider));
}

/** All sealed candidates: chatbot + TeeML + decentralized (the open model runs inside the TEE). */
export async function listSealedProviders(): Promise<ProviderInfo[]> {
  // The contract caps each page at 50 services.
  const services: RawService[] = [];
  for (let offset = 0; offset < 200; offset += 50) {
    const [page, total] = (await contract().getAllServices(offset, 50)) as [RawService[], bigint];
    services.push(...Array.from(page));
    if (BigInt(offset + 50) >= total) break;
  }
  return services
    .filter((s) => s.serviceType === "chatbot" && s.teeSignerAcknowledged)
    .map(toProviderInfo)
    .filter((p) => p.sealed);
}

let picked: { at: number; value: { provider: ProviderInfo; account: AccountInfo } } | null = null;

/**
 * The provider Kavach should use: the pinned one (ZG_COMPUTE_PROVIDER) if set,
 * otherwise the first sealed provider our wallet has funded (≥ 1 0G), else
 * the first sealed provider. Cached for 2 minutes per server instance.
 */
export async function pickProvider(): Promise<{ provider: ProviderInfo; account: AccountInfo }> {
  if (picked && Date.now() - picked.at < 120_000) return picked.value;
  let value: { provider: ProviderInfo; account: AccountInfo };
  if (ZG.computeProvider) {
    const [provider, account] = await Promise.all([getProviderInfo(ZG.computeProvider), getAccountInfo(ZG.computeProvider)]);
    value = { provider, account };
  } else {
    const candidates = await listSealedProviders();
    if (!candidates.length) throw new Error("no 0G-verified sealed chat provider (open model inside a TEE) is available on testnet right now");
    const withAccounts = await Promise.all(candidates.map(async (p) => ({ provider: p, account: await getAccountInfo(p.provider) })));
    value = withAccounts.find((x) => x.account.fundedEnough) ?? withAccounts.find((x) => x.account.exists) ?? withAccounts[0];
  }
  picked = { at: Date.now(), value };
  return value;
}

export async function getAccountInfo(provider: string): Promise<AccountInfo> {
  try {
    const a = await contract().getAccount(getWallet().address, provider);
    const balance: bigint = a.balance;
    const pending: bigint = a.pendingRefund;
    const usable = balance - pending;
    return {
      exists: true,
      balanceWei: usable.toString(),
      balance0G: ethers.formatEther(usable),
      acknowledged: a.acknowledged,
      generation: Number(a.generation ?? 0),
      fundedEnough: usable >= PROVIDER_MIN_LOCKED,
    };
  } catch {
    return { exists: false, balanceWei: "0", balance0G: "0", acknowledged: false, generation: 0, fundedEnough: false };
  }
}

/**
 * Mint an ephemeral session token (same format as the 0G compute SDK:
 * `app-sk-base64(json|signature)`) that the browser can use against a single
 * provider until it expires. Signing is off-chain; no gas is spent.
 */
export async function mintSessionToken(provider: string, generation: number, ttlMs: number): Promise<{ authorization: string; expiresAt: number }> {
  const w = getWallet();
  const timestamp = Date.now();
  const nonceBytes = ethers.randomBytes(16);
  const token = {
    address: w.address,
    provider,
    timestamp,
    expiresAt: timestamp + ttlMs,
    nonce: ethers.hexlify(nonceBytes).slice(2),
    generation,
    tokenId: EPHEMERAL_TOKEN_ID,
  };
  const message = JSON.stringify(token);
  const hash = ethers.keccak256(ethers.toUtf8Bytes(message));
  const signature = await w.signMessage(ethers.getBytes(hash));
  const b64 = Buffer.from(`${message}|${signature}`).toString("base64");
  return { authorization: `Bearer app-sk-${b64}`, expiresAt: token.expiresAt };
}

/** Verify a TEE response signature (EIP-191 personal_sign). */
export function verifyTeeSignature(text: string, signature: string, expected: string): boolean {
  try {
    return ethers.verifyMessage(text, signature).toLowerCase() === expected.toLowerCase();
  } catch {
    return false;
  }
}
