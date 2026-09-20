import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Bug, Zap } from "lucide-react";
import { usePublicChangelog } from "@/hooks/use-public-content";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
};

const entries = [
  {
    version: "1.1.0",
    date: "April 2026",
    tag: "Admin Release",
    tagColor: "bg-[#0F766E] text-white",
    changes: [
      { type: "feature", text: "Shipped a full admin console with secure access control and role-gated operator routes" },
      { type: "feature", text: "Added platform-wide business, user, payment, support, audit, health, and settings management views" },
      { type: "feature", text: "Introduced admin announcements, branded password reset flows, and super-admin setup documentation" },
      { type: "improvement", text: "Improved admin responsiveness with denser mobile-first layouts and destructive-action confirmations" },
      { type: "improvement", text: "Added automated admin coverage for access control, user deletion confirmation, and workspace suspend or restore flows" },
    ],
  },
  {
    version: "1.0.0",
    date: "March 2026",
    tag: "Launch",
    tagColor: "bg-[#5B67F7] text-white",
    changes: [
      { type: "feature", text: "Invoice creation and management with line items" },
      { type: "feature", text: "Bill tracking and payment scheduling" },
      { type: "feature", text: "Vendor and customer management" },
      { type: "feature", text: "Real-time dashboard with cash flow insights" },
      { type: "feature", text: "Reports with cash flow charts and invoice breakdowns" },
      { type: "feature", text: "Audit trail with immutable activity logs" },
      { type: "feature", text: "Dark mode support" },
      { type: "feature", text: "Stripe and Paystack payment gateway integration" },
    ],
  },
  {
    version: "0.9.0",
    date: "February 2026",
    tag: "Beta",
    tagColor: "bg-[#F59E0B] text-white",
    changes: [
      { type: "feature", text: "Team management with role-based access" },
      { type: "improvement", text: "Responsive mobile navigation with bottom bar" },
      { type: "fix", text: "Fixed currency formatting for large amounts" },
      { type: "improvement", text: "Added notification preferences in settings" },
    ],
  },
  {
    version: "0.8.0",
    date: "January 2026",
    tag: "Alpha",
    tagColor: "bg-[#94A3B8] text-white",
    changes: [
      { type: "feature", text: "Initial authentication and workspace access" },
      { type: "feature", text: "Landing page with pricing and features" },
      { type: "improvement", text: "Enterprise design system with lavender theme" },
    ],
  },
];

const typeIcon = { feature: Sparkles, improvement: Zap, fix: Bug };
const typeColor = { feature: "text-[#5B67F7]", improvement: "text-[#16A34A]", fix: "text-[#F97066]" };

const ChangelogPage = () => {
  const { data: publishedEntries } = usePublicChangelog();
  const visibleEntries = publishedEntries.length > 0
    ? publishedEntries.map((entry) => ({
      date: entry.release_date || "",
      tag: entry.tag || "Update",
      tagColor: "bg-[#5B67F7] text-white",
      version: entry.version || entry.title,
      changes: entry.changes.length > 0 ? entry.changes.map((change) => ({ type: change.type || "feature", text: change.text || "Updated product documentation" })) : [{ type: "feature", text: entry.body }],
      relatedHelpSlugs: entry.related_help_slugs ?? [],
    }))
    : entries.map((entry) => ({ ...entry, relatedHelpSlugs: [] as string[] }));

  return <div className="min-h-screen bg-[#F3F4FB]">
    <div className="mx-auto max-w-[800px] px-6 py-16">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#4154D8] hover:underline mb-8">
        <ArrowLeft size={16} /> Back to home
      </Link>

      <motion.div initial="hidden" animate="visible">
        <motion.h1 variants={fadeUp} custom={0} className="text-4xl font-black text-[#0D1B2A] tracking-tight">
          Changelog
        </motion.h1>
        <motion.p variants={fadeUp} custom={1} className="mt-4 text-lg leading-relaxed text-[#64748B]">
          All notable updates and releases for moniger.net.
        </motion.p>

        <div className="mt-10 space-y-8">
          {visibleEntries.map((entry, ei) => (
            <motion.div key={entry.version} variants={fadeUp} custom={ei + 2} className="rounded-2xl border border-[#E0DFF0] bg-white p-6">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-[#0D1B2A]">v{entry.version}</h2>
                <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${entry.tagColor}`}>{entry.tag}</span>
                <span className="text-sm text-[#94A3B8]">{entry.date}</span>
              </div>
              <div className="mt-4 space-y-2">
                {entry.changes.map((c, ci) => {
                  const Icon = typeIcon[c.type as keyof typeof typeIcon];
                  const color = typeColor[c.type as keyof typeof typeColor];
                  return (
                    <div key={ci} className="flex items-start gap-3 rounded-xl p-2 hover:bg-[#F3F4FB] transition-colors">
                      <Icon size={16} className={`mt-0.5 shrink-0 ${color}`} />
                      <span className="text-sm text-[#374151]">{c.text}</span>
                    </div>
                  );
                })}
              </div>
              {entry.relatedHelpSlugs.length > 0 ? (
                <div className="mt-5 border-t border-[#E7EAF3] pt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#66718E]">Learn more</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {entry.relatedHelpSlugs.map((slug) => <Link key={slug} to={`/help-centre?article=${encodeURIComponent(slug)}`} className="rounded-full border border-[#DCE2F2] px-3 py-2 text-sm font-semibold text-[#4154D8] hover:bg-[#F5F6FF]">Help article</Link>)}
                  </div>
                </div>
              ) : null}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  </div>;
};

export default ChangelogPage;
