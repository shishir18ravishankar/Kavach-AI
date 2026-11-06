/**
 * Employee access (Tier 3), with no server-side state.
 *
 * A share link looks like  /s#<manifestRootHash>.<grantKey>
 * The part after "#" is never sent to any server. The manifest (employee
 * name, expiry, and for each shared document: its 0G root hash and document
 * key) is encrypted with the random grant key and stored on 0G.
 *
 * Limits (stated in the UI):
 *  - Expiry is enforced by the Kavach viewer. Someone who already extracted
 *    the keys could ignore it.
 *  - Revoking re-keys each document (new key, new ciphertext on 0G), so the
 *    vault and future shares use a version the old link can't open. 0G
 *    storage is immutable: the old ciphertext still exists and the old link
 *    still opens THAT old version. Nothing can erase what was already seen.
 */
import { decrypt, encrypt, generateKey } from "@/lib/crypto/aes";
import { fromBase64, fromBase64Url, toBase64, toBase64Url, utf8 } from "@/lib/crypto/bytes";
import { idb } from "./db";
import { downloadCiphertext, getCompany, getDoc, getDocumentKey, rekeyDocument, uploadCiphertext, type Progress } from "./vault";
import type { DocPayload } from "./types";
import { docContext } from "@/lib/crypto/keys";

const MANIFEST_CONTEXT = "kavach:grant-manifest";

export interface GrantDoc {
  id: string;
  name: string;
  mime: string;
  rootHash: string;
  keyVersion: number;
  key: string; // base64 document key
}

export interface GrantManifest {
  v: 1;
  company: string;
  employee: string;
  createdAt: string;
  expiresAt: string;
  docs: GrantDoc[];
}

export interface Grant {
  id: string;
  employee: string;
  docIds: string[];
  docNames: string[];
  docVersions: number[];
  createdAt: string;
  expiresAt: string;
  manifestRoot: string;
  link: string; // full link incl. fragment; stored only in this browser
  revokedAt: string | null;
}

export function grantStatus(g: Grant, now = Date.now()): "active" | "expired" | "revoked" {
  if (g.revokedAt) return "revoked";
  return new Date(g.expiresAt).getTime() <= now ? "expired" : "active";
}

export async function listGrants(): Promise<Grant[]> {
  return (await idb.all<Grant>("grants")).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createGrant(employee: string, docIds: string[], ttlMs: number, origin: string, onProgress: Progress = () => {}): Promise<Grant> {
  const name = employee.trim();
  if (!name) throw new Error("Employee name is required");
  if (!docIds.length) throw new Error("Pick at least one document");
  if (ttlMs <= 0) throw new Error("Expiry must be in the future");
  const company = await getCompany();
  if (!company) throw new Error("No company");
  const docs: GrantDoc[] = [];
  for (const id of docIds) {
    const rec = await getDoc(id);
    if (!rec) throw new Error("Document not found");
    if (rec.storage !== "0g" || !rec.rootHash) throw new Error(`"${rec.name}" is not on 0G yet. Retry its upload first.`);
    docs.push({ id, name: rec.name, mime: rec.mime, rootHash: rec.rootHash, keyVersion: rec.keyVersion, key: toBase64(await getDocumentKey(rec)) });
  }
  const now = new Date();
  const manifest: GrantManifest = { v: 1, company: company.name, employee: name, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + ttlMs).toISOString(), docs };
  onProgress("Encrypting the access manifest with a fresh grant key…");
  const grantKey = generateKey();
  const env = await encrypt(grantKey, utf8.encode(JSON.stringify(manifest)), MANIFEST_CONTEXT);
  onProgress("Storing the encrypted manifest on 0G…");
  const up = await uploadCiphertext(env);
  const grant: Grant = {
    id: crypto.randomUUID(),
    employee: name,
    docIds,
    docNames: docs.map((d) => d.name),
    docVersions: docs.map((d) => d.keyVersion),
    createdAt: manifest.createdAt,
    expiresAt: manifest.expiresAt,
    manifestRoot: up.rootHash,
    link: `${origin}/s#${up.rootHash}.${toBase64Url(grantKey)}`,
    revokedAt: null,
  };
  await idb.set("grants", grant.id, grant);
  return grant;
}

/** Revoke: mark revoked and re-key every document in the grant. */
export async function revokeGrant(id: string, onProgress: Progress = () => {}): Promise<{ grant: Grant; failed: string[] }> {
  const g = await idb.get<Grant>("grants", id);
  if (!g) throw new Error("Grant not found");
  const failed: string[] = [];
  for (const docId of g.docIds) {
    const rec = await getDoc(docId);
    if (!rec) continue; // removed from vault already
    // Only re-key if the doc is still on the version this grant exposed.
    const i = g.docIds.indexOf(docId);
    if (rec.keyVersion !== g.docVersions[i]) continue;
    const r = await rekeyDocument(docId, (s) => onProgress(`${rec.name}: ${s}`));
    if (r.storage !== "0g") failed.push(rec.name);
  }
  const updated: Grant = { ...g, revokedAt: new Date().toISOString() };
  await idb.set("grants", id, updated);
  return { grant: updated, failed };
}

export function parseShareFragment(hash: string): { root: string; key: Uint8Array } {
  const frag = hash.replace(/^#/, "");
  const m = /^(0x[0-9a-fA-F]{64})\.([A-Za-z0-9_-]{43})$/.exec(frag);
  if (!m) throw new Error("This share link is incomplete or damaged. Ask for a new link.");
  return { root: m[1], key: fromBase64Url(m[2]) };
}

export async function openManifest(hash: string): Promise<GrantManifest> {
  const { root, key } = parseShareFragment(hash);
  const env = await downloadCiphertext(root);
  try {
    return JSON.parse(utf8.decode(await decrypt(key, env, MANIFEST_CONTEXT))) as GrantManifest;
  } catch {
    throw new Error("Could not decrypt this share. The link key is wrong.");
  }
}

export async function openSharedDoc(d: GrantDoc): Promise<DocPayload> {
  const env = await downloadCiphertext(d.rootHash);
  const plain = await decrypt(fromBase64(d.key), env, docContext(d.id));
  return JSON.parse(utf8.decode(plain)) as DocPayload;
}
