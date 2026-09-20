const RouteLoadingScreen = () => (
  <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.18),_transparent_38%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.35))] px-6">
    <div
      role="status"
      aria-live="polite"
      className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-border/70 bg-card/95 px-8 py-8 text-center shadow-[0_24px_80px_-32px_hsl(var(--foreground)/0.35)] backdrop-blur"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" aria-hidden="true" />

      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/8 shadow-inner shadow-primary/10" aria-hidden="true">
        <div className="relative flex h-14 w-14 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-[3px] border-primary/20" />
          <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-primary border-r-primary/80" />
          <div className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.65)]" />
        </div>
      </div>

      <p className="mt-6 text-base font-semibold tracking-[0.02em] text-foreground">Loading page...</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Preparing the next view and syncing everything for a smooth transition.</p>

      <div className="mt-6 flex items-center justify-center gap-2" aria-hidden="true">
        <span className="h-2 w-2 skeleton-shimmer rounded-full bg-white/5 [animation-delay:-0.3s]" />
        <span className="h-2 w-2 skeleton-shimmer rounded-full bg-white/5 [animation-delay:-0.15s]" />
        <span className="h-2 w-2 skeleton-shimmer rounded-full bg-white/5" />
      </div>
    </div>
  </div>
);

export default RouteLoadingScreen;
