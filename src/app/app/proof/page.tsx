"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RequireCompany } from "@/components/AppShell";
import { useVault } from "@/components/VaultProvider";
import { PayloadBody } from "@/components/DocViewer";
import { Badge, Button, Card, CopyButton, ErrorBox, Spinner, short } from "@/components/ui";
import { decryptEnvelope, getCiphertext } from "@/lib/client/vault";
import { sha256Hex, toHex } from "@/lib/crypto/bytes";
import type { DocPayload } from "@/lib/client/types";

export default function ProofPage() {
  return (
    <RequireCompany needKey={false}>
      <Suspense fallback={<Spinner />}>
        <Proof />
      </Suspense>
    </RequireCompany>
  );
}

interface LogEntry {
  ts: string;
  route: string;
  event: string;
  meta: Record<string, string | number | boolean | null>;
}

function hexDump(b: Uint8Array, max = 384): string {
  const rows: string[] = [];
  for (let i = 0; i < Math.min(b.length, max); i += 16) {
    const chunk = b.slice(i, i + 16);
    const hex = toHex(chunk).replace(/(..)/g, "$1 ").trim().padEnd(47, " ");
    const ascii = Array.from(chunk, (c) => (c >= 32 && c < 127 ? String.fromCharCode(c) : ".")).join("");
    rows.push(`${i.toString(16).padStart(6, "0")}  ${hex}  ${ascii}`);
  }
  if (b.length > max) rows.push(`… ${b.length - max} more bytes`);
  return rows.join("\n");
}

function Proof() {
  const { docs, hasKey } = useVault();
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id") ?? docs[0]?.id ?? "";
  const doc = docs.find((d) => d.id === id) ?? null;

  const [ct, setCt] = useState<{ bytes: Uint8Array; source: string; sha: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plain, setPlain] = useState<DocPayload | null>(null);
  const [log, setLog] = useState<LogEntry[] | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const [needle, setNeedle] = useState("");

  const loadLog = useCallback(async () => {
    try {
      const r = await fetch("/api/logs", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setLog(((await r.json()) as { entries: LogEntry[] }).entries);
      setLogError(null);
    } catch (e) {
      setLogError((e as Error).message);
    }
  }, []);

  const fetchCt = useCallback(async () => {
    if (!doc) return;
    setLoading(true);
    setError(null);
    setPlain(null);
    try {
      const r = await getCiphertext(doc, true);
      setCt({ ...r, sha: await sha256Hex(r.bytes) });
    } catch (e) {
      setError((e as Error).message);
      try {
        const r = await getCiphertext(doc, false);
        setCt({ bytes: r.bytes, source: "local-cache (0G fetch failed)", sha: await sha256Hex(r.bytes) });
      } catch {
        /* nothing cached */
      }
    } finally {
      setLoading(false);
      void loadLog();
    }
  }, [doc, loadLog]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on doc change
    void fetchCt();
  }, [fetchCt]);

  async function onDecrypt() {
    if (!doc || !ct) return;
    try {
      setPlain(await decryptEnvelope(doc, ct.bytes));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const logText = JSON.stringify(log ?? []);
  const needleHit = needle.trim().length >= 3 ? logText.toLowerCase().includes(needle.trim().toLowerCase()) : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Proof</h1>
        <p className="text-sm text-muted">See exactly what 0G and our server hold: ciphertext and metadata, nothing readable.</p>
      </div>

      {docs.length === 0 ? (
        <Card className="text-sm text-muted">No documents yet.</Card>
      ) : (
        <select value={id} onChange={(e) => router.replace(`/app/proof?id=${e.target.value}`)} className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-base">
          {docs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      )}

      {doc && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">1 · What 0G Storage holds</p>
            {doc.storage === "0g" ? <Badge tone="seal">stored on 0G</Badge> : <Badge tone="warn">local only, not on 0G</Badge>}
          </div>
          <dl className="mt-3 space-y-1.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <dt className="w-24 text-muted">Root hash</dt>
              <dd className="mono break-all">{doc.rootHash ?? "n/a"}</dd>
              {doc.rootHash && <CopyButton text={doc.rootHash} />}
            </div>
            {doc.txHash && (
              <div className="flex flex-wrap gap-2">
                <dt className="w-24 text-muted">Upload tx</dt>
                <dd className="mono break-all">
                  <a className="text-brand underline" href={doc.explorerUrl ?? `https://chainscan-galileo.0g.ai/tx/${doc.txHash}`} target="_blank" rel="noreferrer">
                    {short(doc.txHash, 10)} ↗ chainscan
                  </a>
                </dd>
              </div>
            )}
            {doc.rootHash && (
              <div className="flex flex-wrap gap-2">
                <dt className="w-24 text-muted">Storage scan</dt>
                <dd>
                  <a className="text-brand underline" href="https://storagescan-galileo.0g.ai" target="_blank" rel="noreferrer">
                    storagescan-galileo.0g.ai ↗
                  </a>{" "}
                  <span className="text-muted">(search the root hash)</span>
                </dd>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <dt className="w-24 text-muted">Size</dt>
              <dd>{doc.ctBytes.toLocaleString()} bytes (AES-256-GCM: 4 B magic + 12 B IV + ciphertext + 16 B tag)</dd>
            </div>
          </dl>
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted">Raw bytes {ct ? `(fetched from ${ct.source})` : ""}</p>
              <Button variant="ghost" className="!min-h-8 !px-2 !py-0.5 text-xs" onClick={fetchCt} busy={loading}>
                Re-fetch from 0G
              </Button>
            </div>
            {loading && !ct && <div className="py-6 text-center text-brand"><Spinner /></div>}
            {ct && (
              <>
                <pre className="mono mt-1 max-h-64 overflow-auto rounded-xl bg-ink p-3 text-[10px] leading-relaxed text-[#9fd0ff] sm:text-xs">{hexDump(ct.bytes)}</pre>
                <p className="mt-1 text-xs">
                  SHA-256 <span className="mono break-all">{ct.sha}</span>{" "}
                  {ct.sha === doc.ctSha256 ? <Badge tone="seal">matches what was uploaded</Badge> : <Badge tone="danger">does not match upload</Badge>}
                </p>
              </>
            )}
            <ErrorBox error={error} />
          </div>
        </Card>
      )}

      {doc && ct && (
        <Card>
          <p className="font-semibold">2 · Decrypt it here, with the key only this browser has</p>
          {hasKey ? (
            <>
              <Button className="mt-3" onClick={onDecrypt} disabled={!!plain}>
                Decrypt in browser
              </Button>
              {plain && (
                <div className="mt-3">
                  <PayloadBody payload={plain} />
                </div>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-danger">No master key in this browser, so this ciphertext cannot be decrypted. Recover it from the Keys tab.</p>
          )}
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <p className="font-semibold">3 · What our server logged</p>
          <Button variant="ghost" className="!min-h-8 !px-2 !py-0.5 text-xs" onClick={loadLog}>
            Refresh
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted">In-memory log of the current server instance (resets on redeploy or cold start). It records sizes, hashes and timings only.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input value={needle} onChange={(e) => setNeedle(e.target.value)} placeholder="Type a word from a document, e.g. Saffron" className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-base" />
          {needleHit === false && <Badge tone="seal">✓ not found in server log</Badge>}
          {needleHit === true && <Badge tone="danger">found in log</Badge>}
        </div>
        {logError && <ErrorBox error={`Could not load server log: ${logError}`} />}
        {log && log.length === 0 && <p className="mt-3 text-sm text-muted">No entries on this instance yet.</p>}
        {log && log.length > 0 && (
          <ul className="mono mt-3 max-h-80 space-y-1 overflow-auto rounded-xl bg-paper p-3 text-[11px]">
            {log.map((e, i) => (
              <li key={i} className="break-all">
                <span className="text-muted">{e.ts.slice(11, 19)}</span> <span className="font-semibold">{e.event}</span> <span className="text-ink-soft">{JSON.stringify(e.meta)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
