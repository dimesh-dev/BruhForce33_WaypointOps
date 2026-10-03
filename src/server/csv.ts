import { existsSync, readFileSync } from "node:fs";

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.some((v) => v !== "")) rows.push(row);
  }
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map((h) => h.trim().replace(/^\uFEFF/, ""));
  return body.map((r) =>
    Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])),
  );
}

export function readCsv(path: string): Record<string, string>[] {
  return parseCsv(readFileSync(path, "utf8"));
}

export function readCsvIfExists(path: string): Record<string, string>[] | null {
  return existsSync(path) ? readCsv(path) : null;
}
