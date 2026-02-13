import { useState } from 'react';
import type { ModalResults as ModalResultsType } from '@/types/analysis';
import { useAnalysisStore } from '@/stores/analysisStore';

interface ModalResultsProps {
  data: ModalResultsType;
}

export function ModalResults({ data }: ModalResultsProps) {
  const numModes = data.periods.length;
  const [selectedMode, setSelectedMode] = useState<number>(1);
  const selectedModeNumber = useAnalysisStore((s) => s.selectedModeNumber);
  const setSelectedModeNumber = useAnalysisStore((s) => s.setSelectedModeNumber);

  const isVisualizing = selectedModeNumber === selectedMode;

  const handleModeChange = (modeNum: number) => {
    setSelectedMode(modeNum);
  };

  const handleToggleVisualize = () => {
    if (isVisualizing) {
      setSelectedModeNumber(null);
    } else {
      setSelectedModeNumber(selectedMode);
    }
  };

  return (
    <div className="space-y-3">
      {/* Mode selector and visualize toggle */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-gray-400">Mode:</label>
        <select
          value={selectedMode}
          onChange={(e) => handleModeChange(Number(e.target.value))}
          className="rounded bg-gray-800 px-2 py-0.5 text-[10px] text-gray-300 outline-none ring-1 ring-gray-700"
        >
          {Array.from({ length: numModes }, (_, i) => (
            <option key={i + 1} value={i + 1}>Mode {i + 1}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleToggleVisualize}
          className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
            isVisualizing
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {isVisualizing ? 'Visualizing' : 'Visualize'}
        </button>
      </div>

      <div>
        <h3 className="mb-1 text-xs font-semibold text-gray-300">Mode Properties</h3>
        <div className="overflow-x-auto rounded bg-gray-800/50">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-gray-700 text-gray-500">
                <th className="px-2 py-1 text-left">Mode</th>
                <th className="px-2 py-1 text-right">Period (s)</th>
                <th className="px-2 py-1 text-right">Freq (Hz)</th>
                <th className="px-2 py-1 text-right">MPx</th>
                <th className="px-2 py-1 text-right">MPy</th>
              </tr>
            </thead>
            <tbody className="text-gray-400">
              {Array.from({ length: numModes }, (_, i) => {
                const modeNum = i + 1;
                const mp = data.massParticipation[modeNum];
                return (
                  <tr
                    key={modeNum}
                    className={`cursor-pointer transition-colors ${
                      selectedMode === modeNum ? 'bg-gray-700/50' : 'hover:bg-gray-800/80'
                    }`}
                    onClick={() => handleModeChange(modeNum)}
                  >
                    <td className="px-2 py-0.5 font-mono">{modeNum}</td>
                    <td className="px-2 py-0.5 text-right font-mono">
                      {data.periods[i]?.toFixed(4)}
                    </td>
                    <td className="px-2 py-0.5 text-right font-mono">
                      {data.frequencies[i]?.toFixed(4)}
                    </td>
                    <td className="px-2 py-0.5 text-right font-mono">
                      {mp ? (mp.x * 100).toFixed(1) + '%' : '-'}
                    </td>
                    <td className="px-2 py-0.5 text-right font-mono">
                      {mp ? (mp.y * 100).toFixed(1) + '%' : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded bg-gray-800/50 p-2 text-[10px] text-gray-500">
        <p>Fundamental period: {data.periods[0]?.toFixed(4)}s ({data.frequencies[0]?.toFixed(2)} Hz)</p>
        <p>{numModes} mode{numModes > 1 ? 's' : ''} extracted</p>
      </div>
    </div>
  );
}
