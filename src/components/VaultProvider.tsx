"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getCompany, getMasterKey, listDocs } from "@/lib/client/vault";
import type { Company, DocRecord } from "@/lib/client/types";

export interface ZgStatus {
  configured: boolean;
  storage?: { ok: boolean; wallet?: string; balance0G?: string; reason?: string };
  inference?: { ok: boolean; reason?: string | null; provider?: { provider: string; model: string; verifiability: string; sealed: boolean }; account?: { balance0G: string } };
}

interface VaultState {
  loading: boolean;
  error: string | null;
  company: Company | null;
  hasKey: boolean;
  docs: DocRecord[];
  status: ZgStatus | null;
  statusError: string | null;
  refresh: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const Ctx = createContext<VaultState | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [status, setStatus] = useState<ZgStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [c, k, d] = await Promise.all([getCompany(), getMasterKey(), listDocs()]);
      setCompany(c);
      setHasKey(!!k);
      setDocs(d);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/status", { cache: "no-store" });
      if (!r.ok) throw new Error(`status ${r.status}`);
      setStatus((await r.json()) as ZgStatus);
      setStatusError(null);
    } catch (e) {
      setStatusError(`Could not reach the Kavach server: ${(e as Error).message}`);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load from IndexedDB
    void refresh();
    void refreshStatus();
  }, [refresh, refreshStatus]);

  return <Ctx.Provider value={{ loading, error, company, hasKey, docs, status, statusError, refresh, refreshStatus }}>{children}</Ctx.Provider>;
}

export function useVault(): VaultState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useVault must be used inside VaultProvider");
  return v;
}
