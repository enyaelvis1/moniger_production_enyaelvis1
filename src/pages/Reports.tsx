import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AppLayout from "@/components/app/AppLayout";
import { EmptyState } from "@/components/app/EmptyState";
import OperationStatusNotice, { type OperationStatusState } from "@/components/app/OperationStatusNotice";
import { ChartCardsSkeleton, PageActionButtonsSkeleton, TableCardSkeleton } from "@/components/app/StandalonePageSkeletons";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/hooks/use-localization";
import { useOperationsData } from "@/hooks/use-operations-data";
import { useSettingsData } from "@/hooks/use-settings-data";
import { useToast } from "@/hooks/use-toast";
import { getFriendlyErrorMessage } from "@/lib/error-handling";
import { waitForUiFrame } from "@/lib/async";
import { createExportFileName, downloadCsvFile, openPrintDocument } from "@/lib/export";

type ReportExportAction = "csv" | "pdf";
type ReportExportStatus =
  | null
  | {
      action: ReportExportAction;
      description: string;
      state: OperationStatusState;
      title: string;
    };

const getErrorMessage = (error: unknown, fallbackMessage: string) =>
  getFriendlyErrorMessage(error, fallbackMessage);

const ReportsPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { formatCurrency, formatDateTime, language, t } = useLocalization();
  const settingsQuery = useSettingsData(user?.id);
  const businessId = settingsQuery.data?.business?.id;
  const operationsQuery = useOperationsData(businessId);
  const businessName = settingsQuery.data?.business?.name ?? "Moniger Workspace";
  const currency = settingsQuery.data?.business?.default_currency ?? "NGN";
  const reports = operationsQuery.data?.reports;
  const [exportStatus, setExportStatus] = useState<ReportExportStatus>(null);

  const isSettingsLoading = settingsQuery.isLoading && !settingsQuery.data;
  const isOperationsLoading = operationsQuery.isLoading && !operationsQuery.data;

  const handleExportCsv = async () => {
    if (!reports) {
      toast({
        title: "No report data yet",
        description: "Generate some invoice, bill, or payment activity first, then try exporting again.",
      });
      return;
    }

    const rows = [
      { detail: "Total invoices", section: "Summary", value: String(reports.totalInvoices), value2: "", value3: "", value4: "" },
      ...reports.cashFlowData.map((row) => ({
        detail: row.month,
        section: "Cash Flow",
        value: formatCurrency(row.receivables, currency),
        value2: formatCurrency(row.payables, currency),
        value3: "",
        value4: "",
      })),
      ...reports.invoiceStatusData.map((row) => ({
        detail: row.name,
        section: "Invoice Status Breakdown",
        value: String(row.value),
        value2: row.color,
        value3: "",
        value4: "",
      })),
      ...reports.monthlySummary.map((row) => ({
        detail: row.month,
        section: "Monthly Summary",
        value: formatCurrency(row.invoiced, currency),
        value2: formatCurrency(row.collected, currency),
        value3: formatCurrency(row.billsPaid, currency),
        value4: formatCurrency(row.net, currency),
      })),
    ];

    setExportStatus({
      action: "csv",
      description: "We are packaging your report rows into a downloadable CSV file.",
      state: "running",
      title: "Preparing CSV export",
    });
    await waitForUiFrame();

    try {
      downloadCsvFile({
        columns: [
          { header: "Section", value: (row) => row.section },
          { header: "Detail", value: (row) => row.detail },
          { header: "Value", value: (row) => row.value },
          { header: "Value 2", value: (row) => row.value2 },
          { header: "Value 3", value: (row) => row.value3 },
          { header: "Value 4", value: (row) => row.value4 },
        ],
        filename: `${createExportFileName(`${businessName}-reports`)}.csv`,
        rows,
      });
      setExportStatus({
        action: "csv",
        description: "Your report CSV was generated and handed to the browser download flow.",
        state: "success",
        title: "CSV export ready",
      });
    } catch (error) {
      setExportStatus({
        action: "csv",
        description: getErrorMessage(error, "Please try generating the CSV again."),
        state: "error",
        title: "Unable to export CSV",
      });
    }
  };

  const handleExportPdf = async () => {
    if (!reports) {
      toast({
        title: "No report data yet",
        description: "Generate some invoice, bill, or payment activity first, then try exporting again.",
      });
      return;
    }

    setExportStatus({
      action: "pdf",
      description: "We are preparing a print-ready PDF view of your finance report.",
      state: "running",
      title: "Preparing PDF export",
    });
    await waitForUiFrame();

    try {
      openPrintDocument({
        eyebrowLabel: t("export.eyebrow"),
        fileName: createExportFileName(`${businessName}-report`),
        generatedAtLabel: t("export.generatedAt", { timestamp: formatDateTime(new Date()) }),
        htmlLang: language,
        metadata: [
          { label: "Workspace", value: businessName },
          { label: "Currency", value: currency },
          { label: "Total Invoices", value: String(reports.totalInvoices) },
        ],
        sections: [
          {
            table: {
              columns: ["Month", "Receivables", "Payables"],
              rows:
                reports.cashFlowData.length > 0
                  ? reports.cashFlowData.map((row) => [
                      row.month,
                      formatCurrency(row.receivables, currency),
                      formatCurrency(row.payables, currency),
                    ])
                  : [["No cash flow rows yet", "", ""]],
            },
            title: "Cash Flow",
          },
          {
            table: {
              columns: ["Status", "Invoices"],
              rows:
                reports.invoiceStatusData.length > 0
                  ? reports.invoiceStatusData.map((row) => [row.name, String(row.value)])
                  : [["No status rows yet", "0"]],
            },
            title: "Invoice Status Breakdown",
          },
          {
            table: {
              columns: ["Month", "Invoiced", "Collected", "Bills Paid", "Net"],
              rows:
                reports.monthlySummary.length > 0
                  ? reports.monthlySummary.map((row) => [
                      row.month,
                      formatCurrency(row.invoiced, currency),
                      formatCurrency(row.collected, currency),
                      formatCurrency(row.billsPaid, currency),
                      formatCurrency(row.net, currency),
                    ])
                  : [["No monthly rows yet", "", "", "", ""]],
            },
            title: "Monthly Summary",
          },
        ],
        subtitle: `Printable finance report for ${businessName}`,
        title: "Finance Report",
      });
      setExportStatus({
        action: "pdf",
        description: "Your report export opened in a print-ready browser window.",
        state: "success",
        title: "PDF export ready",
      });
    } catch (error) {
      setExportStatus({
        action: "pdf",
        description: getErrorMessage(error, "Please allow popups and try again."),
        state: "error",
        title: "Unable to open export",
      });
    }
  };

  const retryLastExport = () => {
    if (!exportStatus || exportStatus.state !== "error") {
      return;
    }

    if (exportStatus.action === "csv") {
      void handleExportCsv();
      return;
    }

    void handleExportPdf();
  };

  return (
    <AppLayout>
      <div className="page-enter space-y-8">
        {settingsQuery.error ? (
          <div className="rounded-xl border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
            {getErrorMessage(settingsQuery.error, "We could not load your workspace.")}
          </div>
        ) : null}

        {operationsQuery.error ? (
          <div className="rounded-xl border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
            {getErrorMessage(operationsQuery.error, "We could not load your reports right now.")}
          </div>
        ) : null}

        {!businessId && !isSettingsLoading ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Your workspace is still being prepared. Reports will appear here once the business record is available.
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-primary">Reports</h2>
          {isSettingsLoading || isOperationsLoading ? (
            <PageActionButtonsSkeleton />
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 rounded-lg btn-press"
                onClick={() => void handleExportCsv()}
                disabled={exportStatus?.state === "running"}
              >
                {exportStatus?.state === "running" && exportStatus.action === "csv" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 rounded-lg btn-press"
                onClick={() => void handleExportPdf()}
                disabled={exportStatus?.state === "running"}
              >
                {exportStatus?.state === "running" && exportStatus.action === "pdf" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                Export PDF
              </Button>
            </div>
          )}
        </div>

        {exportStatus ? (
          <OperationStatusNotice
            description={exportStatus.description}
            state={exportStatus.state}
            title={exportStatus.title}
            onRetry={exportStatus.state === "error" ? retryLastExport : undefined}
            retryLabel={exportStatus.action === "csv" ? "Retry CSV export" : "Retry PDF export"}
          />
        ) : null}

        {isSettingsLoading || isOperationsLoading ? (
          <>
            <ChartCardsSkeleton />
            <TableCardSkeleton columns={5} rows={5} titleWidth="w-40" />
          </>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <p className="text-sm text-muted-foreground">Confirmed collections this month</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {formatCurrency(reports?.collectionSummary.totalCollected ?? 0, currency)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Receivable payments confirmed in this reporting month</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <p className="text-sm text-muted-foreground">Paystack settlements</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {reports?.collectionSummary.paystackSettlements ?? 0}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Completed invoice payments captured via Paystack</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <p className="text-sm text-muted-foreground">Confirmed receivable payments</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {reports?.collectionSummary.confirmedReceivablePayments ?? 0}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">All completed customer payments in the workspace</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <p className="text-sm text-muted-foreground">Settled payables</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {formatCurrency(reports?.collectionSummary.totalPayablesSettled ?? 0, currency)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Completed outgoing payments reflected in reports</p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <h3 className="mb-4 font-semibold text-foreground">Cash Flow</h3>
                {reports ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={reports.cashFlowData}>
                      <CartesianGrid stroke="hsl(214, 32%, 91%)" strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(215, 16%, 47%)" />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        stroke="hsl(215, 16%, 47%)"
                        tickFormatter={(value) => `${(value / 1000000).toFixed(1)}m`}
                      />
                      <Tooltip formatter={(value: number) => formatCurrency(value, currency)} />
                      <Area
                        type="monotone"
                        dataKey="receivables"
                        stroke="hsl(204, 70%, 44%)"
                        fill="hsl(204, 70%, 44%)"
                        fillOpacity={0.15}
                        strokeWidth={2}
                        name="Receivables"
                      />
                      <Area
                        type="monotone"
                        dataKey="payables"
                        stroke="hsl(0, 72%, 51%)"
                        fill="hsl(0, 72%, 51%)"
                        fillOpacity={0.1}
                        strokeWidth={2}
                        name="Payables"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : null}
              </div>

              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <h3 className="mb-4 font-semibold text-foreground">Invoice Status Breakdown</h3>
                {reports && reports.invoiceStatusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={reports.invoiceStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        dataKey="value"
                        paddingAngle={3}
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {reports.invoiceStatusData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                      <text x="50%" y="48%" textAnchor="middle" className="fill-foreground text-2xl font-bold">
                        {reports.totalInvoices}
                      </text>
                      <text x="50%" y="56%" textAnchor="middle" className="fill-muted-foreground text-xs">
                        Invoices
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    title="No invoice activity yet"
                    description="Invoice status insights will appear here once your workspace starts issuing invoices."
                    icon={Download}
                  />
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <h3 className="font-semibold text-foreground">Monthly Summary</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Monthly financial summary</caption>
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      {["Month", "Invoiced", "Collected", "Bills Paid", "Net"].map((header) => (
                        <th key={header} scope="col" className="table-header px-4 py-3 text-left">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(reports?.monthlySummary ?? []).map((row, index) => (
                      <tr key={row.month} className={`border-b border-border last:border-0 ${index % 2 === 1 ? "bg-muted/10" : ""}`}>
                        <td className="px-4 py-3 font-medium text-foreground">{row.month}</td>
                        <td className="px-4 py-3">{formatCurrency(row.invoiced, currency)}</td>
                        <td className="px-4 py-3">{formatCurrency(row.collected, currency)}</td>
                        <td className="px-4 py-3">{formatCurrency(row.billsPaid, currency)}</td>
                        <td className={`px-4 py-3 font-medium ${row.net >= 0 ? "text-success" : "text-destructive"}`}>
                          {row.net >= 0 ? "+" : ""}
                          {formatCurrency(row.net, currency)}
                        </td>
                      </tr>
                    ))}
                    {reports && reports.monthlySummary.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                          Monthly summaries will appear here once invoices and bills start moving through the workspace.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default ReportsPage;
