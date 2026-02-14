import { lazy, Suspense, useMemo, useState } from 'react';
import type { StaticResults as StaticResultsType } from '@/types/analysis';

interface StaticResultsProps {
  data: StaticResultsType;
}

const Plot = lazy(() => import('react-plotly.js'));

export function StaticResults({ data }: StaticResultsProps) {
  const displacements = Object.entries(data.nodeDisplacements);
  const reactions = Object.entries(data.reactions);
  const elementEntries = Object.entries(data.elementForces);
  const [selectedElement, setSelectedElement] = useState<number>(
    elementEntries.length > 0 ? Number(elementEntries[0]![0]) : 0,
  );

  // Find max displacement magnitude
  let maxDispNodeId = '';
  let maxDispMag = 0;
  for (const [nodeId, d] of displacements) {
    const mag = Math.sqrt(d[0] ** 2 + d[1] ** 2 + d[2] ** 2);
    if (mag > maxDispMag) {
      maxDispMag = mag;
      maxDispNodeId = nodeId;
    }
  }

  const selectedForceVector = useMemo(() => {
    const raw = data.elementForces[selectedElement] ?? [];
    return [raw[0] ?? 0, raw[1] ?? 0, raw[2] ?? 0, raw[3] ?? 0, raw[4] ?? 0, raw[5] ?? 0];
  }, [data.elementForces, selectedElement]);

  return (
    <div className="space-y-3">
      {/* Displacement table */}
      <div>
        <h3 className="mb-1 text-xs font-semibold text-gray-300">Node Displacements</h3>
        <div className="overflow-x-auto rounded bg-gray-800/50">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-gray-700 text-gray-500">
                <th className="px-2 py-1 text-left">Node</th>
                <th className="px-2 py-1 text-right">dx</th>
                <th className="px-2 py-1 text-right">dy</th>
                <th className="px-2 py-1 text-right">dz</th>
              </tr>
            </thead>
            <tbody className="text-gray-400">
              {displacements.map(([nodeId, d]) => (
                <tr
                  key={nodeId}
                  className={nodeId === maxDispNodeId ? 'bg-yellow-900/20 text-yellow-300' : ''}
                >
                  <td className="px-2 py-0.5 font-mono">{nodeId}</td>
                  <td className="px-2 py-0.5 text-right font-mono">{d[0].toFixed(4)}</td>
                  <td className="px-2 py-0.5 text-right font-mono">{d[1].toFixed(4)}</td>
                  <td className="px-2 py-0.5 text-right font-mono">{d[2].toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {maxDispMag > 0 && (
          <p className="mt-1 text-[10px] text-gray-500">
            Max displacement: {maxDispMag.toFixed(4)} in at Node {maxDispNodeId}
          </p>
        )}
      </div>

      {/* Reactions table */}
      {reactions.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-semibold text-gray-300">Support Reactions</h3>
          <div className="overflow-x-auto rounded bg-gray-800/50">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-gray-700 text-gray-500">
                  <th className="px-2 py-1 text-left">Node</th>
                  <th className="px-2 py-1 text-right">Fx</th>
                  <th className="px-2 py-1 text-right">Fy</th>
                  <th className="px-2 py-1 text-right">Fz</th>
                </tr>
              </thead>
              <tbody className="text-gray-400">
                {reactions.map(([nodeId, r]) => (
                  <tr key={nodeId}>
                    <td className="px-2 py-0.5 font-mono">{nodeId}</td>
                    <td className="px-2 py-0.5 text-right font-mono">{r[0].toFixed(2)}</td>
                    <td className="px-2 py-0.5 text-right font-mono">{r[1].toFixed(2)}</td>
                    <td className="px-2 py-0.5 text-right font-mono">{r[2].toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Element force / moment diagram */}
      {elementEntries.length > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-300">Element Forces & Moments</h3>
            <select
              value={selectedElement}
              onChange={(e) => setSelectedElement(Number(e.target.value))}
              className="rounded bg-gray-800 px-2 py-0.5 text-[10px] text-gray-300 outline-none ring-1 ring-gray-700"
            >
              {elementEntries.map(([eid]) => (
                <option key={eid} value={eid}>
                  Element {eid}
                </option>
              ))}
            </select>
          </div>
          <div className="h-44 rounded bg-gray-800/50">
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
                    x: ['N(i)', 'V(i)', 'M(i)', 'N(j)', 'V(j)', 'M(j)'],
                    y: selectedForceVector,
                    type: 'bar' as const,
                    marker: {
                      color: selectedForceVector.map((v) => (v >= 0 ? '#22c55e' : '#ef4444')),
                    },
                  },
                ]}
                layout={{
                  margin: { t: 10, r: 10, b: 25, l: 40 },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { color: '#9ca3af', size: 9 },
                  xaxis: { gridcolor: '#374151' },
                  yaxis: {
                    title: { text: 'Force / Moment', font: { size: 9 } },
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
      )}
    </div>
  );
}
