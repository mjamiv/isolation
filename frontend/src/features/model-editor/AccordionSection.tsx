import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDownIcon, PlusIcon } from '@radix-ui/react-icons';
import { IconButton } from '@/components/ui/IconButton';

interface AccordionSectionProps {
  value: string;
  title: string;
  count: number;
  onAdd?: () => void;
  children: React.ReactNode;
}

export function AccordionSection({
  value,
  title,
  count,
  onAdd,
  children,
}: AccordionSectionProps) {
  return (
    <Accordion.Item value={value} className="border-b border-gray-800">
      <Accordion.Header className="flex">
        <Accordion.Trigger className="group flex flex-1 items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-gray-300 hover:bg-gray-800/50">
          <ChevronDownIcon className="h-3 w-3 shrink-0 text-gray-500 transition-transform group-data-[state=open]:rotate-180" />
          <span className="flex-1">{title}</span>
          <span className="rounded-full bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500">
            {count}
          </span>
        </Accordion.Trigger>
        {onAdd && (
          <IconButton onClick={onAdd} title={`Add ${title.slice(0, -1)}`}>
            <PlusIcon className="h-3 w-3" />
          </IconButton>
        )}
      </Accordion.Header>
      <Accordion.Content className="overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out">
        <div className="px-2 pb-2">{children}</div>
      </Accordion.Content>
    </Accordion.Item>
  );
}
