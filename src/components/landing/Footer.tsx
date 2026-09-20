import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { HEART, NigeriaFlagMark, containerClass } from "./landing-shared";

const Footer = () => (
  <>
    <section className="bg-[#F3F4FB] px-3 py-[80px] text-center sm:px-4 lg:px-6">
      <div className="mx-auto max-w-[1160px] overflow-hidden rounded-[24px] bg-[#0D1B2A] px-5 py-12 sm:px-10 sm:py-14 lg:px-16 lg:py-20">
        <h2 className="mx-auto max-w-[820px] whitespace-pre-line text-[40px] font-black leading-[1.05] tracking-[-0.03em] text-white md:text-[48px] lg:text-[56px]">
          {"Everything you do with money.\nAll in one place."}
        </h2>
        <p className="mx-auto mt-5 max-w-[480px] text-[18px] leading-[1.7] text-white/60">
          Start free. Set up in under 2 minutes. No credit card required.
        </p>

        <div className="mt-10">
          <Link
            to="/register"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-9 py-4 text-[16px] font-semibold text-[#0D1B2A] shadow-[0_8px_24px_rgba(0,0,0,0.2)] transition-all duration-200 hover:bg-[#F7F6F3]"
          >
            <span>Get Started Free</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>

    <div className="landing-peel-section relative z-[8] overflow-hidden bg-[#0D1B2A] text-white">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#152238] via-[#0D1B2A] to-[#09131F] opacity-90" />

      <div className="relative z-10 border-t border-white/10">
        <div className="mx-auto max-w-[1200px] px-6 py-5 text-center text-[13px] leading-[1.7] text-white/35 md:px-10 lg:px-12">
          moniger.net is a financial management platform, not a licensed financial institution. Payment processing is provided by supported third-party providers.
        </div>
      </div>

      <footer id="about" className="relative z-10 px-6 py-12 md:px-10 lg:px-12">
        <div className={cn(containerClass, "grid gap-10 md:grid-cols-2 lg:grid-cols-4")}>
          <div>
            <p className="text-base font-bold text-white">moniger.net</p>
            <p className="mt-3 max-w-[220px] text-sm leading-[1.7] text-white/50">Financial clarity for modern businesses.</p>
          </div>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-white/40">Product</p>
             <div className="mt-4 space-y-3 text-sm text-white/70">
              <Link to="/#features" className="block transition-colors hover:text-white">Features</Link>
              <Link to="/pricing" className="block transition-colors hover:text-white">Pricing</Link>
              <Link to="/security" className="block transition-colors hover:text-white">Security</Link>
              <Link to="/changelog" className="block transition-colors hover:text-white">Changelog</Link>
            </div>
          </div>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-white/40">Company</p>
            <div className="mt-4 space-y-3 text-sm text-white/70">
              <Link to="/about" className="block transition-colors hover:text-white">About</Link>
              <Link to="/contact" className="block transition-colors hover:text-white">Contact</Link>
              <Link to="/help-centre" className="block transition-colors hover:text-white">Help Centre</Link>
              <Link to="/support" className="block transition-colors hover:text-white">Support</Link>
              <Link to="/privacy" className="block transition-colors hover:text-white">Privacy Policy</Link>
              <Link to="/terms" className="block transition-colors hover:text-white">Terms</Link>
            </div>
          </div>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-white/40">Contact</p>
            <div className="mt-4 space-y-3 text-sm text-white/70">
              <a href="mailto:hello@moniger.net" className="block transition-colors hover:text-white">hello@moniger.net</a>
              <a href="tel:+2349131701391" className="block transition-colors hover:text-white">+234 913 170 1391</a>
              <a href="https://www.moniger.net" target="_blank" rel="noreferrer" className="block transition-colors hover:text-white">www.moniger.net</a>
            </div>
          </div>
        </div>

        <div className={cn(containerClass, "mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 text-[13px] text-white/40 md:flex-row md:items-center md:justify-between")}>
          <p>&copy; 2026 moniger.net. All rights reserved.</p>
          <p className="inline-flex items-center gap-2">
            <span>{`Built with ${HEART} in Nigeria`}</span>
            <NigeriaFlagMark className="border-white/20" />
          </p>
        </div>
      </footer>
    </div>
  </>
);

export default Footer;
