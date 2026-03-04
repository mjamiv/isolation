import type { Node } from '@/types/storeModel';

const DOF_LABELS = ['Tx', 'Ty', 'Tz', 'Rx', 'Ry', 'Rz'] as const;

export function NodeProperties({ node }: { node: Node }) {
  return (
    <div className="space-y-2">
      <h3 className="text-ui-sm font-semibold text-gray-300">
        Node {node.id}
        {node.label && <span className="ml-1 text-gray-500">({node.label})</span>}
      </h3>
      <table className="w-full text-ui-sm">
        <tbody className="divide-y divide-gray-800">
          <tr>
            <td className="py-1 text-gray-500">X (in)</td>
            <td className="py-1 text-right text-gray-300">{node.x}</td>
          </tr>
          <tr>
            <td className="py-1 text-gray-500">Y (in)</td>
            <td className="py-1 text-right text-gray-300">{node.y}</td>
          </tr>
          <tr>
            <td className="py-1 text-gray-500">Z (in)</td>
            <td className="py-1 text-right text-gray-300">{node.z}</td>
          </tr>
          {node.mass !== undefined && (
            <tr>
              <td className="py-1 text-gray-500">Mass</td>
              <td className="py-1 text-right text-gray-300">{node.mass}</td>
            </tr>
          )}
        </tbody>
      </table>
      <div>
        <div className="flex items-center justify-between">
          <span className="text-ui-xs uppercase tracking-wider text-gray-500">Restraints</span>
          <span className="text-ui-xs text-gray-500">red = restrained</span>
        </div>
        <div className="mt-1 flex gap-1">
          {DOF_LABELS.map((label, i) => (
            <span
              key={label}
              className={`rounded px-1.5 py-0.5 text-ui-xs font-mono ${
                node.restraint[i] ? 'bg-red-900/50 text-red-400' : 'bg-gray-800 text-gray-600'
              }`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
