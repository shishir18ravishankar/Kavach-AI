import { describe, it, expect } from "vitest";
import { encrypt, decrypt, encryptString, decryptString, generateKey, isEnvelope, DecryptionError } from "./aes";
import { newMasterKey, newDocumentKey, wrapDocumentKey, unwrapDocumentKey, makeKeyCheck, verifyKeyCheck } from "./keys";
import { splitSecret, combineShares, encodeShare, parseShare, shareIndex } from "./shamir";
import { combine } from "shamir-secret-sharing";
import { equalBytes, fromHex, toHex, toBase64, fromBase64, toBase64Url, fromBase64Url, utf8 } from "./bytes";

describe("AES-256-GCM envelope", () => {
  it("round-trips bytes and strings", async () => {
    const key = generateKey();
    const msg = utf8.encode("Brewline pays ₹1,20,000/month to BeanCo");
    const env = await encrypt(key, msg, "ctx");
    expect(isEnvelope(env)).toBe(true);
    expect(equalBytes(await decrypt(key, env, "ctx"), msg)).toBe(true);
    expect(await decryptString(key, await encryptString(key, "hello", "c"), "c")).toBe("hello");
  });

  it("ciphertext does not contain the plaintext and uses a fresh IV", async () => {
    const key = generateKey();
    const a = await encryptString(key, "SECRET-CUSTOMER-LIST");
    const b = await encryptString(key, "SECRET-CUSTOMER-LIST");
    expect(utf8.decode(a)).not.toContain("SECRET");
    expect(toHex(a)).not.toBe(toHex(b));
  });

  it("fails with the wrong key", async () => {
    const env = await encryptString(generateKey(), "top secret");
    await expect(decrypt(generateKey(), env)).rejects.toBeInstanceOf(DecryptionError);
  });

  it("fails with the wrong context (AAD)", async () => {
    const key = generateKey();
    const env = await encryptString(key, "x", "doc:a");
    await expect(decrypt(key, env, "doc:b")).rejects.toBeInstanceOf(DecryptionError);
  });

  it("detects tampering", async () => {
    const key = generateKey();
    const env = await encryptString(key, "invoice total 4200");
    env[env.length - 1] ^= 0x01;
    await expect(decrypt(key, env)).rejects.toBeInstanceOf(DecryptionError);
  });

  it("rejects non-envelopes and bad key sizes", async () => {
    await expect(decrypt(generateKey(), utf8.encode("plain text, not encrypted at all"))).rejects.toThrow();
    await expect(encrypt(new Uint8Array(16), new Uint8Array(1))).rejects.toThrow(/32 bytes/);
  });
});

describe("key wrapping", () => {
  it("wraps and unwraps a document key with the master key", async () => {
    const master = newMasterKey();
    const docKey = newDocumentKey();
    const wrapped = await wrapDocumentKey(master, docKey, "doc-1");
    expect(equalBytes(await unwrapDocumentKey(master, wrapped, "doc-1"), docKey)).toBe(true);
  });

  it("cannot unwrap with another master key or for another document", async () => {
    const master = newMasterKey();
    const wrapped = await wrapDocumentKey(master, newDocumentKey(), "doc-1");
    await expect(unwrapDocumentKey(newMasterKey(), wrapped, "doc-1")).rejects.toBeInstanceOf(DecryptionError);
    await expect(unwrapDocumentKey(master, wrapped, "doc-2")).rejects.toBeInstanceOf(DecryptionError);
  });

  it("key check accepts only the right master key", async () => {
    const master = newMasterKey();
    const check = await makeKeyCheck(master);
    expect(await verifyKeyCheck(master, check)).toBe(true);
    expect(await verifyKeyCheck(newMasterKey(), check)).toBe(false);
  });
});

describe("Shamir 2-of-3", () => {
  it("any 2 of 3 shares recover the master key", async () => {
    const master = newMasterKey();
    const shares = await splitSecret(master, 3, 2);
    expect(shares).toHaveLength(3);
    for (const [i, j] of [[0, 1], [0, 2], [1, 2], [2, 0]]) {
      expect(equalBytes(await combineShares([shares[i], shares[j]]), master)).toBe(true);
    }
    expect(equalBytes(await combineShares(shares), master)).toBe(true);
  });

  it("a single share does not recover the key", async () => {
    const master = newMasterKey();
    const shares = await splitSecret(master, 3, 2);
    await expect(combineShares([shares[0]])).rejects.toThrow(/At least 2/);
    // Even bypassing our guard, the library cannot reconstruct from one share.
    let recovered: Uint8Array | null = null;
    try { recovered = await combine([shares[0]]); } catch { recovered = null; }
    expect(recovered === null || !equalBytes(recovered, master)).toBe(true);
  });

  it("two copies of the same share do not recover the key", async () => {
    const master = newMasterKey();
    const [s] = await splitSecret(master, 3, 2);
    let recovered: Uint8Array | null = null;
    try { recovered = await combineShares([s, s.slice()]); } catch { recovered = null; }
    expect(recovered === null || !equalBytes(recovered, master)).toBe(true);
  });

  it("share text encodes, parses, and detects typos", async () => {
    const master = newMasterKey();
    const shares = await splitSecret(master, 3, 2);
    const texts = await Promise.all(shares.map((s) => encodeShare(s, "brew1", 2, 3)));
    const parsed = await Promise.all(texts.map(parseShare));
    expect(parsed[0]).toMatchObject({ companyTag: "brew1", threshold: 2, total: 3 });
    expect(new Set(parsed.map((p) => shareIndex(p.bytes))).size).toBe(3);
    expect(equalBytes(await combineShares([parsed[2].bytes, parsed[0].bytes]), master)).toBe(true);
    const typo = texts[0].replace(/-(.)([^-]*)-([0-9a-f]{8})$/, (_m, c, rest, chk) => `-${c === "A" ? "B" : "A"}${rest}-${chk}`);
    await expect(parseShare(typo)).rejects.toThrow(/checksum/);
    await expect(parseShare("hello")).rejects.toThrow(/Kavach/);
  });
});

describe("byte helpers", () => {
  it("hex and base64 round-trip", () => {
    const b = new Uint8Array([0, 1, 254, 255, 128]);
    expect(equalBytes(fromHex(toHex(b)), b)).toBe(true);
    expect(equalBytes(fromBase64(toBase64(b)), b)).toBe(true);
    expect(equalBytes(fromBase64Url(toBase64Url(b)), b)).toBe(true);
  });
});
