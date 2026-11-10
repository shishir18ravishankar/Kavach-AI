# Kavach AI: Final Report

*Written at the end of the autonomous build session, 2026-11-06. Everything marked ✅ was run against the real 0G Galileo testnet and a production build in a headless phone-sized browser, not just unit-tested.*

## 1. What works

| Feature | State | How it was verified |
|---|---|---|
| Browser encryption (AES-256-GCM, per-document keys wrapped by a master key, ID bound as AAD) | ✅ | 26 Vitest tests (round-trip, wrong key, wrong context, tampering, wrapping) |
| Upload ciphertext to 0G Storage; server rejects non-ciphertext | ✅ | `npm run check:0g`; demo load stored 3 docs with real root hashes + txs |
| Download from 0G (Merkle-proof verified) and decrypt in browser | ✅ | Proof screen: SHA-256 of bytes fetched from 0G matches the upload |
| Vault: upload .txt/.md/.csv/PDF (≤1 MB), list, open, remove, retry failed uploads | ✅ | E2E, including a generated PDF uploaded, extracted in-browser, stored on 0G and reopened |
| Load demo company (Brewline Coffee Co., fictional CSV, price sheet, contract) | ✅ | E2E |
| Chat: pick docs, ask, answer, proof badge, Save to vault (encrypted note on 0G), chat clears on reload | ✅ in **demo mode** · ⚠️ sealed path not yet live (see §2) | E2E |
| Proof screen: hex ciphertext, root hash, explorer link, decrypt locally, metadata-only server log, "search the log for a word" | ✅ | E2E ("Saffron" not found in server log) |
| Landing page | ✅ | screenshot review at iPhone 13 size |
| Tier 2: split master key into 3 Shamir shares (text + QR + .txt), confirm saved, test-recover | ✅ | E2E + unit tests (any 2 of 3 recover, 1 share fails, duplicate share fails) |
| Tier 2: "I lost my key" → vault locked → any 2 shares restore → documents decrypt | ✅ | E2E |
| Tier 3: expiring employee link (key in URL fragment, manifest encrypted on 0G), employee viewer | ✅ | E2E in a separate browser context |
| Tier 3: revoke re-keys each shared document (new key, new 0G version) | ✅ | E2E + unit test (old key can't open the new version) |
| Quality gates: typecheck, lint, 26 tests, build | ✅ | run before every commit |

## 2. What is demo mode / not verified

**Sealed inference answers have NOT been seen live.** Everything up to the provider call is real and tested:

- The server reads the provider record and the app's sub-account from the on-chain InferenceServing contract (works).
- It mints an ephemeral session token in the 0G SDK's format; the provider **accepted the token's authentication** and then rejected the request on balance.
- The provider endpoints answer CORS preflights for any origin (checked on the second Galileo provider). The browser-direct call is built and wired up.
- Signature verification mirrors the SDK's `processResponse` (EIP-191 against the on-chain signer) and runs in the browser.

Two blockers, both outside the code:

1. **Funding:** providers enforce **≥ 1 0G locked** per user sub-account. The sealed provider's sub-account holds 0.3 0G. The wallet started with only 0.5 0G.
2. **Provider uptime:** the only open-model TeeML provider on Galileo (`0x1cB95Eb66Cc67C62d4DE0CC96726C5A5d82e7C85`, glm-5.3) returned `503 upstream connect error … remote connection failure` all session (checked at ~11:45 and ~12:50 UTC).

Until both are fixed, chat falls back to a **local keyword search** that is labelled "DEMO MODE: no AI model was used and nothing is verified", with an amber "Demo mode · not verified" badge. No fake proof is ever shown. Once funded and the provider is up, the same UI produces sealed answers with no code change: the status banner disappears and badges turn green when the signature verifies.

Never tested live, so verify before claiming:
- Whether the provider returns the `ZG-Res-Key` header readable via CORS (the code falls back to the JSON `id`, as the 0G docs recommend).
- How quickly the signature endpoint has the signature ready (the code retries 4 times over ~10 s).

### To get sealed inference working
1. Send **≥ 1 0G** (2 recommended) on Galileo to `0xF0Cb425B08BcC3733EF8B543A9c71ED6D928Ea2c`.
2. `npm run zg:fund -- --yes` (tops the sub-account up to 1.2 0G).
3. `npm run check:0g`. It must print an answer, a chat ID and `TEE signature valid … true`.
4. If the glm-5.3 provider is still down, ask the 0G booth for another **decentralized TeeML** provider on Galileo and set `ZG_COMPUTE_PROVIDER` to it. Don't use `0xd6269e…C940` (qwen via Alibaba Cloud): it is `ProviderType: centralized`, so the upstream sees prompts. The app refuses non-sealed providers on purpose.

Also: the wallet has **~0.108 0G** left for storage (~0.0012 0G per upload, so roughly 80 uploads). Each demo load uses 3.

## 3. Claims to remove or soften in your ETHGlobal description

Unless step 3 above succeeds before judging, **don't** say:
- ❌ "Every answer comes with a verified TEE attestation" → ✅ "Answers are designed to come from a TEE with a signature verified in the browser; on testnet the sealed provider was offline, so the demo shows the labelled fallback."
- ❌ "Kavach verifies the TEE attestation / hardware quote." We verify the **response signature** against the on-chain TEE signer, not the TDX quote.
- ❌ "Not even 0G can see your prompts" as an unconditional statement → ✅ "Prompts are processed inside a TEE; you trust the chip vendor and attestation."
- ❌ "Revoking access deletes the employee's copy" or "0G data is deleted" → storage is immutable; revocation re-keys for the future only.
- ❌ "Zero metadata" → sizes, timings, counts and the app wallet's transactions are visible.
- ❌ "First private AI" → Maple AI and Confer exist. Lead with the co-founder split-key vault and the vault-only memory model.
- ❌ "Expiring links are cryptographically enforced" → expiry is enforced by the viewer app.

Safe to say: browser-side AES-256-GCM, ciphertext-only on 0G Storage, server never sees prompts (browser → TEE direct), 2-of-3 co-founder recovery with an audited Shamir library, chats not stored, honest demo mode.

## 4. Vercel deploy steps

1. vercel.com → **Add New… → Project** → import `shishir18ravishankar/Kavach-AI`.
2. Framework preset: **Next.js** (auto). Build command `npm run build`, install `npm install`, output default. Node version: 22.x (from `package.json` `engines`).
3. **Environment variables** (Production and Preview):

   | Name | Value | Required |
   |---|---|---|
   | `ZG_PRIVATE_KEY` | the throwaway Galileo wallet's private key (no `NEXT_PUBLIC_` prefix!) | **yes** |
   | `ZG_RPC_URL` | `https://evmrpc-testnet.0g.ai` | no (default) |
   | `ZG_INDEXER_URL` | `https://indexer-storage-testnet-turbo.0g.ai` | no (default) |
   | `ZG_COMPUTE_PROVIDER` | leave empty: the app auto-picks a 0G-acknowledged sealed provider | no |
   | `ZG_MIN_RESERVE_0G` | `0.02` (uploads stop below this wallet balance) | no (default) |
   | `ZG_INFERENCE_CONTRACT` | `0xa79F4c8311FF93C06b8CfB403690cc987c93F91E` | no (default) |

   Do **not** set `KAVACH_DEV_PROXY` on Vercel (it's for sandboxed dev only).
4. Deploy, then open `https://<your-app>.vercel.app/api/status`. Expect `"storage":{"ok":true,…}`. `"inference.ok"` turns `true` once the provider sub-account holds ≥ 1 0G.
5. Smoke test on your phone: `/app` → Load Brewline → Proof → Chat → Keys → Share.

Notes: `/api/storage` uploads wait for on-chain finality (~8–30 s). `maxDuration` is set to 120 s, which fits Vercel's default Fluid compute limits. Server logs are in-memory per instance, so the Proof screen's log may be empty after a cold start. Upload something first.

## 5. Repo facts for judges

- Small commits on `main` throughout the session, each passing typecheck, lint, tests and build.
- 0G packages: `@0gfoundation/0g-storage-ts-sdk@1.2.13` (app), `@0gfoundation/0g-compute-ts-sdk@0.9.0` (funding script only; the app talks to the contract with ethers).
- `open-jsonrpc-provider`'s bundled axios 0.27 is overridden to 1.21.0 (fixes HTTPS proxy handling and old CVEs).
- Built solo with Claude Code; design and scope decisions by the author.

## 6. Post-hackathon update (2026-11-10)

- The live site (https://kavach-ai-khaki.vercel.app) was deployed **without `ZG_PRIVATE_KEY`**, so it ran fully in local/demo mode. Setting it in Vercel turns on real 0G Storage.
- The glm-5.3 provider is gone from the on-chain list. Two new open-model TeeML providers (gpt-oss-20b, gemma-3-27b-it) are listed but **not acknowledged by 0G** and were unreachable. The app now auto-selects from the chain and only uses acknowledged, decentralized TeeML providers, so it will start working by itself once 0G vets one (plus the 1 0G funding).
- Added a wallet-reserve guard and tighter per-IP limits for the public demo, plus Open Graph / Twitter link-preview metadata (`public/og.png`).
