"use client";
import { useEffect, useState } from "react";
import { openDocument } from "@/lib/client/vault";
import type { DocPayload, DocRecord } from "@/lib/client/types";
import { ErrorBox, Spinner } from "./ui";

export function CsvTable({ text }: { text: string }) {
  const rows = text.trim().split(/\r?\n/).map((l) => l.split(","));
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="min-w-full text-xs">
        <thead className="bg-paper">
          <tr>{rows[0]?.map((h, i) => <th key={i} className="whitespace-nowrap px-2 py-1.5 text-left font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.slice(1).map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((c, j) => <td key={j} className="whitespace-nowrap px-2 py-1.5">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PayloadBody({ payload }: { payload: DocPayload }) {
  if (payload.mime === "text/csv") return <CsvTable text={payload.text} />;
  return <pre className="whitespace-pre-wrap break-words rounded-xl bg-paper p-3 text-sm leading-relaxed">{payload.text}</pre>;
}

export function DocViewer({ doc, onClose }: { doc: DocRecord; onClose: () => void }) {
  const [payload, setPayload] = useState<DocPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    openDocument(doc)
      .then((p) => alive && setPayload(p))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [doc]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-card p-4 shadow-xl sm:rounded-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{doc.name}</p>
            <p className="text-xs text-seal">🔓 Decrypted in your browser. This plaintext never left the device.</p>
          </div>
          <button onClick={onClose} className="rounded-lg px-3 py-1 text-sm font-semibold text-muted hover:bg-paper" aria-label="Close">
            ✕
          </button>
        </div>
        {error && <ErrorBox error={error} />}
        {!payload && !error && (
          <div className="flex justify-center py-10 text-brand">
            <Spinner />
          </div>
        )}
        {payload && (
          <>
            {payload.meta?.question && <p className="mb-2 rounded-xl bg-brand-soft p-2 text-sm"><b>Question:</b> {payload.meta.question}</p>}
            <PayloadBody payload={payload} />
            {payload.meta?.proof && <p className="mono mt-2 break-all text-[11px] text-muted">Proof at save time: {payload.meta.proof}</p>}
          </>
        )}
      </div>
    </div>
  );
}
