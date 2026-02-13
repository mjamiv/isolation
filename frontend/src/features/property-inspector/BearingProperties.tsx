import type { TFPBearing } from '@/types/storeModel';

export function BearingProperties({ bearing }: { bearing: TFPBearing }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-purple-300">
        TFP Bearing {bearing.id}
        {bearing.label && <span className="ml-1 text-gray-500">({bearing.label})</span>}
      </h3>

      {/* Connectivity */}
      <table className="w-full text-xs">
        <tbody className="divide-y divide-gray-800">
          <tr>
            <td className="py-1 text-gray-500">Node I</td>
            <td className="py-1 text-right text-gray-300">{bearing.nodeI}</td>
          </tr>
          <tr>
            <td className="py-1 text-gray-500">Node J</td>
            <td className="py-1 text-right text-gray-300">{bearing.nodeJ}</td>
          </tr>
        </tbody>
      </table>

      {/* Geometry */}
      <div>
        <span className="text-[10px] uppercase tracking-wider text-gray-500">Geometry</span>
        <table className="mt-1 w-full text-xs">
          <tbody className="divide-y divide-gray-800">
            <tr>
              <td className="py-1 text-gray-500">Radii (L1/L2/L3)</td>
              <td className="py-1 text-right text-gray-300">{bearing.radii.join(' / ')}</td>
            </tr>
            <tr>
              <td className="py-1 text-gray-500">Disp Cap (d1/d2/d3)</td>
              <td className="py-1 text-right text-gray-300">{bearing.dispCapacities.join(' / ')}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Friction Surfaces */}
      <div>
        <span className="text-[10px] uppercase tracking-wider text-gray-500">Friction Surfaces</span>
        <table className="mt-1 w-full text-xs">
          <thead>
            <tr className="text-gray-600">
              <th className="py-0.5 text-left font-normal">#</th>
              <th className="py-0.5 text-right font-normal">Type</th>
              <th className="py-0.5 text-right font-normal">μ slow</th>
              <th className="py-0.5 text-right font-normal">μ fast</th>
              <th className="py-0.5 text-right font-normal">Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {bearing.surfaces.map((s, i) => (
              <tr key={i}>
                <td className="py-0.5 text-gray-500">{i + 1}</td>
                <td className="py-0.5 text-right text-gray-300">{s.type}</td>
                <td className="py-0.5 text-right text-gray-300">{s.muSlow}</td>
                <td className="py-0.5 text-right text-gray-300">{s.muFast}</td>
                <td className="py-0.5 text-right text-gray-300">{s.transRate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Advanced params */}
      <div>
        <span className="text-[10px] uppercase tracking-wider text-gray-500">Advanced</span>
        <table className="mt-1 w-full text-xs">
          <tbody className="divide-y divide-gray-800">
            <tr>
              <td className="py-1 text-gray-500">Weight</td>
              <td className="py-1 text-right text-gray-300">{bearing.weight}</td>
            </tr>
            <tr>
              <td className="py-1 text-gray-500">Yield Disp</td>
              <td className="py-1 text-right text-gray-300">{bearing.yieldDisp}</td>
            </tr>
            <tr>
              <td className="py-1 text-gray-500">Vert Stiffness</td>
              <td className="py-1 text-right text-gray-300">{bearing.vertStiffness}</td>
            </tr>
            <tr>
              <td className="py-1 text-gray-500">Min Vert Force</td>
              <td className="py-1 text-right text-gray-300">{bearing.minVertForce}</td>
            </tr>
            <tr>
              <td className="py-1 text-gray-500">Tolerance</td>
              <td className="py-1 text-right text-gray-300">{bearing.tolerance}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
