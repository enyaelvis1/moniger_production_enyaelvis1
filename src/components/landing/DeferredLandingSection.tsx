import { startTransition, useEffect, useRef, useState, type ReactNode } from "react";

type DeferredLandingSectionProps = {
  children: ReactNode;
  className?: string;
  fallback: ReactNode;
  rootMargin?: string;
};

const DeferredLandingSection = ({
  children,
  className,
  fallback,
  rootMargin = "200px 0px",
}: DeferredLandingSectionProps) => {
  const [shouldRender, setShouldRender] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (shouldRender) {
      return undefined;
    }

    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      startTransition(() => {
        setShouldRender(true);
      });
      return undefined;
    }

    const node = containerRef.current;

    if (!node) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry?.isIntersecting) {
          return;
        }

        startTransition(() => {
          setShouldRender(true);
        });
        observer.disconnect();
      },
      {
        rootMargin,
      },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [rootMargin, shouldRender]);

  return (
    <div ref={containerRef} className={className}>
      {shouldRender ? children : fallback}
    </div>
  );
};

export default DeferredLandingSection;
