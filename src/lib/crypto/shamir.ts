/**
 * Co-founder key ceremony: split the 32-byte master key into N shares, any K
 * of which recover it. Uses Privy's audited `shamir-secret-sharing` library
 * (Cure53 + Zellic audits), which operates over GF(2^8).
 *
 * Share text format:  kavach1-<companyTag>-<k>of<n>-<base64url(share)>-<checksum>
 * The checksum (first 4 bytes of SHA-256 over the share bytes) catches typos.
 */
import { split, combine } from "shamir-secret-sharing";
import { fromBase64Url, sha256Hex, toBase64Url } from "./bytes";

export interface ParsedShare {
  companyTag: string;
  threshold: number;
  total: number;
  bytes: Uint8Array;
}

export async function splitSecret(secret: Uint8Array, total = 3, threshold = 2): Promise<Uint8Array[]> {
  if (threshold < 2 || threshold > total) throw new Error("Invalid threshold");
  return split(secret, total, threshold);
}

export async function combineShares(shares: Uint8Array[]): Promise<Uint8Array> {
  if (shares.length < 2) throw new Error("At least 2 shares are required");
  return combine(shares);
}

export async function encodeShare(share: Uint8Array, companyTag: string, threshold: number, total: number): Promise<string> {
  const check = (await sha256Hex(share)).slice(0, 8);
  return `kavach1-${companyTag}-${threshold}of${total}-${toBase64Url(share)}-${check}`;
}

export async function parseShare(text: string): Promise<ParsedShare> {
  const t = text.trim().replace(/\s+/g, "");
  const m = /^kavach1-([a-z0-9]+)-(\d)of(\d)-([A-Za-z0-9_-]+)-([0-9a-f]{8})$/.exec(t);
  if (!m) throw new Error("This doesn't look like a Kavach recovery share");
  const bytes = fromBase64Url(m[4]);
  if ((await sha256Hex(bytes)).slice(0, 8) !== m[5]) throw new Error("Share checksum mismatch (typo?)");
  return { companyTag: m[1], threshold: Number(m[2]), total: Number(m[3]), bytes };
}

/** Last byte of each share is its x-coordinate; duplicates cannot recover. */
export function shareIndex(share: Uint8Array): number {
  return share[share.length - 1];
}
