import { useState, useMemo, lazy, Suspense } from 'react';
import type { TimeHistoryResults as THResultsType } from '@/types/analysis';
import { TimeHistoryPlaybackControls } from './TimeHistoryPlaybackControls';

const Plot = lazy(() => import('react-plotly.js'));

interface TimeHistoryResultsProps {
  data: THResultsType;
}

export function TimeHistoryResults({ data }: TimeHistoryResultsProps) {
  const nodeIds = useMemo(() => {
    if (data.timeSteps.length === 0) return [];
    const first = data.timeSteps[0]!;
    return Object.keys(first.nodeDisplacements).map(Number);
  }, [data.timeSteps]);

  const bearingIds = useMemo(() => {
    if (data.timeSteps.length === 0) return [];
    const first = data.timeSteps[0]!;
    return Object.keys(first.bearingResponses).map(Number);
  }, [data.timeSteps]);

  const [selectedNode, setSelectedNode] = useState<number>(nodeIds[0] ?? 0);
  const [selectedBearing, setSelectedBearing] = useState<number>(bearingIds[0] ?? 0);

  // Displacement time series for selected node
  const dispTrace = useMemo(() => {
    const times: number[] = [];
    const dx: number[] = [];
    for (const step of data.timeSteps) {
      times.push(step.time);
      const d = step.nodeDisplacements[selectedNode];
      dx.push(d ? d[0] : 0);
    }
    return { times, dx };
  }, [data.timeSteps, selectedNode]);

  // Bearing hysteresis for selected bearing
  const hysteresisTrace = useMemo(() => {
    if (selectedBearing === 0) return null;
    const disp: number[] = [];
    const force: number[] = [];
    for (const step of data.timeSteps) {
      const br = step.bearingResponses[selectedBearing];
      if (br) {
        disp.push(br.displacement[0]);
        force.push(br.force[0]);
      }
    }
    return { disp, force };
  }, [data.timeSteps, selectedBearing]);

  const peak = data.peakValues;

  return (
    <div className="space-y-3">
      {/* Playback controls */}
      <TimeHistoryPlaybackControls totalSteps={data.timeSteps.length} dt={data.dt} />

      {/* Summary stats */}
      <div className="rounded bg-gray-800/50 p-2 text-[10px]">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-400">
          <span>Duration:</span>
          <span className="font-mono text-gray-300">{data.totalTime.toFixed(2)}s</span>
          <span>Peak Drift:</span>
          <span className="font-mono text-gray-300">{peak.maxDrift.value.toFixed(4)} (story {peak.maxDrift.story})</span>
          <span>Peak Base Shear:</span>
          <span className="font-mono text-gray-300">{peak.maxBaseShear.value.toFixed(2)} kip</span>
          {peak.maxBearingDisp.bearingId > 0 && (
            <>
              <span>Peak Brg Disp:</span>
              <span className="font-mono text-gray-300">{peak.maxBearingDisp.value.toFixed(4)} in</span>
            </>
          )}
        </div>
      </div>

      {/* Node displacement chart */}
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-300">Displacement vs Time</h3>
          <select
            value={selectedNode}
            onChange={(e) => setSelectedNode(Number(e.target.value))}
            className="rounded bg-gray-800 px-2 py-0.5 text-[10px] text-gray-300 outline-none ring-1 ring-gray-700"
          >
            {nodeIds.map((id) => (
              <option key={id} value={id}>Node {id}</option>
            ))}
          </select>
        </div>
        <div className="mt-1 h-48 rounded bg-gray-800/50">
          <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-gray-500">Loading chart...</div>}>
            <Plot
              data={[{
                x: dispTrace.times,
                y: dispTrace.dx,
                type: 'scatter' as const,
                mode: 'lines' as const,
                line: { color: '#3b82f6', width: 1 },
                name: `Node ${selectedNode} dx`,
              }]}
              layout={{
                margin: { t: 10, r: 10, b: 30, l: 40 },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                font: { color: '#9ca3af', size: 9 },
                xaxis: { title: { text: 'Time (s)', font: { size: 9 } }, gridcolor: '#374151' },
                yaxis: { title: { text: 'Disp (in)', font: { size: 9 } }, gridcolor: '#374151' },
                showlegend: false,
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%', height: '100%' }}
            />
          </Suspense>
        </div>
      </div>

      {/* Bearing hysteresis chart */}
      {bearingIds.length > 0 && (
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-300">Bearing Hysteresis</h3>
            <select
              value={selectedBearing}
              onChange={(e) => setSelectedBearing(Number(e.target.value))}
              className="rounded bg-gray-800 px-2 py-0.5 text-[10px] text-gray-300 outline-none ring-1 ring-gray-700"
            >
              {bearingIds.map((id) => (
                <option key={id} value={id}>Bearing {id}</option>
              ))}
            </select>
          </div>
          {hysteresisTrace && (
            <div className="mt-1 h-48 rounded bg-gray-800/50">
              <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-gray-500">Loading chart...</div>}>
                <Plot
                  data={[{
                    x: hysteresisTrace.disp,
                    y: hysteresisTrace.force,
                    type: 'scatter' as const,
                    mode: 'lines' as const,
                    line: { color: '#10b981', width: 1 },
                    name: `Bearing ${selectedBearing}`,
                  }]}
                  layout={{
                    margin: { t: 10, r: 10, b: 30, l: 40 },
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    font: { color: '#9ca3af', size: 9 },
                    xaxis: { title: { text: 'Disp (in)', font: { size: 9 } }, gridcolor: '#374151' },
                    yaxis: { title: { text: 'Force (kip)', font: { size: 9 } }, gridcolor: '#374151' },
                    showlegend: false,
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: '100%', height: '100%' }}
                />
              </Suspense>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
