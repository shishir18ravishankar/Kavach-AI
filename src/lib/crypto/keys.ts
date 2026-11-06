/**
 * Key hierarchy:
 *   master key (random 256-bit, lives only in this browser's IndexedDB,
 *               split into co-founder shares with Shamir)
 *     └─ wraps each document key (random 256-bit, one per document)
 *           └─ encrypts the document payload uploaded to 0G Storage
 */
import { decrypt, encrypt, encryptString, decryptString, generateKey, DecryptionError } from "./aes";

const wrapContext = (docId: string) => `kavach:wrap:${docId}`;
const KEY_CHECK_CONTEXT = "kavach:key-check";
const KEY_CHECK_TEXT = "kavach-master-key-ok";

export function newMasterKey(): Uint8Array {
  return generateKey();
}

export function newDocumentKey(): Uint8Array {
  return generateKey();
}

export async function wrapDocumentKey(master: Uint8Array, docKey: Uint8Array, docId: string): Promise<Uint8Array> {
  return encrypt(master, docKey, wrapContext(docId));
}

export async function unwrapDocumentKey(master: Uint8Array, wrapped: Uint8Array, docId: string): Promise<Uint8Array> {
  return decrypt(master, wrapped, wrapContext(docId));
}

/** A small ciphertext stored with the company that proves a candidate master key is correct. */
export async function makeKeyCheck(master: Uint8Array): Promise<Uint8Array> {
  return encryptString(master, KEY_CHECK_TEXT, KEY_CHECK_CONTEXT);
}

export async function verifyKeyCheck(master: Uint8Array, check: Uint8Array): Promise<boolean> {
  try {
    return (await decryptString(master, check, KEY_CHECK_CONTEXT)) === KEY_CHECK_TEXT;
  } catch (e) {
    if (e instanceof DecryptionError) return false;
    throw e;
  }
}

export const docContext = (docId: string) => `kavach:doc:${docId}`;
