import type { ModalResults as ModalResultsType } from '@/types/analysis';

interface ModalResultsProps {
  data: ModalResultsType;
}

export function ModalResults({ data }: ModalResultsProps) {
  const numModes = data.periods.length;

  return (
    <div className="space-y-3">
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
                  <tr key={modeNum}>
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
