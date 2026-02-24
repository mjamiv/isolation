import { useState, useMemo, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Cross2Icon } from '@radix-ui/react-icons';
import type { AnalysisType, AnalysisParams, PushDirection, LoadPattern } from '@/types/analysis';
import { useModelStore } from '@/stores/modelStore';
import { useRunAnalysis } from './useRunAnalysis';
import { useRunComparison } from './useRunComparison';

interface AnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ANALYSIS_TYPES: { value: AnalysisType; label: string }[] = [
  { value: 'static', label: 'Static' },
  { value: 'modal', label: 'Modal' },
  { value: 'time_history', label: 'Time-History' },
  { value: 'pushover', label: 'Pushover' },
];

export function AnalysisDialog({ open, onOpenChange }: AnalysisDialogProps) {
  const [analysisType, setAnalysisType] = useState<AnalysisType>('static');
  const [numModes, setNumModes] = useState('3');
  const [selectedGmId, setSelectedGmId] = useState('');
  const [dt, setDt] = useState('0.01');
  const [numSteps, setNumSteps] = useState('1000');
  const [targetDisplacement, setTargetDisplacement] = useState('10');
  const [pushDirection, setPushDirection] = useState<PushDirection>('X');
  const [loadPattern, setLoadPattern] = useState<LoadPattern>('linear');
  const [displacementIncrement, setDisplacementIncrement] = useState('0.1');
  const [directionScales, setDirectionScales] = useState<Record<1 | 2 | 3, number>>({
    1: 100,
    2: 0,
    3: 0,
  });

  // Comparison options
  const [runComparisonMode, setRunComparisonMode] = useState(false);
  const [enableLambda, setEnableLambda] = useState(false);
  const [lambdaMin, setLambdaMin] = useState('0.85');
  const [lambdaMax, setLambdaMax] = useState('1.8');

  const loads = useModelStore((s) => s.loads);
  const bearings = useModelStore((s) => s.bearings);
  const groundMotions = useModelStore((s) => s.groundMotions);
  const gmArray = useMemo(() => Array.from(groundMotions.values()), [groundMotions]);

  const { run: runAnalysis, submitting: analysisSubmitting } = useRunAnalysis();
  const { run: runComparison, submitting: comparisonSubmitting } = useRunComparison();
  const submitting = analysisSubmitting || comparisonSubmitting;

  const hasBearings = bearings.size > 0;

  // Reset comparison state every time the dialog opens
  useEffect(() => {
    if (open) {
      setRunComparisonMode(false);
      setEnableLambda(false);
    }
  }, [open]);

  // Auto-select first ground motion when switching to time-history
  useEffect(() => {
    if (analysisType === 'time_history' && selectedGmId === '' && gmArray.length > 0) {
      setSelectedGmId(String(gmArray[0]!.id));
    }
  }, [analysisType, gmArray, selectedGmId]);

  const validate = (): string | null => {
    if (analysisType === 'static' && loads.size === 0) {
      return 'Static analysis requires at least one load.';
    }
    if (analysisType === 'time_history' && groundMotions.size === 0) {
      return 'Time-history analysis requires at least one ground motion.';
    }
    if (analysisType === 'time_history' && !selectedGmId) {
      return 'Please select a ground motion record.';
    }
    if (
      analysisType === 'time_history' &&
      !([1, 2, 3] as const).some((d) => directionScales[d] > 0)
    ) {
      return 'Please select at least one excitation direction.';
    }
    if (analysisType === 'pushover' && loads.size === 0) {
      return 'Pushover analysis requires at least one load defined.';
    }
    if (runComparisonMode && !hasBearings) {
      return 'Comparison requires bearings in the model.';
    }
    if (runComparisonMode && analysisType !== 'pushover' && analysisType !== 'time_history') {
      return 'Comparison mode requires pushover or time-history analysis type.';
    }
    return null;
  };

  const validationError = validate();

  const handleRun = () => {
    if (validationError) return;

    const params: AnalysisParams = { type: analysisType };

    if (analysisType === 'modal') {
      params.numModes = Number(numModes) || 3;
    }

    if (analysisType === 'time_history') {
      const selectedGm = gmArray.find((gm) => gm.id === Number(selectedGmId));
      if (selectedGm) {
        // For Z-up bearing models, the serializer swaps Y↔Z axes so
        // backend DOF 2 = frontend Z (lateral) and DOF 3 = frontend Y (vertical).
        // Map the user's frontend direction to the backend DOF accordingly.
        const zUp = bearings.size > 0;
        const mapDir = (d: 1 | 2 | 3): 1 | 2 | 3 => (zUp ? (d === 2 ? 3 : d === 3 ? 2 : d) : d);

        params.groundMotions = ([1, 2, 3] as const)
          .filter((dir) => directionScales[dir] > 0)
          .map((dir) => ({
            dt: selectedGm.dt,
            acceleration: selectedGm.acceleration,
            direction: mapDir(dir),
            scaleFactor: selectedGm.scaleFactor * (directionScales[dir] / 100),
          }));
      }
      params.dt = Number(dt) || 0.01;
      params.numSteps = Number(numSteps) || 1000;
    }

    if (analysisType === 'pushover') {
      params.targetDisplacement = Number(targetDisplacement) || 10;
      params.pushDirection = pushDirection;
      params.loadPattern = loadPattern;
      params.displacementIncrement = Number(displacementIncrement) || 0.1;
    }

    onOpenChange(false);

    if (runComparisonMode && (analysisType === 'pushover' || analysisType === 'time_history')) {
      const lambdaFactors =
        enableLambda && analysisType === 'pushover'
          ? { min: Number(lambdaMin) || 0.85, max: Number(lambdaMax) || 1.8 }
          : undefined;
      void runComparison(params, lambdaFactors);
    } else {
      void runAnalysis(params);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-96 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-gray-900 p-5 shadow-xl ring-1 ring-gray-700 focus:outline-none">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold text-gray-200">
              Run Analysis
            </Dialog.Title>
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
            Configure and run a structural analysis.
          </Dialog.Description>

          {/* Analysis type selector */}
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-400">Analysis Type</label>
              <div className="mt-1 flex gap-1 rounded-lg bg-gray-800 p-0.5">
                {ANALYSIS_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      setAnalysisType(t.value);
                      setRunComparisonMode(false);
                      setEnableLambda(false);
                    }}
                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      analysisType === t.value
                        ? 'bg-gray-600 text-white'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal params */}
            {analysisType === 'modal' && (
              <div>
                <label className="text-xs font-medium text-gray-400">Number of Modes</label>
                <input
                  type="number"
                  value={numModes}
                  onChange={(e) => setNumModes(e.target.value)}
                  min={1}
                  max={20}
                  className="mt-1 w-full rounded bg-gray-800 px-3 py-1.5 text-xs text-gray-200 outline-none ring-1 ring-gray-700 focus:ring-yellow-500"
                />
              </div>
            )}

            {/* Time-history params */}
            {analysisType === 'time_history' && (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-400">Ground Motion</label>
                  <select
                    value={selectedGmId}
                    onChange={(e) => setSelectedGmId(e.target.value)}
                    className="mt-1 w-full rounded bg-gray-800 px-3 py-1.5 text-xs text-gray-200 outline-none ring-1 ring-gray-700 focus:ring-yellow-500"
                  >
                    <option value="">Select...</option>
                    {gmArray.map((gm) => (
                      <option key={gm.id} value={gm.id}>
                        {gm.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400">Excitation Directions</label>
                  <div className="mt-1 flex gap-3">
                    {([1, 2, 3] as const).map((dir) => {
                      const label = dir === 1 ? 'X' : dir === 2 ? 'Y' : 'Z';
                      const enabled = directionScales[dir] > 0;
                      return (
                        <label key={dir} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) => {
                              setDirectionScales((prev) => ({
                                ...prev,
                                [dir]: e.target.checked ? 100 : 0,
                              }));
                            }}
                            className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-700 text-yellow-500 focus:ring-yellow-500"
                          />
                          <span className="text-xs text-gray-300">{label}</span>
                          <input
                            type="number"
                            value={directionScales[dir]}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                              setDirectionScales((prev) => ({ ...prev, [dir]: val }));
                            }}
                            min={0}
                            max={100}
                            className="w-12 rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-200 text-center outline-none ring-1 ring-gray-700 focus:ring-yellow-500"
                          />
                          <span className="text-[10px] text-gray-500">%</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-gray-400">Time Step (s)</label>
                    <input
                      type="number"
                      value={dt}
                      onChange={(e) => setDt(e.target.value)}
                      step={0.001}
                      className="mt-1 w-full rounded bg-gray-800 px-3 py-1.5 text-xs text-gray-200 outline-none ring-1 ring-gray-700 focus:ring-yellow-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-400">Num Steps</label>
                    <input
                      type="number"
                      value={numSteps}
                      onChange={(e) => setNumSteps(e.target.value)}
                      min={1}
                      className="mt-1 w-full rounded bg-gray-800 px-3 py-1.5 text-xs text-gray-200 outline-none ring-1 ring-gray-700 focus:ring-yellow-500"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Pushover params */}
            {analysisType === 'pushover' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-gray-400">Target Disp (in)</label>
                    <input
                      type="number"
                      value={targetDisplacement}
                      onChange={(e) => setTargetDisplacement(e.target.value)}
                      min={0.1}
                      step={1}
                      className="mt-1 w-full rounded bg-gray-800 px-3 py-1.5 text-xs text-gray-200 outline-none ring-1 ring-gray-700 focus:ring-yellow-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-400">Disp Increment (in)</label>
                    <input
                      type="number"
                      value={displacementIncrement}
                      onChange={(e) => setDisplacementIncrement(e.target.value)}
                      min={0.01}
                      step={0.01}
                      className="mt-1 w-full rounded bg-gray-800 px-3 py-1.5 text-xs text-gray-200 outline-none ring-1 ring-gray-700 focus:ring-yellow-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400">Push Direction</label>
                  <div className="mt-1 flex gap-1 rounded-lg bg-gray-800 p-0.5">
                    {(['X', 'Y'] as const).map((dir) => (
                      <button
                        key={dir}
                        type="button"
                        onClick={() => setPushDirection(dir)}
                        className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                          pushDirection === dir
                            ? 'bg-gray-600 text-white'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        {dir}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400">Load Pattern</label>
                  <div className="mt-1 flex gap-1 rounded-lg bg-gray-800 p-0.5">
                    {[
                      { value: 'linear' as const, label: 'Linear' },
                      { value: 'first_mode' as const, label: 'First-Mode' },
                    ].map((lp) => (
                      <button
                        key={lp.value}
                        type="button"
                        onClick={() => setLoadPattern(lp.value)}
                        className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                          loadPattern === lp.value
                            ? 'bg-gray-600 text-white'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        {lp.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Comparison toggle — available for pushover and time-history */}
            {(analysisType === 'pushover' || analysisType === 'time_history') && hasBearings && (
              <div className="rounded-lg bg-gray-800/50 p-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={runComparisonMode}
                    onChange={(e) => setRunComparisonMode(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-700 text-yellow-500 focus:ring-yellow-500"
                  />
                  <span className="text-xs font-medium text-gray-300">
                    Run Comparison (Isolated vs Fixed-Base)
                  </span>
                </label>

                {runComparisonMode && (
                  <>
                    <p className="text-[10px] text-gray-400">
                      {analysisType === 'time_history'
                        ? 'Runs time-history on both the isolated model and an auto-generated fixed-base variant with animated overlay.'
                        : 'Runs pushover on both the isolated model and an auto-generated fixed-base variant.'}
                    </p>

                    {analysisType === 'pushover' && (
                      <>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enableLambda}
                            onChange={(e) => setEnableLambda(e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-700 text-yellow-500 focus:ring-yellow-500"
                          />
                          <span className="text-xs text-gray-400">
                            Lambda Factors (ASCE 7-22 Ch. 17)
                          </span>
                        </label>

                        {enableLambda && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-medium text-gray-400">
                                Lambda Min
                              </label>
                              <input
                                type="number"
                                value={lambdaMin}
                                onChange={(e) => setLambdaMin(e.target.value)}
                                min={0.1}
                                max={1}
                                step={0.05}
                                className="mt-0.5 w-full rounded bg-gray-800 px-2 py-1 text-xs text-gray-200 outline-none ring-1 ring-gray-700 focus:ring-yellow-500"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-medium text-gray-400">
                                Lambda Max
                              </label>
                              <input
                                type="number"
                                value={lambdaMax}
                                onChange={(e) => setLambdaMax(e.target.value)}
                                min={1}
                                max={3}
                                step={0.1}
                                className="mt-0.5 w-full rounded bg-gray-800 px-2 py-1 text-xs text-gray-200 outline-none ring-1 ring-gray-700 focus:ring-yellow-500"
                              />
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Validation error */}
            {validationError && (
              <div role="alert" aria-live="polite">
                <p className="text-xs text-red-400">{validationError}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={handleRun}
              disabled={!!validationError || submitting}
              className="rounded bg-yellow-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? 'Submitting...'
                : runComparisonMode &&
                    (analysisType === 'pushover' || analysisType === 'time_history')
                  ? 'Run Comparison'
                  : 'Run'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
