import { useState, useMemo, useEffect, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Cross2Icon, ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import type {
  BentBuildParams,
  PierSupportConfig,
  DeadLoadComponents,
  HorizontalPI,
  VerticalPVI,
  AlignmentParams,
} from './bentBuildTypes';
import { DEFAULT_BENT_BUILD_PARAMS, DEFAULT_DEAD_LOADS } from './bentBuildTypes';
import { generateBentFrame } from './generateBentFrame';
import { aashtoLaneCount, aashtoMPF, aashtoLaneLoadKlf } from './bentLoadCalc';
import { useModelStore } from '@/stores/modelStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useComparisonStore } from '@/stores/comparisonStore';
import { useToastStore } from '@/stores/toastStore';

interface BentBuildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Reusable SliderRow (same as BayBuildDialog) ──

function SliderRow({
  label,
  min,
  max,
  step,
  value,
  onChange,
  suffix,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-gray-400">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer accent-yellow-500"
      />
      <span className="w-14 shrink-0 text-right text-xs text-gray-300">
        {value}
        {suffix ? ` ${suffix}` : ''}
      </span>
    </div>
  );
}

// ── Number Input Row ──

function NumberInputRow({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-gray-400">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        step="any"
        className="w-full rounded bg-gray-800 px-2 py-1 text-xs text-gray-300 outline-none ring-1 ring-gray-700 focus:ring-yellow-500"
      />
      {suffix && <span className="w-8 shrink-0 text-xs text-gray-500">{suffix}</span>}
    </div>
  );
}

// ── Main Component ──

export function BentBuildDialog({ open, onOpenChange }: BentBuildDialogProps) {
  // State from defaults
  const [numSpans, setNumSpans] = useState(DEFAULT_BENT_BUILD_PARAMS.numSpans);
  const [spanLengthsStr, setSpanLengthsStr] = useState(
    DEFAULT_BENT_BUILD_PARAMS.spanLengths.join(', '),
  );
  const [numGirders, setNumGirders] = useState(DEFAULT_BENT_BUILD_PARAMS.numGirders);
  const [girderType, setGirderType] = useState<'steel' | 'concrete'>(
    DEFAULT_BENT_BUILD_PARAMS.girderType,
  );
  const [roadwayWidth, setRoadwayWidth] = useState(DEFAULT_BENT_BUILD_PARAMS.roadwayWidth);
  const [overhang, setOverhang] = useState(DEFAULT_BENT_BUILD_PARAMS.overhang);
  const [numBentColumns, setNumBentColumns] = useState(DEFAULT_BENT_BUILD_PARAMS.numBentColumns);
  const [columnHeightsStr, setColumnHeightsStr] = useState(
    DEFAULT_BENT_BUILD_PARAMS.columnHeights.join(', '),
  );
  const [supportMode, setSupportMode] = useState<'conventional' | 'isolated'>(
    DEFAULT_BENT_BUILD_PARAMS.supportMode,
  );
  const [pierSupports, setPierSupports] = useState<PierSupportConfig[]>(
    DEFAULT_BENT_BUILD_PARAMS.pierSupports,
  );
  const [isolationLevel, setIsolationLevel] = useState<'bearing' | 'base'>(
    DEFAULT_BENT_BUILD_PARAMS.isolationLevel,
  );
  const [deadLoads, setDeadLoads] = useState<DeadLoadComponents>({
    ...DEFAULT_DEAD_LOADS,
  });
  const [aashtoLLPercent, setAashtoLLPercent] = useState(DEFAULT_BENT_BUILD_PARAMS.aashtoLLPercent);
  const [slopePercent, setSlopePercent] = useState(DEFAULT_BENT_BUILD_PARAMS.slopePercent);
  const [includeDiaphragms, setIncludeDiaphragms] = useState(
    DEFAULT_BENT_BUILD_PARAMS.includeDiaphragms,
  );
  const [showDeadLoads, setShowDeadLoads] = useState(false);

  // Alignment state
  const [showAlignment, setShowAlignment] = useState(false);
  const [enableHCurve, setEnableHCurve] = useState(false);
  const [horizontalPIs, setHorizontalPIs] = useState<HorizontalPI[]>([
    { station: 50, deflectionAngle: 15, radius: 2000, direction: 'R' as const },
  ]);
  const [enableVCurve, setEnableVCurve] = useState(false);
  const [verticalPVIs, setVerticalPVIs] = useState<VerticalPVI[]>([
    { station: 130, elevation: 0, exitGrade: -1, curveLength: 50 },
  ]);
  const [chordsPerSpan, setChordsPerSpan] = useState(1);

  const loadModelFromJSON = useModelStore((s) => s.loadModelFromJSON);
  const resetAnalysis = useAnalysisStore((s) => s.resetAnalysis);
  const resetComparison = useComparisonStore((s) => s.resetComparison);
  const addToast = useToastStore((s) => s.addToast);

  const numPiers = numSpans - 1;

  // Parse comma-separated inputs
  const spanLengths = useMemo(() => {
    const parsed = spanLengthsStr
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);
    while (parsed.length < numSpans) parsed.push(parsed[parsed.length - 1] ?? 80);
    return parsed.slice(0, numSpans);
  }, [spanLengthsStr, numSpans]);

  const columnHeights = useMemo(() => {
    const parsed = columnHeightsStr
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);
    while (parsed.length < numPiers) parsed.push(parsed[parsed.length - 1] ?? 20);
    return parsed.slice(0, Math.max(0, numPiers));
  }, [columnHeightsStr, numPiers]);

  // Synchronously derive pier supports sized to numPiers (avoids render-before-effect crash)
  const syncedPierSupports = useMemo(() => {
    const next = [...pierSupports];
    while (next.length < numPiers) next.push({ type: 'FIX', guided: false });
    return next.slice(0, Math.max(0, numPiers));
  }, [pierSupports, numPiers]);

  // Auto-resize span lengths text when numSpans changes
  useEffect(() => {
    const parts = spanLengthsStr.split(',').map((s) => s.trim());
    while (parts.length < numSpans) parts.push(parts[parts.length - 1] ?? '80');
    setSpanLengthsStr(parts.slice(0, numSpans).join(', '));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numSpans]);

  // Auto-resize column heights text when numPiers changes
  useEffect(() => {
    if (numPiers <= 0) {
      setColumnHeightsStr('');
      return;
    }
    const parts = columnHeightsStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    while (parts.length < numPiers) parts.push(parts[parts.length - 1] ?? '20');
    setColumnHeightsStr(parts.slice(0, numPiers).join(', '));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPiers]);

  // Build alignment param (undefined = straight bridge, backward compat)
  const alignmentParam = useMemo<AlignmentParams | undefined>(() => {
    if (!enableHCurve && !enableVCurve && chordsPerSpan <= 1) return undefined;
    return {
      refElevation: 0,
      entryBearing: 0,
      entryGrade: slopePercent,
      horizontalPIs: enableHCurve ? horizontalPIs : [],
      verticalPVIs: enableVCurve ? verticalPVIs : [],
      chordsPerSpan,
    };
  }, [enableHCurve, enableVCurve, horizontalPIs, verticalPVIs, chordsPerSpan, slopePercent]);

  // Build params
  const params = useMemo<BentBuildParams>(
    () => ({
      numSpans,
      spanLengths,
      numGirders,
      girderType,
      roadwayWidth,
      overhang,
      numBentColumns,
      columnHeights,
      supportMode,
      pierSupports: syncedPierSupports,
      isolationLevel,
      deadLoads,
      aashtoLLPercent,
      slopePercent,
      alignment: alignmentParam,
      includeDiaphragms,
    }),
    [
      numSpans,
      spanLengths,
      numGirders,
      girderType,
      roadwayWidth,
      overhang,
      numBentColumns,
      columnHeights,
      supportMode,
      syncedPierSupports,
      isolationLevel,
      deadLoads,
      aashtoLLPercent,
      slopePercent,
      alignmentParam,
      includeDiaphragms,
    ],
  );

  // Generate model
  const modelJSON = useMemo(() => generateBentFrame(params), [params]);

  // Summary counts
  const summary = useMemo(
    () => ({
      nodes: modelJSON.nodes.length,
      elements: modelJSON.elements.length,
      bearings: modelJSON.bearings.length,
      diaphragms: modelJSON.diaphragms?.length ?? 0,
      equalDof: modelJSON.equalDofConstraints?.length ?? 0,
    }),
    [modelJSON],
  );

  // AASHTO LL info
  const lanes = aashtoLaneCount(roadwayWidth);
  const mpf = aashtoMPF(lanes);
  const totalKlf = aashtoLaneLoadKlf(roadwayWidth);

  // Live preview
  useEffect(() => {
    if (!open) return;
    loadModelFromJSON(modelJSON);
  }, [open, modelJSON, loadModelFromJSON]);

  const handleGenerate = useCallback(() => {
    resetAnalysis();
    resetComparison();
    loadModelFromJSON(modelJSON);
    addToast('success', `Generated "${modelJSON.modelInfo.name}"`);
    onOpenChange(false);
  }, [resetAnalysis, resetComparison, loadModelFromJSON, modelJSON, addToast, onOpenChange]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[520px] max-h-[85vh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-700 bg-gray-900 p-6 shadow-xl focus:outline-none">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold text-gray-200">Bent Build</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              >
                <Cross2Icon className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-1 text-xs text-gray-400">
            Generate a parametric girder bridge with real-time preview.
          </Dialog.Description>

          <div className="mt-5 space-y-4">
            {/* Bridge Geometry */}
            <Section title="Bridge Geometry">
              <SliderRow
                label="Spans"
                min={1}
                max={8}
                step={1}
                value={numSpans}
                onChange={setNumSpans}
              />
              <div className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs text-gray-400">Span Lengths</span>
                <input
                  type="text"
                  value={spanLengthsStr}
                  onChange={(e) => setSpanLengthsStr(e.target.value)}
                  className="w-full rounded bg-gray-800 px-2 py-1 text-xs text-gray-300 outline-none ring-1 ring-gray-700 focus:ring-yellow-500"
                  placeholder="80, 100, 80"
                />
                <span className="w-8 shrink-0 text-xs text-gray-500">ft</span>
              </div>
              <SliderRow
                label="Girders"
                min={3}
                max={10}
                step={1}
                value={numGirders}
                onChange={setNumGirders}
              />
              <SelectRow
                label="Girder Type"
                value={girderType}
                onChange={(v) => setGirderType(v as 'steel' | 'concrete')}
                options={[
                  { value: 'steel', label: 'Steel' },
                  { value: 'concrete', label: 'Concrete' },
                ]}
              />
              <SliderRow
                label="Roadway Width"
                min={12}
                max={100}
                step={2}
                value={roadwayWidth}
                onChange={setRoadwayWidth}
                suffix="ft"
              />
              <SliderRow
                label="Overhang"
                min={1}
                max={6}
                step={0.5}
                value={overhang}
                onChange={setOverhang}
                suffix="ft"
              />
              <SliderRow
                label="Grade Slope"
                min={-8}
                max={8}
                step={0.5}
                value={slopePercent}
                onChange={setSlopePercent}
                suffix="%"
              />
            </Section>

            {/* Alignment (collapsible) */}
            <div>
              <button
                type="button"
                onClick={() => setShowAlignment(!showAlignment)}
                className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-gray-400"
              >
                <span>Alignment (Advanced)</span>
                {showAlignment ? (
                  <ChevronUpIcon className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDownIcon className="h-3.5 w-3.5" />
                )}
              </button>
              {showAlignment && (
                <div className="mt-2 space-y-3">
                  {/* Horizontal Curve */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={enableHCurve}
                        onChange={(e) => setEnableHCurve(e.target.checked)}
                        className="accent-yellow-500"
                      />
                      <span className="text-xs font-medium text-gray-300">Horizontal Curve</span>
                    </label>
                    {enableHCurve &&
                      horizontalPIs.map((pi, i) => (
                        <div
                          key={i}
                          className="ml-4 space-y-1 rounded border border-gray-700/50 p-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-500">PI {i + 1}</span>
                            {horizontalPIs.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setHorizontalPIs(horizontalPIs.filter((_, j) => j !== i))
                                }
                                className="text-[10px] text-red-400 hover:text-red-300"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <NumberInputRow
                            label="PC Station"
                            value={String(pi.station)}
                            onChange={(v) => {
                              const next = [...horizontalPIs];
                              next[i] = { ...next[i]!, station: Number(v) || 0 };
                              setHorizontalPIs(next);
                            }}
                            suffix="ft"
                          />
                          <NumberInputRow
                            label="Defl. Angle"
                            value={String(pi.deflectionAngle)}
                            onChange={(v) => {
                              const next = [...horizontalPIs];
                              next[i] = { ...next[i]!, deflectionAngle: Number(v) || 0 };
                              setHorizontalPIs(next);
                            }}
                            suffix="deg"
                          />
                          <NumberInputRow
                            label="Radius"
                            value={String(pi.radius)}
                            onChange={(v) => {
                              const next = [...horizontalPIs];
                              next[i] = { ...next[i]!, radius: Number(v) || 0 };
                              setHorizontalPIs(next);
                            }}
                            suffix="ft"
                          />
                          <SelectRow
                            label="Direction"
                            value={pi.direction}
                            onChange={(v) => {
                              const next = [...horizontalPIs];
                              next[i] = { ...next[i]!, direction: v as 'L' | 'R' };
                              setHorizontalPIs(next);
                            }}
                            options={[
                              { value: 'L', label: 'Left' },
                              { value: 'R', label: 'Right' },
                            ]}
                          />
                        </div>
                      ))}
                    {enableHCurve && (
                      <button
                        type="button"
                        onClick={() =>
                          setHorizontalPIs([
                            ...horizontalPIs,
                            { station: 100, deflectionAngle: 15, radius: 2000, direction: 'R' },
                          ])
                        }
                        className="ml-4 text-[10px] text-yellow-500 hover:text-yellow-400"
                      >
                        + Add PI
                      </button>
                    )}
                  </div>

                  {/* Vertical Curve */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={enableVCurve}
                        onChange={(e) => setEnableVCurve(e.target.checked)}
                        className="accent-yellow-500"
                      />
                      <span className="text-xs font-medium text-gray-300">Vertical Curve</span>
                    </label>
                    {enableVCurve &&
                      verticalPVIs.map((pvi, i) => (
                        <div
                          key={i}
                          className="ml-4 space-y-1 rounded border border-gray-700/50 p-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-500">PVI {i + 1}</span>
                            {verticalPVIs.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setVerticalPVIs(verticalPVIs.filter((_, j) => j !== i))
                                }
                                className="text-[10px] text-red-400 hover:text-red-300"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <NumberInputRow
                            label="PVI Station"
                            value={String(pvi.station)}
                            onChange={(v) => {
                              const next = [...verticalPVIs];
                              next[i] = { ...next[i]!, station: Number(v) || 0 };
                              setVerticalPVIs(next);
                            }}
                            suffix="ft"
                          />
                          <NumberInputRow
                            label="PVI Elevation"
                            value={String(pvi.elevation)}
                            onChange={(v) => {
                              const next = [...verticalPVIs];
                              next[i] = { ...next[i]!, elevation: Number(v) || 0 };
                              setVerticalPVIs(next);
                            }}
                            suffix="ft"
                          />
                          <NumberInputRow
                            label="Exit Grade"
                            value={String(pvi.exitGrade)}
                            onChange={(v) => {
                              const next = [...verticalPVIs];
                              next[i] = { ...next[i]!, exitGrade: Number(v) || 0 };
                              setVerticalPVIs(next);
                            }}
                            suffix="%"
                          />
                          <NumberInputRow
                            label="Curve Length"
                            value={String(pvi.curveLength)}
                            onChange={(v) => {
                              const next = [...verticalPVIs];
                              next[i] = { ...next[i]!, curveLength: Number(v) || 0 };
                              setVerticalPVIs(next);
                            }}
                            suffix="ft"
                          />
                        </div>
                      ))}
                    {enableVCurve && (
                      <button
                        type="button"
                        onClick={() =>
                          setVerticalPVIs([
                            ...verticalPVIs,
                            { station: 200, elevation: 0, exitGrade: -1, curveLength: 50 },
                          ])
                        }
                        className="ml-4 text-[10px] text-yellow-500 hover:text-yellow-400"
                      >
                        + Add PVI
                      </button>
                    )}
                  </div>

                  {/* Chords per span */}
                  <SliderRow
                    label="Chords/Span"
                    min={1}
                    max={10}
                    step={1}
                    value={chordsPerSpan}
                    onChange={setChordsPerSpan}
                  />
                </div>
              )}
            </div>

            {/* Bent Configuration */}
            {numPiers > 0 && (
              <Section title="Bent Configuration">
                <SliderRow
                  label="Bent Columns"
                  min={1}
                  max={4}
                  step={1}
                  value={numBentColumns}
                  onChange={setNumBentColumns}
                />
                <div className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs text-gray-400">Column Heights</span>
                  <input
                    type="text"
                    value={columnHeightsStr}
                    onChange={(e) => setColumnHeightsStr(e.target.value)}
                    className="w-full rounded bg-gray-800 px-2 py-1 text-xs text-gray-300 outline-none ring-1 ring-gray-700 focus:ring-yellow-500"
                    placeholder="20, 20"
                  />
                  <span className="w-8 shrink-0 text-xs text-gray-500">ft</span>
                </div>
              </Section>
            )}

            {/* Support Conditions */}
            <Section title="Support Conditions">
              <SelectRow
                label="Mode"
                value={supportMode}
                onChange={(v) => setSupportMode(v as 'conventional' | 'isolated')}
                options={[
                  { value: 'conventional', label: 'Conventional' },
                  { value: 'isolated', label: 'Isolated' },
                ]}
              />

              {supportMode === 'conventional' && numPiers > 0 && (
                <div className="mt-2 space-y-1.5">
                  {syncedPierSupports.map((ps, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-16 text-xs text-gray-500">Pier {i + 1}</span>
                      <select
                        value={ps.type}
                        onChange={(e) => {
                          const next = [...syncedPierSupports];
                          next[i] = {
                            ...next[i]!,
                            type: e.target.value as 'FIX' | 'EXP',
                            guided: next[i]!.guided,
                          };
                          setPierSupports(next);
                        }}
                        className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300 outline-none ring-1 ring-gray-700 focus:ring-yellow-500"
                      >
                        <option value="FIX">FIX</option>
                        <option value="EXP">EXP</option>
                      </select>
                      {ps.type === 'EXP' && (
                        <label className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={ps.guided}
                            onChange={(e) => {
                              const next = [...syncedPierSupports];
                              next[i] = {
                                ...next[i]!,
                                guided: e.target.checked,
                              };
                              setPierSupports(next);
                            }}
                            className="accent-yellow-500"
                          />
                          <span className="text-xs text-gray-500">Guided</span>
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {supportMode === 'isolated' && (
                <SelectRow
                  label="Isolation Level"
                  value={isolationLevel}
                  onChange={(v) => setIsolationLevel(v as 'bearing' | 'base')}
                  options={[
                    { value: 'bearing', label: 'Bearing Level' },
                    { value: 'base', label: 'Column Base' },
                  ]}
                />
              )}

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeDiaphragms}
                  onChange={(e) => setIncludeDiaphragms(e.target.checked)}
                  className="accent-yellow-500"
                />
                <span className="text-xs text-gray-300">Include Rigid Diaphragms</span>
              </label>
            </Section>

            {/* Dead Loads (collapsible) */}
            <div>
              <button
                type="button"
                onClick={() => setShowDeadLoads(!showDeadLoads)}
                className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-gray-400"
              >
                <span>Dead Loads</span>
                {showDeadLoads ? (
                  <ChevronUpIcon className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDownIcon className="h-3.5 w-3.5" />
                )}
              </button>
              {showDeadLoads && (
                <div className="mt-2 space-y-1.5">
                  <NumberInputRow
                    label="Overlay"
                    value={String(deadLoads.overlayPsf)}
                    onChange={(v) =>
                      setDeadLoads({
                        ...deadLoads,
                        overlayPsf: Number(v) || 0,
                      })
                    }
                    suffix="psf"
                  />
                  <NumberInputRow
                    label="Barriers"
                    value={String(deadLoads.barrierKlf)}
                    onChange={(v) =>
                      setDeadLoads({
                        ...deadLoads,
                        barrierKlf: Number(v) || 0,
                      })
                    }
                    suffix="klf"
                  />
                  <NumberInputRow
                    label="Cross-frames"
                    value={String(deadLoads.crossFramesPsf)}
                    onChange={(v) =>
                      setDeadLoads({
                        ...deadLoads,
                        crossFramesPsf: Number(v) || 0,
                      })
                    }
                    suffix="psf"
                  />
                  <NumberInputRow
                    label="Utilities"
                    value={String(deadLoads.utilitiesPsf)}
                    onChange={(v) =>
                      setDeadLoads({
                        ...deadLoads,
                        utilitiesPsf: Number(v) || 0,
                      })
                    }
                    suffix="psf"
                  />
                  <NumberInputRow
                    label="FWS"
                    value={String(deadLoads.fwsPsf)}
                    onChange={(v) =>
                      setDeadLoads({
                        ...deadLoads,
                        fwsPsf: Number(v) || 0,
                      })
                    }
                    suffix="psf"
                  />
                  <NumberInputRow
                    label="Misc"
                    value={String(deadLoads.miscPsf)}
                    onChange={(v) =>
                      setDeadLoads({
                        ...deadLoads,
                        miscPsf: Number(v) || 0,
                      })
                    }
                    suffix="psf"
                  />
                </div>
              )}
            </div>

            {/* Live Load */}
            <Section title="Live Load">
              <SliderRow
                label="AASHTO LL %"
                min={0}
                max={100}
                step={5}
                value={aashtoLLPercent}
                onChange={setAashtoLLPercent}
                suffix="%"
              />
              <p className="text-xs text-gray-500">
                {lanes} lane{lanes !== 1 ? 's' : ''}, MPF={mpf.toFixed(2)}, {totalKlf.toFixed(2)}{' '}
                klf total
              </p>
            </Section>

            {/* Summary */}
            <div className="rounded-lg bg-gray-800/50 px-3 py-2">
              <p className="text-xs text-gray-400">
                <span className="font-medium text-gray-300">{summary.nodes}</span> nodes,{' '}
                <span className="font-medium text-gray-300">{summary.elements}</span> elements
                {summary.bearings > 0 && (
                  <>
                    , <span className="font-medium text-gray-300">{summary.bearings}</span> bearings
                  </>
                )}
                {summary.diaphragms > 0 && (
                  <>
                    , <span className="font-medium text-gray-300">{summary.diaphragms}</span>{' '}
                    diaphragms
                  </>
                )}
                {summary.equalDof > 0 && (
                  <>
                    , <span className="font-medium text-gray-300">{summary.equalDof}</span> equalDOF
                  </>
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              className="w-full rounded bg-yellow-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-yellow-500"
            >
              Generate
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Helpers ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</h3>
      {children}
    </div>
  );
}

function SelectRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center justify-between">
      <span className="text-xs text-gray-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300 outline-none ring-1 ring-gray-700 focus:ring-yellow-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
