import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const modelsDir = path.resolve(__dirname, '../public/models');

const targets = ['three-span-bridge-fixed.json', 'three-span-bridge-isolated.json'];

function buildPanelDiaphragms(nodes) {
  const supportLines = new Map();

  for (const node of nodes) {
    if (!Array.isArray(node.restraint) || node.restraint.length !== 6) continue;
    const label = typeof node.label === 'string' ? node.label : '';
    const isDeckLike = /(Abt\d+|Pier\d+)\s+G\d+/.test(label);
    if (!isDeckLike) continue;

    const key = String(node.x);
    const group = supportLines.get(key) ?? [];
    group.push(node);
    supportLines.set(key, group);
  }

  const orderedLines = [...supportLines.values()]
    .map((group) => group.sort((a, b) => a.z - b.z))
    .sort((a, b) => a[0].x - b[0].x);

  if (orderedLines.length < 2) return [];
  const girders = orderedLines[0].length;
  if (girders < 2) return [];

  for (const line of orderedLines) {
    if (line.length !== girders) {
      throw new Error('Inconsistent girder count across support lines');
    }
  }

  const diaphragms = [];
  let id = 1;

  for (let span = 0; span < orderedLines.length - 1; span++) {
    const lineA = orderedLines[span];
    const lineB = orderedLines[span + 1];

    for (let gi = 0; gi < girders - 1; gi++) {
      const n1 = lineA[gi].id;
      const n2 = lineA[gi + 1].id;
      const n3 = lineB[gi + 1].id;
      const n4 = lineB[gi].id;

      diaphragms.push({
        id: id++,
        masterNodeId: n1,
        constrainedNodeIds: [n2, n3, n4],
        perpDirection: 2,
        label: `Deck Panel S${span + 1} C1 G${gi + 1}-${gi + 2}`,
      });
    }
  }

  return diaphragms;
}

for (const filename of targets) {
  const filePath = path.join(modelsDir, filename);
  const model = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  model.diaphragms = buildPanelDiaphragms(model.nodes);

  if (typeof model.modelInfo?.description === 'string') {
    model.modelInfo.description = model.modelInfo.description.replace(
      'Single rigid deck diaphragm.',
      'Panel rigid deck diaphragms.',
    );
  }

  fs.writeFileSync(filePath, `${JSON.stringify(model, null, 2)}\n`);
  console.log(`updated ${filename}: ${model.diaphragms.length} diaphragms`);
}
