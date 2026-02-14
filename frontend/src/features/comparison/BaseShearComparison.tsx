import { lazy, Suspense } from 'react';
import type { BaseShearComparison as BaseShearComparisonType } from '@/types/comparison';

const Plot = lazy(() => import('react-plotly.js'));

interface BaseShearComparisonProps {
  data: BaseShearComparisonType;
}

export function BaseShearComparison({ data }: BaseShearComparisonProps) {
  return (
    <div className="space-y-2">
      <div className="rounded bg-gray-800/50 p-2 text-center">
        <span className="text-lg font-bold text-emerald-400">
          {data.reductionPercent.toFixed(0)}%
        </span>
        <span className="ml-1 text-[10px] text-gray-400">base shear reduction</span>
      </div>

      <div className="h-36 rounded bg-gray-800/50">
        <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-gray-500">Loading chart...</div>}>
          <Plot
            data={[
              {
                x: ['Isolated', 'Fixed-Base'],
                y: [data.isolatedBaseShear, data.fixedBaseBaseShear],
                type: 'bar' as const,
                marker: { color: ['#10b981', '#f59e0b'] },
              },
            ]}
            layout={{
              margin: { t: 10, r: 10, b: 30, l: 50 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              font: { color: '#9ca3af', size: 9 },
              yaxis: { title: { text: 'Base Shear (kip)', font: { size: 9 } }, gridcolor: '#374151' },
              showlegend: false,
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%', height: '100%' }}
          />
        </Suspense>
      </div>
    </div>
  );
}
