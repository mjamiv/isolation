import * as Accordion from '@radix-ui/react-accordion';
import { NodeList } from './NodeList';
import { ElementList } from './ElementList';
import { SectionList } from './SectionList';
import { MaterialList } from './MaterialList';
import { BearingList } from './BearingList';
import { LoadList } from './LoadList';

export function ModelEditor() {
  return (
    <Accordion.Root
      type="multiple"
      defaultValue={['nodes', 'elements', 'sections', 'materials']}
      className="text-gray-300"
    >
      <NodeList />
      <ElementList />
      <SectionList />
      <MaterialList />
      <BearingList />
      <LoadList />
    </Accordion.Root>
  );
}
