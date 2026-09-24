import { useMemo, useState } from "react";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  invokeAdminConsole,
  useAdminConsoleQuery,
  type AdminAnnouncementsResponse,
} from "@/admin/lib/admin-console";
import {
  AdminBadge,
  AdminPageHeader,
  AdminSectionCard,
} from "@/admin/components/AdminUi";

const initialForm = {
  announcementId: "",
  body: "",
  expiresAt: "",
  publishedAt: "",
  target: "all",
  title: "",
  type: "info",
};

const AdminAnnouncementsPage = () => {
  const { toast } = useToast();
  const [form, setForm] = useState(initialForm);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const announcementsQuery = useAdminConsoleQuery<AdminAnnouncementsResponse>("announcements.list");
  const previewStatus = useMemo(
    () => form.publishedAt ? "Scheduled" : "Draft",
    [form.publishedAt],
  );
  const rows = announcementsQuery.data?.rows ?? [];
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.announcementId));

  const saveAnnouncement = async (publishNow = false) => {
    try {
      await invokeAdminConsole("announcements.save", {
        ...form,
        announcementId: form.announcementId || undefined,
        publishNow,
      });
      await announcementsQuery.refetch();
      toast({
        title: publishNow ? "Announcement published" : "Announcement saved",
        description: publishNow ? "Notifications were queued for the target audience." : "The draft was saved.",
      });
      if (!publishNow) {
        setForm(initialForm);
      }
    } catch (error) {
      toast({
        title: "Unable to save announcement",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0 || !window.confirm(`Delete ${selectedIds.length} selected announcement${selectedIds.length === 1 ? "" : "s"}?`)) return;
    try {
      await Promise.all(selectedIds.map((announcementId) => invokeAdminConsole("announcements.delete", { announcementId })));
      await announcementsQuery.refetch();
      setSelectedIds([]);
      toast({ title: "Announcements deleted", description: "The selected announcements were removed." });
    } catch (error) {
      toast({ title: "Unable to delete announcements", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Announcements"
        subtitle="Create, schedule, preview, and publish operator notices across the platform."
        action={selectedIds.length > 0 ? <Button variant="destructive" onClick={() => void deleteSelected()}>Delete selected ({selectedIds.length})</Button> : null}
      />

      <AdminSectionCard title="What this page is for">
        <div className="space-y-2 text-sm text-white/60">
          <p>Use Announcements for platform-wide notices such as maintenance windows, product updates, billing alerts, and rollout messaging.</p>
          <p>Drafts let you prepare copy safely, scheduled items let you publish later, and published items fan out to the intended audience without editing app content directly.</p>
        </div>
      </AdminSectionCard>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <AdminSectionCard title="Announcements List">
          {rows.length > 0 ? <label className="mb-4 flex items-center gap-2 text-xs text-white/60"><Checkbox checked={allSelected} onCheckedChange={(checked) => setSelectedIds(checked === true ? rows.map((row) => row.announcementId) : [])} aria-label="Select all announcements" /> Select all visible ({selectedIds.length} selected)</label> : null}
          <div className="space-y-3">
            {rows.map((announcement) => (
              <div key={announcement.announcementId} className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Checkbox checked={selectedIds.includes(announcement.announcementId)} onCheckedChange={(checked) => setSelectedIds((current) => checked === true ? [...new Set([...current, announcement.announcementId])] : current.filter((id) => id !== announcement.announcementId))} aria-label={`Select ${announcement.title}`} className="mb-2" />
                    <p className="text-sm font-semibold text-[#F1F5F9]">{announcement.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-white/45">{announcement.body}</p>
                  </div>
                  <AdminBadge tone={announcement.status === "live" ? "success" : announcement.status === "scheduled" ? "warning" : "neutral"}>
                    {announcement.status}
                  </AdminBadge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <AdminBadge tone="neutral">{announcement.type}</AdminBadge>
                  <AdminBadge tone="info">{announcement.target}</AdminBadge>
                  <Button
                    variant="ghost"
                    className="h-8 rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => setForm({
                      announcementId: announcement.announcementId,
                      body: announcement.body,
                      expiresAt: announcement.expiresAt ?? "",
                      publishedAt: announcement.publishedAt ?? "",
                      target: announcement.target,
                      title: announcement.title,
                      type: announcement.type,
                    })}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-8 rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10"
                    onClick={async () => {
                      await invokeAdminConsole("announcements.duplicate", { announcementId: announcement.announcementId });
                      await announcementsQuery.refetch();
                    }}
                  >
                    Duplicate
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-8 rounded-lg border border-[#EF4444]/20 bg-[#EF4444]/10 text-[#FCA5A5] hover:bg-[#EF4444]/20"
                    onClick={async () => {
                      await invokeAdminConsole("announcements.delete", { announcementId: announcement.announcementId });
                      await announcementsQuery.refetch();
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </AdminSectionCard>

        <AdminSectionCard title="Create / Edit">
          <div className="space-y-3">
            <Input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Announcement title"
              className="border-white/10 bg-[#0F1621] text-white placeholder:text-white/30"
            />
            <Textarea
              value={form.body}
              onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
              placeholder="Write the announcement body..."
              className="min-h-[140px] border-white/10 bg-[#0F1621] text-white placeholder:text-white/30"
            />
            <div className="text-right text-xs text-white/30">{form.body.length} characters</div>
            <Select value={form.type} onValueChange={(value) => setForm((current) => ({ ...current, type: value }))}>
              <SelectTrigger className="border-white/10 bg-[#0F1621] text-white">
                <SelectValue placeholder="Announcement type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="feature">Feature</SelectItem>
              </SelectContent>
            </Select>
            <Select value={form.target} onValueChange={(value) => setForm((current) => ({ ...current, target: value }))}>
              <SelectTrigger className="border-white/10 bg-[#0F1621] text-white">
                <SelectValue placeholder="Audience" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                <SelectItem value="starter">Starter only</SelectItem>
                <SelectItem value="growth">Growth only</SelectItem>
                <SelectItem value="business">Business only</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="datetime-local"
              value={form.publishedAt}
              onChange={(event) => setForm((current) => ({ ...current, publishedAt: event.target.value }))}
              className="border-white/10 bg-[#0F1621] text-white"
            />
            <Input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))}
              className="border-white/10 bg-[#0F1621] text-white"
            />

            <div className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
              <div className="flex items-center gap-2 text-sm text-[#F1F5F9]">
                <Megaphone size={16} aria-hidden="true" />
                Preview
              </div>
              <p className="mt-3 text-sm font-medium text-[#F1F5F9]">{form.title || "Announcement title"}</p>
              <p className="mt-1 text-sm text-white/45">{form.body || "Announcement body preview will appear here."}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <AdminBadge tone="neutral">{previewStatus}</AdminBadge>
                <AdminBadge tone="info">{form.target}</AdminBadge>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button className="bg-white/10 text-white hover:bg-white/15" onClick={() => void saveAnnouncement(false)}>
                Save as Draft
              </Button>
              <Button className="bg-[#3B82F6] text-white hover:bg-[#2563EB]" onClick={() => void saveAnnouncement(true)}>
                Publish Now
              </Button>
            </div>
          </div>
        </AdminSectionCard>
      </div>
    </div>
  );
};

export default AdminAnnouncementsPage;
