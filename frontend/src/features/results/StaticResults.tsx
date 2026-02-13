import type { StaticResults as StaticResultsType } from '@/types/analysis';

interface StaticResultsProps {
  data: StaticResultsType;
}

export function StaticResults({ data }: StaticResultsProps) {
  const displacements = Object.entries(data.nodeDisplacements);
  const reactions = Object.entries(data.reactions);

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
    </div>
  );
}
