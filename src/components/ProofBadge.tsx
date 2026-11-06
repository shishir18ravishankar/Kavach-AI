"use client";
import { useState } from "react";
import type { Proof } from "@/lib/client/ai";
import { Badge, CopyButton, short } from "./ui";

const EXPLORER = "https://chainscan-galileo.0g.ai/address/";

export function proofSummary(p: Proof): string {
  if (p.mode === "demo") return `DEMO MODE (not AI, not verified) at ${p.at}`;
  return `0G sealed inference · ${p.model} · provider ${p.provider} · chat ${p.chatId ?? "n/a"} · signature ${p.verified === true ? "verified" : p.verified === false ? "INVALID" : "not verified"} · ${p.at}`;
}

function Row({ k, v, copy, href }: { k: string; v: string; copy?: boolean; href?: string }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 py-1">
      <dt className="text-muted">{k}</dt>
      <dd className="mono flex min-w-0 items-start gap-2 break-all">
        {href ? (
          <a className="text-brand underline" href={href} target="_blank" rel="noreferrer">
            {v}
          </a>
        ) : (
          <span>{v}</span>
        )}
        {copy && <CopyButton text={v} />}
      </dd>
    </div>
  );
}

export function ProofBadge({ proof }: { proof: Proof }) {
  const [open, setOpen] = useState(false);
  let badge;
  if (proof.mode === "demo") badge = <Badge tone="warn">⚠ Demo mode · not verified</Badge>;
  else if (proof.verified === true) badge = <Badge tone="seal">🛡 Sealed in TEE · signature verified</Badge>;
  else if (proof.verified === false) badge = <Badge tone="danger">✕ Signature invalid</Badge>;
  else badge = <Badge tone="warn">🛡 Sealed in TEE · signature not verified</Badge>;

  return (
    <div className="mt-2">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-left" aria-expanded={open}>
        {badge}
        <span className="text-xs font-semibold text-brand">{open ? "Hide proof" : "Show proof"}</span>
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-line bg-paper p-3 text-xs">
          {proof.mode === "demo" ? (
            <>
              <p className="font-semibold text-warn">This answer was NOT produced by an AI model and has no proof.</p>
              <p className="mt-1 text-ink-soft">
                0G sealed inference was unavailable, so Kavach fell back to a local keyword search over the documents you decrypted in this browser. Nothing was sent anywhere.
              </p>
              <dl className="mt-2">
                <Row k="Why" v={proof.reason} />
                <Row k="Time" v={proof.at} />
              </dl>
            </>
          ) : (
            <>
              <p className="text-ink-soft">
                Your browser sent this prompt <b>directly</b> to a 0G Compute provider whose model runs inside a TEE ({proof.verifiability}, {proof.teeVerifier ?? "TEE"}). The Kavach server only issued a short-lived access token and never saw the prompt or answer.
              </p>
              <p className={`mt-1 font-semibold ${proof.verified ? "text-seal" : "text-warn"}`}>{proof.verifyNote}</p>
              <dl className="mt-2 divide-y divide-line">
                <Row k="Model" v={proof.model} />
                <Row k="Provider" v={proof.provider} href={`${EXPLORER}${proof.provider}`} />
                <Row k="Request / chat ID" v={proof.chatId ?? "none"} copy={!!proof.chatId} />
                <Row k="TEE signer" v={proof.signingAddress} href={`${EXPLORER}${proof.signingAddress}`} />
                {proof.signature && <Row k="Signature" v={short(proof.signature, 18)} />}
                {proof.signedText && <Row k="Signed text" v={proof.signedText.length > 300 ? proof.signedText.slice(0, 300) + "…" : proof.signedText} />}
                {proof.imageDigest && <Row k="Image digest" v={proof.imageDigest} />}
                <Row k="Endpoint" v={proof.endpoint} />
                <Row k="Latency" v={`${proof.latencyMs} ms`} />
                {proof.usage && <Row k="Tokens" v={`${proof.usage.prompt_tokens ?? "?"} in / ${proof.usage.completion_tokens ?? "?"} out`} />}
                <Row k="Time" v={proof.at} />
              </dl>
              <p className="mt-2 text-muted">
                Trust note: the TEE guarantee relies on Intel TDX / GPU TEE hardware and the provider&apos;s dstack attestation. Kavach checks the response signature against the signer registered on-chain; it does not re-verify the hardware quote in your browser.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
