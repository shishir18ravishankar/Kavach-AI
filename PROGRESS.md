# Kavach AI: Progress Log

## ⚠️ WHAT YOU MUST DO (action needed)

1. **Send at least 1 0G (testnet) to the server wallet** `0xF0Cb425B08BcC3733EF8B543A9c71ED6D928Ea2c`.
   - Why: 0G sealed-inference providers refuse requests unless the per-provider
     sub-account holds **≥ 1.0 0G locked** (verified, provider error:
     `insufficient balance: your locked balance is 0.04 0G, but the required minimum is 1.000000 0G`).
     The sub-account for the sealed provider currently holds 0.3 0G. Shortfall is
     **~0.8 0G**, plus a little for gas. 1 0G is enough; 2 0G gives headroom.
   - Where: faucet.0g.ai (0.1/day), the Google Cloud 0G faucet, or **ask at the 0G booth**.
   - Then run: `npm run zg:fund -- --yes` (deposits into the compute ledger and tops
     the provider sub-account up to 1.2 0G), then `npm run check:0g` to confirm.
2. **Ask at the 0G booth:** the only Galileo TeeML open-model provider
   (`0x1cB95Eb66Cc67C62d4DE0CC96726C5A5d82e7C85`, glm-5.3, Phala dstack) returned
   `503 upstream connect error ... remote connection failure` and then TLS resets
   on 2026-11-06 ~11:45 UTC. That's the provider's own backend being down. Ask
   whether it's expected back, or whether there's another testnet TeeML provider.

Until both are fixed, the chat runs in a clearly labelled **DEMO MODE** (see below).

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

## Next
- Tier 1 app.
