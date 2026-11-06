"use client";
import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div role="alert" className="mx-auto max-w-md rounded-2xl border border-danger/30 bg-danger-soft p-5">
      <p className="text-lg font-semibold text-danger">This screen hit an error</p>
      <p className="mt-2 break-words text-sm text-ink-soft">{error.message || "Unknown error"}</p>
      <p className="mt-2 text-xs text-muted">Your encrypted vault is untouched. Try again, or go back to the vault.</p>
      <div className="mt-4 flex gap-2">
        <button onClick={reset} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white">Try again</button>
        <a href="/app/vault" className="rounded-xl border border-line bg-card px-4 py-2 text-sm font-semibold">Go to vault</a>
      </div>
    </div>
  );
}
