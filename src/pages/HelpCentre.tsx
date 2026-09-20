import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen, Bot, FileText, LifeBuoy, Search, ShieldCheck, Video } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import PublicPageShell, { PublicInfoCard, publicFadeUp } from "@/components/public/PublicPageShell";
import { usePublicHelpArticles } from "@/hooks/use-public-content";

const resourceCards = [
  {
    icon: BookOpen,
    title: "Getting Started",
    description: "Set up your workspace, invite teammates, and send your first invoice without touching a spreadsheet again.",
  },
  {
    icon: ShieldCheck,
    title: "Security & Access",
    description: "Learn how approvals, role permissions, MFA, and audit visibility work across your finance operations.",
  },
  {
    icon: FileText,
    title: "Billing Workflows",
    description: "Understand payable approvals, invoice payment links, overdue tracking, and exports in plain English.",
  },
  {
    icon: Bot,
    title: "Automation Guides",
    description: "See how reminders, recurring routines, and email delivery can reduce manual follow-up for your team.",
  },
];

const quickLinks = [
  "How to create your first invoice",
  "How to accept a team invitation",
  "How approval thresholds work",
  "How public payment links are shared",
  "How to review audit activity",
];

const HelpCentrePage = () => {
  const { data: articles } = usePublicHelpArticles();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(searchParams.get("article"));
  const selectArticle = (slug: string | null) => {
    setSelectedSlug(slug);
    const nextParams = new URLSearchParams(searchParams);
    if (slug) nextParams.set("article", slug); else nextParams.delete("article");
    setSearchParams(nextParams, { replace: true });
  };
  const categories = useMemo(
    () => Array.from(new Set(articles.map((article) => article.category).filter(Boolean))).sort(),
    [articles],
  );
  const normalizedSearch = search.trim().toLowerCase();
  const filteredArticles = useMemo(
    () => articles.filter((article) => {
      const matchesCategory = category === "all" || article.category === category;
      const haystack = `${article.title} ${article.excerpt} ${article.body}`.toLowerCase();
      return matchesCategory && (!normalizedSearch || haystack.includes(normalizedSearch));
    }),
    [articles, category, normalizedSearch],
  );
  const visibleCards = (articles.length > 0 ? filteredArticles : resourceCards).map((article) =>
    "icon" in article
      ? article
      : {
      description: article.excerpt || article.body,
      icon: FileText,
      title: article.title,
      },
  );
  const visibleQuickLinks = articles.length > 0 ? filteredArticles.slice(0, 5).map((article) => article.title) : quickLinks;
  const selectedArticle = articles.find((article) => article.slug === selectedSlug) ?? null;
  const relatedArticles = selectedArticle
    ? articles.filter((article) => article.slug !== selectedArticle.slug && article.category === selectedArticle.category).slice(0, 3)
    : [];

  return <PublicPageShell
    eyebrow="Help Centre"
    title="Answers that feel like a helpful teammate."
    description="The moniger.net Help Centre is designed for busy operators, founders, and accountants who need fast clarity, not dense documentation."
    highlights={[
      { label: "Core guide paths", value: "4" },
      { label: "Quick-start time", value: "<10 min" },
      { label: "Support coverage", value: "24/7" },
    ]}
    cta={{ label: "Talk to support", to: "/support" }}
    accent={
      <div className="rounded-[30px] border border-[#DCE2F2] bg-[#10203F] p-6 text-white shadow-[0_28px_80px_rgba(16,32,63,0.18)]">
        <div className="rounded-[22px] border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white/85">Popular topics</p>
            <LifeBuoy size={18} className="text-[#AFC2FF]" />
          </div>
          <div className="mt-5 space-y-3">
            {visibleQuickLinks.length > 0 ? visibleQuickLinks.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-sm text-white/88">{item}</p>
              </div>
            )) : <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">No articles match this search.</p>}
          </div>
          <div className="mt-5 rounded-2xl bg-[#D7E3FF] px-4 py-3 text-[#10203F]">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4154D8]">Recommended</p>
            <p className="mt-1 text-sm font-medium">Start with workspace setup if you are onboarding a new team.</p>
          </div>
        </div>
      </div>
    }
    aside={
      <>
        <div className="rounded-[24px] border border-[#DCE2F2] bg-white p-6 shadow-[0_18px_50px_rgba(16,32,63,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#66718E]">Need a walkthrough?</p>
          <p className="mt-3 text-[22px] font-bold tracking-[-0.03em] text-[#10203F]">Choose the path that matches your role.</p>
          <div className="mt-5 space-y-3 text-sm text-[#5F6A88]">
            <div className="rounded-2xl bg-[#F6F8FF] px-4 py-3">Founders: payments visibility and cash flow basics</div>
            <div className="rounded-2xl bg-[#F6F8FF] px-4 py-3">Finance teams: approvals, audit history, exports</div>
            <div className="rounded-2xl bg-[#F6F8FF] px-4 py-3">Operations: vendors, customers, reminders, follow-up</div>
          </div>
        </div>
        <div className="rounded-[24px] border border-[#DCE2F2] bg-[#EAF6EF] p-6">
          <Video size={22} className="text-[#1E8A4C]" />
          <p className="mt-4 text-lg font-bold tracking-[-0.02em] text-[#10203F]">Short guided demos are coming next.</p>
          <p className="mt-2 text-sm leading-[1.75] text-[#4F6B5D]">
            This page is ready for docs routing today and can later expand with videos, searchable articles, and product walkthroughs.
          </p>
        </div>
      </>
    }
  >
    <motion.section initial="hidden" animate="visible">
      <motion.div variants={publicFadeUp} custom={0}>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#66718E]">Browse by workflow</p>
        <h2 className="mt-3 text-[30px] font-black tracking-[-0.03em] text-[#10203F]">Start from the job you need to finish.</h2>
      </motion.div>

      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7D89A5]" aria-hidden="true" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search help articles..."
            aria-label="Search help articles"
            className="h-11 border-[#DCE2F2] bg-white pl-10 text-[#10203F]"
          />
        </div>
        {categories.length > 0 ? (
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Filter help articles by category"
            className="h-11 rounded-md border border-[#DCE2F2] bg-white px-3 text-sm text-[#10203F]"
          >
            <option value="all">All categories</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        ) : null}
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {visibleCards.length > 0 ? visibleCards.map((card, index) => (
          <motion.div key={card.title} variants={publicFadeUp} custom={index + 1}>
            <PublicInfoCard
              {...card}
              onClick={articles.length > 0 ? () => selectArticle(filteredArticles.find((article) => article.title === card.title)?.slug ?? null) : undefined}
            />
          </motion.div>
        )) : <div className="rounded-2xl border border-dashed border-[#DCE2F2] bg-white p-6 text-sm text-[#5F6A88]">No help articles match your search. Try another phrase or contact support.</div>}
      </div>

      {selectedArticle ? (
        <div className="mt-8 rounded-[24px] border border-[#DCE2F2] bg-white p-6 shadow-[0_18px_50px_rgba(16,32,63,0.06)] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              {selectedArticle.category ? <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5B67F7]">{selectedArticle.category}</p> : null}
              <h3 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[#10203F]">{selectedArticle.title}</h3>
            </div>
            <button type="button" onClick={() => selectArticle(null)} className="text-sm font-semibold text-[#5B67F7] hover:underline">Close article</button>
          </div>
          <p className="mt-5 whitespace-pre-line text-[15px] leading-8 text-[#5F6A88]">{selectedArticle.body}</p>
          {relatedArticles.length > 0 ? (
            <div className="mt-7 border-t border-[#E7EAF3] pt-5">
              <p className="text-sm font-semibold text-[#10203F]">Related articles</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {relatedArticles.map((article) => (
                  <button key={article.id} type="button" onClick={() => selectArticle(article.slug)} className="rounded-full border border-[#DCE2F2] px-3 py-2 text-sm text-[#4154D8] hover:bg-[#F5F6FF]">{article.title}</button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </motion.section>
  </PublicPageShell>;
};

export default HelpCentrePage;
