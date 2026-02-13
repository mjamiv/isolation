import { useState, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Cross2Icon } from '@radix-ui/react-icons';
import type { AnalysisType, AnalysisParams } from '@/types/analysis';
import { useModelStore } from '@/stores/modelStore';
import { useRunAnalysis } from './useRunAnalysis';

interface AnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ANALYSIS_TYPES: { value: AnalysisType; label: string }[] = [
  { value: 'static', label: 'Static' },
  { value: 'modal', label: 'Modal' },
  { value: 'time_history', label: 'Time-History' },
];

export function AnalysisDialog({ open, onOpenChange }: AnalysisDialogProps) {
  const [analysisType, setAnalysisType] = useState<AnalysisType>('static');
  const [numModes, setNumModes] = useState('3');
  const [selectedGmId, setSelectedGmId] = useState('');
  const [dt, setDt] = useState('0.01');
  const [numSteps, setNumSteps] = useState('1000');

  const loads = useModelStore((s) => s.loads);
  const groundMotions = useModelStore((s) => s.groundMotions);
  const gmArray = useMemo(() => Array.from(groundMotions.values()), [groundMotions]);

  const { run, submitting } = useRunAnalysis();

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
      params.groundMotionIds = [Number(selectedGmId)];
      params.dt = Number(dt) || 0.01;
      params.numSteps = Number(numSteps) || 1000;
    }

    onOpenChange(false);
    void run(params);
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
              <button type="button" className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-gray-200">
                <Cross2Icon className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="mt-1 text-xs text-gray-500">
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
                    onClick={() => setAnalysisType(t.value)}
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
                  className="mt-1 w-full rounded bg-gray-800 px-3 py-1.5 text-xs text-gray-200 outline-none ring-1 ring-gray-700 focus:ring-blue-500"
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
                    className="mt-1 w-full rounded bg-gray-800 px-3 py-1.5 text-xs text-gray-200 outline-none ring-1 ring-gray-700 focus:ring-blue-500"
                  >
                    <option value="">Select...</option>
                    {gmArray.map((gm) => (
                      <option key={gm.id} value={gm.id}>{gm.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-gray-400">Time Step (s)</label>
                    <input
                      type="number"
                      value={dt}
                      onChange={(e) => setDt(e.target.value)}
                      step={0.001}
                      className="mt-1 w-full rounded bg-gray-800 px-3 py-1.5 text-xs text-gray-200 outline-none ring-1 ring-gray-700 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-400">Num Steps</label>
                    <input
                      type="number"
                      value={numSteps}
                      onChange={(e) => setNumSteps(e.target.value)}
                      min={1}
                      className="mt-1 w-full rounded bg-gray-800 px-3 py-1.5 text-xs text-gray-200 outline-none ring-1 ring-gray-700 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Validation error */}
            {validationError && (
              <p className="text-xs text-red-400">{validationError}</p>
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
              className="rounded bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Run'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
