import { lazy, Suspense, useMemo } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { useComparisonStore } from '@/stores/comparisonStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useModelStore } from '@/stores/modelStore';
import { useDisplayStore } from '@/stores/displayStore';
import { computeComparisonSummary } from '@/services/comparisonMetrics';
import { DriftProfileChart } from './DriftProfileChart';
import { BaseShearComparison } from './BaseShearComparison';
import { BearingDemandCapacity } from './BearingDemandCapacity';
import { HingeDistribution } from './HingeDistribution';

const Plot = lazy(() => import('react-plotly.js'));

function AccordionItem({
  value,
  title,
  children,
}: {
  value: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Accordion.Item value={value} className="border-b border-gray-800">
      <Accordion.Header className="flex">
        <Accordion.Trigger className="group flex flex-1 items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-gray-300 hover:bg-gray-800/50">
          <ChevronDownIcon className="h-3 w-3 shrink-0 text-gray-500 transition-transform group-data-[state=open]:rotate-180" />
          <span className="flex-1">{title}</span>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out">
        <div className="px-2 pb-3">{children}</div>
      </Accordion.Content>
    </Accordion.Item>
  );
}

const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4];

function TimeHistoryComparisonPanel() {
  const isolated = useComparisonStore((s) => s.isolated);
  const fixedBase = useComparisonStore((s) => s.fixedBase);
  const showComparisonOverlay = useDisplayStore((s) => s.showComparisonOverlay);
  const setShowComparisonOverlay = useDisplayStore((s) => s.setShowComparisonOverlay);
  const isPlaying = useAnalysisStore((s) => s.isPlaying);
  const playbackSpeed = useAnalysisStore((s) => s.playbackSpeed);
  const currentTimeStep = useAnalysisStore((s) => s.currentTimeStep);
  const togglePlayback = useAnalysisStore((s) => s.togglePlayback);
  const setPlaybackSpeed = useAnalysisStore((s) => s.setPlaybackSpeed);
  const setTimeStep = useAnalysisStore((s) => s.setTimeStep);

  if (!isolated || !fixedBase) {
    return <div className="p-3 text-xs text-gray-500">Comparison data incomplete.</div>;
  }

  const isoTH = isolated.timeHistoryResults;
  const fbTH = fixedBase.timeHistoryResults;

  const isoPeakShear = isoTH?.peakValues?.maxBaseShear?.value ?? isolated.maxBaseShear;
  const fbPeakShear = fbTH?.peakValues?.maxBaseShear?.value ?? fixedBase.maxBaseShear;
  const isoPeakDisp = isoTH?.peakValues?.maxDrift?.value ?? isolated.maxRoofDisplacement;
  const fbPeakDisp = fbTH?.peakValues?.maxDrift?.value ?? fixedBase.maxRoofDisplacement;

  const shearReduction = fbPeakShear > 0 ? ((fbPeakShear - isoPeakShear) / fbPeakShear) * 100 : 0;
  const dispReduction = fbPeakDisp > 0 ? ((fbPeakDisp - isoPeakDisp) / fbPeakDisp) * 100 : 0;

  const totalSteps = isoTH?.timeSteps?.length ?? 0;
  const currentTime = isoTH?.timeSteps?.[currentTimeStep]?.time ?? 0;
  const totalTime = isoTH?.totalTime ?? 0;

  return (
    <div className="space-y-2 p-3">
      {/* Summary header */}
      <div className="rounded bg-gray-800/50 p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-300">Time-History Comparison</span>
          <span className="text-[10px] text-yellow-400">{totalSteps} steps</span>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-1 text-center">
        <div className="rounded bg-gray-800/50 p-2">
          <div className="text-sm font-bold text-yellow-400">{shearReduction.toFixed(0)}%</div>
          <div className="text-[9px] text-gray-400">Shear Reduction</div>
        </div>
        <div className="rounded bg-gray-800/50 p-2">
          <div className="text-sm font-bold text-yellow-400">{isoPeakShear.toFixed(1)}</div>
          <div className="text-[9px] text-gray-400">Iso Shear (kip)</div>
        </div>
        <div className="rounded bg-gray-800/50 p-2">
          <div className="text-sm font-bold text-yellow-400">{fbPeakShear.toFixed(1)}</div>
          <div className="text-[9px] text-gray-400">FB Shear (kip)</div>
        </div>
      </div>

      {/* Displacement metrics */}
      <div className="grid grid-cols-3 gap-1 text-center">
        <div className="rounded bg-gray-800/50 p-2">
          <div className="text-sm font-bold text-yellow-400">{dispReduction.toFixed(0)}%</div>
          <div className="text-[9px] text-gray-400">Disp Reduction</div>
        </div>
        <div className="rounded bg-gray-800/50 p-2">
          <div className="text-sm font-bold text-yellow-400">{isoPeakDisp.toFixed(2)}</div>
          <div className="text-[9px] text-gray-400">Iso Disp (in)</div>
        </div>
        <div className="rounded bg-gray-800/50 p-2">
          <div className="text-sm font-bold text-yellow-400">{fbPeakDisp.toFixed(2)}</div>
          <div className="text-[9px] text-gray-400">FB Disp (in)</div>
        </div>
      </div>

      {/* 3D Overlay toggle */}
      <label className="flex items-center gap-2 px-1 cursor-pointer">
        <input
          type="checkbox"
          checked={showComparisonOverlay}
          onChange={(e) => setShowComparisonOverlay(e.target.checked)}
          className="h-3 w-3 rounded border-gray-600 bg-gray-700 text-yellow-500 focus:ring-yellow-500"
        />
        <span className="text-[10px] text-gray-400">Show 3D overlay (both deformed shapes)</span>
      </label>

      {/* Playback controls */}
      <div className="rounded bg-gray-800/50 p-2 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-gray-400">Playback</span>
          <span className="text-[10px] text-gray-500">
            {currentTime.toFixed(2)}s / {totalTime.toFixed(2)}s
          </span>
        </div>

        {/* Playback slider */}
        <input
          type="range"
          min={0}
          max={Math.max(totalSteps - 1, 0)}
          value={currentTimeStep}
          onChange={(e) => setTimeStep(Number(e.target.value))}
          className="w-full h-1 accent-yellow-500"
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlayback}
            className="rounded bg-yellow-600 px-3 py-1 text-[10px] font-medium text-white hover:bg-yellow-500"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          <div className="flex gap-0.5">
            {PLAYBACK_SPEEDS.map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={() => setPlaybackSpeed(speed)}
                className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
                  playbackSpeed === speed
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:text-gray-200'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ComparisonPanel() {
  const status = useComparisonStore((s) => s.status);
  const comparisonType = useComparisonStore((s) => s.comparisonType);
  const isolated = useComparisonStore((s) => s.isolated);
  const isolatedUpper = useComparisonStore((s) => s.isolatedUpper);
  const isolatedLower = useComparisonStore((s) => s.isolatedLower);
  const fixedBase = useComparisonStore((s) => s.fixedBase);
  const lambdaFactors = useComparisonStore((s) => s.lambdaFactors);
  const error = useComparisonStore((s) => s.error);
  const nodes = useModelStore((s) => s.nodes);
  const bearings = useModelStore((s) => s.bearings);
  const showComparisonOverlay = useDisplayStore((s) => s.showComparisonOverlay);
  const setShowComparisonOverlay = useDisplayStore((s) => s.setShowComparisonOverlay);

  const summary = useMemo(() => {
    if (!isolated || !fixedBase) return null;
    if (comparisonType === 'time_history') return null;
    return computeComparisonSummary(isolated, fixedBase, nodes, bearings);
  }, [isolated, fixedBase, nodes, bearings, comparisonType]);

  if (status === 'idle') {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="text-sm font-medium text-gray-400">No comparison data</p>
        <p className="mt-1 text-xs text-gray-500">
          Run a pushover or time-history comparison to compare isolated vs fixed-base performance
        </p>
      </div>
    );
  }

  if (status === 'running') {
    return (
      <div className="p-3 text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
          Running comparison analysis...
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return <div className="p-3 text-xs text-red-400">Comparison failed: {error}</div>;
  }

  if (!isolated || !fixedBase) {
    return <div className="p-3 text-xs text-gray-500">Comparison data incomplete.</div>;
  }

  // Time-history comparison panel
  if (comparisonType === 'time_history') {
    return <TimeHistoryComparisonPanel />;
  }

  // Pushover comparison panel
  if (!summary) {
    return <div className="p-3 text-xs text-gray-500">Comparison data incomplete.</div>;
  }

  // Build capacity curve traces
  const capacityTraces: Plotly.Data[] = [
    {
      x: isolated.pushoverResults.capacityCurve.map((pt) => pt.roofDisplacement),
      y: isolated.pushoverResults.capacityCurve.map((pt) => pt.baseShear),
      type: 'scattergl' as const,
      mode: 'lines' as const,
      line: { color: '#D4AF37', width: 2 },
      name: 'Isolated (Nominal)',
    },
    {
      x: fixedBase.pushoverResults.capacityCurve.map((pt) => pt.roofDisplacement),
      y: fixedBase.pushoverResults.capacityCurve.map((pt) => pt.baseShear),
      type: 'scattergl' as const,
      mode: 'lines' as const,
      line: { color: '#FACC15', width: 2 },
      name: 'Fixed-Base',
    },
  ];

  if (isolatedUpper) {
    capacityTraces.push({
      x: isolatedUpper.pushoverResults.capacityCurve.map((pt) => pt.roofDisplacement),
      y: isolatedUpper.pushoverResults.capacityCurve.map((pt) => pt.baseShear),
      type: 'scattergl' as const,
      mode: 'lines' as const,
      line: { color: '#D4AF37', width: 1.5, dash: 'dash' },
      name: `Upper (${lambdaFactors?.max ?? 1.8})`,
    });
  }

  if (isolatedLower) {
    capacityTraces.push({
      x: isolatedLower.pushoverResults.capacityCurve.map((pt) => pt.roofDisplacement),
      y: isolatedLower.pushoverResults.capacityCurve.map((pt) => pt.baseShear),
      type: 'scattergl' as const,
      mode: 'lines' as const,
      line: { color: '#D4AF37', width: 1.5, dash: 'dot' },
      name: `Lower (${lambdaFactors?.min ?? 0.85})`,
    });
  }

  return (
    <div className="space-y-2 p-3">
      {/* Summary header */}
      <div className="rounded bg-gray-800/50 p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-300">
            Isolated vs Fixed-Base Comparison
          </span>
          {lambdaFactors && (
            <span className="text-[10px] text-yellow-400">
              Lambda {lambdaFactors.min}/{lambdaFactors.max}
            </span>
          )}
        </div>
      </div>

      {/* Key metrics bar */}
      <div className="grid grid-cols-3 gap-1 text-center">
        <div className="rounded bg-gray-800/50 p-2">
          <div className="text-sm font-bold text-yellow-400">
            {summary.baseShear.reductionPercent.toFixed(0)}%
          </div>
          <div className="text-[9px] text-gray-400">Shear Reduction</div>
        </div>
        <div className="rounded bg-gray-800/50 p-2">
          <div className="text-sm font-bold text-yellow-400">
            {isolated.maxBaseShear.toFixed(1)}
          </div>
          <div className="text-[9px] text-gray-400">Iso Shear (kip)</div>
        </div>
        <div className="rounded bg-gray-800/50 p-2">
          <div className="text-sm font-bold text-yellow-400">
            {fixedBase.maxBaseShear.toFixed(1)}
          </div>
          <div className="text-[9px] text-gray-400">FB Shear (kip)</div>
        </div>
      </div>

      {/* 3D Overlay toggle */}
      <label className="flex items-center gap-2 px-1 cursor-pointer">
        <input
          type="checkbox"
          checked={showComparisonOverlay}
          onChange={(e) => setShowComparisonOverlay(e.target.checked)}
          className="h-3 w-3 rounded border-gray-600 bg-gray-700 text-yellow-500 focus:ring-yellow-500"
        />
        <span className="text-[10px] text-gray-400">Show 3D overlay (both deformed shapes)</span>
      </label>

      {/* Dashboard accordion */}
      <Accordion.Root type="multiple" defaultValue={['capacity', 'drift', 'shear']}>
        <AccordionItem value="capacity" title="Capacity Curve">
          <div className="h-48 rounded bg-gray-800/50">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-xs text-gray-500">
                  Loading chart...
                </div>
              }
            >
              <Plot
                data={capacityTraces}
                layout={{
                  margin: { t: 10, r: 10, b: 30, l: 50 },
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
                  legend: { x: 0, y: 1, font: { size: 8 } },
                  showlegend: true,
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%', height: '100%' }}
              />
            </Suspense>
          </div>
        </AccordionItem>

        <AccordionItem value="drift" title="Drift Profile">
          <DriftProfileChart data={summary.driftProfiles} />
        </AccordionItem>

        <AccordionItem value="shear" title="Base Shear">
          <BaseShearComparison data={summary.baseShear} />
        </AccordionItem>

        <AccordionItem value="bearings" title="Bearing D/C">
          <BearingDemandCapacity data={summary.bearingDemands} />
        </AccordionItem>

        <AccordionItem value="hinges" title="Hinge Distribution">
          <HingeDistribution data={summary.hingeDistribution} />
        </AccordionItem>
      </Accordion.Root>
    </div>
  );
}
