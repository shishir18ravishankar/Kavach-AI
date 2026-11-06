import { NextResponse } from "next/server";
import { getLog } from "@/lib/server/log";

export const dynamic = "force-dynamic";

/** Metadata-only server log, shown on the Proof screen. */
export async function GET() {
  return NextResponse.json({ note: "In-memory log of this server instance. Metadata only: sizes, hashes, timings. No content.", entries: getLog() }, { headers: { "Cache-Control": "no-store" } });
}
