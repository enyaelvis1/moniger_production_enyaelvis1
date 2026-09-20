import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, Loader2 } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import OperationStatusNotice, { type OperationStatusState } from "@/components/app/OperationStatusNotice";
import { SearchFilterToolbarSkeleton, SummaryCardsSkeleton, TableCardSkeleton } from "@/components/app/StandalonePageSkeletons";
import StatusBadge from "@/components/app/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { usePaymentsData, type PaymentRecord } from "@/hooks/use-finance-data";
import { useLocalization } from "@/hooks/use-localization";
import { useSearchParamState } from "@/hooks/use-search-param";
import { useSettingsData } from "@/hooks/use-settings-data";
import { Button } from "@/components/ui/button";
import { AdvancedFilter } from "@/components/ui/advanced-filter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { waitForUiFrame } from "@/lib/async";
import { createExportFileName, openPrintDocument } from "@/lib/export";
import {
  getMultiSelectFilterValue,
  getStringFilterValue,
  isDateRangeFilterValue,
  isNumberRangeFilterValue,
  matchesDateRange,
  matchesNumberRange,
  type AdvancedFilterDefinition,
  type AdvancedFilterState,
} from "@/lib/advanced-filters";
import { getFriendlyErrorMessage } from "@/lib/error-handling";

const readMetadataString = (metadata: PaymentRecord["metadata"], key: string) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "";
  }

  const value = metadata[key];
  return typeof value === "string" ? value : "";
};

const statusBadge = (status: PaymentRecord["status"]) => {
  const map = {
    completed: { label: "Completed", variant: "green" },
    failed: { label: "Failed", variant: "red" },
    pending: { label: "Pending", variant: "amber" },
    scheduled: { label: "Scheduled", variant: "blue" },
  } as const;
  const config = map[status];
  return <StatusBadge variant={config.variant}>{config.label}</StatusBadge>;
};

const typeBadge = (type: PaymentRecord["type"]) => {
  const isReceivable = type === "receivable";
  return <StatusBadge variant={isReceivable ? "green" : "red"}>{isReceivable ? "Receivable" : "Payable"}</StatusBadge>;
};

const formatGateway = (gateway: PaymentRecord["gateway"]) => {
  const map = {
    bank_transfer: "Bank Transfer",
    manual: "Manual",
    paystack: "Paystack",
    stripe: "Stripe",
  } as const;
  return map[gateway];
};

const getErrorMessage = (error: unknown, fallbackMessage: string) =>
  getFriendlyErrorMessage(error, fallbackMessage);

type ReceiptExportStatus =
  | null
  | {
      description: string;
      paymentId: string;
      state: OperationStatusState;
      title: string;
    };

const handleTableRowKeyDown = (event: ReactKeyboardEvent<HTMLTableRowElement>, onActivate: () => void) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onActivate();
  }
};

const PaymentsPage = () => {
  const { user } = useAuth();
  const { formatCurrency, formatDate, formatDateTime, language, t } = useLocalization();
  const settingsQuery = useSettingsData(user?.id);
  const businessId = settingsQuery.data?.business?.id;
  const businessName = settingsQuery.data?.business?.name ?? "Moniger Workspace";
  const paymentsQuery = usePaymentsData(businessId);

  const [search, setSearch] = useSearchParamState();
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilterState>({});
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [receiptExportStatus, setReceiptExportStatus] = useState<ReceiptExportStatus>(null);

  const payments = useMemo(() => paymentsQuery.data ?? [], [paymentsQuery.data]);
  const selectedPayment = useMemo(
    () => payments.find((payment) => payment.id === selectedPaymentId) ?? null,
    [payments, selectedPaymentId],
  );
  const advancedFilterDefinitions: AdvancedFilterDefinition[] = useMemo(
    () => [
      {
        emptyLabel: "All statuses",
        id: "status",
        label: "Status",
        options: [
          { label: "Completed", value: "completed" },
          { label: "Scheduled", value: "scheduled" },
          { label: "Pending", value: "pending" },
          { label: "Failed", value: "failed" },
        ],
        type: "select",
      },
      {
        emptyLabel: "All types",
        id: "type",
        label: "Type",
        options: [
          { label: "Receivable", value: "receivable" },
          { label: "Payable", value: "payable" },
        ],
        type: "select",
      },
      {
        fromLabel: "Paid from",
        id: "date",
        label: "Payment Date",
        toLabel: "Paid to",
        type: "date-range",
      },
      {
        id: "amount",
        label: "Amount",
        maxPlaceholder: "10000000",
        minPlaceholder: "0",
        step: "0.01",
        type: "number-range",
      },
      {
        id: "gateway",
        label: "Gateway",
        options: [
          { label: "Manual", value: "manual" },
          { label: "Bank Transfer", value: "bank_transfer" },
          { label: "Paystack", value: "paystack" },
          { label: "Stripe", value: "stripe" },
        ],
        type: "multi-select",
      },
    ],
    [],
  );

  const filteredPayments = useMemo(() => {
    let list = payments;
    const statusFilter = getStringFilterValue(advancedFilters.status);
    const typeFilter = getStringFilterValue(advancedFilters.type);
    const dateRange = isDateRangeFilterValue(advancedFilters.date) ? advancedFilters.date : undefined;
    const amountRange = isNumberRangeFilterValue(advancedFilters.amount) ? advancedFilters.amount : undefined;
    const gatewayFilters = getMultiSelectFilterValue(advancedFilters.gateway);

    if (statusFilter) {
      list = list.filter((payment) => payment.status === statusFilter);
    }

    if (typeFilter) {
      list = list.filter((payment) => payment.type === typeFilter);
    }

    list = list.filter((payment) => matchesDateRange(payment.date, dateRange));
    list = list.filter((payment) => matchesNumberRange(payment.amount, amountRange));

    if (gatewayFilters.length > 0) {
      list = list.filter((payment) => gatewayFilters.includes(payment.gateway));
    }

    if (!search.trim()) {
      return list;
    }

    const normalizedSearch = search.trim().toLowerCase();
    return list.filter(
      (payment) =>
        payment.reference.toLowerCase().includes(normalizedSearch) ||
        payment.party.toLowerCase().includes(normalizedSearch) ||
        payment.linkedRef.toLowerCase().includes(normalizedSearch),
    );
  }, [advancedFilters.amount, advancedFilters.date, advancedFilters.gateway, advancedFilters.status, advancedFilters.type, payments, search]);

  const summaryCurrency = filteredPayments[0]?.currency ?? "NGN";
  const totalPaidOut = filteredPayments
    .filter((payment) => payment.type === "payable" && payment.status === "completed")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const totalReceived = filteredPayments
    .filter((payment) => payment.type === "receivable" && payment.status === "completed")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const net = totalReceived - totalPaidOut;

  const isSettingsLoading = settingsQuery.isLoading && !settingsQuery.data;
  const isPaymentsLoading = paymentsQuery.isLoading && !paymentsQuery.data;
  const selectedReceiptStatus =
    selectedPayment && receiptExportStatus?.paymentId === selectedPayment.id ? receiptExportStatus : null;

  const handleDownloadReceipt = async (payment: PaymentRecord) => {
    setReceiptExportStatus({
      description: "We are preparing a print-ready receipt for this payment.",
      paymentId: payment.id,
      state: "running",
      title: "Preparing receipt",
    });
    await waitForUiFrame();

    try {
      openPrintDocument({
        eyebrowLabel: t("export.eyebrow"),
        fileName: createExportFileName(payment.reference),
        generatedAtLabel: t("export.generatedAt", { timestamp: formatDateTime(new Date()) }),
        htmlLang: language,
        metadata: [
          { label: "Workspace", value: businessName },
          { label: "Receipt Reference", value: payment.reference },
          { label: "Date", value: payment.date },
          { label: "Type", value: payment.type === "receivable" ? "Receivable" : "Payable" },
          { label: "Status", value: payment.status.charAt(0).toUpperCase() + payment.status.slice(1) },
        ],
        sections: [
          {
            rows: [
              { label: "Party", value: payment.party },
              { label: "Amount", value: formatCurrency(payment.amount, payment.currency) },
              { label: "Gateway", value: formatGateway(payment.gateway) },
              { label: "Linked Document", value: payment.linkedRef },
              { label: "Source", value: readMetadataString(payment.metadata, "source") || "payments" },
              { label: "Gateway Response", value: payment.gatewayResponse || "No gateway response captured" },
            ],
            title: "Receipt Details",
          },
        ],
        subtitle: `Printable payment receipt for ${payment.party}`,
        title: `Receipt ${payment.reference}`,
      });
      setReceiptExportStatus({
        description: "The receipt opened in a print-ready browser window.",
        paymentId: payment.id,
        state: "success",
        title: "Receipt ready",
      });
    } catch (error) {
      setReceiptExportStatus({
        description: getErrorMessage(error, "Please allow popups and try again."),
        paymentId: payment.id,
        state: "error",
        title: "Unable to export receipt",
      });
    }
  };

  const retryReceiptExport = () => {
    if (!selectedPayment) {
      return;
    }

    void handleDownloadReceipt(selectedPayment);
  };

  return (
    <AppLayout>
      <div className="page-enter space-y-6">
        {settingsQuery.error ? (
          <div className="rounded-xl border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
            {getErrorMessage(settingsQuery.error, "We could not load your workspace.")}
          </div>
        ) : null}

        {paymentsQuery.error ? (
          <div className="rounded-xl border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
            {getErrorMessage(paymentsQuery.error, "We could not load your payments right now.")}
          </div>
        ) : null}

        {!businessId && !isSettingsLoading ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Your workspace is still being prepared. Payments will appear here once the business record is available.
          </div>
        ) : null}

        <h2 className="text-2xl font-bold text-primary">Payments</h2>

        {isSettingsLoading || isPaymentsLoading ? (
          <>
            <SummaryCardsSkeleton />
            <SearchFilterToolbarSkeleton />
            <TableCardSkeleton columns={8} rows={6} showCardHeader={false} />
          </>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  border: "border-l-destructive",
                  icon: ArrowUpRight,
                  iconColor: "text-destructive",
                  label: "Total Paid Out",
                  value: formatCurrency(totalPaidOut, summaryCurrency),
                },
                {
                  border: "border-l-success",
                  icon: ArrowDownLeft,
                  iconColor: "text-success",
                  label: "Total Received",
                  value: formatCurrency(totalReceived, summaryCurrency),
                },
                {
                  border: net >= 0 ? "border-l-success" : "border-l-destructive",
                  icon: null,
                  iconColor: "",
                  label: "Net",
                  value: `${net >= 0 ? "+" : "-"}${formatCurrency(Math.abs(net), summaryCurrency)}`,
                },
              ].map((card) => (
                <div key={card.label} className={`rounded-xl border-l-4 bg-card p-6 shadow-sm transition-shadow hover:shadow-md ${card.border}`}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{card.label}</span>
                    {card.icon ? <card.icon size={16} className={card.iconColor} aria-hidden="true" /> : null}
                  </div>
                  <p className="text-2xl font-bold text-foreground">{card.value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
              <div className="relative max-w-sm flex-1">
                <Input
                  aria-label="Search payments"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Reference, party, or document"
                  className="rounded-lg"
                />
              </div>
              <AdvancedFilter
                definitions={advancedFilterDefinitions}
                state={advancedFilters}
                onChange={setAdvancedFilters}
                storageKey="payments"
              />
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Payments table</caption>
                  <thead>
                    <tr className="sticky top-0 border-b border-border bg-muted/50">
                      {["Date", "Reference", "Type", "Party", "Linked Document", "Amount", "Gateway", "Status"].map((header) => (
                        <th key={header} scope="col" className="table-header px-4 py-3 text-left">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((payment, index) => (
                      <tr
                        key={payment.id}
                        onClick={() => setSelectedPaymentId(payment.id)}
                        onKeyDown={(event) => handleTableRowKeyDown(event, () => setSelectedPaymentId(payment.id))}
                        tabIndex={0}
                        className={`cursor-pointer border-b border-border transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                          index % 2 === 1 ? "bg-muted/10" : ""
                        }`}
                        aria-label={`View payment ${payment.reference}`}
                      >
                        <td className="px-4 py-3">{formatDate(payment.date)}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{payment.reference}</td>
                        <td className="px-4 py-3">{typeBadge(payment.type)}</td>
                        <td className="px-4 py-3">{payment.party}</td>
                        <td className="px-4 py-3">{payment.linkedRef}</td>
                        <td className="px-4 py-3 font-medium">{formatCurrency(payment.amount, payment.currency)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-lg bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {formatGateway(payment.gateway)}
                          </span>
                        </td>
                        <td className="px-4 py-3">{statusBadge(payment.status)}</td>
                      </tr>
                    ))}
                    {filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                          Payments will appear here when invoices are sent or paid, and when bills are scheduled or marked paid.
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

      <Sheet open={Boolean(selectedPayment)} onOpenChange={(open) => !open && setSelectedPaymentId(null)}>
        <SheetContent className="w-full sm:max-w-[420px]">
          <SheetHeader>
            <SheetTitle>Payment Details</SheetTitle>
            <SheetDescription>
              Review payment metadata and export a receipt for this transaction.
            </SheetDescription>
          </SheetHeader>
          {selectedPayment ? (
            <div className="mt-6 space-y-5">
              {selectedReceiptStatus ? (
                <OperationStatusNotice
                  description={selectedReceiptStatus.description}
                  state={selectedReceiptStatus.state}
                  title={selectedReceiptStatus.title}
                  onRetry={selectedReceiptStatus.state === "error" ? retryReceiptExport : undefined}
                  retryLabel="Retry receipt export"
                />
              ) : null}
              <div className="space-y-3">
                {[
                  { label: "Reference", value: selectedPayment.reference },
                  { label: "Date", value: formatDate(selectedPayment.date) },
                  { label: "Type", value: selectedPayment.type === "receivable" ? "Receivable" : "Payable" },
                  { label: "Party", value: selectedPayment.party },
                  { label: "Amount", value: formatCurrency(selectedPayment.amount, selectedPayment.currency) },
                  { label: "Gateway", value: formatGateway(selectedPayment.gateway) },
                  { label: "Status", value: selectedPayment.status.charAt(0).toUpperCase() + selectedPayment.status.slice(1) },
                  { label: "Linked Document", value: selectedPayment.linkedRef },
                  { label: "Source", value: readMetadataString(selectedPayment.metadata, "source") || "payments" },
                  { label: "Gateway Response", value: selectedPayment.gatewayResponse },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between gap-4 border-b border-border py-2 last:border-0">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className="text-right text-sm font-medium text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                className="w-full rounded-lg btn-press"
                onClick={() => void handleDownloadReceipt(selectedPayment)}
                disabled={selectedReceiptStatus?.state === "running"}
              >
                {selectedReceiptStatus?.state === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Download Receipt
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
};

export default PaymentsPage;
