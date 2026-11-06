"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Wordmark } from "./Logo";
import { useVault } from "./VaultProvider";
import { Badge, Spinner } from "./ui";

const NAV = [
  { href: "/app/vault", label: "Vault", icon: "M4 7h16v12H4zM8 7V5h8v2" },
  { href: "/app/chat", label: "Chat", icon: "M4 5h16v11H8l-4 4z" },
  { href: "/app/keys", label: "Keys", icon: "M14 4a5 5 0 1 1-4.6 7L4 16.4V20h3.6l1-1v-2h2v-2h1.4l1.4-1.4A5 5 0 0 1 14 4z" },
  { href: "/app/share", label: "Share", icon: "M16 8a3 3 0 1 0-2.8-4M8 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 6a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM10.6 12.5l2.8 2.5M10.6 9.5l2.8-2.5" },
  { href: "/app/proof", label: "Proof", icon: "M12 3 4 6v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6zM9 12l2 2 4-4" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function StatusBanner() {
  const { status, statusError } = useVault();
  if (statusError) return <div className="bg-danger-soft px-4 py-2 text-center text-xs font-medium text-danger">{statusError}</div>;
  if (!status) return null;
  if (!status.configured)
    return <div className="bg-warn-soft px-4 py-2 text-center text-xs font-semibold text-warn">0G unavailable, demo mode: server has no 0G wallet configured. Documents stay encrypted on this device only.</div>;
  if (status.inference && !status.inference.ok)
    return (
      <div className="bg-warn-soft px-4 py-2 text-center text-xs font-semibold text-warn">
        0G sealed inference unavailable, demo mode for chat: {status.inference.reason}. Storage on 0G {status.storage?.ok ? "is working" : "is also unavailable"}.
      </div>
    );
  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { company, loading, hasKey } = useVault();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/" aria-label="Kavach AI home">
            <Wordmark />
          </Link>
          <nav className="hidden gap-1 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={`rounded-lg px-3 py-2 text-sm font-semibold ${path.startsWith(n.href) ? "bg-brand-soft text-brand" : "text-ink-soft hover:bg-paper"}`}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="min-w-0 text-right">
            {loading ? <Spinner /> : company ? <p className="truncate text-sm font-semibold">{company.name}</p> : null}
            {company && !hasKey && <Badge tone="danger">key missing</Badge>}
          </div>
        </div>
        <StatusBanner />
      </header>
      <main className="pb-safe mx-auto max-w-5xl px-4 py-5 md:pb-10">{children}</main>
      {company && (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
          <div className="grid grid-cols-5">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${path.startsWith(n.href) ? "text-brand" : "text-muted"}`}>
                <Icon d={n.icon} />
                {n.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

/** Guards pages that need a company (and optionally a master key). */
export function RequireCompany({ children, needKey = true }: { children: ReactNode; needKey?: boolean }) {
  const { company, loading, hasKey, error } = useVault();
  if (loading) return <div className="flex justify-center py-20 text-brand"><Spinner /></div>;
  if (error) return <p className="text-danger">Could not open local vault: {error}</p>;
  if (!company)
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-semibold">No company on this device yet</p>
        <Link className="mt-3 inline-block font-semibold text-brand underline" href="/app">
          Set up your company
        </Link>
      </div>
    );
  if (needKey && !hasKey)
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-danger/30 bg-danger-soft p-5 text-center">
        <p className="text-lg font-semibold text-danger">This browser has no master key</p>
        <p className="mt-2 text-sm text-ink-soft">Your documents are still safe on 0G, but they can&apos;t be decrypted here until you restore the key with any 2 co-founder shares.</p>
        <Link className="mt-4 inline-block rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white" href="/app/keys">
          Recover with shares
        </Link>
      </div>
    );
  return <>{children}</>;
}
