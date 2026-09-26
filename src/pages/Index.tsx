import { Suspense, type ReactNode, useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";
import DeferredLandingSection from "@/components/landing/DeferredLandingSection";
import Footer from "@/components/landing/Footer";
import HeroSection from "@/components/landing/HeroSection";
import Navbar from "@/components/landing/Navbar";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { SkipToMainContent } from "@/components/ui/accessibility";
import { lazyWithReload } from "@/lib/lazy-with-reload";

const StatsProofSection = lazyWithReload(() => import("@/components/landing/StatsProofSection"));
const FeaturesSection = lazyWithReload(() => import("@/components/landing/FeaturesSection"));
const TestimonialsSection = lazyWithReload(() => import("@/components/landing/TestimonialsSection"));
const PricingSection = lazyWithReload(() => import("@/components/landing/PricingSection"));

const sectionSkeletonClassName =
  "mx-auto w-full max-w-[1160px] rounded-[24px] border border-[#E8E4DF] bg-white/70 shadow-[0_2px_24px_rgba(0,0,0,0.04)]";

const LandingSectionPlaceholder = ({
  accentClassName,
  className,
  heightClassName,
}: {
  accentClassName?: string;
  className?: string;
  heightClassName: string;
}) => (
  <section className={className}>
    <div className={`${sectionSkeletonClassName} ${heightClassName}`}>
      <div className={`h-full w-full rounded-[24px] bg-gradient-to-br ${accentClassName ?? "from-white via-[#F4F3FA] to-[#EEF2FF]"}`} />
    </div>
  </section>
);

const DeferredSectionBoundary = ({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: ReactNode;
}) => (
  <DeferredLandingSection fallback={fallback}>
    <Suspense fallback={fallback}>{children}</Suspense>
  </DeferredLandingSection>
);

const Index = () => {
  const [showGoToTop, setShowGoToTop] = useState(false);
  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    const handleScroll = () => {
      setShowGoToTop(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <div className="min-h-screen bg-[#F7F6F3] text-[#0D1B2A]">
      <SkipToMainContent />
      {!isOnline ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 md:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">You&apos;re offline</p>
              <p className="text-sm text-amber-900/80">Check your connection and refresh once you&apos;re back online.</p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100"
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}
      <Navbar />
      <main id="main-content" tabIndex={-1} className="outline-none">
      <HeroSection />
      <DeferredSectionBoundary
        fallback={
          <LandingSectionPlaceholder
            className="landing-peel-section z-[3] bg-[#F3F4FB] px-3 py-[80px] sm:px-4 lg:px-6"
            heightClassName="h-[520px] px-5 py-8 sm:px-8 sm:py-10 lg:px-16 lg:py-16"
            accentClassName="from-white via-[#F7F7FB] to-[#EEF3FF]"
          />
        }
      >
        <StatsProofSection />
      </DeferredSectionBoundary>
      <DeferredSectionBoundary
        fallback={
          <LandingSectionPlaceholder
            className="landing-peel-section z-[4] bg-[#F3F4FB] px-3 py-16 sm:px-4 lg:px-6 lg:py-[100px]"
            heightClassName="h-[1080px] px-6 py-10 md:px-8 lg:px-10"
            accentClassName="from-white via-[#F4F3FA] to-[#E9F2FF]"
          />
        }
      >
        <FeaturesSection />
      </DeferredSectionBoundary>
      <DeferredSectionBoundary
        fallback={
          <LandingSectionPlaceholder
            className="landing-peel-section relative z-[6] overflow-hidden bg-[#F3F4FB] px-6 py-16 md:px-10 lg:px-12 lg:py-[100px]"
            heightClassName="h-[760px] px-6 py-10 md:px-8 lg:px-10"
            accentClassName="from-[#F7F6F3] via-white to-[#F0EDE8]"
          />
        }
      >
        <TestimonialsSection />
      </DeferredSectionBoundary>
      <DeferredSectionBoundary
        fallback={
          <LandingSectionPlaceholder
            className="landing-peel-section relative z-[7] bg-[#EAECF8] px-6 py-16 md:px-10 lg:px-12 lg:py-[100px]"
            heightClassName="h-[760px] px-6 py-10 md:px-8 lg:px-10"
            accentClassName="from-white via-[#F6F7FC] to-[#EAECF8]"
          />
        }
      >
      <PricingSection />
      </DeferredSectionBoundary>
      </main>
      <Footer />

      {/* Go to top button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-8 right-8 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#5B67F7] shadow-[0_4px_16px_rgba(91,103,247,0.3)] transition-all duration-300 hover:bg-[#4A56E0] hover:shadow-[0_6px_20px_rgba(91,103,247,0.4)] hover:scale-110 active:scale-95 ${
          showGoToTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-16 opacity-0"
        }`}
        aria-label="Scroll to top"
      >
        <ChevronUp size={24} className="text-white font-bold" />
      </button>
    </div>
  );
};

export default Index;
