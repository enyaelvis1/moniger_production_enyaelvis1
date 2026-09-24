import { useMemo, useState } from "react";
import { BookOpen, FileText, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { invokeAdminConsole, useAdminConsoleQuery, type AdminContentItem, type AdminContentResponse } from "@/admin/lib/admin-console";
import { AdminBadge, AdminEmpty, AdminPageHeader, AdminSectionCard } from "@/admin/components/AdminUi";

type ContentType = "help_article" | "changelog";

const emptyForm = {
  body: "",
  category: "",
  changes: "",
  excerpt: "",
  id: "",
  published: false,
  releaseDate: "",
  relatedHelpSlugs: "",
  slug: "",
  sortOrder: "0",
  tag: "",
  title: "",
  version: "",
};

const parseChanges = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
  const [type, ...textParts] = line.split("|");
  return { text: textParts.join("|").trim() || type.trim(), type: textParts.length > 0 ? type.trim() : "feature" };
});

const serializeChanges = (changes: AdminContentItem["changes"]) => changes.map((change) => `${change.type || "feature"}|${change.text || ""}`).join("\n");

const AdminContentPage = () => {
  const { toast } = useToast();
  const [contentType, setContentType] = useState<ContentType>("help_article");
  const [form, setForm] = useState(emptyForm);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const contentQuery = useAdminConsoleQuery<AdminContentResponse>("content.list", { contentType });
  const items = contentQuery.data?.items ?? [];
  const contentLabel = contentType === "help_article" ? "Help Centre" : "Changelog";
  const isChangelog = contentType === "changelog";
  const formReady = Boolean(form.title.trim() && form.body.trim());
  const listDescription = useMemo(() => isChangelog ? "Publish product releases and visible change summaries." : "Publish searchable help articles and frequently asked questions.", [isChangelog]);
  const allSelected = items.length > 0 && items.every((item) => selectedIds.includes(item.id));

  const selectType = (nextType: ContentType) => {
    setContentType(nextType);
    setForm(emptyForm);
  };

  const editItem = (item: AdminContentItem) => {
    setForm({
      body: item.body,
      category: item.category ?? "",
      changes: serializeChanges(item.changes),
      excerpt: item.excerpt ?? "",
      id: item.id,
      published: item.published,
      releaseDate: item.releaseDate ?? "",
      relatedHelpSlugs: item.relatedHelpSlugs.join("\n"),
      slug: item.slug,
      sortOrder: String(item.sortOrder),
      tag: item.tag ?? "",
      title: item.title,
      version: item.version ?? "",
    });
  };

  const save = async () => {
    try {
      await invokeAdminConsole("content.save", {
        body: form.body,
        category: form.category,
        changes: isChangelog ? parseChanges(form.changes) : [],
        contentType,
        excerpt: form.excerpt,
        id: form.id || undefined,
        published: form.published,
        releaseDate: form.releaseDate || undefined,
        relatedHelpSlugs: isChangelog ? form.relatedHelpSlugs.split("\n").map((slug) => slug.trim()).filter(Boolean) : [],
        slug: form.slug,
        sortOrder: Number(form.sortOrder) || 0,
        tag: form.tag,
        title: form.title,
        version: form.version,
      });
      await contentQuery.refetch();
      setForm(emptyForm);
      toast({ title: form.published ? "Content published" : "Draft saved", description: `${contentLabel} content was updated.` });
    } catch (error) {
      toast({ title: "Unable to save content", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0 || !window.confirm(`Delete ${selectedIds.length} selected ${contentLabel} entr${selectedIds.length === 1 ? "y" : "ies"}?`)) return;
    try {
      await Promise.all(selectedIds.map((id) => invokeAdminConsole("content.delete", { id })));
      await contentQuery.refetch();
      setSelectedIds([]);
      toast({ title: "Content deleted", description: "The selected public content entries were removed." });
    } catch (error) {
      toast({ title: "Unable to delete content", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Content" subtitle="Manage public Help Centre articles, FAQs, and Changelog entries." action={selectedIds.length > 0 ? <Button variant="destructive" onClick={() => void deleteSelected}><Trash2 size={14} /> Delete selected ({selectedIds.length})</Button> : null} />

      <div className="flex flex-wrap gap-2 rounded-xl border border-white/5 bg-[#111927] p-2">
        <Button variant="ghost" className={contentType === "help_article" ? "bg-[#3B82F6] text-white" : "text-white/60 hover:bg-white/10 hover:text-white"} onClick={() => selectType("help_article")}>
          <BookOpen size={15} aria-hidden="true" /> Help Centre
        </Button>
        <Button variant="ghost" className={contentType === "changelog" ? "bg-[#3B82F6] text-white" : "text-white/60 hover:bg-white/10 hover:text-white"} onClick={() => selectType("changelog")}>
          <FileText size={15} aria-hidden="true" /> Changelog
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminSectionCard title={`${contentLabel} entries`}>
          <p className="mb-4 text-sm text-white/50">{listDescription}</p>
          {items.length > 0 ? <label className="mb-4 flex items-center gap-2 text-xs text-white/60"><Checkbox checked={allSelected} onCheckedChange={(checked) => setSelectedIds(checked === true ? items.map((item) => item.id) : [])} aria-label={`Select all ${contentLabel} entries`} /> Select all visible ({selectedIds.length} selected)</label> : null}
          {items.length === 0 ? (
            <AdminEmpty title={`No ${contentLabel.toLowerCase()} content yet`} description="Create a draft on the right, then publish it when it is ready." icon={isChangelog ? FileText : BookOpen} />
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Checkbox checked={selectedIds.includes(item.id)} onCheckedChange={(checked) => setSelectedIds((current) => checked === true ? [...new Set([...current, item.id])] : current.filter((id) => id !== item.id))} aria-label={`Select ${item.title}`} className="mb-2" />
                      <p className="font-medium text-[#F1F5F9]">{item.title}</p>
                      <p className="mt-1 text-xs text-white/40">{item.slug}{item.version ? ` · v${item.version}` : ""}</p>
                    </div>
                    <AdminBadge tone={item.published ? "success" : "neutral"}>{item.published ? "published" : "draft"}</AdminBadge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-white/50">{item.excerpt || item.body}</p>
                  <div className="mt-3 flex gap-2">
                    <Button variant="ghost" className="h-8 border border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => editItem(item)}>
                      <Pencil size={13} aria-hidden="true" /> Edit
                    </Button>
                    <Button variant="ghost" className="h-8 border border-[#EF4444]/20 bg-[#EF4444]/10 text-[#FCA5A5] hover:bg-[#EF4444]/20" onClick={async () => {
                      await invokeAdminConsole("content.delete", { id: item.id });
                      await contentQuery.refetch();
                      toast({ title: "Content deleted", description: "The public content entry was removed." });
                    }}>
                      <Trash2 size={13} aria-hidden="true" /> Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminSectionCard>

        <AdminSectionCard title={form.id ? "Edit content" : "Create content"}>
          <div className="space-y-3">
            <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder={isChangelog ? "Release title" : "Article title"} className="border-white/10 bg-[#0F1621] text-white placeholder:text-white/30" />
            <Input value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="URL slug" className="border-white/10 bg-[#0F1621] text-white placeholder:text-white/30" />
            <Input value={form.excerpt} onChange={(event) => setForm((current) => ({ ...current, excerpt: event.target.value }))} placeholder="Short summary" className="border-white/10 bg-[#0F1621] text-white placeholder:text-white/30" />
            {!isChangelog ? <Input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="Category, e.g. Getting Started" className="border-white/10 bg-[#0F1621] text-white placeholder:text-white/30" /> : null}
            {isChangelog ? <div className="grid grid-cols-2 gap-3"><Input value={form.version} onChange={(event) => setForm((current) => ({ ...current, version: event.target.value }))} placeholder="Version, e.g. 1.2.0" className="border-white/10 bg-[#0F1621] text-white placeholder:text-white/30" /><Input type="date" value={form.releaseDate} onChange={(event) => setForm((current) => ({ ...current, releaseDate: event.target.value }))} className="border-white/10 bg-[#0F1621] text-white" /></div> : null}
            {isChangelog ? <Input value={form.tag} onChange={(event) => setForm((current) => ({ ...current, tag: event.target.value }))} placeholder="Release tag" className="border-white/10 bg-[#0F1621] text-white placeholder:text-white/30" /> : null}
            <Textarea value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} placeholder={isChangelog ? "Release summary" : "Answer or article body"} className="min-h-[130px] border-white/10 bg-[#0F1621] text-white placeholder:text-white/30" />
            {isChangelog ? <Textarea value={form.changes} onChange={(event) => setForm((current) => ({ ...current, changes: event.target.value }))} placeholder="One change per line: feature|Added FAQ search" className="min-h-[110px] border-white/10 bg-[#0F1621] text-white placeholder:text-white/30" /> : null}
            {isChangelog ? <Textarea value={form.relatedHelpSlugs} onChange={(event) => setForm((current) => ({ ...current, relatedHelpSlugs: event.target.value }))} placeholder="Related Help Centre slugs, one per line" className="min-h-[90px] border-white/10 bg-[#0F1621] text-white placeholder:text-white/30" /> : null}
            <Input type="number" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} placeholder="Sort order" className="border-white/10 bg-[#0F1621] text-white placeholder:text-white/30" />
            <label className="flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={form.published} onChange={(event) => setForm((current) => ({ ...current, published: event.target.checked }))} /> Publish publicly</label>
            <div className="flex gap-3"><Button variant="ghost" className="border border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => setForm(emptyForm)}>Clear</Button><Button disabled={!formReady} className="bg-[#3B82F6] text-white hover:bg-[#2563EB]" onClick={() => void save()}>Save content</Button></div>
          </div>
        </AdminSectionCard>
      </div>
    </div>
  );
};

export default AdminContentPage;
