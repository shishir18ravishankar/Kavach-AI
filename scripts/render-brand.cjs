/* eslint-disable @typescript-eslint/no-require-imports -- plain Node CJS script */
// Renders submission/logo.png (512x512) and submission/cover.png (1280x720).
// Usage: node scripts/render-brand.cjs   (needs Playwright + Chromium)
const { chromium } = require("playwright");
const path = require("path");
const shield = (size) => `
<svg viewBox="0 0 64 64" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d4fb8"/><stop offset="1" stop-color="#16307a"/></linearGradient></defs>
  <path d="M32 6 52 13.5v15.5c0 13.6-8.4 23.6-20 27.5C20.4 52.6 12 42.6 12 29V13.5z" fill="url(#g)" stroke="#9cb8ff" stroke-width="2.2" stroke-linejoin="round"/>
  <rect x="22.5" y="28" width="19" height="15" rx="3.2" fill="#fff"/>
  <path d="M26.2 28v-4.2a5.8 5.8 0 0 1 11.6 0V28" fill="none" stroke="#fff" stroke-width="3.2"/>
  <circle cx="32" cy="34.6" r="2.3" fill="#0b1530"/><rect x="31" y="35.5" width="2" height="4" rx="1" fill="#0b1530"/>
</svg>`;
const base = `*{margin:0;box-sizing:border-box}body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}`;
const logo = `<html><head><style>${base}
body{width:512px;height:512px;background:radial-gradient(circle at 50% 35%,#1a2c63 0%,#0b1530 70%);display:flex;align-items:center;justify-content:center;border-radius:0}
</style></head><body>${shield(360)}</body></html>`;
const cover = `<html><head><style>${base}
body{width:1280px;height:720px;background:radial-gradient(circle at 78% 40%,#1d3478 0%,#0b1530 60%);color:#fff;display:flex;align-items:center;padding:0 96px;gap:64px;overflow:hidden}
.t{flex:1}.k{font-size:22px;letter-spacing:.18em;text-transform:uppercase;color:#9cb8ff;font-weight:700}
h1{font-size:104px;line-height:1;font-weight:800;margin-top:18px;letter-spacing:-.02em}h1 span{color:#9cb8ff}
p{font-size:34px;line-height:1.3;margin-top:26px;color:#d5def7;max-width:640px}
.chips{display:flex;gap:12px;margin-top:40px;flex-wrap:wrap}.chip{border:1.5px solid #3d5aa8;border-radius:999px;padding:10px 20px;font-size:20px;color:#c9d6ff;font-weight:600}
.grid{position:absolute;inset:0;background-image:linear-gradient(#ffffff08 1px,transparent 1px),linear-gradient(90deg,#ffffff08 1px,transparent 1px);background-size:40px 40px}
</style></head><body><div class="grid"></div>
<div class="t" style="position:relative"><div class="k">Private AI for startups</div><h1>Kavach <span>AI</span></h1>
<p>Chat with your company's secrets. Nobody else can read them.</p>
<div class="chips"><div class="chip">Encrypted in your browser</div><div class="chip">Stored on 0G</div><div class="chip">Sealed TEE inference</div><div class="chip">2-of-3 co-founder keys</div></div></div>
<div style="position:relative">${shield(380)}</div></body></html>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
  await p.setContent(logo);
  await p.screenshot({ path: path.join("submission", "logo.png") });
  await p.setViewportSize({ width: 1280, height: 720 });
  await p.setContent(cover);
  await p.screenshot({ path: path.join("submission", "cover.png") });
  await b.close();
  console.log("wrote submission/logo.png and submission/cover.png");
})();
