/**
 * DEMO MODE answer engine. Used ONLY when 0G sealed inference is unavailable.
 * It is NOT an AI model: plain keyword matching over the documents the user
 * already decrypted in this browser. Nothing leaves the device.
 */
export interface DemoDoc {
  name: string;
  text: string;
}

const STOP = new Set(
  "a an the and or of to in on for with by is are was were be our we us you your what which who whom whose when where why how do does did can could should would will this that these those it its at from as any all than then there their them they me my i if not no yes up out".split(" "),
);

function terms(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9₹\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/(ing|ed|es|s)$/, ""))
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function parseCsv(text: string): { header: string[]; rows: string[][] } | null {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return null;
  const split = (l: string) => l.split(",").map((c) => c.trim());
  const header = split(lines[0]);
  if (header.length < 2) return null;
  return { header, rows: lines.slice(1).map(split) };
}

function fmt(n: number): string {
  return n.toLocaleString("en-IN");
}

function csvTopN(question: string, doc: DemoDoc): string | null {
  const q = question.toLowerCase();
  if (!/\b(top|largest|biggest|highest|most|best)\b/.test(q)) return null;
  const csv = parseCsv(doc.text);
  if (!csv) return null;
  const n = Number(/\btop\s+(\d+)/.exec(q)?.[1] ?? 3);
  const numericCols = csv.header
    .map((h, i) => ({ h, i }))
    .filter(({ i }) => csv.rows.filter((r) => r[i] !== undefined && /^\d+(\.\d+)?$/.test(r[i])).length >= csv.rows.length * 0.8);
  if (!numericCols.length) return null;
  const qTerms = terms(q);
  const col =
    numericCols.find(({ h }) => terms(h.replace(/_/g, " ")).some((t) => qTerms.includes(t))) ??
    numericCols.find(({ h }) => /revenue|amount|total|value/i.test(h)) ??
    numericCols[0];
  const sorted = [...csv.rows].sort((a, b) => Number(b[col.i]) - Number(a[col.i])).slice(0, n);
  const lines = sorted.map((r, k) => `${k + 1}. ${r[0]}: ${col.h.replace(/_/g, " ")} = ${fmt(Number(r[col.i]))}`);
  return `Top ${n} by ${col.h.replace(/_/g, " ")} [${doc.name}]:\n${lines.join("\n")}`;
}

interface Chunk {
  doc: string;
  text: string;
  score: number;
}

function chunks(doc: DemoDoc): string[] {
  const csv = doc.name.toLowerCase().endsWith(".csv") ? parseCsv(doc.text) : null;
  if (csv) return csv.rows.map((r) => csv.header.map((h, i) => `${h}: ${r[i] ?? ""}`).join(" · "));
  return doc.text
    .split(/\n(?=\s*(?:#|\d+\.\d*\s|[-*]\s|\|))|\n{2,}/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0 && !/^\|[-\s|]+\|$/.test(c));
}

export function demoAnswer(question: string, docs: DemoDoc[]): string {
  const header = "DEMO MODE: no AI model was used and nothing is verified. These are the closest matching passages found locally in your decrypted documents.";
  if (!docs.length) return `${header}\n\nSelect one or more vault documents to search.`;
  for (const d of docs) {
    const top = csvTopN(question, d);
    if (top) return `${header}\n\n${top}`;
  }
  const q = new Set(terms(question));
  // Dates like "2026" in the question are strong signals.
  const years = question.match(/\b20\d\d\b/g) ?? [];
  const scored: Chunk[] = [];
  for (const d of docs) {
    for (const c of chunks(d)) {
      const ct = terms(c);
      let score = 0;
      for (const t of new Set(ct)) if (q.has(t)) score += 1;
      for (const y of years) if (c.includes(y)) score += 0.5;
      if (score > 0) scored.push({ doc: d.name, text: c, score: score / Math.sqrt(1 + ct.length / 40) });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const best = scored.slice(0, 5);
  if (!best.length) return `${header}\n\nNo passages matched your question's keywords.`;
  return `${header}\n\n${best.map((b) => `• [${b.doc}] ${b.text.length > 400 ? b.text.slice(0, 400) + "…" : b.text}`).join("\n")}`;
}
