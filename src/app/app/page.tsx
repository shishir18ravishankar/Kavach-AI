"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/components/VaultProvider";
import { Button, Card, ErrorBox, LinkButton, Notice, Spinner } from "@/components/ui";
import { addDocument, createCompany, resetEverything } from "@/lib/client/vault";
import { DEMO_COMPANY_NAME, DEMO_DOCS } from "@/lib/demo/brewline";

export default function SetupPage() {
  const router = useRouter();
  const { company, loading, refresh, docs } = useVault();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<"create" | "demo" | "reset" | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const log = (s: string) => setSteps((p) => [...p, s]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    setError(null);
    try {
      await createCompany(name);
      await refresh();
      router.push("/app/vault");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onDemo() {
    setBusy("demo");
    setError(null);
    setSteps([]);
    try {
      log("Generating a random 256-bit master key in this browser…");
      await createCompany(DEMO_COMPANY_NAME, true);
      await refresh();
      let failed = 0;
      for (const d of DEMO_DOCS) {
        log(`${d.name}: encrypting on this device, then uploading ciphertext to 0G…`);
        const rec = await addDocument(d);
        if (rec.storage === "0g") log(`✓ ${d.name} stored on 0G · root ${rec.rootHash?.slice(0, 12)}…`);
        else {
          failed++;
          log(`⚠ ${d.name} kept encrypted on this device only (0G upload failed: ${rec.uploadError})`);
        }
        await refresh();
      }
      log(failed ? "Done, with some documents local-only. You can retry uploads from the Vault." : "Done. All demo documents are encrypted and on 0G.");
      router.push("/app/vault");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onReset() {
    if (!confirm("Delete this company, its master key and the vault index from THIS browser? Without recovery shares, the documents on 0G become permanently unreadable.")) return;
    setBusy("reset");
    try {
      await resetEverything();
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="flex justify-center py-20 text-brand"><Spinner /></div>;

  if (company && busy !== "demo") {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Card>
          <h1 className="text-xl font-bold">{company.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {docs.length} item{docs.length === 1 ? "" : "s"} in the vault · created {new Date(company.createdAt).toLocaleDateString()}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <LinkButton href="/app/vault">Open vault</LinkButton>
            <LinkButton href="/app/chat" variant="secondary">Ask the AI</LinkButton>
          </div>
        </Card>
        {!company.ceremony.done && (
          <Notice tone="warn" title="Do the co-founder key ceremony">
            Right now the master key exists only in this browser. Split it into 3 shares so any 2 co-founders can recover it. <a className="font-semibold underline" href="/app/keys">Go to Keys →</a>
          </Notice>
        )}
        <Card>
          <p className="text-sm font-semibold">Start over on this device</p>
          <p className="mt-1 text-xs text-muted">Deletes the local vault index and master key. Useful to re-run the demo.</p>
          <Button variant="danger" className="mt-3" onClick={onReset} busy={busy === "reset"}>
            Reset this device
          </Button>
          <ErrorBox error={error} />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Set up your private vault</h1>
        <p className="mt-1 text-sm text-ink-soft">A random master key is generated in this browser. It never leaves your device unless you split it into co-founder recovery shares.</p>
      </div>
      <Card>
        <form onSubmit={onCreate} className="space-y-3">
          <label className="block text-sm font-semibold" htmlFor="cname">
            Company name
          </label>
          <input
            id="cname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Robotics"
            maxLength={60}
            className="w-full rounded-xl border border-line px-3 py-2.5 text-base outline-none focus:border-brand"
          />
          <Button type="submit" className="w-full" disabled={!name.trim() || !!busy} busy={busy === "create"}>
            Create company &amp; generate master key
          </Button>
        </form>
      </Card>
      <div className="text-center text-xs font-semibold uppercase tracking-wide text-muted">or</div>
      <Card>
        <p className="font-semibold">Load demo company</p>
        <p className="mt-1 text-sm text-muted">
          <b>{DEMO_COMPANY_NAME}</b>: a fictional customer list (CSV), wholesale price sheet and supplier contract. Each is encrypted here and uploaded to 0G (≈10–30 s each).
        </p>
        <Button variant="secondary" className="mt-3 w-full" onClick={onDemo} disabled={!!busy} busy={busy === "demo"}>
          Load {DEMO_COMPANY_NAME}
        </Button>
        {steps.length > 0 && (
          <ol className="mono mt-3 space-y-1 rounded-xl bg-paper p-3 text-xs text-ink-soft">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        )}
      </Card>
      <ErrorBox error={error} />
    </div>
  );
}
