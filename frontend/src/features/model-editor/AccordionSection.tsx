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

export function AccordionSection({ value, title, count, onAdd, children }: AccordionSectionProps) {
  return (
    <Accordion.Item value={value} className="border-b border-white/[0.04]">
      <Accordion.Header className="flex">
        <Accordion.Trigger className="group flex flex-1 items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-white/60 transition-colors duration-150 hover:bg-white/[0.03] hover:text-white/80">
          <ChevronDownIcon className="h-3 w-3 shrink-0 text-white/20 transition-transform duration-200 ease-out-expo group-data-[state=open]:rotate-180 group-data-[state=open]:text-yellow-500/60" />
          <span className="flex-1">{title}</span>
          <span className="rounded-full border border-white/[0.06] bg-surface-3 px-1.5 py-0.5 font-mono text-[9px] text-white/25">
            {count}
          </span>
        </Accordion.Trigger>
        {onAdd && (
          <IconButton onClick={onAdd} title={`Add ${title.slice(0, -1)}`}>
            <PlusIcon className="h-3 w-3" />
          </IconButton>
        )}
      </Accordion.Header>
      <Accordion.Content className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
        <div className="px-2 pb-2">{children}</div>
      </Accordion.Content>
    </Accordion.Item>
  );
}
