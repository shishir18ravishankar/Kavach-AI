"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { RequireCompany } from "@/components/AppShell";
import { useVault } from "@/components/VaultProvider";
import { Badge, Button, Card, CopyButton, ErrorBox, Notice } from "@/components/ui";
import { combineShares, encodeShare, parseShare, shareIndex, splitSecret } from "@/lib/crypto/shamir";
import { checkMasterKey, forgetMasterKey, getMasterKey, installRecoveredKey, saveCompany } from "@/lib/client/vault";
import { DEMO_COFOUNDERS } from "@/lib/demo/brewline";

export default function KeysPage() {
  return (
    <RequireCompany needKey={false}>
      <Keys />
    </RequireCompany>
  );
}

function Keys() {
  const { hasKey } = useVault();
  const [recovered, setRecovered] = useState(false);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Keys &amp; recovery</h1>
        <p className="text-sm text-muted">
          Your master key unlocks every document. It lives only in this browser. Split it into 3 co-founder shares: any 2 can restore it, 1 alone reveals nothing.
        </p>
      </div>
      {recovered && hasKey && (
        <Notice tone="seal" title="Access restored">
          The master key was rebuilt from 2 shares and checked against this company. All documents can be decrypted again.
        </Notice>
      )}
      {hasKey ? (
        <>
          <Ceremony />
          <LoseKey />
        </>
      ) : (
        <Recover onRecovered={() => setRecovered(true)} />
      )}
    </div>
  );
}

interface ShareCard {
  holder: string;
  text: string;
  qr: string;
  saved: boolean;
}

function Ceremony() {
  const { company, refresh } = useVault();
  const [holders, setHolders] = useState<string[]>(() => (company?.ceremony.holders.length ? company.ceremony.holders : company?.demo ? DEMO_COFOUNDERS : ["Co-founder 1", "Co-founder 2", "Co-founder 3"]));
  const [cards, setCards] = useState<ShareCard[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testA, setTestA] = useState("");
  const [testB, setTestB] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);

  if (!company) return null;

  async function onSplit() {
    setBusy(true);
    setError(null);
    setTestResult(null);
    try {
      const master = await getMasterKey();
      if (!master) throw new Error("No master key in this browser");
      const shares = await splitSecret(master, 3, 2);
      const out: ShareCard[] = [];
      for (let i = 0; i < 3; i++) {
        const text = await encodeShare(shares[i], company!.tag, 2, 3);
        out.push({ holder: holders[i] || `Co-founder ${i + 1}`, text, qr: await QRCode.toDataURL(text, { margin: 1, width: 240, errorCorrectionLevel: "M" }), saved: false });
      }
      setCards(out);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onTest() {
    setTestResult(null);
    try {
      const [a, b] = await Promise.all([parseShare(testA), parseShare(testB)]);
      if (shareIndex(a.bytes) === shareIndex(b.bytes)) throw new Error("Those are the same share. Use two different co-founders' shares.");
      const key = await combineShares([a.bytes, b.bytes]);
      setTestResult((await checkMasterKey(key)) ? "ok" : "These shares do not recover this company's key.");
    } catch (e) {
      setTestResult((e as Error).message);
    }
  }

  async function onConfirm() {
    await saveCompany({ ...company!, ceremony: { done: true, at: new Date().toISOString(), threshold: 2, total: 3, holders: cards!.map((c) => c.holder) } });
    await refresh();
    setCards(null);
  }

  function download(c: ShareCard, i: number) {
    const body = `KAVACH AI RECOVERY SHARE ${i + 1} of 3 (any 2 recover the vault)\nCompany: ${company!.name}\nHolder: ${c.holder}\nCreated: ${new Date().toISOString()}\n\n${c.text}\n\nKeep this private. Anyone with 2 shares can decrypt ${company!.name}'s vault.\n`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    a.download = `kavach-share-${i + 1}-${c.holder.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const allSaved = cards?.every((c) => c.saved) ?? false;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-lg font-semibold">Co-founder key ceremony</p>
        {company.ceremony.done ? <Badge tone="seal">✓ done {company.ceremony.at ? new Date(company.ceremony.at).toLocaleDateString() : ""}</Badge> : <Badge tone="warn">not done yet</Badge>}
      </div>
      {company.ceremony.done && !cards && (
        <p className="mt-2 text-sm text-ink-soft">Shares are held by {company.ceremony.holders.join(", ")}. You can run the ceremony again to issue a fresh set; old shares keep working because the master key is unchanged.</p>
      )}
      {!cards && (
        <div className="mt-3 space-y-2">
          {holders.map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs font-semibold text-muted">Share {i + 1}</span>
              <input
                value={h}
                onChange={(e) => setHolders((hs) => hs.map((x, j) => (j === i ? e.target.value : x)))}
                className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-base"
                aria-label={`Holder of share ${i + 1}`}
              />
            </div>
          ))}
          <Button onClick={onSplit} busy={busy} className="mt-2 w-full sm:w-auto">
            Split master key into 3 shares
          </Button>
        </div>
      )}
      <ErrorBox error={error} />
      {cards && (
        <div className="mt-4 space-y-3">
          <Notice tone="warn" title="Hand each share to a different person">
            Shares are shown once and are not stored by Kavach. Copy, download or photograph each QR code now. Never keep two shares in the same place.
          </Notice>
          {cards.map((c, i) => (
            <div key={i} className="rounded-2xl border border-line p-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.qr} alt={`QR code for share ${i + 1}`} className="mx-auto h-40 w-40 rounded-lg border border-line sm:mx-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    Share {i + 1} · {c.holder}
                  </p>
                  <p className="mono mt-1 break-all rounded-lg bg-paper p-2 text-[11px]">{c.text}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <CopyButton text={c.text} />
                    <button className="rounded-lg border border-line px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-soft" onClick={() => download(c, i)}>
                      Download .txt
                    </button>
                    <label className="flex items-center gap-1.5 text-sm font-medium">
                      <input type="checkbox" className="h-4 w-4" checked={c.saved} onChange={(e) => setCards((cs) => cs!.map((x, j) => (j === i ? { ...x, saved: e.target.checked } : x)))} />
                      {c.holder.split(" ")[0]} saved it
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div className="rounded-2xl bg-paper p-3">
            <p className="text-sm font-semibold">Optional: prove 2 shares work before finishing</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input value={testA} onChange={(e) => setTestA(e.target.value)} placeholder="Paste a share" className="mono rounded-xl border border-line px-3 py-2 text-xs" />
              <input value={testB} onChange={(e) => setTestB(e.target.value)} placeholder="Paste a different share" className="mono rounded-xl border border-line px-3 py-2 text-xs" />
            </div>
            <Button variant="secondary" className="mt-2" onClick={onTest} disabled={!testA || !testB}>
              Test recovery
            </Button>
            {testResult === "ok" && <p className="mt-2 text-sm font-semibold text-seal">✓ These 2 shares recover this company&apos;s master key.</p>}
            {testResult && testResult !== "ok" && <p className="mt-2 text-sm font-semibold text-danger">{testResult}</p>}
          </div>
          <Button className="w-full" disabled={!allSaved} onClick={onConfirm}>
            {allSaved ? "Confirm: all 3 shares are saved" : "Tick all 3 “saved it” boxes to finish"}
          </Button>
        </div>
      )}
    </Card>
  );
}

function LoseKey() {
  const { company, refresh } = useVault();
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  if (!company) return null;
  const ready = company.ceremony.done;
  return (
    <Card>
      <p className="text-lg font-semibold">“I lost my key”</p>
      <p className="mt-1 text-sm text-ink-soft">
        Simulates a lost laptop: deletes the master key from this browser. The encrypted documents on 0G and the encrypted vault index stay, but nothing can be decrypted until 2 co-founders bring their shares.
      </p>
      {!ready && <Notice tone="danger" title="Do the key ceremony first">Without shares, losing the key makes every document permanently unreadable.</Notice>}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={ready ? "Type FORGET to confirm" : "Type DESTROY to confirm anyway"}
          className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-base"
        />
        <Button
          variant="danger"
          busy={busy}
          disabled={confirmText !== (ready ? "FORGET" : "DESTROY")}
          onClick={async () => {
            setBusy(true);
            await forgetMasterKey();
            await refresh();
            setBusy(false);
          }}
        >
          Delete key from this browser
        </Button>
      </div>
    </Card>
  );
}

function Recover({ onRecovered }: { onRecovered: () => void }) {
  const { company, refresh } = useVault();
  const [inputs, setInputs] = useState(["", ""]);
  const [info, setInfo] = useState<(string | null)[]>([null, null]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all(
      inputs.map(async (t) => {
        if (!t.trim()) return null;
        try {
          const p = await parseShare(t);
          return p.companyTag === company?.tag ? `✓ valid share #${shareIndex(p.bytes)} for ${company.name}` : `⚠ share is for a different company (${p.companyTag})`;
        } catch (e) {
          return `✕ ${(e as Error).message}`;
        }
      }),
    ).then((r) => alive && setInfo(r));
    return () => {
      alive = false;
    };
  }, [inputs, company]);

  async function onRecover() {
    setBusy(true);
    setError(null);
    try {
      const parsed = await Promise.all(inputs.filter((t) => t.trim()).map(parseShare));
      if (parsed.length < 2) throw new Error("Enter at least 2 shares");
      if (new Set(parsed.map((p) => shareIndex(p.bytes))).size < parsed.length) throw new Error("Two of these are the same share. You need shares from 2 different co-founders.");
      const key = await combineShares(parsed.map((p) => p.bytes));
      const ok = await installRecoveredKey(key);
      if (!ok) throw new Error("These shares don't recover this company's master key. Check you have the right shares.");
      onRecovered();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <p className="text-lg font-semibold">Recover with any 2 co-founder shares</p>
      <p className="mt-1 text-sm text-ink-soft">Paste shares (or the text from a scanned QR). They are combined here in your browser; shares are never sent to any server.</p>
      <div className="mt-3 space-y-3">
        {inputs.map((v, i) => (
          <div key={i}>
            <textarea
              value={v}
              onChange={(e) => setInputs((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))}
              rows={2}
              placeholder={`Share ${i + 1} (kavach1-…)`}
              className="mono w-full rounded-xl border border-line px-3 py-2 text-xs"
            />
            {info[i] && <p className={`mt-1 text-xs font-semibold ${info[i]!.startsWith("✓") ? "text-seal" : "text-danger"}`}>{info[i]}</p>}
          </div>
        ))}
        {inputs.length < 3 && (
          <button className="text-xs font-semibold text-brand" onClick={() => setInputs((x) => [...x, ""])}>
            + add a third share
          </button>
        )}
      </div>
      <Button className="mt-3 w-full" onClick={onRecover} busy={busy} disabled={inputs.filter((t) => t.trim()).length < 2}>
        Restore master key
      </Button>
      <ErrorBox error={error} />
    </Card>
  );
}
