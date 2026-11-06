"use client";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { RequireCompany } from "@/components/AppShell";
import { useVault } from "@/components/VaultProvider";
import { Badge, Button, Card, CopyButton, ErrorBox, Notice } from "@/components/ui";
import { createGrant, grantStatus, listGrants, revokeGrant, type Grant } from "@/lib/client/share";

const EXPIRY = [
  { label: "1 hour", ms: 3600_000 },
  { label: "1 day", ms: 86_400_000 },
  { label: "7 days", ms: 7 * 86_400_000 },
  { label: "30 days", ms: 30 * 86_400_000 },
];

export default function SharePage() {
  return (
    <RequireCompany>
      <Share />
    </RequireCompany>
  );
}

function Share() {
  const { docs, refresh } = useVault();
  const [grants, setGrants] = useState<Grant[]>([]);
  const [employee, setEmployee] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [ttl, setTtl] = useState(EXPIRY[1].ms);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<{ grant: Grant; qr: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setGrants(await listGrants());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    setError(null);
    setNotice(null);
    try {
      const g = await createGrant(employee, [...picked], ttl, window.location.origin, setProgress);
      setFresh({ grant: g, qr: await QRCode.toDataURL(g.link, { margin: 1, width: 220 }) });
      setEmployee("");
      setPicked(new Set());
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  async function onRevoke(g: Grant) {
    if (!confirm(`Revoke ${g.employee}'s access? Each shared document will be re-encrypted with a new key and re-uploaded to 0G.`)) return;
    setBusy(g.id);
    setError(null);
    try {
      const { failed } = await revokeGrant(g.id, setProgress);
      setNotice(
        failed.length
          ? `Revoked, but re-upload to 0G failed for: ${failed.join(", ")}. They are re-keyed locally; retry from the Vault.`
          : `Revoked. ${g.docNames.length} document(s) re-encrypted with new keys and stored on 0G as new versions.`,
      );
      await Promise.all([load(), refresh()]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  const shareable = docs.filter((d) => d.storage === "0g");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Share with an employee</h1>
        <p className="text-sm text-muted">Give someone read access to selected documents through a private link that expires. The decryption key lives in the link itself (after the #), which browsers never send to servers.</p>
      </div>

      <Card>
        <form onSubmit={onCreate} className="space-y-3">
          <div>
            <label htmlFor="emp" className="text-sm font-semibold">Employee</label>
            <input id="emp" value={employee} onChange={(e) => setEmployee(e.target.value)} placeholder="e.g. Priya, sales" className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-base" />
          </div>
          <div>
            <p className="text-sm font-semibold">Documents</p>
            {shareable.length === 0 ? (
              <p className="mt-1 text-sm text-muted">No documents on 0G yet.</p>
            ) : (
              <div className="mt-1 space-y-1">
                {shareable.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={picked.has(d.id)}
                      onChange={(e) =>
                        setPicked((s) => {
                          const n = new Set(s);
                          if (e.target.checked) n.add(d.id);
                          else n.delete(d.id);
                          return n;
                        })
                      }
                    />
                    <span className="truncate">{d.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold">Expires after</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {EXPIRY.map((x) => (
                <button type="button" key={x.label} onClick={() => setTtl(x.ms)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${ttl === x.ms ? "border-brand bg-brand-soft text-brand" : "border-line text-muted"}`}>
                  {x.label}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full sm:w-auto" busy={busy === "create"} disabled={!employee.trim() || picked.size === 0}>
            Create private link
          </Button>
          {progress && <p className="text-sm text-brand">{progress}</p>}
        </form>
      </Card>

      <ErrorBox error={error} />
      {notice && <Notice tone="seal">{notice}</Notice>}

      {fresh && (
        <Card className="border-seal/40">
          <p className="font-semibold">Link for {fresh.grant.employee}</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fresh.qr} alt="QR code of the share link" className="mx-auto h-36 w-36 rounded-lg border border-line sm:mx-0" />
            <div className="min-w-0 flex-1">
              <p className="mono break-all rounded-lg bg-paper p-2 text-[11px]">{fresh.grant.link}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <CopyButton text={fresh.grant.link} label="Copy link" />
                <a href={fresh.grant.link} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-2 py-1 text-xs font-semibold text-brand">Open as employee ↗</a>
              </div>
              <p className="mt-2 text-xs text-muted">Send it over a private channel. Anyone with this link can read these documents until {new Date(fresh.grant.expiresAt).toLocaleString()}.</p>
            </div>
          </div>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold">Access links</h2>
        {grants.length === 0 ? (
          <p className="mt-2 text-sm text-muted">None yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {grants.map((g) => {
              const st = grantStatus(g);
              return (
                <li key={g.id}>
                  <Card className="!p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold">{g.employee}</p>
                        <p className="text-xs text-muted">{g.docNames.join(", ")}</p>
                        <p className="text-xs text-muted">
                          {st === "revoked" ? `Revoked ${new Date(g.revokedAt!).toLocaleString()}` : `Expires ${new Date(g.expiresAt).toLocaleString()}`}
                        </p>
                      </div>
                      <Badge tone={st === "active" ? "seal" : st === "expired" ? "muted" : "danger"}>{st}</Badge>
                    </div>
                    {st !== "revoked" && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <CopyButton text={g.link} label="Copy link" />
                        <Button variant="danger" className="!min-h-8 !px-3 !py-1 text-xs" busy={busy === g.id} onClick={() => onRevoke(g)}>
                          Revoke &amp; re-key
                        </Button>
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Notice tone="warn" title="What revoking can and can't do">
        Revoking re-encrypts each shared document with a brand-new key and stores the new version on 0G, so the vault and future shares use a version the old link can&apos;t open. It cannot erase what the employee already viewed, copied or saved. Because 0G storage is immutable, the old encrypted version still exists and the old link can still open that old version. Expiry is enforced by the Kavach viewer, not by cryptography.
      </Notice>
    </div>
  );
}
