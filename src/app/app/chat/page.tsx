"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { RequireCompany } from "@/components/AppShell";
import { useVault } from "@/components/VaultProvider";
import { ProofBadge, proofSummary } from "@/components/ProofBadge";
import { Badge, Button, Card, ErrorBox, Notice, Spinner } from "@/components/ui";
import { ask, type Answer } from "@/lib/client/ai";
import { addDocument, openDocument } from "@/lib/client/vault";
import { DEMO_QUESTIONS } from "@/lib/demo/brewline";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  answer?: Answer;
  question?: string;
  saved?: "saving" | "saved" | string;
}

export default function ChatPage() {
  return (
    <RequireCompany>
      <Chat />
    </RequireCompany>
  );
}

function Chat() {
  const { docs, refresh, company } = useVault();
  const sources = useMemo(() => docs.filter((d) => d.kind === "document"), [docs]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(sources.map((d) => d.id)));
  const [q, setQ] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function send(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    setError(null);
    setQ("");
    const history = msgs.map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "user", content: text }]);
    try {
      setBusy("Decrypting selected documents in your browser…");
      const chosen = sources.filter((d) => selected.has(d.id));
      const ctx = await Promise.all(chosen.map(async (d) => ({ name: d.name, text: (await openDocument(d)).text })));
      setBusy("Sending directly from your browser to 0G sealed inference (TEE)…");
      const answer = await ask(text, ctx, history);
      setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: answer.text, answer, question: text }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function save(msg: Msg) {
    if (!msg.answer) return;
    setMsgs((m) => m.map((x) => (x.id === msg.id ? { ...x, saved: "saving" } : x)));
    try {
      const title = (msg.question ?? "Answer").slice(0, 60);
      const rec = await addDocument({
        name: `Note: ${title}${(msg.question ?? "").length > 60 ? "…" : ""}`,
        mime: "text/markdown",
        kind: "note",
        text: msg.content,
        meta: { question: msg.question ?? "", proof: proofSummary(msg.answer.proof) },
      });
      await refresh();
      setMsgs((m) => m.map((x) => (x.id === msg.id ? { ...x, saved: rec.storage === "0g" ? "saved" : `saved on this device only (0G upload failed: ${rec.uploadError})` } : x)));
    } catch (e) {
      setMsgs((m) => m.map((x) => (x.id === msg.id ? { ...x, saved: `Save failed: ${(e as Error).message}` } : x)));
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Chat</h1>
        <p className="text-sm text-muted">Chats are not saved anywhere. Reloading this page clears the conversation. Use “Save to vault” to keep an answer as an encrypted note.</p>
      </div>

      <Card className="!p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Documents the AI may read ({selected.size}/{sources.length})</p>
        {sources.length === 0 ? (
          <p className="text-sm text-muted">No documents in the vault yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sources.map((d) => (
              <button
                key={d.id}
                onClick={() => toggle(d.id)}
                className={`max-w-full truncate rounded-full border px-3 py-1.5 text-xs font-semibold ${selected.has(d.id) ? "border-brand bg-brand-soft text-brand" : "border-line text-muted"}`}
              >
                {selected.has(d.id) ? "✓ " : ""}
                {d.name}
              </button>
            ))}
          </div>
        )}
      </Card>

      <div className="space-y-3">
        {msgs.length === 0 && (
          <Card>
            <p className="text-sm font-semibold">Try a question</p>
            <div className="mt-2 flex flex-col gap-2">
              {(company?.demo ? DEMO_QUESTIONS : ["Summarise the key obligations in these documents.", "What numbers should I double-check?"]).map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-xl border border-line px-3 py-2 text-left text-sm hover:border-brand/50">
                  {s}
                </button>
              ))}
            </div>
          </Card>
        )}
        {msgs.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-brand px-4 py-2 text-sm text-white">{m.content}</p>
            </div>
          ) : (
            <div key={m.id} className="max-w-[95%] rounded-2xl rounded-bl-sm border border-line bg-card px-4 py-3">
              <p className={`whitespace-pre-wrap text-sm leading-relaxed ${m.answer?.proof.mode === "demo" ? "text-ink-soft" : ""}`}>{m.content}</p>
              {m.answer && <ProofBadge proof={m.answer.proof} />}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {!m.saved && (
                  <Button variant="secondary" className="!min-h-9 !px-3 !py-1" onClick={() => save(m)}>
                    Save to vault
                  </Button>
                )}
                {m.saved === "saving" && <Badge tone="brand"><Spinner /> encrypting &amp; saving…</Badge>}
                {m.saved === "saved" && <Badge tone="seal">✓ saved to vault as an encrypted note on 0G</Badge>}
                {m.saved && m.saved !== "saving" && m.saved !== "saved" && <Badge tone="warn">{m.saved}</Badge>}
              </div>
            </div>
          ),
        )}
        {busy && (
          <p className="flex items-center gap-2 text-sm text-brand">
            <Spinner /> {busy}
          </p>
        )}
        <ErrorBox error={error} />
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(q);
        }}
        className="sticky bottom-20 flex gap-2 rounded-2xl border border-line bg-card p-2 shadow-lg md:bottom-4"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask about your documents…"
          className="min-w-0 flex-1 rounded-xl px-3 py-2 text-base outline-none"
          aria-label="Question"
        />
        <Button type="submit" disabled={!q.trim()} busy={!!busy}>
          Ask
        </Button>
      </form>
      {selected.size === 0 && sources.length > 0 && <Notice tone="warn">No documents selected. The AI will answer without any company context.</Notice>}
    </div>
  );
}
