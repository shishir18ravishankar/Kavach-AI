import { NextResponse } from "next/server";
import { sha256Hex } from "@/lib/crypto/bytes";
import { downloadBytes } from "@/lib/server/zgStorage";
import { logEvent } from "@/lib/server/log";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Returns the raw ciphertext stored on 0G (downloaded with Merkle proof verification). */
export async function GET(_req: Request, ctx: { params: Promise<{ root: string }> }) {
  const { root } = await ctx.params;
  const t0 = Date.now();
  if (!/^0x[0-9a-fA-F]{64}$/.test(root)) {
    return NextResponse.json({ error: "Invalid root hash" }, { status: 400 });
  }
  try {
    const bytes = await downloadBytes(root);
    logEvent("GET /api/storage/[root]", "fetched_from_0g", { rootHash: root, bytes: bytes.length, sha256: await sha256Hex(bytes), ms: Date.now() - t0 });
    return new Response(bytes as BodyInit, {
      headers: { "Content-Type": "application/octet-stream", "Cache-Control": "private, max-age=31536000, immutable" },
    });
  } catch (e) {
    const message = (e as Error).message.slice(0, 300);
    logEvent("GET /api/storage/[root]", "download_failed", { rootHash: root, ms: Date.now() - t0, error: message });
    return NextResponse.json({ error: `0G Storage download failed: ${message}` }, { status: 502 });
  }
}
