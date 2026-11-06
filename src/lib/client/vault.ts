/**
 * Vault operations. Everything here runs in the browser: plaintext and keys
 * never leave this device. Only AES-GCM ciphertext is sent to /api/storage,
 * which forwards it to 0G Storage.
 */
import { decrypt, encrypt } from "@/lib/crypto/aes";
import { fromBase64, sha256Hex, toBase64, utf8 } from "@/lib/crypto/bytes";
import { docContext, makeKeyCheck, newDocumentKey, newMasterKey, unwrapDocumentKey, verifyKeyCheck, wrapDocumentKey } from "@/lib/crypto/keys";
import { idb, wipeAll } from "./db";
import { fetchWithTimeout, readError } from "./api";
import type { Company, DocKind, DocPayload, DocRecord, UploadResult } from "./types";

export const MAX_PLAINTEXT_BYTES = 900 * 1024; // keep ciphertext < 1 MB

function uuid(): string {
  return crypto.randomUUID();
}

// ---------- company + master key ----------

export async function getCompany(): Promise<Company | null> {
  return (await idb.get<Company>("kv", "company")) ?? null;
}

export async function saveCompany(c: Company): Promise<void> {
  await idb.set("kv", "company", c);
}

export async function getMasterKey(): Promise<Uint8Array | null> {
  const k = await idb.get<Uint8Array>("kv", "masterKey");
  return k ? new Uint8Array(k) : null;
}

async function requireMasterKey(): Promise<Uint8Array> {
  const k = await getMasterKey();
  if (!k) throw new Error("This browser has no master key. Recover it with 2 co-founder shares (Keys tab).");
  return k;
}

export async function createCompany(name: string, demo = false): Promise<Company> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Company name is required");
  const master = newMasterKey();
  const slug = trimmed.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 4) || "co";
  const tagSuffix = Array.from(crypto.getRandomValues(new Uint8Array(2)), (b) => b.toString(16).padStart(2, "0")).join("");
  const company: Company = {
    id: uuid(),
    name: trimmed,
    tag: `${slug}${tagSuffix}`,
    createdAt: new Date().toISOString(),
    keyCheck: toBase64(await makeKeyCheck(master)),
    ceremony: { done: false, at: null, threshold: 2, total: 3, holders: [] },
    demo,
  };
  await idb.set("kv", "masterKey", master);
  await saveCompany(company);
  return company;
}

/** "I lost my key": remove the master key from this browser. Encrypted data stays. */
export async function forgetMasterKey(): Promise<void> {
  await idb.del("kv", "masterKey");
}

/** Install a recovered master key after checking it really belongs to this company. */
export async function installRecoveredKey(candidate: Uint8Array): Promise<boolean> {
  const company = await getCompany();
  if (!company) throw new Error("No company in this browser");
  const ok = await verifyKeyCheck(candidate, fromBase64(company.keyCheck));
  if (ok) await idb.set("kv", "masterKey", candidate);
  return ok;
}

export async function checkMasterKey(candidate: Uint8Array): Promise<boolean> {
  const company = await getCompany();
  if (!company) return false;
  return verifyKeyCheck(candidate, fromBase64(company.keyCheck));
}

export async function resetEverything(): Promise<void> {
  await wipeAll();
}

// ---------- 0G storage via our ciphertext-only API ----------

export async function uploadCiphertext(envelope: Uint8Array): Promise<UploadResult> {
  const res = await fetchWithTimeout("/api/storage", { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: envelope as BodyInit }, 150_000);
  if (!res.ok) throw await readError(res);
  return (await res.json()) as UploadResult;
}

export async function downloadCiphertext(rootHash: string): Promise<Uint8Array> {
  const res = await fetchWithTimeout(`/api/storage/${rootHash}`, {}, 90_000);
  if (!res.ok) throw await readError(res);
  return new Uint8Array(await res.arrayBuffer());
}

// ---------- documents ----------

export async function listDocs(): Promise<DocRecord[]> {
  const docs = await idb.all<DocRecord>("docs");
  return docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getDoc(id: string): Promise<DocRecord | null> {
  return (await idb.get<DocRecord>("docs", id)) ?? null;
}

export interface AddDocInput {
  name: string;
  mime: string;
  text: string;
  kind?: DocKind;
  meta?: Record<string, string>;
}

export type Progress = (step: string) => void;

/** Encrypt in the browser, store ciphertext on 0G, record it in the local vault index. */
export async function addDocument(input: AddDocInput, onProgress: Progress = () => {}): Promise<DocRecord> {
  const master = await requireMasterKey();
  const id = uuid();
  const payload: DocPayload = {
    v: 1,
    name: input.name,
    mime: input.mime,
    kind: input.kind ?? "document",
    text: input.text,
    createdAt: new Date().toISOString(),
    meta: input.meta,
  };
  const plain = utf8.encode(JSON.stringify(payload));
  if (plain.length > MAX_PLAINTEXT_BYTES) throw new Error(`File too large: ${(plain.length / 1024).toFixed(0)} KB of text (limit 900 KB)`);
  onProgress("Encrypting on this device (AES-256-GCM)…");
  const docKey = newDocumentKey();
  const envelope = await encrypt(docKey, plain, docContext(id));
  const wrapped = await wrapDocumentKey(master, docKey, id);
  const record: DocRecord = {
    id,
    name: input.name,
    mime: input.mime,
    kind: payload.kind,
    chars: input.text.length,
    createdAt: payload.createdAt,
    wrappedKey: toBase64(wrapped),
    storage: "local",
    rootHash: null,
    txHash: null,
    explorerUrl: null,
    ctBytes: envelope.length,
    ctSha256: await sha256Hex(envelope),
    keyVersion: 1,
    uploadError: null,
  };
  await idb.set("blobs", id, envelope);
  await idb.set("docs", id, record);
  onProgress("Uploading ciphertext to 0G Storage (waits for on-chain confirmation)…");
  return pushToZeroG(record, envelope);
}

async function pushToZeroG(record: DocRecord, envelope: Uint8Array): Promise<DocRecord> {
  try {
    const r = await uploadCiphertext(envelope);
    const updated: DocRecord = { ...record, storage: "0g", rootHash: r.rootHash, txHash: r.txHash, explorerUrl: r.explorerUrl, uploadError: null };
    await idb.set("docs", record.id, updated);
    return updated;
  } catch (e) {
    const updated: DocRecord = { ...record, storage: "local", uploadError: (e as Error).message };
    await idb.set("docs", record.id, updated);
    return updated;
  }
}

export async function retryUpload(id: string): Promise<DocRecord> {
  const rec = await getDoc(id);
  if (!rec) throw new Error("Document not found");
  const env = await idb.get<Uint8Array>("blobs", id);
  if (!env) throw new Error("Local ciphertext missing");
  return pushToZeroG(rec, new Uint8Array(env));
}

/** Ciphertext for a document: prefer 0G (source of truth), fall back to the local cache. */
export async function getCiphertext(rec: DocRecord, preferNetwork = false): Promise<{ bytes: Uint8Array; source: "0g" | "local-cache" }> {
  if (!preferNetwork) {
    const cached = await idb.get<Uint8Array>("blobs", rec.id);
    if (cached) return { bytes: new Uint8Array(cached), source: "local-cache" };
  }
  if (rec.rootHash) {
    const bytes = await downloadCiphertext(rec.rootHash);
    await idb.set("blobs", rec.id, bytes);
    return { bytes, source: "0g" };
  }
  const cached = await idb.get<Uint8Array>("blobs", rec.id);
  if (cached) return { bytes: new Uint8Array(cached), source: "local-cache" };
  throw new Error("Ciphertext not available");
}

export async function getDocumentKey(rec: DocRecord): Promise<Uint8Array> {
  const master = await requireMasterKey();
  return unwrapDocumentKey(master, fromBase64(rec.wrappedKey), rec.id);
}

export async function decryptEnvelope(rec: DocRecord, envelope: Uint8Array): Promise<DocPayload> {
  const key = await getDocumentKey(rec);
  const plain = await decrypt(key, envelope, docContext(rec.id));
  return JSON.parse(utf8.decode(plain)) as DocPayload;
}

export async function openDocument(rec: DocRecord): Promise<DocPayload> {
  const { bytes } = await getCiphertext(rec);
  return decryptEnvelope(rec, bytes);
}

/** Removes from this vault's index. Ciphertext on 0G is immutable but unreadable without the key. */
export async function removeDocument(id: string): Promise<void> {
  await idb.del("docs", id);
  await idb.del("blobs", id);
}

/**
 * Re-key a document: new random document key, re-encrypt, re-upload. The old
 * ciphertext on 0G stays (immutable) but anyone holding only the OLD document
 * key cannot read the new version.
 */
export async function rekeyDocument(id: string, onProgress: Progress = () => {}): Promise<DocRecord> {
  const rec = await getDoc(id);
  if (!rec) throw new Error("Document not found");
  const payload = await openDocument(rec);
  const master = await requireMasterKey();
  onProgress("Re-encrypting with a fresh document key…");
  const docKey = newDocumentKey();
  const envelope = await encrypt(docKey, utf8.encode(JSON.stringify(payload)), docContext(id));
  const updated: DocRecord = {
    ...rec,
    wrappedKey: toBase64(await wrapDocumentKey(master, docKey, id)),
    keyVersion: rec.keyVersion + 1,
    storage: "local",
    rootHash: null,
    txHash: null,
    explorerUrl: null,
    ctBytes: envelope.length,
    ctSha256: await sha256Hex(envelope),
  };
  await idb.set("blobs", id, envelope);
  await idb.set("docs", id, updated);
  onProgress("Uploading new ciphertext to 0G…");
  return pushToZeroG(updated, envelope);
}
