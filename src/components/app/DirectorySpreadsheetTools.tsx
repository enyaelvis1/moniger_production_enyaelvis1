import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadCsvFile, type CsvColumn } from "@/lib/export";
import { parseCsvPreview, type CsvPreview } from "@/lib/import-preview";
import { downloadImportTemplate, type ImportTemplate } from "@/lib/import-templates";

type DirectorySpreadsheetToolsProps<T> = {
  columns: CsvColumn<T>[];
  importTemplate: ImportTemplate;
  paidAccess: boolean;
  rows: T[];
  title: string;
  onImport: (rows: Array<Record<string, string>>) => Promise<void>;
};

export function DirectorySpreadsheetTools<T>({
  columns,
  importTemplate,
  paidAccess,
  rows,
  title,
  onImport,
}: DirectorySpreadsheetToolsProps<T>) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const resetPreview = () => {
    setPreview(null);
    setErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFile = async (file: File) => {
    const result = parseCsvPreview(await file.text(), importTemplate);
    setPreview(result.preview);
    setErrors(result.errors);
  };

  const handleExport = () => {
    downloadCsvFile({
      columns,
      filename: `${importTemplate.key}-export.csv`,
      rows,
    });
  };

  const handleImport = async () => {
    if (!preview || errors.length > 0 || preview.rows.length === 0) {
      return;
    }

    setIsImporting(true);
    try {
      await onImport(preview.rows);
      resetPreview();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "The spreadsheet could not be imported."]);
    } finally {
      setIsImporting(false);
    }
  };

  if (!paidAccess) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-semibold text-foreground">{title} is available on Growth and Business</p>
            <p className="mt-1">Upgrade to upload or download your {importTemplate.title.toLowerCase()} spreadsheet.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Use CSV format. Required column: <span className="font-medium">{importTemplate.requiredHeaders.join(", ")}</span>.
            Download the template before preparing your file.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => downloadImportTemplate(importTemplate)}>
            <Download />
            Download template
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleExport}>
            <Download />
            Download records
          </Button>
          <Button type="button" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload />
            Upload CSV
          </Button>
          <Input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleFile(file);
              }
            }}
          />
        </div>
      </div>

      {preview ? (
        <div className="mt-4 space-y-3 rounded-lg border border-border bg-background p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-foreground">Preview: {preview.rows.length} row{preview.rows.length === 1 ? "" : "s"}</p>
            <Button type="button" variant="ghost" size="sm" onClick={resetPreview}>Choose another file</Button>
          </div>
          {errors.length > 0 ? (
            <div className="space-y-1 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              {errors.slice(0, 5).map((error) => <p key={error}>{error}</p>)}
            </div>
          ) : (
            <>
              <div className="max-h-48 overflow-auto rounded border border-border text-xs">
                <table className="w-full min-w-[520px]">
                  <thead className="sticky top-0 bg-muted text-left"><tr>{preview.headers.map((header) => <th key={header} className="px-2 py-2">{header}</th>)}</tr></thead>
                  <tbody>{preview.rows.slice(0, 5).map((row, index) => <tr key={index} className="border-t border-border">{preview.headers.map((header) => <td key={header} className="max-w-48 truncate px-2 py-2">{row[header]}</td>)}</tr>)}</tbody>
                </table>
              </div>
              <Button type="button" onClick={() => void handleImport()} disabled={isImporting}>
                {isImporting ? <Loader2 className="animate-spin" /> : <Upload />}
                {isImporting ? "Importing…" : `Import ${preview.rows.length} row${preview.rows.length === 1 ? "" : "s"}`}
              </Button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
