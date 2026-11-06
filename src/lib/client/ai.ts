/**
 * Sealed inference, browser side.
 *
 * 1. Ask our server for a short-lived session token for the 0G TeeML provider
 *    (the server only signs a token; it never sees the question).
 * 2. Send the prompt (question + decrypted documents) DIRECTLY from this
 *    browser to the provider's TEE endpoint over TLS.
 * 3. Fetch the TEE's signature for this response from the provider and verify
 *    it here (EIP-191) against the TEE signer address recorded on-chain.
 */
import { verifyMessage } from "ethers";
import { ApiError, fetchWithTimeout, readError } from "./api";
import { demoAnswer } from "./demoEngine";

export interface ProviderInfo {
  provider: string;
  url: string;
  endpoint: string;
  model: string;
  verifiability: string;
  signingAddress: string;
  providerType: "decentralized" | "centralized";
  sealed: boolean;
  teeVerifier: string | null;
  imageDigest: string | null;
}

export interface SealedProof {
  mode: "sealed";
  provider: string;
  model: string;
  verifiability: string;
  teeVerifier: string | null;
  imageDigest: string | null;
  endpoint: string;
  chatId: string | null;
  /** true = signature verified in this browser; false = present but invalid; null = could not fetch */
  verified: boolean | null;
  verifyNote: string;
  signingAddress: string;
  signedText: string | null;
  signature: string | null;
  latencyMs: number;
  usage: { prompt_tokens?: number; completion_tokens?: number } | null;
  at: string;
}

export interface DemoProof {
  mode: "demo";
  verified: false;
  reason: string;
  at: string;
}

export type Proof = SealedProof | DemoProof;

export interface Answer {
  text: string;
  proof: Proof;
}

export interface ContextDoc {
  name: string;
  text: string;
}

const MAX_CONTEXT_CHARS = 60_000;

export function buildMessages(question: string, docs: ContextDoc[], history: { role: "user" | "assistant"; content: string }[] = []) {
  const per = Math.max(2_000, Math.floor(MAX_CONTEXT_CHARS / Math.max(1, docs.length)));
  const ctx = docs
    .map((d) => {
      const t = d.text.length > per ? `${d.text.slice(0, per)}\n[…truncated…]` : d.text;
      return `<document name="${d.name.replace(/"/g, "'")}">\n${t}\n</document>`;
    })
    .join("\n\n");
  const system =
    "You are Kavach, a private assistant for a small company. Answer using ONLY the documents provided. " +
    "Be concise and specific; quote numbers exactly and name the source document in brackets, e.g. [customers.csv]. " +
    "If the documents don't contain the answer, say so.";
  return [
    { role: "system", content: system },
    ...(docs.length ? [{ role: "user", content: `Company documents:\n\n${ctx}` }, { role: "assistant", content: "I have read the documents." }] : []),
    ...history.slice(-6),
    { role: "user", content: question },
  ];
}

/** Some open models (e.g. GLM) prepend <think>…</think> reasoning; show only the answer. */
export function stripReasoning(s: string): string {
  return s.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

export class SealedUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SealedUnavailable";
  }
}

async function getSession(): Promise<{ provider: ProviderInfo; authorization: string }> {
  const res = await fetchWithTimeout("/api/ai/session", { method: "POST" }, 30_000);
  if (!res.ok) {
    const err = await readError(res);
    throw new SealedUnavailable(err.message);
  }
  return res.json();
}

async function fetchSignature(provider: ProviderInfo, chatId: string): Promise<{ text: string; signature: string } | null> {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetchWithTimeout(`${provider.url}/v1/proxy/signature/${encodeURIComponent(chatId)}?model=${encodeURIComponent(provider.model)}`, {}, 15_000);
      if (r.ok) {
        const j = (await r.json()) as { text?: string; signature?: string };
        if (j.text && j.signature) return { text: j.text, signature: j.signature };
      }
    } catch {
      /* retry */
    }
    await new Promise((res) => setTimeout(res, 1000 * (i + 1)));
  }
  return null;
}

export async function askSealed(question: string, docs: ContextDoc[], history: { role: "user" | "assistant"; content: string }[] = []): Promise<Answer> {
  const { provider, authorization } = await getSession();
  if (!provider.sealed) throw new SealedUnavailable("Configured provider is not a sealed (TeeML, decentralized) provider; refusing to send documents.");
  const t0 = performance.now();
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${provider.endpoint}/chat/completions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authorization },
        body: JSON.stringify({ model: provider.model, messages: buildMessages(question, docs, history), temperature: 0.2 }),
      },
      120_000,
    );
  } catch (e) {
    throw new SealedUnavailable(`Could not reach the 0G TEE provider: ${(e as ApiError).message}`);
  }
  if (!res.ok) {
    const err = await readError(res);
    throw new SealedUnavailable(`0G provider returned ${res.status}: ${err.message.slice(0, 240)}`);
  }
  const data = (await res.json()) as { id?: string; choices?: { message?: { content?: string } }[]; usage?: SealedProof["usage"] };
  const latencyMs = Math.round(performance.now() - t0);
  const text = stripReasoning(data.choices?.[0]?.message?.content ?? "") || "(empty answer)";
  const chatId = res.headers.get("ZG-Res-Key") || data.id || null;
  let verified: boolean | null = null;
  let verifyNote = "No chat ID returned, so the response could not be verified.";
  let sig: { text: string; signature: string } | null = null;
  if (chatId) {
    sig = await fetchSignature(provider, chatId);
    if (!sig) {
      verifyNote = "The provider did not return a signature for this chat ID, so it is not verified.";
    } else {
      try {
        verified = verifyMessage(sig.text, sig.signature).toLowerCase() === provider.signingAddress.toLowerCase();
      } catch {
        verified = false;
      }
      verifyNote = verified
        ? "The TEE's signature over this response was checked in your browser and matches the TEE signer registered on-chain."
        : "A signature was returned but it does NOT match the on-chain TEE signer. Treat this answer as untrusted.";
    }
  }
  return {
    text,
    proof: {
      mode: "sealed",
      provider: provider.provider,
      model: provider.model,
      verifiability: provider.verifiability,
      teeVerifier: provider.teeVerifier,
      imageDigest: provider.imageDigest,
      endpoint: provider.endpoint,
      chatId,
      verified,
      verifyNote,
      signingAddress: provider.signingAddress,
      signedText: sig?.text ?? null,
      signature: sig?.signature ?? null,
      latencyMs,
      usage: data.usage ?? null,
      at: new Date().toISOString(),
    },
  };
}

/** Sealed inference first; if 0G is unavailable, a clearly labelled local demo answer. */
export async function ask(question: string, docs: ContextDoc[], history: { role: "user" | "assistant"; content: string }[] = []): Promise<Answer> {
  try {
    return await askSealed(question, docs, history);
  } catch (e) {
    if (!(e instanceof SealedUnavailable)) throw e;
    return {
      text: demoAnswer(question, docs),
      proof: { mode: "demo", verified: false, reason: e.message, at: new Date().toISOString() },
    };
  }
}
