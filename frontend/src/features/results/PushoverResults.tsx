import { lazy, Suspense } from 'react';
import type {
  PushoverResults as PushoverResultsType,
  HingeState,
  PerformanceLevel,
} from '@/types/analysis';

const Plot = lazy(() => import('react-plotly.js'));

interface PushoverResultsProps {
  data: PushoverResultsType;
  hingeStates?: HingeState[];
}

const PERF_LEVEL_COLORS: Record<PerformanceLevel, string> = {
  elastic: 'text-green-400',
  yield: 'text-yellow-400',
  IO: 'text-yellow-300',
  LS: 'text-orange-400',
  CP: 'text-red-400',
  beyondCP: 'text-red-500',
  collapse: 'text-red-600',
};

export function PushoverResults({ data, hingeStates }: PushoverResultsProps) {
  const baseShears = data.capacityCurve.map((pt) => pt.baseShear);
  const roofDisps = data.capacityCurve.map((pt) => pt.roofDisplacement);

  return (
    <div className="space-y-3">
      {/* Summary stats */}
      <div className="rounded bg-gray-800/50 p-2 text-[10px]">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-400">
          <span>Max Base Shear:</span>
          <span className="font-mono text-gray-300">{data.maxBaseShear.toFixed(2)} kip</span>
          <span>Max Roof Disp:</span>
          <span className="font-mono text-gray-300">{data.maxRoofDisplacement.toFixed(4)} in</span>
          <span>Ductility Ratio:</span>
          <span className="font-mono text-gray-300">{data.ductilityRatio.toFixed(2)}</span>
        </div>
      </div>

      {/* Capacity curve chart */}
      <div>
        <h3 className="mb-1 text-xs font-semibold text-gray-300">Capacity Curve</h3>
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
                  x: roofDisps,
                  y: baseShears,
                  type: 'scattergl' as const,
                  mode: 'lines' as const,
                  line: { color: '#f59e0b', width: 1.5 },
                  name: 'Capacity Curve',
                },
              ]}
              layout={{
                margin: { t: 10, r: 10, b: 30, l: 40 },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                font: { color: '#9ca3af', size: 9 },
                xaxis: {
                  title: { text: 'Roof Displacement (in)', font: { size: 9 } },
                  gridcolor: '#374151',
                },
                yaxis: {
                  title: { text: 'Base Shear (kip)', font: { size: 9 } },
                  gridcolor: '#374151',
                },
                showlegend: false,
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%', height: '100%' }}
            />
          </Suspense>
        </div>
      </div>

      {/* Plastic hinge state table */}
      {hingeStates && hingeStates.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-semibold text-gray-300">Plastic Hinge States</h3>
          <div className="overflow-x-auto rounded bg-gray-800/50">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-gray-700 text-gray-500">
                  <th className="px-2 py-1 text-left">Element</th>
                  <th className="px-2 py-1 text-left">End</th>
                  <th className="px-2 py-1 text-right">Rotation</th>
                  <th className="px-2 py-1 text-right">Moment</th>
                  <th className="px-2 py-1 text-right">D/C</th>
                  <th className="px-2 py-1 text-left">Level</th>
                </tr>
              </thead>
              <tbody className="text-gray-400">
                {hingeStates.map((h, i) => (
                  <tr key={i}>
                    <td className="px-2 py-0.5 font-mono">{h.elementId}</td>
                    <td className="px-2 py-0.5 font-mono">{h.end}</td>
                    <td className="px-2 py-0.5 text-right font-mono">{h.rotation.toFixed(5)}</td>
                    <td className="px-2 py-0.5 text-right font-mono">{h.moment.toFixed(2)}</td>
                    <td className="px-2 py-0.5 text-right font-mono">
                      {h.demandCapacityRatio.toFixed(2)}
                    </td>
                    <td
                      className={`px-2 py-0.5 font-mono ${PERF_LEVEL_COLORS[h.performanceLevel]}`}
                    >
                      {h.performanceLevel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
