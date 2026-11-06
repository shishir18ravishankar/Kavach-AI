import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCompany, addDocument, openDocument, listDocs, forgetMasterKey, getMasterKey, installRecoveredKey, rekeyDocument, getDocumentKey, resetEverything } from "./vault";
import { splitSecret, combineShares } from "@/lib/crypto/shamir";
import { newMasterKey } from "@/lib/crypto/keys";
import { isEnvelope } from "@/lib/crypto/aes";
import { utf8 } from "@/lib/crypto/bytes";

let uploaded: Uint8Array[] = [];
beforeEach(async () => {
  await resetEverything();
  uploaded = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url === "/api/storage" && init?.method === "POST") {
      const body = init.body as Uint8Array;
      uploaded.push(body);
      return new Response(JSON.stringify({ rootHash: "0x" + "ab".repeat(32), txHash: "0x" + "cd".repeat(32), txSeq: 1, explorerUrl: "x", bytes: body.length, sha256: "s" }), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  });
});

describe("vault flow", () => {
  it("only ciphertext is uploaded, and the doc decrypts locally", async () => {
    await createCompany("Test Co");
    const rec = await addDocument({ name: "secret.txt", mime: "text/plain", text: "Customer: ACME, price 999" });
    expect(rec.storage).toBe("0g");
    expect(uploaded).toHaveLength(1);
    expect(isEnvelope(uploaded[0])).toBe(true);
    expect(utf8.decode(uploaded[0])).not.toContain("ACME");
    expect(utf8.decode(uploaded[0])).not.toContain("secret.txt");
    expect((await openDocument(rec)).text).toBe("Customer: ACME, price 999");
    expect(await listDocs()).toHaveLength(1);
  });

  it("lost key → 2 shares recover access; wrong key is rejected", async () => {
    await createCompany("Test Co");
    const rec = await addDocument({ name: "a.txt", mime: "text/plain", text: "hello" });
    const master = (await getMasterKey())!;
    const shares = await splitSecret(master, 3, 2);
    await forgetMasterKey();
    await expect(openDocument(rec)).rejects.toThrow(/no master key/);
    expect(await installRecoveredKey(newMasterKey())).toBe(false);
    expect(await installRecoveredKey(await combineShares([shares[1], shares[2]]))).toBe(true);
    expect((await openDocument(rec)).text).toBe("hello");
  });

  it("re-key changes the document key", async () => {
    await createCompany("Test Co");
    const rec = await addDocument({ name: "a.txt", mime: "text/plain", text: "hello" });
    const oldKey = await getDocumentKey(rec);
    const re = await rekeyDocument(rec.id);
    expect(re.keyVersion).toBe(2);
    expect(Buffer.from(await getDocumentKey(re)).equals(Buffer.from(oldKey))).toBe(false);
    expect((await openDocument(re)).text).toBe("hello");
  });

  it("falls back to local-only storage when 0G upload fails", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: "0G down" }), { status: 502 }));
    await createCompany("Test Co");
    const rec = await addDocument({ name: "a.txt", mime: "text/plain", text: "hello" });
    expect(rec.storage).toBe("local");
    expect(rec.uploadError).toContain("0G down");
    expect((await openDocument(rec)).text).toBe("hello");
  });
});
