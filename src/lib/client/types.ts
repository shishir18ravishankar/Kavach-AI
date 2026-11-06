export interface Company {
  id: string;
  name: string;
  /** short tag embedded in recovery shares, e.g. "brew4f" */
  tag: string;
  createdAt: string;
  /** base64 AES-GCM envelope proving which master key belongs to this company */
  keyCheck: string;
  ceremony: { done: boolean; at: string | null; threshold: number; total: number; holders: string[] };
  demo: boolean;
}

export type DocKind = "document" | "note";

export interface DocRecord {
  id: string;
  name: string;
  mime: string;
  kind: DocKind;
  /** plaintext text length in characters */
  chars: number;
  createdAt: string;
  /** document key wrapped (AES-GCM) by the master key, base64 */
  wrappedKey: string;
  storage: "0g" | "local";
  rootHash: string | null;
  txHash: string | null;
  explorerUrl: string | null;
  ctBytes: number;
  ctSha256: string;
  /** bumps on every re-key (revocation) */
  keyVersion: number;
  uploadError?: string | null;
}

/** What is inside the encrypted blob stored on 0G. */
export interface DocPayload {
  v: 1;
  name: string;
  mime: string;
  kind: DocKind;
  text: string;
  createdAt: string;
  meta?: Record<string, string>;
}

export interface UploadResult {
  rootHash: string;
  txHash: string | null;
  txSeq: number | null;
  explorerUrl: string | null;
  bytes: number;
  sha256: string;
}
