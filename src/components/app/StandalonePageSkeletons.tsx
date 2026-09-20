import { Skeleton } from "@/components/ui/skeleton";

const range = (count: number) => Array.from({ length: count }, (_, index) => index);

export const PageActionButtonsSkeleton = ({ count = 2 }: { count?: number }) => (
  <div className="flex flex-wrap gap-2">
    {range(count).map((index) => (
      <Skeleton key={`page-action-skeleton-${index}`} className="h-9 w-28 rounded-lg" />
    ))}
  </div>
);

export const SummaryCardsSkeleton = ({ count = 3 }: { count?: number }) => (
  <div className="grid gap-4 sm:grid-cols-3">
    {range(count).map((index) => (
      <div key={`summary-card-skeleton-${index}`} className="rounded-xl border-l-4 border-l-muted bg-card p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-4 rounded-full" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>
    ))}
  </div>
);

export const SearchFilterToolbarSkeleton = () => (
  <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
    <Skeleton className="h-10 w-full rounded-lg lg:max-w-sm" />
    <Skeleton className="h-10 w-full rounded-lg sm:w-44" />
  </div>
);

export const FilterControlsSkeleton = ({ count = 3 }: { count?: number }) => (
  <div className="sticky top-0 z-10 flex flex-wrap items-end gap-3 bg-background py-2">
    {range(count).map((index) => (
      <div key={`filter-control-skeleton-${index}`} className="space-y-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>
    ))}
  </div>
);

export const TableCardSkeleton = ({
  columns = 5,
  rows = 5,
  showCardHeader = true,
  titleWidth = "w-36",
}: {
  columns?: number;
  rows?: number;
  showCardHeader?: boolean;
  titleWidth?: string;
}) => (
  <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
    {showCardHeader ? (
      <div className="border-b border-border px-4 py-3">
        <Skeleton className={`h-5 ${titleWidth}`} />
      </div>
    ) : null}
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Loading table</caption>
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {range(columns).map((index) => (
              <th key={`table-header-skeleton-${index}`} scope="col" className="px-4 py-3 text-left">
                <Skeleton className="h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {range(rows).map((rowIndex) => (
            <tr key={`table-row-skeleton-${rowIndex}`} className="border-b border-border last:border-0">
              {range(columns).map((columnIndex) => (
                <td key={`table-cell-skeleton-${rowIndex}-${columnIndex}`} className="px-4 py-4">
                  <Skeleton
                    className={`h-4 rounded ${
                      columnIndex === 0 ? "w-24" : columnIndex === columns - 1 ? "w-20" : "w-full max-w-[150px]"
                    }`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export const ChartCardsSkeleton = ({ count = 2 }: { count?: number }) => (
  <div className="grid gap-6 lg:grid-cols-2">
    {range(count).map((index) => (
      <div key={`chart-card-skeleton-${index}`} className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <Skeleton className="mb-4 h-5 w-40" />
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export const TimelineEntriesSkeleton = ({ items = 6 }: { items?: number }) => (
  <div className="space-y-1">
    {range(items).map((index) => (
      <div key={`timeline-entry-skeleton-${index}`} className="flex items-start gap-4 rounded-xl p-4">
        <Skeleton className="mt-0.5 h-9 w-9 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
        <Skeleton className="h-3 w-20 shrink-0" />
      </div>
    ))}
  </div>
);

export const NotificationItemsSkeleton = ({ items = 5 }: { items?: number }) => (
  <div className="divide-y divide-border">
    {range(items).map((index) => (
      <div key={`notification-item-skeleton-${index}`} className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-2 w-2 rounded-full" />
            </div>
            <Skeleton className="h-4 w-44 max-w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
          <Skeleton className="h-3 w-14 shrink-0" />
        </div>
      </div>
    ))}
  </div>
);

const TeamMembersSkeleton = ({ items = 3 }: { items?: number }) => (
  <div className="space-y-3">
    {range(items).map((index) => (
      <div
        key={`team-member-skeleton-${index}`}
        className="flex flex-col gap-4 rounded-lg border border-border p-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
            <Skeleton className="h-3 w-44" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-10 w-[180px] rounded-md" />
          </div>
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
      </div>
    ))}
  </div>
);

export const SettingsSectionSkeleton = ({
  variant,
}: {
  variant: "business" | "notifications" | "profile" | "security" | "team";
}) => {
  if (variant === "profile") {
    return (
      <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
        <Skeleton className="h-6 w-44" />
        <div className="flex items-center gap-5">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {range(3).map((index) => (
            <div key={`settings-profile-field-${index}`} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
      </div>
    );
  }

  if (variant === "business") {
    return (
      <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
        <Skeleton className="h-6 w-44" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {range(6).map((index) => (
            <div key={`settings-business-field-${index}`} className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
      </div>
    );
  }

  if (variant === "notifications") {
    return (
      <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
        <Skeleton className="h-6 w-32" />
        <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
          <Skeleton className="h-6 w-11 rounded-full" />
        </div>
        <div className="space-y-3">
          {range(6).map((index) => (
            <div key={`settings-notification-item-${index}`} className="flex items-start justify-between gap-4 rounded-lg border border-border px-4 py-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-10 w-36 rounded-md" />
        </div>
      </div>
    );
  }

  if (variant === "security") {
    return (
      <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3 w-72 max-w-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-44" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {range(4).map((index) => (
                <div key={`settings-security-card-${index}`} className="rounded-lg border border-border bg-background px-4 py-3">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-2 h-4 w-28" />
                </div>
              ))}
            </div>
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
          <div className="space-y-4 rounded-xl border border-border bg-background p-5">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-56" />
            </div>
            <Skeleton className="h-3 w-full" />
            <div className="space-y-3">
              {range(3).map((index) => (
                <Skeleton key={`settings-security-action-${index}`} className="h-10 w-full rounded-md" />
              ))}
            </div>
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-3 w-80 max-w-full" />
            </div>
            <Skeleton className="h-10 w-48 rounded-md" />
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            {range(4).map((index) => (
              <div key={`settings-password-field-${index}`} className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-3 w-48" />
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-3 w-72 max-w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-20 rounded-md" />
              <Skeleton className="h-10 w-36 rounded-md" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-3 w-72 max-w-full" />
            </div>
            <Skeleton className="h-10 w-52 rounded-md" />
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            {range(3).map((index) => (
              <div key={`settings-mfa-card-${index}`} className="rounded-lg border border-border bg-muted/20 p-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-3 h-6 w-20" />
                <Skeleton className="mt-2 h-3 w-full" />
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {range(2).map((index) => (
              <div
                key={`settings-mfa-factor-${index}`}
                className="flex flex-col gap-4 rounded-lg border border-border p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-10 w-36 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-3 w-72 max-w-full" />
        </div>
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {range(3).map((index) => (
          <div key={`settings-team-summary-${index}`} className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-7 w-12" />
          </div>
        ))}
      </div>
      <TeamMembersSkeleton />
    </div>
  );
};
