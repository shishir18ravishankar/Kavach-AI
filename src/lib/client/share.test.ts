import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCompany, addDocument, getDoc, resetEverything } from "./vault";
import { createGrant, openManifest, openSharedDoc, revokeGrant, grantStatus, parseShareFragment, listGrants } from "./share";
import { sha256Hex, utf8 } from "@/lib/crypto/bytes";

const store = new Map<string, Uint8Array>();
beforeEach(async () => {
  await resetEverything();
  store.clear();
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url === "/api/storage" && init?.method === "POST") {
      const body = init.body as Uint8Array;
      const root = "0x" + (await sha256Hex(body));
      store.set(root, body);
      return new Response(JSON.stringify({ rootHash: root, txHash: null, txSeq: 1, explorerUrl: null, bytes: body.length, sha256: root }), { status: 200 });
    }
    const m = /^\/api\/storage\/(0x[0-9a-f]{64})$/.exec(url);
    if (m && store.has(m[1])) return new Response(store.get(m[1]) as BodyInit, { status: 200 });
    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  });
});

describe("employee sharing", () => {
  it("link opens only the shared docs; manifest on 0G is ciphertext", async () => {
    await createCompany("Share Co");
    const a = await addDocument({ name: "pricing.md", mime: "text/markdown", text: "floor ₹980" });
    await addDocument({ name: "payroll.csv", mime: "text/csv", text: "name,salary\nA,1" });
    const g = await createGrant("Priya (sales)", [a.id], 3600_000, "https://kavach.test");
    expect(g.link.startsWith("https://kavach.test/s#0x")).toBe(true);
    const hash = g.link.slice(g.link.indexOf("#"));
    const manifestCt = store.get(parseShareFragment(hash).root)!;
    expect(utf8.decode(manifestCt)).not.toContain("Priya");
    const m = await openManifest(hash);
    expect(m.employee).toBe("Priya (sales)");
    expect(m.docs.map((d) => d.name)).toEqual(["pricing.md"]);
    expect((await openSharedDoc(m.docs[0])).text).toBe("floor ₹980");
    expect(grantStatus(g)).toBe("active");
    expect(grantStatus(g, Date.now() + 2 * 3600_000)).toBe("expired");
  });

  it("wrong link key fails", async () => {
    await createCompany("Share Co");
    const a = await addDocument({ name: "x.txt", mime: "text/plain", text: "x" });
    const g = await createGrant("Bob", [a.id], 60_000, "https://k");
    const { root } = parseShareFragment(g.link.slice(g.link.indexOf("#")));
    await expect(openManifest(`#${root}.${"A".repeat(43)}`)).rejects.toThrow(/key is wrong/);
    await expect(openManifest("#garbage")).rejects.toThrow(/incomplete/);
  });

  it("revoke re-keys the document; the old key cannot open the new version", async () => {
    await createCompany("Share Co");
    const a = await addDocument({ name: "x.txt", mime: "text/plain", text: "v1" });
    const g = await createGrant("Bob", [a.id], 60_000, "https://k");
    const m = await openManifest(g.link.slice(g.link.indexOf("#")));
    const { grant } = await revokeGrant(g.id);
    expect(grantStatus(grant)).toBe("revoked");
    const after = (await getDoc(a.id))!;
    expect(after.keyVersion).toBe(2);
    expect(after.rootHash).not.toBe(a.rootHash);
    await expect(openSharedDoc({ ...m.docs[0], rootHash: after.rootHash! })).rejects.toThrow();
    // Honest limit: the old immutable ciphertext still opens with the old link.
    expect((await openSharedDoc(m.docs[0])).text).toBe("v1");
    expect((await listGrants())[0].revokedAt).not.toBeNull();
  });
});
