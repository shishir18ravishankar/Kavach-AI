/**
 * What one 0G Storage upload really costs, and how to price its transaction.
 *
 * Measured on Galileo (2026-11-14), see README "Running costs":
 *  - The Flow `submit` call uses ~295k–336k gas (more nodes in the submission
 *    tree → more gas; a real 54-byte upload used ~298k).
 *  - The storage fee is tiny: sectors × pricePerSector (30,733,644,962 wei),
 *    i.e. ~0.00000025 0G for a 2 KB document.
 *  - Fees: Galileo has TWO floors. Nodes ADMIT transactions into the mempool
 *    from a minimum priority fee they state in errors (seen 100 gwei and
 *    1,000 gwei), but a 100 gwei upload sat unmined for 5+ minutes while a
 *    1,000 gwei transaction was mined in 9 s. So we pay 1,000 gwei by
 *    default, climb if a node demands more, and never pay the RPC's
 *    eth_gasPrice suggestion (2,000 gwei, 2× what is needed).
 */

const GWEI = 1_000_000_000n;
const WEI_PER_0G = 10n ** 18n;

/** Gas we budget per upload: above the largest observed estimate (336k). */
export const UPLOAD_GAS_BUDGET = 360_000n;
/** Upper bound for the storage fee per 256-byte sector (measured 30,733,644,962 wei). */
export const PRICE_PER_SECTOR_WEI = 31_000_000_000n;

function gweiEnv(name: string, fallback: bigint): bigint {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? BigInt(Math.round(v * 1e9)) : fallback;
}

/**
 * Gas price we pay by default: the lowest price observed to actually get
 * mined (1,000 gwei). If a node rejects it with a higher stated minimum we
 * move up to that (a rejection is free: nothing is mined) and fall back here
 * after FLOOR_TTL_MS.
 */
export const DEFAULT_GAS_PRICE_WEI = gweiEnv("ZG_GAS_PRICE_GWEI", 1_000n * GWEI);
export const FLOOR_TTL_MS = 10 * 60_000;
/** Never pay more than this per gas, whatever the node asks for. */
export const MAX_GAS_PRICE_WEI = gweiEnv("ZG_MAX_GAS_PRICE_GWEI", 2_000n * GWEI);

/** Upper bound of the storage fee for `bytes` (sectors are 256 B; the Merkle padding at most doubles them). */
export function storageFeeWei(bytes: number): bigint {
  const sectors = BigInt(Math.max(1, Math.ceil(bytes / 256))) * 2n;
  return sectors * PRICE_PER_SECTOR_WEI;
}

/** Balance a single upload needs at `gasPriceWei` (gas budget × price + storage fee). */
export function uploadCostWei(gasPriceWei: bigint, bytes = 4096): bigint {
  return UPLOAD_GAS_BUDGET * gasPriceWei + storageFeeWei(bytes);
}

export function to0G(wei: bigint, digits = 4): string {
  const whole = wei / WEI_PER_0G;
  const frac = (wei % WEI_PER_0G).toString().padStart(18, "0").slice(0, digits);
  return `${whole}.${frac}`;
}

/** "transaction priority fee below minimum required priority fee 1000000000000" → 1000000000000n */
export function parseMinPriorityFee(message: string): bigint | null {
  const m = /minimum required priority fee\D*(\d+)/i.exec(message);
  return m ? BigInt(m[1]) : null;
}

export type UploadErrorKind = "underpriced" | "funds" | "transient" | "other";

/**
 * Classify an upload error. "execution reverted … require(false)" during
 * estimateGas is how this chain reports a balance that can't cover the gas at
 * the chosen price (the node caps the simulation's gas at balance / price, so
 * the submit runs out of gas). Callers confirm with the actual balance.
 */
export function classifyUploadError(message: string): UploadErrorKind {
  if (parseMinPriorityFee(message) !== null || /underpriced|fee too low/i.test(message)) return "underpriced";
  if (/insufficient funds|require\(false\)|exceeds balance/i.test(message)) return "funds";
  if (/nonce|replacement|timeout|ECONNRESET|socket hang up|ETIMEDOUT/i.test(message)) return "transient";
  return "other";
}

export class InsufficientFundsError extends Error {
  constructor(public balanceWei: bigint, public neededWei: bigint, public gasPriceWei: bigint) {
    super(
      `The server wallet has ${to0G(balanceWei)} 0G but one 0G Storage upload currently needs about ${to0G(neededWei)} 0G ` +
        `(~${UPLOAD_GAS_BUDGET / 1000n}k gas at ${gasPriceWei / GWEI} gwei, the network's current minimum priority fee).`,
    );
    this.name = "InsufficientFundsError";
  }
}
