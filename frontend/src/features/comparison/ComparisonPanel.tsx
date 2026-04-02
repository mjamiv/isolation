import { lazy, Suspense, useMemo } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { useComparisonStore } from '@/stores/comparisonStore';
import { useModelStore } from '@/stores/modelStore';
import { useDisplayStore } from '@/stores/displayStore';
import { computeComparisonSummary } from '@/services/comparisonMetrics';
import { PlaybackControls } from '@/features/playback/PlaybackControls';
import { DriftProfileChart } from './DriftProfileChart';
import { BaseShearComparison } from './BaseShearComparison';
import { BearingDemandCapacity } from './BearingDemandCapacity';
import { HingeDistribution } from './HingeDistribution';
import { ChartPlotSkeleton } from '@/components/ui/Skeleton';

const Plot = lazy(() => import('react-plotly.js'));

function Toggle({
  label,
  checked,
  onChange,
  ariaLabel,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-0.5">
      <span className="text-ui-xs text-gray-400">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        onClick={() => onChange(!checked)}
        className="toggle-track"
      >
        <div className="toggle-thumb" />
      </button>
    </label>
  );
}

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
    <Accordion.Item value={value} className="border-b border-white/[0.06]">
      <Accordion.Header className="flex">
        <Accordion.Trigger className="group flex flex-1 items-center gap-2 px-3 py-2 text-left text-ui-sm font-semibold text-gray-300 hover:bg-surface-3">
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

function TimeHistoryComparisonPanel() {
  const isolated = useComparisonStore((s) => s.isolated);
  const fixedBase = useComparisonStore((s) => s.fixedBase);
  const showComparisonOverlay = useDisplayStore((s) => s.showComparisonOverlay);
  const setShowComparisonOverlay = useDisplayStore((s) => s.setShowComparisonOverlay);

  if (!isolated || !fixedBase) {
    return <div className="p-3 text-ui-sm text-gray-500">Comparison data incomplete.</div>;
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
  const dt = isoTH?.dt ?? 0.02;
  const totalTime = isoTH?.totalTime ?? 0;

  const timeAtStep = (step: number) => isoTH?.timeSteps?.[step]?.time ?? step * dt;

  return (
    <div className="space-y-2 p-3">
      {/* Summary header */}
      <div className="metric-card rounded-lg p-2">
        <div className="flex items-center justify-between">
          <span className="text-ui-sm font-semibold text-gray-300">Time-History Comparison</span>
          <span className="text-ui-xs text-yellow-400">{totalSteps} steps</span>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-1 gap-1 text-center sm:grid-cols-3">
        <div className="metric-card rounded-lg p-2">
          <div className="text-ui-lg font-bold text-yellow-400">{shearReduction.toFixed(0)}%</div>
          <div className="text-ui-xs text-gray-400">Shear Reduction</div>
        </div>
        <div className="metric-card rounded-lg p-2">
          <div className="text-ui-lg font-bold text-yellow-400">{isoPeakShear.toFixed(1)}</div>
          <div className="text-ui-xs text-gray-400">Isolated Shear (kip)</div>
        </div>
        <div className="metric-card rounded-lg p-2">
          <div className="text-ui-lg font-bold text-yellow-400">{fbPeakShear.toFixed(1)}</div>
          <div className="text-ui-xs text-gray-400">Fixed-Base Shear (kip)</div>
        </div>
      </div>

      {/* Displacement metrics */}
      <div className="grid grid-cols-1 gap-1 text-center sm:grid-cols-3">
        <div className="metric-card rounded-lg p-2">
          <div className="text-ui-lg font-bold text-yellow-400">{dispReduction.toFixed(0)}%</div>
          <div className="text-ui-xs text-gray-400">Displacement Reduction</div>
        </div>
        <div className="metric-card rounded-lg p-2">
          <div className="text-ui-lg font-bold text-yellow-400">{isoPeakDisp.toFixed(2)}</div>
          <div className="text-ui-xs text-gray-400">Isolated Displacement (in)</div>
        </div>
        <div className="metric-card rounded-lg p-2">
          <div className="text-ui-lg font-bold text-yellow-400">{fbPeakDisp.toFixed(2)}</div>
          <div className="text-ui-xs text-gray-400">Fixed-Base Displacement (in)</div>
        </div>
      </div>

      {/* 3D Overlay toggle */}
      <div className="px-1">
        <Toggle
          label="Show 3D overlay (both deformed shapes)"
          checked={showComparisonOverlay}
          onChange={setShowComparisonOverlay}
          ariaLabel="Show 3D overlay with both deformed shapes"
        />
      </div>

      {/* Playback controls */}
      <PlaybackControls
        totalSteps={totalSteps}
        dt={dt}
        totalTime={totalTime}
        timeAtStep={timeAtStep}
      />
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
        <p className="text-ui-base font-medium text-gray-400">No comparison data</p>
        <p className="mt-1 text-ui-sm text-gray-500">
          Run a pushover or time-history comparison to compare isolated vs fixed-base performance
        </p>
      </div>
    );
  }

  if (status === 'running') {
    return (
      <div className="p-3 text-ui-sm text-gray-400">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
          Running comparison analysis...
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return <div className="p-3 text-ui-sm text-red-400">Comparison failed: {error}</div>;
  }

  if (!isolated || !fixedBase) {
    return <div className="p-3 text-ui-sm text-gray-500">Comparison data incomplete.</div>;
  }

  // Time-history comparison panel
  if (comparisonType === 'time_history') {
    return <TimeHistoryComparisonPanel />;
  }

  // Pushover comparison panel
  if (!summary) {
    return <div className="p-3 text-ui-sm text-gray-500">Comparison data incomplete.</div>;
  }

  // Build capacity curve traces
  const isoCurve = isolated.pushoverResults?.capacityCurve ?? [];
  const fbCurve = fixedBase.pushoverResults?.capacityCurve ?? [];
  const capacityTraces: Plotly.Data[] = [
    {
      x: isoCurve.map((pt) => pt.roofDisplacement),
      y: isoCurve.map((pt) => pt.baseShear),
      type: 'scatter' as const,
      mode: 'lines' as const,
      line: { color: '#D4AF37', width: 2 },
      name: 'Isolated (Nominal)',
    },
    {
      x: fbCurve.map((pt) => pt.roofDisplacement),
      y: fbCurve.map((pt) => pt.baseShear),
      type: 'scatter' as const,
      mode: 'lines' as const,
      line: { color: '#FACC15', width: 2 },
      name: 'Fixed-Base',
    },
  ];

  if (isolatedUpper?.pushoverResults) {
    const upperCurve = isolatedUpper.pushoverResults.capacityCurve ?? [];
    capacityTraces.push({
      x: upperCurve.map((pt) => pt.roofDisplacement),
      y: upperCurve.map((pt) => pt.baseShear),
      type: 'scatter' as const,
      mode: 'lines' as const,
      line: { color: '#D4AF37', width: 1.5, dash: 'dash' },
      name: `Upper (${lambdaFactors?.max ?? 1.8})`,
    });
  }

  if (isolatedLower?.pushoverResults) {
    const lowerCurve = isolatedLower.pushoverResults.capacityCurve ?? [];
    capacityTraces.push({
      x: lowerCurve.map((pt) => pt.roofDisplacement),
      y: lowerCurve.map((pt) => pt.baseShear),
      type: 'scatter' as const,
      mode: 'lines' as const,
      line: { color: '#D4AF37', width: 1.5, dash: 'dot' },
      name: `Lower (${lambdaFactors?.min ?? 0.85})`,
    });
  }

  return (
    <div className="space-y-2 p-3">
      {/* Summary header */}
      <div className="metric-card rounded-lg p-2">
        <div className="flex items-center justify-between">
          <span className="text-ui-sm font-semibold text-gray-300">
            Isolated vs Fixed-Base Comparison
          </span>
          {lambdaFactors && (
            <span className="text-ui-xs text-yellow-400">
              Lambda {lambdaFactors.min}/{lambdaFactors.max}
            </span>
          )}
        </div>
      </div>

      {/* Key metrics bar */}
      <div className="grid grid-cols-1 gap-1 text-center sm:grid-cols-3">
        <div className="metric-card rounded-lg p-2">
          <div className="text-ui-lg font-bold text-yellow-400">
            {summary.baseShear.reductionPercent.toFixed(0)}%
          </div>
          <div className="text-ui-xs text-gray-400">Shear Reduction</div>
        </div>
        <div className="metric-card rounded-lg p-2">
          <div className="text-ui-lg font-bold text-yellow-400">
            {isolated.maxBaseShear.toFixed(1)}
          </div>
          <div className="text-ui-xs text-gray-400">Isolated Shear (kip)</div>
        </div>
        <div className="metric-card rounded-lg p-2">
          <div className="text-ui-lg font-bold text-yellow-400">
            {fixedBase.maxBaseShear.toFixed(1)}
          </div>
          <div className="text-ui-xs text-gray-400">Fixed-Base Shear (kip)</div>
        </div>
      </div>

      {(isolated.hingeDiagnostic || fixedBase.hingeDiagnostic) && (
        <div className="rounded border border-yellow-700/40 bg-yellow-900/20 p-2 text-ui-xs text-yellow-200">
          {isolated.hingeDiagnostic ?? fixedBase.hingeDiagnostic}
        </div>
      )}

      {/* 3D Overlay toggle */}
      <div className="px-1">
        <Toggle
          label="Show 3D overlay (both deformed shapes)"
          checked={showComparisonOverlay}
          onChange={setShowComparisonOverlay}
          ariaLabel="Show 3D overlay with both deformed shapes"
        />
      </div>

      {/* Dashboard accordion */}
      <Accordion.Root type="multiple" defaultValue={['capacity', 'drift', 'shear']}>
        <AccordionItem value="capacity" title="Capacity Curve">
          <div className="metric-card h-48 rounded-lg">
            <Suspense fallback={<ChartPlotSkeleton className="h-full min-h-[12rem]" />}>
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

        <AccordionItem value="bearings" title="Bearing Demand/Capacity">
          <div className="space-y-1.5">
            <p className="text-ui-xs text-gray-500">Demand over capacity ratio for each bearing.</p>
            <BearingDemandCapacity data={summary.bearingDemands} />
          </div>
        </AccordionItem>

        <AccordionItem value="hinges" title="Hinge Distribution">
          <HingeDistribution data={summary.hingeDistribution} />
        </AccordionItem>
      </Accordion.Root>
    </div>
  );
}
