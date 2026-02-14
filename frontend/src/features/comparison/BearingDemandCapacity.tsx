import { lazy, Suspense } from 'react';
import type { BearingDemand } from '@/types/comparison';

const Plot = lazy(() => import('react-plotly.js'));

interface BearingDemandCapacityProps {
  data: BearingDemand[];
}

function dcColor(ratio: number): string {
  if (ratio < 0.7) return '#D4AF37'; // gold
  if (ratio < 0.9) return '#FACC15'; // yellow
  return '#ef4444'; // red
}

export function BearingDemandCapacity({ data }: BearingDemandCapacityProps) {
  if (data.length === 0) {
    return <p className="text-[10px] text-gray-500">No bearing data available.</p>;
  }

  const labels = data.map((d) => `Brg ${d.bearingId}`);
  const demands = data.map((d) => d.demand);
  const capacities = data.map((d) => d.capacity);
  const colors = data.map((d) => dcColor(d.dcRatio));

  return (
    <div className="space-y-2">
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
                x: labels,
                y: demands,
                type: 'bar' as const,
                name: 'Demand',
                marker: { color: colors },
              },
              {
                x: labels,
                y: capacities,
                type: 'bar' as const,
                name: 'Capacity',
                marker: { color: '#6b7280', opacity: 0.4 },
              },
            ]}
            layout={{
              margin: { t: 10, r: 10, b: 30, l: 50 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              font: { color: '#9ca3af', size: 9 },
              yaxis: {
                title: { text: 'Displacement (in)', font: { size: 9 } },
                gridcolor: '#374151',
              },
              barmode: 'overlay' as const,
              legend: { x: 0.6, y: 1, font: { size: 8 } },
              showlegend: true,
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%', height: '100%' }}
          />
        </Suspense>
      </div>

      {/* D/C ratio table */}
      <div className="overflow-x-auto rounded bg-gray-800/50">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-gray-700 text-gray-500">
              <th className="px-2 py-1 text-left">Bearing</th>
              <th className="px-2 py-1 text-right">Demand (in)</th>
              <th className="px-2 py-1 text-right">Capacity (in)</th>
              <th className="px-2 py-1 text-right">D/C Ratio</th>
            </tr>
          </thead>
          <tbody className="text-gray-400">
            {data.map((d) => (
              <tr key={d.bearingId}>
                <td className="px-2 py-0.5 font-mono">{d.bearingId}</td>
                <td className="px-2 py-0.5 text-right font-mono">{d.demand.toFixed(3)}</td>
                <td className="px-2 py-0.5 text-right font-mono">{d.capacity.toFixed(3)}</td>
                <td
                  className={`px-2 py-0.5 text-right font-mono ${d.dcRatio > 0.9 ? 'text-red-400' : d.dcRatio > 0.7 ? 'text-yellow-400' : 'text-yellow-500'}`}
                >
                  {d.dcRatio.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
