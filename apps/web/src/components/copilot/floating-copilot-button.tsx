'use client';

import { useEffect, useState } from 'react';
import { Bot } from 'lucide-react';
import { useCopilot } from '@/components/copilot/copilot-context';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Hides while the user types in a form field so it never overlaps the input.
function isEditableField(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    (el as HTMLElement).isContentEditable
  );
}

// Floating chatbot trigger — a fixed bottom-right button that opens the
// orgwise Copilot drawer from anywhere in the workspace.
export function FloatingCopilotButton() {
  const copilot = useCopilot();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onFocusIn = () => setHidden(isEditableField(document.activeElement));
    const onFocusOut = () => setHidden(false);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  return (
    <div
      data-tour="copilot"
      className={cn(
        'fixed bottom-5 right-5 z-40 transition-all duration-200',
        hidden ? 'pointer-events-none -translate-y-1 opacity-0' : 'translate-y-0 opacity-100',
      )}
    >
      <Tooltip content="Ask orgwise" side="top">
        <button
          type="button"
          onClick={() => copilot.openWithQuestion()}
          aria-label="Open orgwise Copilot"
          className={cn(
            'group relative flex size-14 items-center justify-center rounded-full',
            'bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/30',
            'transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          )}
        >
          {/* Subtle ping ring to draw the eye */}
          <span
            aria-hidden
            className="absolute inset-0 -z-10 animate-ping rounded-full bg-indigo-500/20 [animation-duration:2.5s]"
          />
          <Bot className="size-6" aria-hidden />
        </button>
      </Tooltip>
    </div>
  );
}
