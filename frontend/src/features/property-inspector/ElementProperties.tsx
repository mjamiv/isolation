import type { Element } from '@/types/storeModel';
import { useModelStore } from '@/stores/modelStore';

export function ElementProperties({ element }: { element: Element }) {
  const sections = useModelStore((s) => s.sections);
  const materials = useModelStore((s) => s.materials);
  const nodes = useModelStore((s) => s.nodes);

  const section = sections.get(element.sectionId);
  const material = materials.get(element.materialId);
  const nodeI = nodes.get(element.nodeI);
  const nodeJ = nodes.get(element.nodeJ);

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-300">
        Element {element.id}
        {element.label && <span className="ml-1 text-gray-500">({element.label})</span>}
      </h3>
      <table className="w-full text-xs">
        <tbody className="divide-y divide-gray-800">
          <tr>
            <td className="py-1 text-gray-500">Type</td>
            <td className="py-1 text-right capitalize text-gray-300">{element.type}</td>
          </tr>
          <tr>
            <td className="py-1 text-gray-500">Node I</td>
            <td className="py-1 text-right text-gray-300">
              {element.nodeI}
              {nodeI && <span className="ml-1 text-gray-500">({nodeI.x}, {nodeI.y}, {nodeI.z})</span>}
            </td>
          </tr>
          <tr>
            <td className="py-1 text-gray-500">Node J</td>
            <td className="py-1 text-right text-gray-300">
              {element.nodeJ}
              {nodeJ && <span className="ml-1 text-gray-500">({nodeJ.x}, {nodeJ.y}, {nodeJ.z})</span>}
            </td>
          </tr>
          <tr>
            <td className="py-1 text-gray-500">Section</td>
            <td className="py-1 text-right text-gray-300">{section?.name ?? element.sectionId}</td>
          </tr>
          <tr>
            <td className="py-1 text-gray-500">Material</td>
            <td className="py-1 text-right text-gray-300">{material?.name ?? element.materialId}</td>
          </tr>
        </tbody>
      </table>

      {section && (
        <div>
          <span className="text-[10px] uppercase tracking-wider text-gray-500">Section Properties</span>
          <table className="mt-1 w-full text-xs">
            <tbody className="divide-y divide-gray-800">
              <tr><td className="py-0.5 text-gray-500">Area</td><td className="py-0.5 text-right text-gray-400">{section.area} in²</td></tr>
              <tr><td className="py-0.5 text-gray-500">Ix</td><td className="py-0.5 text-right text-gray-400">{section.Ix} in⁴</td></tr>
              <tr><td className="py-0.5 text-gray-500">Iy</td><td className="py-0.5 text-right text-gray-400">{section.Iy} in⁴</td></tr>
              <tr><td className="py-0.5 text-gray-500">Depth</td><td className="py-0.5 text-right text-gray-400">{section.d} in</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {material && (
        <div>
          <span className="text-[10px] uppercase tracking-wider text-gray-500">Material Properties</span>
          <table className="mt-1 w-full text-xs">
            <tbody className="divide-y divide-gray-800">
              <tr><td className="py-0.5 text-gray-500">E</td><td className="py-0.5 text-right text-gray-400">{material.E} ksi</td></tr>
              <tr><td className="py-0.5 text-gray-500">Fy</td><td className="py-0.5 text-right text-gray-400">{material.Fy} ksi</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
