# Kavach AI: Progress Log

## ⚠️ WHAT YOU MUST DO (updated 2026-11-10, post-hackathon)

1. **Vercel → Project → Settings → Environment Variables → add `ZG_PRIVATE_KEY`** (the throwaway
   Galileo wallet key, Production + Preview), then **Redeploy**. The live site currently has no key,
   so nothing reaches 0G. Check afterwards: https://kavach-ai-khaki.vercel.app/api/status
2. Optional: top up the wallet `0xF0Cb425B08BcC3733EF8B543A9c71ED6D928Ea2c` from faucet.0g.ai now
   and then (≈0.1 0G left ≈ 80 uploads; uploads stop at a 0.02 0G reserve).
3. Sealed AI: no 0G-acknowledged open-model TEE chat provider exists on testnet right now
   (gpt-oss-20b and gemma-3-27b-it are listed but unacknowledged and unreachable). The app
   auto-picks one when 0G acknowledges it; it then still needs ≥ 1 0G via `npm run zg:fund -- --yes`.

---

## Status

| Area | State |
|---|---|
| 0G Storage upload/download (encrypted blob, Merkle-proof download) | ✅ works (verified by `npm run check:0g`) |
| 0G sealed inference session token (minted server-side, used by browser) | ✅ auth accepted by provider |
| 0G sealed inference answer | ⛔ blocked: needs ≥1 0G per provider + provider 1 backend was down |

## Research notes (2026-11-06)

- **Storage SDK:** `@0gfoundation/0g-storage-ts-sdk@1.2.13` (peer `ethers@6.13.1`). Indexer
  `https://indexer-storage-testnet-turbo.0g.ai`, RPC `https://evmrpc-testnet.0g.ai`, chain 16602.
  Upload of a ~60 B blob ≈ 8 s, gas ≈ 0.0012 0G. Download via `downloadToBlob(root, {proof:true})` ≈ 1 s.
- **Compute:** two paths.
  - *Router* (`router-api.0g.ai`, API key from pc.0g.ai, `X-0G-Provider-Trust-Mode: private`) is
    **mainnet only**, so it can't be used with a testnet wallet.
  - *Direct* (`@0gfoundation/0g-compute-ts-sdk@0.9.0`): ledger + per-provider sub-account on
    Galileo. On-chain minimums are 0.1 0G (ledger) / 0.01 0G (transfer), but the SDK hardcodes
    3 0G / 1 0G, and the **provider broker enforces a 1 0G locked balance**.
  - Galileo providers: `0x1cB9…7C85` glm-5.3 **TeeML, decentralized** (an open model running
    inside the TEE, so it really is sealed); `0xd626…C940` qwen3.8-omni-flash, TeeML label
    but `ProviderType: centralized` (a TEE broker relaying to Alibaba Cloud, so the upstream
    sees the prompt). Kavach only uses the first one.
- **Privacy option achieved: A (browser → TEE directly).** Provider endpoints allow CORS from
  any origin. The server mints a short-lived (15 min) ephemeral session token
  (`app-sk-…`, the SDK's format, signed off-chain by the server wallet) and returns it to the
  browser. The browser POSTs the prompt straight to the provider's TEE endpoint over TLS. **Our
  server never sees prompts, documents, or answers.** The browser then fetches the TEE's
  response signature (`/v1/proxy/signature/{chatID}`) and verifies it locally (EIP-191)
  against the TEE signer address read from the on-chain service record.
  - Caveat (stated in UI): the token lets the holder spend the app's provider balance until
    it expires. That's acceptable for a demo; production would add per-user rate limits.
  - Caveat: TLS terminates at the provider's dstack gateway/CVM; we rely on 0G's statement
    that the model runs in Intel TDX + GPU TEE and on the dstack attestation. We do not
    verify the TDX quote ourselves in the browser.
- **Sandbox quirk (not a production issue):** `open-jsonrpc-provider` ships axios 0.27, which
  breaks HTTPS proxies. Overridden to axios 1.21.0 in `package.json`. `scripts/sandbox-proxy.ts`
  tunnels the plain-HTTP storage-node calls through the dev sandbox's CONNECT proxy; it's a
  no-op on Vercel.
- **Shamir:** `shamir-secret-sharing@0.0.4` (Privy), zero-dependency, audited by Cure53 and Zellic.

## Done
- Research + risk tests: `scripts/check-0g.ts`, `scripts/fund-compute.ts`
- **Tier 1 ✅** landing, onboarding, Brewline demo, vault (txt/md/csv/PDF) → browser encryption →
  0G Storage, chat with proof badge + Save to vault, Proof screen. E2E-verified on real 0G.
  Chat answers in labelled **DEMO MODE** while sealed inference is blocked (see top).
- **Tier 2 ✅** key ceremony (3 shares, QR, download, confirm, test) + lose key + recover with any 2.
- **Tier 3 ✅** expiring employee links (key in URL fragment, encrypted manifest on 0G), viewer,
  revoke-by-rekey with honest limits.
- **Deliverables ✅** README (Mermaid, 0G usage, honest limits, credits), `submission/logo.png`,
  `submission/cover.png`, `submission/DEMO_SCRIPT.md`, `submission/FINAL_REPORT.md`.

## Next (needs you)
- Fund the wallet (top of this file) → `npm run zg:fund -- --yes` → `npm run check:0g`.
- Deploy to Vercel: steps + env vars in `submission/FINAL_REPORT.md` §4.
- Re-read `submission/FINAL_REPORT.md` §3 before writing the ETHGlobal description.

## Wallet
- ~0.108 0G left in the wallet for storage (~0.0012 0G per upload). 0.3 0G sits in the glm-5.3
  provider sub-account, 0.04 0G in the (unused, centralized) qwen sub-account, 0.01 0G in the ledger.
