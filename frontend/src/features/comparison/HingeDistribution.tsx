import { lazy, Suspense } from 'react';
import type { HingeDistribution as HingeDistributionType } from '@/types/comparison';

const Plot = lazy(() => import('react-plotly.js'));

interface HingeDistributionProps {
  data: HingeDistributionType[];
}

export function HingeDistribution({ data }: HingeDistributionProps) {
  const hasAnyHinges = data.some((d) => d.isolatedCount > 0 || d.fixedBaseCount > 0);

  if (!hasAnyHinges) {
    return <p className="text-[10px] text-gray-500">No plastic hinges formed.</p>;
  }

  const levels = data.map((d) => d.level);
  const isolatedCounts = data.map((d) => d.isolatedCount);
  const fixedBaseCounts = data.map((d) => d.fixedBaseCount);

  return (
    <div className="h-40 rounded bg-gray-800/50">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-xs text-gray-500">
            Loading chart...
          </div>
        }
      >
        <Plot
          data={[
            {
              x: levels,
              y: isolatedCounts,
              type: 'bar' as const,
              name: 'Isolated',
              marker: { color: '#D4AF37' },
            },
            {
              x: levels,
              y: fixedBaseCounts,
              type: 'bar' as const,
              name: 'Fixed-Base',
              marker: { color: '#FACC15' },
            },
          ]}
          layout={{
            margin: { t: 10, r: 10, b: 30, l: 40 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            font: { color: '#9ca3af', size: 9 },
            yaxis: { title: { text: 'Count', font: { size: 9 } }, gridcolor: '#374151', dtick: 1 },
            xaxis: { title: { text: 'Performance Level', font: { size: 9 } } },
            barmode: 'group' as const,
            legend: { x: 0.6, y: 1, font: { size: 8 } },
            showlegend: true,
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%', height: '100%' }}
        />
      </Suspense>
    </div>
  );
}
