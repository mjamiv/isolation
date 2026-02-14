import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import type { TimeHistoryResults as THResultsType } from '@/types/analysis';
import { useAnalysisStore } from '@/stores/analysisStore';
import { TimeHistoryPlaybackControls } from './TimeHistoryPlaybackControls';

const Plot = lazy(() => import('react-plotly.js'));

interface TimeHistoryResultsProps {
  data: THResultsType;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function TimeHistoryResults({ data }: TimeHistoryResultsProps) {
  const currentTimeStep = useAnalysisStore((s) => s.currentTimeStep);

  const nodeIds = useMemo(() => {
    if (data.timeSteps.length === 0) return [];
    return Object.keys(data.timeSteps[0]!.nodeDisplacements).map(Number);
  }, [data.timeSteps]);

  const bearingIds = useMemo(() => {
    if (data.timeSteps.length === 0) return [];
    return Object.keys(data.timeSteps[0]!.bearingResponses).map(Number);
  }, [data.timeSteps]);

  const elementIds = useMemo(() => {
    if (data.timeSteps.length === 0) return [];
    return Object.keys(data.timeSteps[0]!.elementForces).map(Number);
  }, [data.timeSteps]);

  const [selectedNode, setSelectedNode] = useState<number>(nodeIds[0] ?? 0);
  const [selectedBearing, setSelectedBearing] = useState<number>(bearingIds[0] ?? 0);
  const [selectedElement, setSelectedElement] = useState<number>(elementIds[0] ?? 0);

  useEffect(() => {
    if (nodeIds.length > 0 && !nodeIds.includes(selectedNode)) {
      setSelectedNode(nodeIds[0]!);
    }
  }, [nodeIds, selectedNode]);

  useEffect(() => {
    if (bearingIds.length > 0 && !bearingIds.includes(selectedBearing)) {
      setSelectedBearing(bearingIds[0]!);
    }
  }, [bearingIds, selectedBearing]);

  useEffect(() => {
    if (elementIds.length > 0 && !elementIds.includes(selectedElement)) {
      setSelectedElement(elementIds[0]!);
    }
  }, [elementIds, selectedElement]);

  const times = useMemo(() => data.timeSteps.map((s) => s.time), [data.timeSteps]);
  const stepIndex = clamp(currentTimeStep, 0, Math.max(0, data.timeSteps.length - 1));
  const currentTime = times[stepIndex] ?? 0;

  const nodeTrace = useMemo(() => {
    const dx: number[] = [];
    const dy: number[] = [];
    const dz: number[] = [];

    for (const step of data.timeSteps) {
      const d = step.nodeDisplacements[selectedNode];
      dx.push(d ? d[0] : 0);
      dy.push(d ? d[1] : 0);
      dz.push(d ? d[2] : 0);
    }

    return { dx, dy, dz };
  }, [data.timeSteps, selectedNode]);

  const bearingTrace = useMemo(() => {
    const dispX: number[] = [];
    const dispY: number[] = [];
    const forceX: number[] = [];
    const forceY: number[] = [];
    const axial: number[] = [];

    for (const step of data.timeSteps) {
      const br = step.bearingResponses[selectedBearing];
      if (br) {
        dispX.push(br.displacement[0] ?? 0);
        dispY.push(br.displacement[1] ?? 0);
        forceX.push(br.force[0] ?? 0);
        forceY.push(br.force[1] ?? 0);
        axial.push(br.axialForce ?? 0);
      } else {
        dispX.push(0);
        dispY.push(0);
        forceX.push(0);
        forceY.push(0);
        axial.push(0);
      }
    }

    return { dispX, dispY, forceX, forceY, axial };
  }, [data.timeSteps, selectedBearing]);

  const elementTrace = useMemo(() => {
    const shear: number[] = [];
    const moment: number[] = [];

    for (const step of data.timeSteps) {
      const f = step.elementForces[selectedElement] ?? [];
      const v = f[1] ?? f[4] ?? 0;
      const m = f[2] ?? f[5] ?? 0;
      shear.push(v);
      moment.push(m);
    }

    return { shear, moment };
  }, [data.timeSteps, selectedElement]);

  const peak = data.peakValues;

  return (
    <div className="space-y-3">
      <TimeHistoryPlaybackControls totalSteps={data.timeSteps.length} dt={data.dt} />

      <div className="grid grid-cols-2 gap-2 text-[10px] md:grid-cols-4">
        <div className="rounded bg-gray-800/50 p-2">
          <p className="text-gray-500">Duration</p>
          <p className="font-mono text-gray-200">{data.totalTime.toFixed(2)} s</p>
        </div>
        <div className="rounded bg-gray-800/50 p-2">
          <p className="text-gray-500">Current Time</p>
          <p className="font-mono text-gray-200">{currentTime.toFixed(2)} s</p>
        </div>
        <div className="rounded bg-gray-800/50 p-2">
          <p className="text-gray-500">Peak Bearing Disp</p>
          <p className="font-mono text-gray-200">{peak.maxBearingDisp.value.toFixed(4)}</p>
        </div>
        <div className="rounded bg-gray-800/50 p-2">
          <p className="text-gray-500">Peak Base Shear</p>
          <p className="font-mono text-gray-200">{peak.maxBaseShear.value.toFixed(2)}</p>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-300">3D Node Displacement Time History</h3>
          <select
            value={selectedNode}
            onChange={(e) => setSelectedNode(Number(e.target.value))}
            className="rounded bg-gray-800 px-2 py-0.5 text-[10px] text-gray-300 outline-none ring-1 ring-gray-700"
          >
            {nodeIds.map((id) => (
              <option key={id} value={id}>
                Node {id}
              </option>
            ))}
          </select>
        </div>
        <div className="h-56 rounded bg-gray-800/50">
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
                  x: times,
                  y: nodeTrace.dx,
                  type: 'scatter' as const,
                  mode: 'lines' as const,
                  line: { color: '#38bdf8', width: 1.3 },
                  name: 'Ux',
                },
                {
                  x: times,
                  y: nodeTrace.dy,
                  type: 'scatter' as const,
                  mode: 'lines' as const,
                  line: { color: '#22c55e', width: 1.1 },
                  name: 'Uy',
                },
                {
                  x: times,
                  y: nodeTrace.dz,
                  type: 'scatter' as const,
                  mode: 'lines' as const,
                  line: { color: '#f59e0b', width: 1.1 },
                  name: 'Uz',
                },
                {
                  x: [currentTime],
                  y: [nodeTrace.dx[stepIndex] ?? 0],
                  type: 'scatter' as const,
                  mode: 'markers' as const,
                  marker: { color: '#f43f5e', size: 7 },
                  name: 'Current',
                },
              ]}
              layout={{
                margin: { t: 10, r: 10, b: 30, l: 40 },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                font: { color: '#9ca3af', size: 9 },
                xaxis: { title: { text: 'Time (s)', font: { size: 9 } }, gridcolor: '#374151' },
                yaxis: { title: { text: 'Displacement', font: { size: 9 } }, gridcolor: '#374151' },
                legend: { orientation: 'h', y: 1.2, font: { size: 9 } },
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%', height: '100%' }}
            />
          </Suspense>
        </div>
      </div>

      {bearingIds.length > 0 && (
        <>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-300">
                Friction Pendulum Bearing Response
              </h3>
              <select
                value={selectedBearing}
                onChange={(e) => setSelectedBearing(Number(e.target.value))}
                className="rounded bg-gray-800 px-2 py-0.5 text-[10px] text-gray-300 outline-none ring-1 ring-gray-700"
              >
                {bearingIds.map((id) => (
                  <option key={id} value={id}>
                    Bearing {id}
                  </option>
                ))}
              </select>
            </div>
            <div className="h-52 rounded bg-gray-800/50">
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
                      x: times,
                      y: bearingTrace.dispX,
                      type: 'scatter' as const,
                      mode: 'lines' as const,
                      line: { color: '#34d399', width: 1.4 },
                      name: 'Disp X',
                    },
                    {
                      x: times,
                      y: bearingTrace.forceX,
                      type: 'scatter' as const,
                      mode: 'lines' as const,
                      yaxis: 'y2' as const,
                      line: { color: '#f97316', width: 1.2 },
                      name: 'Force X',
                    },
                  ]}
                  layout={{
                    margin: { t: 10, r: 40, b: 30, l: 40 },
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    font: { color: '#9ca3af', size: 9 },
                    xaxis: { title: { text: 'Time (s)', font: { size: 9 } }, gridcolor: '#374151' },
                    yaxis: { title: { text: 'Disp', font: { size: 9 } }, gridcolor: '#374151' },
                    yaxis2: {
                      title: { text: 'Force', font: { size: 9 } },
                      overlaying: 'y',
                      side: 'right',
                      gridcolor: '#374151',
                    },
                    legend: { orientation: 'h', y: 1.2, font: { size: 9 } },
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: '100%', height: '100%' }}
                />
              </Suspense>
            </div>
          </div>

          <div>
            <h3 className="mb-1 text-xs font-semibold text-gray-300">Bearing Hysteresis Loop</h3>
            <div className="h-52 rounded bg-gray-800/50">
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
                      x: bearingTrace.dispX,
                      y: bearingTrace.forceX,
                      type: 'scatter' as const,
                      mode: 'lines' as const,
                      line: { color: '#10b981', width: 1.2 },
                      name: 'Loop',
                    },
                    {
                      x: [bearingTrace.dispX[stepIndex] ?? 0],
                      y: [bearingTrace.forceX[stepIndex] ?? 0],
                      type: 'scatter' as const,
                      mode: 'markers' as const,
                      marker: { color: '#f43f5e', size: 7 },
                      name: 'Current',
                    },
                  ]}
                  layout={{
                    margin: { t: 10, r: 10, b: 30, l: 40 },
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    font: { color: '#9ca3af', size: 9 },
                    xaxis: {
                      title: { text: 'Displacement', font: { size: 9 } },
                      gridcolor: '#374151',
                    },
                    yaxis: { title: { text: 'Force', font: { size: 9 } }, gridcolor: '#374151' },
                    showlegend: false,
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: '100%', height: '100%' }}
                />
              </Suspense>
            </div>
          </div>
        </>
      )}

      {elementIds.length > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-300">
              Element Shear/Moment Time History
            </h3>
            <select
              value={selectedElement}
              onChange={(e) => setSelectedElement(Number(e.target.value))}
              className="rounded bg-gray-800 px-2 py-0.5 text-[10px] text-gray-300 outline-none ring-1 ring-gray-700"
            >
              {elementIds.map((id) => (
                <option key={id} value={id}>
                  Element {id}
                </option>
              ))}
            </select>
          </div>
          <div className="h-52 rounded bg-gray-800/50">
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
                    x: times,
                    y: elementTrace.shear,
                    type: 'scatter' as const,
                    mode: 'lines' as const,
                    line: { color: '#60a5fa', width: 1.2 },
                    name: 'Shear',
                  },
                  {
                    x: times,
                    y: elementTrace.moment,
                    type: 'scatter' as const,
                    mode: 'lines' as const,
                    line: { color: '#f59e0b', width: 1.2 },
                    name: 'Moment',
                  },
                ]}
                layout={{
                  margin: { t: 10, r: 10, b: 30, l: 40 },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { color: '#9ca3af', size: 9 },
                  xaxis: { title: { text: 'Time (s)', font: { size: 9 } }, gridcolor: '#374151' },
                  yaxis: { title: { text: 'Response', font: { size: 9 } }, gridcolor: '#374151' },
                  legend: { orientation: 'h', y: 1.2, font: { size: 9 } },
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
