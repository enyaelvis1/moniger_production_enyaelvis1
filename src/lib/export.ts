const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeFileName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "export";

const downloadBlob = (blob: Blob, filename: string) => {
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1_000);
};

const toDisplayString = (value: unknown) => {
  if (value === null || typeof value === "undefined") {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return JSON.stringify(value);
};

const createCsvValue = (value: unknown) => {
  const normalizedValue = toDisplayString(value).replace(/\r?\n|\r/g, " ").trim();
  return `"${normalizedValue.replace(/"/g, '""')}"`;
};

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => unknown;
};

export const downloadCsvFile = <T>({
  columns,
  filename,
  rows,
}: {
  columns: CsvColumn<T>[];
  filename: string;
  rows: T[];
}) => {
  const csvLines = [
    columns.map((column) => createCsvValue(column.header)).join(","),
    ...rows.map((row) => columns.map((column) => createCsvValue(column.value(row))).join(",")),
  ];

  const csvContent = `\uFEFF${csvLines.join("\r\n")}`;
  downloadBlob(new Blob([csvContent], { type: "text/csv;charset=utf-8;" }), filename);
};

export const downloadJsonFile = ({
  data,
  filename,
}: {
  data: unknown;
  filename: string;
}) => {
  const jsonContent = `${JSON.stringify(data, null, 2)}\n`;
  downloadBlob(new Blob([jsonContent], { type: "application/json;charset=utf-8;" }), filename);
};

type PrintRow = {
  label: string;
  value: string;
};

type PrintSection = {
  rows?: PrintRow[];
  table?: {
    columns: string[];
    rows: string[][];
  };
  text?: string[];
  title: string;
};

export type PrintDocumentOptions = {
  eyebrowLabel?: string;
  fileName?: string;
  generatedAtLabel?: string;
  htmlLang?: string;
  metadata?: PrintRow[];
  sections: PrintSection[];
  subtitle?: string;
  title: string;
};

const renderMetadata = (rows: PrintRow[]) => {
  if (rows.length === 0) {
    return "";
  }

  return `
    <dl class="meta-grid">
      ${rows
        .map(
          (row) => `
            <div class="meta-card">
              <dt>${escapeHtml(row.label)}</dt>
              <dd>${escapeHtml(row.value)}</dd>
            </div>
          `,
        )
        .join("")}
    </dl>
  `;
};

const renderRows = (rows: PrintRow[]) => {
  if (rows.length === 0) {
    return "";
  }

  return `
    <div class="key-value-list">
      ${rows
        .map(
          (row) => `
            <div class="key-value-row">
              <span class="key-value-label">${escapeHtml(row.label)}</span>
              <span class="key-value-value">${escapeHtml(row.value)}</span>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
};

const renderTable = (table: NonNullable<PrintSection["table"]>) => `
  <div class="table-wrap">
    <table>
      <thead>
        <tr>${table.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${table.rows
          .map(
            (row) => `
              <tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  </div>
`;

const renderText = (text: string[]) =>
  text.length === 0 ? "" : `<div class="text-block">${text.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</div>`;

const buildPrintDocumentHtml = ({
  eyebrowLabel = "Moniger Export",
  generatedAtLabel,
  htmlLang = "en",
  metadata = [],
  sections,
  subtitle,
  title,
}: PrintDocumentOptions) => `
  <!doctype html>
  <html lang="${escapeHtml(htmlLang)}">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(title)}</title>
      <style>
        :root {
          color-scheme: light;
          --ink: #14213d;
          --muted: #64748b;
          --line: #dbe2ef;
          --panel: #f8fafc;
          --accent: #25476a;
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #eef2f8;
          color: var(--ink);
          font-family: "Segoe UI", Arial, sans-serif;
          line-height: 1.5;
        }

        .page {
          max-width: 920px;
          margin: 0 auto;
          background: #ffffff;
          min-height: 100vh;
          padding: 40px 36px 48px;
        }

        .header {
          border-bottom: 2px solid var(--line);
          padding-bottom: 20px;
          margin-bottom: 24px;
        }

        .eyebrow {
          color: var(--accent);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          margin: 6px 0 0;
          font-size: 30px;
          line-height: 1.15;
        }

        .subtitle {
          margin: 10px 0 0;
          color: var(--muted);
          font-size: 14px;
        }

        .meta-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
          margin: 0 0 24px;
        }

        .meta-card {
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 12px 14px;
          background: var(--panel);
        }

        .meta-card dt {
          color: var(--muted);
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .meta-card dd {
          margin: 6px 0 0;
          font-size: 16px;
          font-weight: 700;
        }

        .section {
          margin-top: 22px;
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 18px;
          background: #ffffff;
        }

        .section h2 {
          margin: 0 0 14px;
          font-size: 18px;
        }

        .key-value-list {
          display: grid;
          gap: 10px;
        }

        .key-value-row {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          border-bottom: 1px solid var(--line);
          padding-bottom: 10px;
        }

        .key-value-row:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }

        .key-value-label {
          color: var(--muted);
          font-size: 13px;
        }

        .key-value-value {
          text-align: right;
          font-weight: 600;
        }

        .table-wrap {
          overflow: hidden;
          border: 1px solid var(--line);
          border-radius: 14px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th,
        td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--line);
          text-align: left;
          font-size: 13px;
        }

        th {
          color: var(--muted);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          background: var(--panel);
        }

        tbody tr:last-child td {
          border-bottom: 0;
        }

        .text-block p {
          margin: 0 0 10px;
        }

        .footer-note {
          margin-top: 24px;
          color: var(--muted);
          font-size: 12px;
          text-align: right;
        }

        @media print {
          body {
            background: #ffffff;
          }

          .page {
            max-width: none;
            padding: 0;
          }
        }
      </style>
    </head>
    <body>
      <main class="page">
        <header class="header">
          <div class="eyebrow">${escapeHtml(eyebrowLabel)}</div>
          <h1>${escapeHtml(title)}</h1>
          ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ""}
        </header>
        ${renderMetadata(metadata)}
        ${sections
          .map(
            (section) => `
              <section class="section">
                <h2>${escapeHtml(section.title)}</h2>
                ${section.rows ? renderRows(section.rows) : ""}
                ${section.table ? renderTable(section.table) : ""}
                ${section.text ? renderText(section.text) : ""}
              </section>
            `,
          )
          .join("")}
        <p class="footer-note">${escapeHtml(generatedAtLabel ?? `Generated ${new Date().toLocaleString()}`)}</p>
      </main>
    </body>
  </html>
`;

export const openPrintDocument = ({ fileName, ...options }: PrintDocumentOptions) => {
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    throw new Error("Your browser blocked the export window. Please allow popups and try again.");
  }

  try {
    printWindow.opener = null;
  } catch {
    // Some browsers may keep opener read-only on blank windows.
  }

  printWindow.document.open();
  printWindow.document.write(buildPrintDocumentHtml(options));
  printWindow.document.close();
  printWindow.document.title = fileName ? normalizeFileName(fileName) : normalizeFileName(options.title);

  let hasPrinted = false;
  const triggerPrint = () => {
    if (hasPrinted || printWindow.closed) {
      return;
    }

    hasPrinted = true;
    printWindow.focus();
    printWindow.print();
  };

  printWindow.onload = triggerPrint;
  window.setTimeout(triggerPrint, 250);
};

export const createExportFileName = (prefix: string) => {
  const dateStamp = new Date().toISOString().slice(0, 10);
  return `${normalizeFileName(prefix)}-${dateStamp}`;
};
