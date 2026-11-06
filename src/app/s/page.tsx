"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/Logo";
import { PayloadBody } from "@/components/DocViewer";
import { Badge, Button, ErrorBox, Spinner } from "@/components/ui";
import { openManifest, openSharedDoc, type GrantDoc, type GrantManifest } from "@/lib/client/share";
import type { DocPayload } from "@/lib/client/types";

export default function SharedView() {
  const [manifest, setManifest] = useState<GrantManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<{ doc: GrantDoc; payload: DocPayload | null; error: string | null } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    openManifest(window.location.hash)
      .then(setManifest)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const expired = manifest ? new Date(manifest.expiresAt).getTime() <= now : false;

  async function view(d: GrantDoc) {
    setOpen({ doc: d, payload: null, error: null });
    try {
      setOpen({ doc: d, payload: await openSharedDoc(d), error: null });
    } catch (e) {
      setOpen({ doc: d, payload: null, error: (e as Error).message });
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Wordmark />
          <Badge tone="brand">shared access</Badge>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {loading && (
          <p className="flex items-center gap-2 text-brand">
            <Spinner /> Fetching the encrypted access manifest from 0G and decrypting it in your browser…
          </p>
        )}
        <ErrorBox error={error} />
        {manifest && (
          <>
            <div>
              <h1 className="text-2xl font-bold">{manifest.company}</h1>
              <p className="text-sm text-ink-soft">
                Shared with <b>{manifest.employee}</b> · {expired ? <span className="font-semibold text-danger">expired {new Date(manifest.expiresAt).toLocaleString()}</span> : <>expires {new Date(manifest.expiresAt).toLocaleString()}</>}
              </p>
            </div>
            {expired ? (
              <div className="rounded-2xl border border-line bg-card p-5 text-center">
                <p className="text-lg font-semibold">This link has expired</p>
                <p className="mt-1 text-sm text-muted">Ask {manifest.company} for a new link.</p>
              </div>
            ) : (
              <>
                <ul className="space-y-2">
                  {manifest.docs.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-card p-3">
                      <span className="truncate font-semibold">📄 {d.name}</span>
                      <Button variant="secondary" className="!min-h-9 !px-3 !py-1" onClick={() => view(d)}>
                        Open
                      </Button>
                    </li>
                  ))}
                </ul>
                {open && (
                  <div className="rounded-2xl border border-line bg-card p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-semibold">{open.doc.name}</p>
                      <button className="text-sm text-muted" onClick={() => setOpen(null)}>
                        Close
                      </button>
                    </div>
                    {open.error && <ErrorBox error={open.error} />}
                    {!open.payload && !open.error && <Spinner />}
                    {open.payload && (
                      <>
                        <p className="mb-2 text-xs text-seal">🔓 Downloaded as ciphertext from 0G and decrypted in this browser.</p>
                        <PayloadBody payload={open.payload} />
                      </>
                    )}
                  </div>
                )}
              </>
            )}
            <p className="text-xs text-muted">
              Read-only access. The key is in this link (after the #) and never reaches a server. {manifest.company} can revoke it, but revocation can&apos;t erase what you have already seen.
            </p>
          </>
        )}
        <p className="text-center text-xs text-muted">
          <Link href="/" className="underline">What is Kavach AI?</Link>
        </p>
      </main>
    </div>
  );
}
