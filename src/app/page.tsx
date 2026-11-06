import Link from "next/link";
import { ShieldMark, Wordmark } from "@/components/Logo";

const STEPS = [
  {
    title: "Encrypted on your device",
    body: "Each document gets its own random AES-256 key, created in your browser. Files are encrypted before they leave your laptop or phone.",
  },
  {
    title: "Stored on 0G, unreadable",
    body: "Only ciphertext is uploaded to 0G's decentralised storage network. Storage nodes, and we, see random bytes and a hash.",
  },
  {
    title: "Answered by sealed AI",
    body: "Your browser sends questions straight to an open model running inside a hardware TEE on 0G Compute. Every answer carries a signature you can check.",
  },
  {
    title: "Co-founders hold the key",
    body: "The master key is split into 3 shares. Any 2 co-founders can recover the vault, and no single person or server can.",
  },
];

const WHO = [
  ["Kavach (us)", "Ciphertext and metadata only. We never receive your keys, documents, questions or answers."],
  ["0G Storage nodes", "Encrypted blobs addressed by Merkle root hash."],
  ["AI provider host", "The model runs inside a Trusted Execution Environment, so the machine's operator can't read prompts. You trust the chip maker (Intel / NVIDIA) and the attestation."],
  ["Your company", "Everything, using the master key in your browser or 2 of 3 co-founder shares."],
];

export default function Landing() {
  return (
    <div className="min-h-dvh bg-card">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Wordmark />
        <Link href="/app" className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong">
          Open app
        </Link>
      </header>

      <section className="mx-auto max-w-5xl px-4 pb-12 pt-6 sm:pt-12">
        <div className="grid items-center gap-10 md:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand">Private AI for small teams</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Ask AI about your company&apos;s secrets, <span className="text-brand">without handing them over.</span>
            </h1>
            <p className="mt-4 text-lg text-ink-soft">
              Startups paste customer lists, pricing and contracts into AI chatbots every day. That data then sits on someone else&apos;s servers, readable by staff, logs and future training runs.
              Kavach is a vault and an AI assistant where <b>nobody but your company can read your documents</b>: not us, not the storage network, not the AI provider.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/app" className="rounded-xl bg-brand px-5 py-3 font-semibold text-white hover:bg-brand-strong">
                Try the demo company
              </Link>
              <a href="#how" className="rounded-xl border border-line px-5 py-3 font-semibold text-ink hover:border-brand/40">
                How it works
              </a>
            </div>
          </div>
          <div className="mx-auto flex aspect-square w-56 items-center justify-center rounded-[2.5rem] bg-ink shadow-2xl sm:w-72">
            <ShieldMark className="h-40 w-40 sm:h-52 sm:w-52" />
          </div>
        </div>
      </section>

      <section id="how" className="bg-paper py-12">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-2xl font-bold">The promise, in four steps</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-2xl border border-line bg-card p-5">
                <p className="text-sm font-bold text-brand">0{i + 1}</p>
                <p className="mt-1 text-lg font-semibold">{s.title}</p>
                <p className="mt-2 text-sm text-ink-soft">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-2xl font-bold">Who can see what</h2>
          <div className="mt-6 overflow-hidden rounded-2xl border border-line">
            {WHO.map(([who, what], i) => (
              <div key={who} className={`grid gap-1 p-4 sm:grid-cols-[12rem_1fr] ${i ? "border-t border-line" : ""}`}>
                <p className="font-semibold">{who}</p>
                <p className="text-sm text-ink-soft">{what}</p>
              </div>
            ))}
          </div>
          <h2 className="mt-12 text-2xl font-bold">Honest limits</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-ink-soft">
            <li>Sealed inference trusts TEE hardware (Intel TDX, NVIDIA confidential computing) and its attestation. A flaw in the chip would break that guarantee.</li>
            <li>Your browser holds the master key. Malware on your device, or a malicious update to this web app, could read it. That&apos;s true of any web app.</li>
            <li>Chats are not stored, but an answer you have seen can be copied by whoever saw it. Revoking access re-encrypts documents; it cannot erase what someone already read.</li>
            <li>This hackathon build runs on the 0G Galileo testnet. When the sealed provider is unreachable, the app says so and switches to a clearly labelled demo mode.</li>
          </ul>
          <div className="mt-10 rounded-2xl bg-ink p-6 text-white sm:p-8">
            <p className="text-xl font-bold">See it with a fictional coffee company</p>
            <p className="mt-2 text-sm text-white/80">Load “Brewline Coffee Co.”, ask about customer renewals and supplier penalties, then open the Proof screen to see the raw ciphertext on 0G.</p>
            <Link href="/app" className="mt-4 inline-block rounded-xl bg-white px-5 py-3 font-semibold text-ink">
              Open Kavach
            </Link>
          </div>
        </div>
      </section>
      <footer className="border-t border-line py-6 text-center text-xs text-muted">Kavach AI · ETHGlobal Mumbai · built on 0G Storage and 0G Compute (Galileo testnet)</footer>
    </div>
  );
}
