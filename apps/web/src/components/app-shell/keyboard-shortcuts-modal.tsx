'use client';

import { Keyboard } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';

const SHORTCUTS = [
  { keys: ['⌘', 'K'], description: 'Open command palette' },
  { keys: ['?'], description: 'Show keyboard shortcuts' },
  { keys: ['Esc'], description: 'Close dialog / clear search' },
  { keys: ['↓', '↑'], description: 'Navigate list items' },
  { keys: ['Enter'], description: 'Select / open item' },
  { keys: ['Tab'], description: 'Move to next field' },
  { keys: ['Shift', 'Tab'], description: 'Move to previous field' },
];

export function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't trigger inside inputs/textareas or when a dialog is open
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      {/* Trigger — a subtle button in the bottom-right corner */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 flex size-9 items-center justify-center rounded-full border border-border bg-card shadow-md transition-colors hover:bg-muted"
        aria-label="Keyboard shortcuts"
      >
        <Keyboard className="size-4 text-muted-foreground" />
      </button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Keyboard Shortcuts"
        description="Navigate orgwise faster with these shortcuts."
      >
        <div className="space-y-3">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.description}
              className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-4 py-2.5"
            >
              <span className="text-sm text-foreground">{shortcut.description}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border border-border bg-card px-1.5 font-mono text-xs font-medium text-muted-foreground shadow-sm"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Press{' '}
          <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">?</kbd>{' '}
          anywhere to toggle this overlay
        </p>
      </Dialog>
    </>
  );
}
