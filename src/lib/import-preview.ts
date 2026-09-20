import type { ImportTemplate } from "@/lib/import-templates";

export type CsvPreview = {
  headers: string[];
  rows: Array<Record<string, string>>;
};

const parseCsvLine = (line: string) => {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];
    if (character === '"' && quoted && nextCharacter === '"') {
      current += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  values.push(current.trim());
  return values;
};

export const parseCsvPreview = (text: string, template: ImportTemplate): { errors: string[]; preview: CsvPreview | null } => {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return { errors: ["The file is empty."], preview: null };

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const missingHeaders = template.requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) return { errors: [`Missing required column${missingHeaders.length === 1 ? "" : "s"}: ${missingHeaders.join(", ")}`], preview: null };

  const rows = lines.slice(1, 101).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
  const errors = rows.flatMap((row, index) => template.requiredHeaders.filter((header) => !row[header]).map((header) => `Row ${index + 2}: ${header} is required.`));
  return { errors, preview: { headers, rows } };
};
