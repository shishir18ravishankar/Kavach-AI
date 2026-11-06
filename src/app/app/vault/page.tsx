"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { RequireCompany } from "@/components/AppShell";
import { useVault } from "@/components/VaultProvider";
import { Badge, Button, Card, ErrorBox, short } from "@/components/ui";
import { DocViewer } from "@/components/DocViewer";
import { ACCEPTED, extractText } from "@/lib/client/extract";
import { addDocument, removeDocument, retryUpload } from "@/lib/client/vault";
import type { DocRecord } from "@/lib/client/types";

export default function VaultPage() {
  return (
    <RequireCompany>
      <Vault />
    </RequireCompany>
  );
}

function Vault() {
  const { docs, refresh } = useVault();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<DocRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "document" | "note">("all");

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    for (const f of Array.from(files)) {
      try {
        setProgress(`${f.name}: reading file in the browser…`);
        const ex = await extractText(f);
        const rec = await addDocument(ex, (s) => setProgress(`${f.name}: ${s}`));
        if (rec.storage !== "0g") setError(`${f.name} was encrypted and saved on this device, but the 0G upload failed: ${rec.uploadError}`);
      } catch (e) {
        setError((e as Error).message);
      }
      await refresh();
    }
    setProgress(null);
    if (input.current) input.current.value = "";
  }

  async function onRetry(d: DocRecord) {
    setBusyId(d.id);
    setError(null);
    try {
      const r = await retryUpload(d.id);
      if (r.storage !== "0g") setError(`Upload still failing: ${r.uploadError}`);
    } catch (e) {
      setError((e as Error).message);
    }
    await refresh();
    setBusyId(null);
  }

  async function onRemove(d: DocRecord) {
    if (!confirm(`Remove "${d.name}" from this vault? The ciphertext on 0G is immutable and stays there, but without this vault's key it is unreadable.`)) return;
    await removeDocument(d.id);
    await refresh();
  }

  const shown = docs.filter((d) => filter === "all" || d.kind === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Vault</h1>
          <p className="text-sm text-muted">Encrypted on this device with AES-256-GCM. Only ciphertext is stored on 0G.</p>
        </div>
        <div className="flex gap-2">
          <input ref={input} type="file" multiple accept={ACCEPTED} className="hidden" onChange={(e) => onFiles(e.target.files)} />
          <Button onClick={() => input.current?.click()} busy={!!progress}>
            Upload document
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted">Supports .txt, .md, .csv and PDF (text is extracted in your browser), up to 1 MB.</p>
      {progress && <p className="rounded-xl bg-brand-soft p-3 text-sm font-medium text-brand">{progress}</p>}
      <ErrorBox error={error} />

      <div className="flex gap-1 text-sm">
        {(["all", "document", "note"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 font-semibold ${filter === f ? "bg-ink text-white" : "text-ink-soft hover:bg-card"}`}>
            {f === "all" ? "All" : f === "document" ? "Documents" : "Saved answers"}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Card className="text-center text-sm text-muted">
          {docs.length === 0 ? "No documents yet. Upload one, or load the demo company from Setup." : "Nothing here yet. Save an AI answer from Chat to see it here."}
        </Card>
      ) : (
        <ul className="space-y-2">
          {shown.map((d) => (
            <li key={d.id}>
              <Card className="!p-3 sm:!p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <button className="min-w-0 text-left" onClick={() => setOpen(d)}>
                    <p className="truncate font-semibold">{d.kind === "note" ? "📝 " : "📄 "}{d.name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {new Date(d.createdAt).toLocaleString()} · {d.chars.toLocaleString()} chars · {(d.ctBytes / 1024).toFixed(1)} KB ciphertext
                      {d.keyVersion > 1 ? ` · key v${d.keyVersion}` : ""}
                    </p>
                  </button>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {d.storage === "0g" ? <Badge tone="seal">on 0G · {short(d.rootHash, 4)}</Badge> : <Badge tone="warn">local only</Badge>}
                  </div>
                </div>
                {d.storage !== "0g" && <p className="mt-2 text-xs text-warn">{d.uploadError ? `0G upload failed: ${d.uploadError}` : "Upload to 0G was interrupted (page closed mid-upload). Encrypted copy is safe on this device."}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="secondary" className="!min-h-9 !px-3 !py-1" onClick={() => setOpen(d)}>
                    Open
                  </Button>
                  <Link href={`/app/proof?id=${d.id}`} className="inline-flex min-h-9 items-center rounded-xl px-3 text-sm font-semibold text-brand hover:bg-brand-soft">
                    Proof
                  </Link>
                  {d.storage !== "0g" && (
                    <Button variant="ghost" className="!min-h-9 !px-3 !py-1" onClick={() => onRetry(d)} busy={busyId === d.id}>
                      Retry 0G upload
                    </Button>
                  )}
                  <Button variant="ghost" className="!min-h-9 !px-3 !py-1 !text-danger" onClick={() => onRemove(d)}>
                    Remove
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {open && <DocViewer doc={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
