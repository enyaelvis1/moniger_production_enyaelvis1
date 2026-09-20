import { useMemo, useState } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "@/components/app/EmptyState";
import { NotificationItemsSkeleton } from "@/components/app/StandalonePageSkeletons";
import { Button } from "@/components/ui/button";
import { useLocalization } from "@/hooks/use-localization";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotificationMutations, useNotificationsData, type NotificationItem } from "@/hooks/use-notifications-data";

const NotificationCenter = ({ businessId, userId }: { businessId?: string; userId?: string }) => {
  const navigate = useNavigate();
  const { formatRelativeTime, t } = useLocalization();
  const notificationsQuery = useNotificationsData(businessId, userId);
  const { markAllAsRead, markAsRead } = useNotificationMutations(businessId, userId);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [open, setOpen] = useState(false);

  const notifications = useMemo(() => notificationsQuery.data ?? [], [notificationsQuery.data]);
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const visibleNotifications = useMemo(
    () => (filter === "unread" ? notifications.filter((notification) => !notification.readAt) : notifications),
    [filter, notifications],
  );
  const typeLabel: Record<NotificationItem["type"], string> = useMemo(
    () => ({
      bill: t("notifications.center.type.bill"),
      invoice: t("notifications.center.type.invoice"),
      payment: t("notifications.center.type.payment"),
      report: t("notifications.center.type.report"),
      system: t("notifications.center.type.system"),
      team: t("notifications.center.type.team"),
    }),
    [t],
  );
  const unreadSummary =
    unreadCount === 0
      ? t("notifications.center.allCaughtUp")
      : unreadCount === 1
        ? t("notifications.center.unreadSingular")
        : t("notifications.center.unreadPlural", { count: unreadCount });

  const handleNotificationClick = async (notification: NotificationItem) => {
    if (!notification.readAt) {
      try {
        await markAsRead.mutateAsync(notification.id);
      } catch (error) {
        console.error("Unable to mark notification as read", error);
      }
    }

    if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={
            unreadCount > 0
              ? t("notifications.center.triggerWithUnread", { count: unreadCount })
              : t("notifications.center.triggerLabel")
          }
          aria-controls="notifications-panel"
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <Bell size={18} aria-hidden="true" />
          {unreadCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        id="notifications-panel"
        align="end"
        className="w-[360px] p-0"
        aria-label={t("notifications.center.title")}
        aria-labelledby="notifications-heading"
      >
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p id="notifications-heading" className="font-semibold text-foreground">{t("notifications.center.title")}</p>
              <p className="text-xs text-muted-foreground">{unreadSummary}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              disabled={unreadCount === 0 || markAllAsRead.isPending}
              onClick={() => void markAllAsRead.mutateAsync()}
            >
              {markAllAsRead.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
              {t("notifications.center.markAllRead")}
            </Button>
          </div>
          <div className="mt-3 flex gap-2">
            {[
              { label: t("notifications.center.all"), value: "all" as const },
              { label: t("notifications.center.unread"), value: "unread" as const },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                aria-pressed={filter === option.value}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filter === option.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <ScrollArea className="max-h-[420px]" aria-busy={notificationsQuery.isLoading}>
          {notificationsQuery.isLoading && !notificationsQuery.data ? (
            <NotificationItemsSkeleton />
          ) : null}

          {notificationsQuery.error ? (
            <div className="px-4 py-6 text-sm text-[#B42318]">{t("notifications.center.loadError")}</div>
          ) : null}

          {!notificationsQuery.isLoading && visibleNotifications.length === 0 ? (
            <div className="px-2 py-2">
              <EmptyState
                title={
                  filter === "unread"
                    ? t("notifications.center.empty.unreadTitle")
                    : t("notifications.center.empty.allTitle")
                }
                description={
                  filter === "unread"
                    ? t("notifications.center.empty.unreadDescription")
                    : t("notifications.center.empty.allDescription")
                }
                icon={Bell}
                size="compact"
                className="border-0 bg-transparent px-4 py-8"
                actions={
                  filter === "unread" && notifications.length > 0
                    ? [{ label: t("notifications.center.empty.showAll"), onClick: () => setFilter("all"), size: "sm", variant: "outline" }]
                    : []
                }
              />
            </div>
          ) : null}

          <div className="divide-y divide-border">
            {visibleNotifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => void handleNotificationClick(notification)}
                className={`w-full px-4 py-3 text-left transition-colors hover:bg-muted/30 ${
                  notification.readAt ? "bg-background" : "bg-primary/5"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {typeLabel[notification.type]}
                      </span>
                      {!notification.readAt ? <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" /> : null}
                    </div>
                    <p className="mt-2 text-sm font-medium text-foreground">{notification.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{notification.body}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatRelativeTime(notification.createdAt)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationCenter;
