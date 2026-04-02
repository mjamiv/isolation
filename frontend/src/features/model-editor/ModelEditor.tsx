import * as Accordion from '@radix-ui/react-accordion';
import { NodeList } from './NodeList';
import { ElementList } from './ElementList';
import { SectionList } from './SectionList';
import { MaterialList } from './MaterialList';
import { BearingList } from './BearingList';
import { DiaphragmList } from './DiaphragmList';
import { LoadList } from './LoadList';
import { GroundMotionList } from './GroundMotionList';

interface ModelEditorProps {
  defaultOpenSections?: string[];
}

export function ModelEditor({ defaultOpenSections = [] }: ModelEditorProps) {
  return (
    <Accordion.Root type="multiple" defaultValue={defaultOpenSections} className="text-white/80">
      <NodeList />
      <ElementList />
      <SectionList />
      <MaterialList />
      <BearingList />
      <DiaphragmList />
      <LoadList />
      <GroundMotionList />
    </Accordion.Root>
  );
}
