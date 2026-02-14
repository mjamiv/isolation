import { lazy, Suspense } from 'react';
import type { DriftProfile } from '@/types/comparison';

const Plot = lazy(() => import('react-plotly.js'));

interface DriftProfileChartProps {
  data: DriftProfile[];
}

export function DriftProfileChart({ data }: DriftProfileChartProps) {
  if (data.length === 0) {
    return <p className="text-[10px] text-gray-500">No drift data available.</p>;
  }

  const stories = data.map((d) => `Story ${d.story}`);
  const isolatedDrifts = data.map((d) => d.isolatedDrift * 100); // convert to %
  const fixedBaseDrifts = data.map((d) => d.fixedBaseDrift * 100);

  return (
    <div className="h-48 rounded bg-gray-800/50">
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
              y: stories,
              x: isolatedDrifts,
              type: 'bar' as const,
              orientation: 'h' as const,
              name: 'Isolated',
              marker: { color: '#D4AF37' },
            },
            {
              y: stories,
              x: fixedBaseDrifts,
              type: 'bar' as const,
              orientation: 'h' as const,
              name: 'Fixed-Base',
              marker: { color: '#FACC15' },
            },
          ]}
          layout={{
            margin: { t: 10, r: 10, b: 30, l: 60 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            font: { color: '#9ca3af', size: 9 },
            xaxis: { title: { text: 'Drift Ratio (%)', font: { size: 9 } }, gridcolor: '#374151' },
            yaxis: { autorange: 'reversed' as const },
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
