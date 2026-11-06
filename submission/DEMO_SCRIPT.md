# Kavach AI: 3-minute demo video script

**Setup before recording:** open the deployed app on a phone-sized browser window (or your phone via screen mirroring). Use a fresh browser profile (or tap **Reset this device** on `/app`). Have a second browser/incognito window ready for the employee view. Check `/api/status` first: if sealed inference is up, use Path A in scene 4; if not, use Path B.

---

### 0:00 to 0:20 · The problem (landing page)
**Screen:** landing page, scroll slowly.
**Say:** "Every startup pastes its customer list, pricing and contracts into AI chatbots. That data then sits on someone else's servers. Kavach is a private AI assistant where nobody but your company can read your documents: not us, not the storage network, not the AI provider."

### 0:20 to 0:50 · Create the vault (Setup → Load demo company)
**Screen:** tap **Open app** → **Load Brewline Coffee Co.** Let the progress log run.
**Say:** "This is Brewline, a fictional coffee company. The browser just generated a 256-bit master key that never leaves this device. Each document gets its own key, is encrypted right here with AES-256-GCM, and only the ciphertext is uploaded to 0G Storage. You can see each one confirm on-chain with its Merkle root."

### 0:50 to 1:15 · Proof: what 0G and our server actually hold
**Screen:** **Proof** tab → pick `customers.csv`. Show the hex dump and the "matches what was uploaded" badge. Tap **Decrypt in browser**. Type `Saffron` in the server-log search to show "not found in server log".
**Say:** "This is the raw data fetched back from 0G: random bytes. Our server's log only has sizes and hashes. Searching it for a customer name finds nothing. Only this browser, holding the key, can turn it back into the customer list."

### 1:15 to 1:55 · Ask the AI
**Screen:** **Chat** → tap "Which customers are up for renewal before the end of 2026…".
- **Path A (sealed inference live):** open **Show proof**.
  **Say:** "My browser sent this question and the decrypted documents straight to an open model running inside a hardware TEE on 0G Compute. Our server never saw it. The answer comes with a request ID, and my browser verified the enclave's signature against the signer registered on-chain: green means verified."
- **Path B (sealed inference unavailable):** point at the amber banner and the "Demo mode · not verified" badge.
  **Say:** "Right now the testnet's sealed-inference provider is offline, and Kavach is honest about it: this answer comes from a local keyword search, clearly labelled demo mode, with no fake proof. When the provider is up, the same button sends the prompt straight from the browser into the TEE and shows a verified signature."

Then tap **Save to vault**.
**Say:** "Chats aren't stored. Reload and they're gone. If an answer matters, Save to vault turns it into another encrypted note on 0G."

### 1:55 to 2:30 · Co-founder key ceremony and recovery
**Screen:** **Keys** → **Split master key into 3 shares** (names prefilled: Ananya, Vikram, Zoya). Show the QR codes. Tap **Copy** on shares 1 and 3 and paste them into a notes app (shares are shown only once). Tick the 3 boxes → **Confirm**. Type `FORGET` → **Delete key from this browser**. Show the vault locked. Paste shares 1 and 3 → **Restore master key** → open a document.
**Say:** "Losing a laptop shouldn't lose the company. The master key is split with audited Shamir secret sharing: three co-founders each hold a share, and any two can recover it. I just deleted the key. The documents are locked, even for me. Two co-founders paste their shares, and everything decrypts again. One share alone reveals nothing."

### 2:30 to 2:50 · Share with an employee, then revoke
**Screen:** **Share** → employee "Priya, sales", tick `price-sheet`, expiry 1 hour → **Create private link** → open the link in the incognito window and open the document. Back in the owner's window → **Revoke & re-key**.
**Say:** "Priya gets a link that expires. The key is in the part after the #, which browsers never send to a server. Revoking re-encrypts the document with a new key. And we're honest: revocation can't erase what she already saw."

### 2:50 to 3:00 · Close
**Screen:** cover image or landing hero.
**Say:** "Kavach AI: encrypted in your browser, stored on 0G, answered by sealed AI, recoverable by your co-founders. Your secrets, your keys."
