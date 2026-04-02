/** Pulsing placeholder blocks for lazy panels and chart mounts. */

export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.06] ${className}`} aria-hidden />;
}

export function ComparisonPanelSkeleton() {
  return (
    <div className="space-y-3 p-3" aria-busy="true" aria-label="Loading comparison">
      <SkeletonLine className="h-4 w-2/3" />
      <SkeletonLine className="h-32 w-full" />
      <SkeletonLine className="h-24 w-full" />
      <div className="flex gap-2">
        <SkeletonLine className="h-8 flex-1" />
        <SkeletonLine className="h-8 flex-1" />
      </div>
    </div>
  );
}

export function ChartPlotSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex min-h-[220px] flex-col gap-2 rounded-lg border border-white/[0.06] bg-surface-2/80 p-3 ${className}`}
      aria-busy="true"
      aria-label="Loading chart"
    >
      <SkeletonLine className="h-3 w-1/3" />
      <SkeletonLine className="min-h-[180px] w-full flex-1" />
    </div>
  );
}
