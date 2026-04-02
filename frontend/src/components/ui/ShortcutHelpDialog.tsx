import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Cross2Icon } from '@radix-ui/react-icons';

const ROWS: { action: string; keys: string }[] = [
  { action: 'Play / pause time-history', keys: 'Space' },
  { action: 'Step backward one frame', keys: '←' },
  { action: 'Step forward one frame', keys: '→' },
  { action: 'Jump 10 frames back / forward', keys: 'Shift + ← / →' },
  { action: 'Jump to first / last frame', keys: 'Home / End' },
  { action: 'Toggle loop playback', keys: 'L' },
  { action: 'Switch inspector tabs (when focused)', keys: '← / →' },
  { action: 'Open this help', keys: '⌘ / Ctrl + /' },
];

export function ShortcutHelpDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] w-[min(420px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/[0.08] bg-surface-1 p-5 shadow-2xl focus:outline-none">
          <div className="flex items-start justify-between gap-2">
            <div>
              <Dialog.Title className="text-sm font-semibold text-white/90">
                Keyboard shortcuts
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[11px] text-white/45">
                Playback shortcuts apply when results time-history is loaded. Inspector tab
                shortcuts work when a tab header is focused.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md p-1 text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white/70"
                aria-label="Close"
              >
                <Cross2Icon className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          <table className="mt-4 w-full border-collapse text-left text-[11px]">
            <thead>
              <tr className="border-b border-white/[0.06] text-white/40">
                <th className="pb-2 font-medium">Action</th>
                <th className="pb-2 font-mono font-medium">Keys</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.action} className="border-b border-white/[0.04] text-white/75">
                  <td className="py-2 pr-3">{row.action}</td>
                  <td className="py-2 font-mono text-yellow-400/85">{row.keys}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
