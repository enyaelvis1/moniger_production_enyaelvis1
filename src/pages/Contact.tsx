import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Phone, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
};

const contactInfo = [
  { icon: Mail, label: "Email", value: "admin@moniger.net", href: "mailto:admin@moniger.net" },
  { icon: Phone, label: "Phone", value: "+234 913 170 1391", href: "tel:+2349131701391" },
  { icon: MapPin, label: "Address", value: "Lagos, Nigeria", href: "#" },
];

const ContactPage = () => {
  const [form, setForm] = useState({ email: "", fullName: "", message: "", subject: "", website: "" });
  const [status, setStatus] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const [isSending, setIsSending] = useState(false);

  const update = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setStatus(null);
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke<{ message?: string }>("contact-message", { body: form });
      if (error) throw error;
      setForm({ email: "", fullName: "", message: "", subject: "", website: "" });
      setStatus({ kind: "success", message: data?.message ?? "Your message was sent. We will respond within 24 hours." });
    } catch (error) {
      console.error("Contact form delivery failed", error);
      setStatus({
        kind: "error",
        message: "We couldn't send your message right now. Please try again or email admin@moniger.net.",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
  <div className="min-h-screen bg-[#F3F4FB]">
    <div className="mx-auto max-w-[800px] px-6 py-16">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#4154D8] hover:underline mb-8">
        <ArrowLeft size={16} /> Back to home
      </Link>

      <motion.div initial="hidden" animate="visible">
        <motion.h1 variants={fadeUp} custom={0} className="text-4xl font-black text-[#0D1B2A] tracking-tight">
          Contact Us
        </motion.h1>
        <motion.p variants={fadeUp} custom={1} className="mt-4 text-lg leading-relaxed text-[#52607A]">
          Have questions about moniger.net? We respond within 24 hours.
        </motion.p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {contactInfo.map((c, i) => (
            <motion.a
              key={c.label}
              href={c.href}
              variants={fadeUp}
              custom={i + 2}
              className="flex flex-col items-center rounded-2xl border border-[#E0DFF0] bg-white p-6 text-center transition-all hover:shadow-[0_8px_24px_rgba(91,103,247,0.1)] hover:border-[#5B67F7]/30"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EEEDF8]">
                <c.icon size={22} className="text-[#5B67F7]" />
              </div>
              <p className="mt-4 text-sm font-semibold text-[#0D1B2A]">{c.label}</p>
              <p className="mt-1 text-sm text-[#52607A]">{c.value}</p>
            </motion.a>
          ))}
        </div>

        <motion.div variants={fadeUp} custom={5} className="mt-10 rounded-2xl border border-[#E0DFF0] bg-white p-8">
          <h2 className="text-xl font-bold text-[#0D1B2A]">Send us a message</h2>
          <p className="mt-2 text-sm text-[#52607A]">Fill out the form and we'll get back to you.</p>
          {status ? (
            <div id="contact-form-status" role="status" aria-live="polite" aria-atomic="true" className={`mt-4 rounded-xl border px-4 py-3 text-sm ${status.kind === "success" ? "border-[#BBE4C9] bg-[#F0FBF3] text-[#16713A]" : "border-[#F8C9C9] bg-[#FEF2F2] text-[#B42318]"}`}>
              {status.message}
            </div>
          ) : null}
          <form className="mt-6 space-y-4" onSubmit={submit} aria-busy={isSending} aria-describedby={status ? "contact-form-status" : undefined}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium text-[#0D1B2A]">
                <span>Full name</span>
                <input id="contact-full-name" value={form.fullName} onChange={update("fullName")} placeholder="Full name" autoComplete="name" required className="w-full rounded-xl border border-[#E0DFF0] bg-[#F3F4FB] px-4 py-3 text-sm font-normal outline-none transition-colors focus:border-[#5B67F7] focus-visible:ring-2 focus-visible:ring-[#5B67F7] focus-visible:ring-offset-2" />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-[#0D1B2A]">
                <span>Email address</span>
                <input id="contact-email" value={form.email} onChange={update("email")} placeholder="Email address" type="email" autoComplete="email" required className="w-full rounded-xl border border-[#E0DFF0] bg-[#F3F4FB] px-4 py-3 text-sm font-normal outline-none transition-colors focus:border-[#5B67F7] focus-visible:ring-2 focus-visible:ring-[#5B67F7] focus-visible:ring-offset-2" />
              </label>
            </div>
            <label className="block space-y-1.5 text-sm font-medium text-[#0D1B2A]">
              <span>Subject</span>
              <input id="contact-subject" value={form.subject} onChange={update("subject")} placeholder="Subject" required className="w-full rounded-xl border border-[#E0DFF0] bg-[#F3F4FB] px-4 py-3 text-sm font-normal outline-none transition-colors focus:border-[#5B67F7] focus-visible:ring-2 focus-visible:ring-[#5B67F7] focus-visible:ring-offset-2" />
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-[#0D1B2A]">
              <span className="flex items-center justify-between gap-3">
                <span>Your message</span>
                <span className="text-xs font-normal text-[#52607A]">{form.message.length}/300</span>
              </span>
              <textarea id="contact-message" value={form.message} onChange={update("message")} placeholder="Your message..." rows={5} maxLength={300} required className="w-full resize-none rounded-xl border border-[#E0DFF0] bg-[#F3F4FB] px-4 py-3 text-sm font-normal outline-none transition-colors focus:border-[#5B67F7] focus-visible:ring-2 focus-visible:ring-[#5B67F7] focus-visible:ring-offset-2" />
            </label>
            <input aria-label="Website" aria-hidden="true" tabIndex={-1} autoComplete="off" value={form.website} onChange={update("website")} className="absolute h-px w-px overflow-hidden opacity-0" />
            <button type="submit" disabled={isSending} className="inline-flex items-center rounded-full bg-[#5B67F7] px-8 py-3 text-sm font-medium text-white shadow-[0_4px_16px_rgba(91,103,247,0.3)] transition-all hover:bg-[#4A56E0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B67F7] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
              {isSending ? "Sending..." : "Send Message"}
            </button>
          </form>
        </motion.div>
      </motion.div>
    </div>
  </div>
  );
};

export default ContactPage;
