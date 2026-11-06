/** Turn an uploaded file into text, entirely in the browser. */
export const ACCEPTED = ".txt,.md,.markdown,.csv,.pdf,text/plain,text/markdown,text/csv,application/pdf";
export const MAX_FILE_BYTES = 1024 * 1024;

export interface Extracted {
  name: string;
  mime: string;
  text: string;
  meta?: Record<string, string>;
}

function kindOf(file: File): "pdf" | "text" | null {
  const n = file.name.toLowerCase();
  if (file.type === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (/\.(txt|md|markdown|csv)$/.test(n) || file.type.startsWith("text/")) return "text";
  return null;
}

export async function extractText(file: File): Promise<Extracted> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB. Limit is 1 MB.`);
  const kind = kindOf(file);
  if (!kind) throw new Error(`${file.name}: unsupported type. Use .txt, .md, .csv or .pdf`);
  if (kind === "text") {
    const text = await file.text();
    const mime = file.name.toLowerCase().endsWith(".csv") ? "text/csv" : file.name.toLowerCase().match(/\.(md|markdown)$/) ? "text/markdown" : "text/plain";
    return { name: file.name, mime, text };
  }
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : "")).join("");
    pages.push(line.trim());
  }
  const text = pages.join("\n\n").trim();
  if (!text) throw new Error(`${file.name}: no extractable text (scanned PDF?). OCR is not supported.`);
  return { name: file.name, mime: "application/pdf", text, meta: { pages: String(doc.numPages), note: "Text extracted from PDF in the browser" } };
}
