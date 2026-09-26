import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface FilterTab {
  label: string;
  count: number;
  value: string;
}

interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface DataPageProps<T> {
  title: string;
  actionLabel: string;
  onAction: () => void;
  actionDisabled?: boolean;
  actionTitle?: string;
  tabs: FilterTab[];
  activeTab: string;
  onTabChange: (value: string) => void;
  columns: Column<T>[];
  data: T[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  toolbarSlot?: ReactNode;
  enableRowSelection?: boolean;
  getRowId?: (row: T, index: number) => string;
  renderBulkActions?: (context: {
    clearSelection: () => void;
    selectedIds: string[];
    selectedRows: T[];
  }) => ReactNode;
  isLoading?: boolean;
  loadingRowCount?: number;
}

function DataPage<T extends { id?: string }>({
  title,
  actionLabel,
  onAction,
  actionDisabled = false,
  actionTitle,
  tabs,
  activeTab,
  onTabChange,
  columns,
  data,
  searchValue,
  onSearchChange,
  emptyTitle = "No records found",
  emptyDescription = "Get started by creating your first record.",
  pageSize = 10,
  onRowClick,
  searchPlaceholder = "Search...",
  toolbarSlot,
  enableRowSelection = false,
  getRowId,
  renderBulkActions,
  isLoading = false,
  loadingRowCount = pageSize,
}: DataPageProps<T>) {
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const resolveRowId = useMemo(
    () => getRowId ?? ((row: T, index: number) => String(row.id ?? index)),
    [getRowId],
  );
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const start = (page - 1) * pageSize;
  const pageData = data.slice(start, start + pageSize);
  const currentPageRowIds = useMemo(
    () => pageData.map((row, index) => resolveRowId(row, start + index)),
    [pageData, resolveRowId, start],
  );
  const availableRowIds = useMemo(
    () => data.map((row, index) => resolveRowId(row, index)),
    [data, resolveRowId],
  );
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedRows = useMemo(
    () => data.filter((row, index) => selectedIdSet.has(resolveRowId(row, index))),
    [data, resolveRowId, selectedIdSet],
  );
  const allCurrentPageSelected = currentPageRowIds.length > 0 && currentPageRowIds.every((id) => selectedIdSet.has(id));
  const someCurrentPageSelected =
    currentPageRowIds.some((id) => selectedIdSet.has(id)) && !allCurrentPageSelected;
  const skeletonTabs = useMemo(
    () =>
      (tabs.length > 0 ? tabs : Array.from({ length: 4 }, (_, index) => ({ count: 0, label: `Loading ${index + 1}`, value: `loading-${index}` }))).slice(0, 4),
    [tabs],
  );
  const skeletonRows = useMemo(() => Array.from({ length: Math.max(3, loadingRowCount) }, (_, index) => index), [loadingRowCount]);

  useEffect(() => {
    setSelectedIds((currentSelectedIds) => currentSelectedIds.filter((id) => availableRowIds.includes(id)));
  }, [availableRowIds]);

  const clearSelection = () => setSelectedIds([]);

  const toggleRowSelection = (rowId: string, checked: boolean) => {
    setSelectedIds((currentSelectedIds) =>
      checked ? [...currentSelectedIds.filter((id) => id !== rowId), rowId] : currentSelectedIds.filter((id) => id !== rowId),
    );
  };

  const toggleCurrentPageSelection = (checked: boolean) => {
    setSelectedIds((currentSelectedIds) => {
      if (checked) {
        return Array.from(new Set([...currentSelectedIds, ...currentPageRowIds]));
      }

      return currentSelectedIds.filter((id) => !currentPageRowIds.includes(id));
    });
  };

  const handleRowKeyDown = (event: ReactKeyboardEvent<HTMLElement>, row: T) => {
    if (!onRowClick) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowClick(row);
    }
  };

  return (
    <div className="space-y-5" aria-busy={isLoading}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-primary">{title}</h2>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          {isLoading ? (
            <>
              {toolbarSlot ? <Skeleton className="h-10 w-full rounded-lg sm:w-40" /> : null}
              <Skeleton className="h-10 w-full rounded-lg sm:w-32" />
            </>
          ) : (
            <>
              {toolbarSlot}
              <Button onClick={onAction} disabled={actionDisabled} title={actionTitle} className="btn-press w-full rounded-lg sm:w-auto">
                {actionLabel}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {isLoading ? (
          <Skeleton className="h-10 w-full rounded-lg lg:max-w-sm" />
        ) : (
          <div className="relative min-w-0 flex-1 lg:max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label={`Search ${title.toLowerCase()}`}
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(event) => {
                onSearchChange(event.target.value);
                setPage(1);
              }}
              className="pl-9 rounded-lg"
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2" aria-label={`${title} filters`} role="group">
        {isLoading
          ? skeletonTabs.map((tab, index) => <Skeleton key={`${tab.value}-${index}`} className="h-8 w-24 rounded-full" />)
          : tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  onTabChange(tab.value);
                  setPage(1);
                }}
                aria-pressed={activeTab === tab.value}
                className={`px-3 py-1.5 rounded-pill text-xs font-medium transition-colors btn-press ${
                  activeTab === tab.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
      </div>

      {isLoading ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Loading {title.toLowerCase()} table</caption>
              <thead>
                <tr className="sticky top-0 border-b border-border bg-muted/50">
                  {enableRowSelection ? (
                    <th scope="col" className="w-12 px-4 py-3">
                      <span className="sr-only">Select rows</span>
                    </th>
                  ) : null}
                  {columns.map((col) => (
                    <th key={col.key} scope="col" className={`table-header px-4 py-3 text-left ${col.className || ""}`}>
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {skeletonRows.map((rowIndex) => (
                  <tr key={`skeleton-row-${rowIndex}`} className="border-b border-border last:border-0">
                    {enableRowSelection ? (
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-4 rounded-sm" />
                      </td>
                    ) : null}
                    {columns.map((col, columnIndex) => (
                      <td key={`${col.key}-${rowIndex}`} className={`px-4 py-3 ${col.className || ""}`}>
                        <Skeleton
                          className={`h-4 rounded ${
                            columnIndex === 0 ? "w-24" : columnIndex === columns.length - 1 ? "w-16" : "w-full max-w-[150px]"
                          }`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <Skeleton className="h-3 w-28" />
            <div className="flex gap-1">
              <Skeleton className="h-7 w-7 rounded-md" />
              <Skeleton className="h-7 w-7 rounded-md" />
            </div>
          </div>
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          icon={Search}
          actions={[{ label: actionLabel, onClick: onAction }]}
        />
      ) : (
        <div className="space-y-3">
          {enableRowSelection && selectedRows.length > 0 && renderBulkActions ? (
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
              <div className="text-sm font-medium text-foreground">{selectedRows.length} selected</div>
              <div className="flex flex-wrap items-center gap-2">
                {renderBulkActions({ clearSelection, selectedIds, selectedRows })}
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
              </div>
            </div>
          ) : null}

          <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
              <caption className="sr-only">{title} data table</caption>
              <thead>
                <tr className="sticky top-0 border-b border-border bg-muted/50">
                  {enableRowSelection ? (
                      <th scope="col" className="w-12 px-4 py-3">
                        <div onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            checked={allCurrentPageSelected ? true : someCurrentPageSelected ? "indeterminate" : false}
                            onCheckedChange={(checked) => toggleCurrentPageSelection(checked === true)}
                            aria-label="Select current page rows"
                          />
                        </div>
                      </th>
                    ) : null}
                    {columns.map((col) => (
                      <th key={col.key} scope="col" className={`table-header px-4 py-3 text-left ${col.className || ""}`}>
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageData.map((row, index) => {
                    const rowId = resolveRowId(row, start + index);
                    const rowSelected = selectedIdSet.has(rowId);

                    return (
                      <tr
                        key={rowId}
                        onClick={() => onRowClick?.(row)}
                        onKeyDown={(event) => handleRowKeyDown(event, row)}
                        tabIndex={onRowClick ? 0 : undefined}
                        className={`border-b border-border last:border-0 transition-colors hover:bg-muted/30 ${
                          rowSelected ? "bg-primary/5" : index % 2 === 1 ? "bg-muted/10" : ""
                        } ${onRowClick ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" : ""}`}
                      >
                        {enableRowSelection ? (
                          <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                            <Checkbox
                              checked={rowSelected}
                              onCheckedChange={(checked) => toggleRowSelection(rowId, checked === true)}
                              aria-label={`Select ${title.toLowerCase()} row ${start + index + 1}`}
                            />
                          </td>
                        ) : null}
                        {columns.map((col) => (
                          <td key={col.key} className={`px-4 py-3 ${col.className || ""}`}>
                            {col.render(row)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <span className="text-xs text-muted-foreground" aria-live="polite">
                {start + 1}-{Math.min(start + pageSize, data.length)} of {data.length} results
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  aria-label="Go to previous page"
                >
                  <ChevronLeft size={14} aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  aria-label="Go to next page"
                >
                  <ChevronRight size={14} aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-3 md:hidden" aria-label={`${title} mobile cards`}>
            {pageData.map((row, index) => {
              const rowId = resolveRowId(row, start + index);
              const rowSelected = selectedIdSet.has(rowId);

              return (
                <article
                  key={`mobile-${rowId}`}
                  onClick={() => onRowClick?.(row)}
                  onKeyDown={(event) => handleRowKeyDown(event, row)}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={`rounded-xl border border-border bg-card p-4 shadow-sm ${
                    onRowClick ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : ""
                  } ${rowSelected ? "ring-2 ring-primary/30" : ""}`}
                >
                  <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {title.slice(0, -1)} {start + index + 1}
                    </span>
                    {enableRowSelection ? (
                      <div onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={rowSelected}
                          onCheckedChange={(checked) => toggleRowSelection(rowId, checked === true)}
                          aria-label={`Select ${title.toLowerCase()} row ${start + index + 1}`}
                        />
                      </div>
                    ) : null}
                  </div>
                  <dl className="grid gap-3">
                    {columns.map((col) => (
                      <div key={col.key} className="grid grid-cols-[minmax(96px,0.4fr)_minmax(0,1fr)] items-start gap-3 text-sm">
                        <dt className="text-xs font-medium text-muted-foreground">{col.header}</dt>
                        <dd className="min-w-0 text-right text-foreground">{col.render(row)}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default DataPage;
