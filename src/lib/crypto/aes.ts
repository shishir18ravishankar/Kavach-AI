/**
 * AES-256-GCM via WebCrypto. All encryption in Kavach happens on the user's
 * device with these functions.
 *
 * Envelope format (binary):  "KVH1" (4 bytes magic) | IV (12 bytes) | ciphertext+tag
 * The optional `context` string is bound as GCM additional authenticated data,
 * so a ciphertext cannot be swapped into a different role (e.g. a wrapped key
 * for document A cannot be used as the wrapped key for document B).
 */
import { concatBytes, utf8 } from "./bytes";

export const KEY_BYTES = 32;
export const IV_BYTES = 12;
export const MAGIC = utf8.encode("KVH1");
export const HEADER_BYTES = MAGIC.length + IV_BYTES;

export class DecryptionError extends Error {
  constructor(message = "Decryption failed: wrong key or tampered data") {
    super(message);
    this.name = "DecryptionError";
  }
}

export function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function generateKey(): Uint8Array {
  return randomBytes(KEY_BYTES);
}

async function importAes(key: Uint8Array): Promise<CryptoKey> {
  if (key.length !== KEY_BYTES) throw new Error(`AES-256 key must be ${KEY_BYTES} bytes`);
  return crypto.subtle.importKey("raw", key as BufferSource, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export function isEnvelope(data: Uint8Array): boolean {
  if (data.length < HEADER_BYTES + 16) return false;
  for (let i = 0; i < MAGIC.length; i++) if (data[i] !== MAGIC[i]) return false;
  return true;
}

export async function encrypt(key: Uint8Array, plaintext: Uint8Array, context = ""): Promise<Uint8Array> {
  const iv = randomBytes(IV_BYTES);
  const ck = await importAes(key);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource, additionalData: utf8.encode(context) as BufferSource },
    ck,
    plaintext as BufferSource,
  );
  return concatBytes(MAGIC, iv, new Uint8Array(ct));
}

export async function decrypt(key: Uint8Array, envelope: Uint8Array, context = ""): Promise<Uint8Array> {
  if (!isEnvelope(envelope)) throw new DecryptionError("Not a Kavach ciphertext");
  const iv = envelope.slice(MAGIC.length, HEADER_BYTES);
  const ct = envelope.slice(HEADER_BYTES);
  const ck = await importAes(key);
  try {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource, additionalData: utf8.encode(context) as BufferSource },
      ck,
      ct as BufferSource,
    );
    return new Uint8Array(pt);
  } catch {
    throw new DecryptionError();
  }
}

export async function encryptString(key: Uint8Array, s: string, context = ""): Promise<Uint8Array> {
  return encrypt(key, utf8.encode(s), context);
}

export async function decryptString(key: Uint8Array, env: Uint8Array, context = ""): Promise<string> {
  return utf8.decode(await decrypt(key, env, context));
}
