import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const base = "skeleton-shimmer rounded-md";
  return <div className={cn(base, className)} {...props} />;
}

export { Skeleton };
