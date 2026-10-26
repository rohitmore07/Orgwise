'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  content: React.ReactNode;
  shortcut?: string;
  side?: 'right' | 'top' | 'bottom' | 'left';
  disabled?: boolean;
  children: React.ReactElement;
  className?: string;
}

export function Tooltip({
  content,
  shortcut,
  side = 'right',
  disabled = false,
  children,
  className,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  if (disabled || !content) {
    return children;
  }

  const sideClasses = {
    right: 'left-full top-1/2 -translate-y-1/2 ml-2.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2.5',
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2.5',
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-50 flex items-center gap-2 whitespace-nowrap rounded-md border border-border/80 bg-popover/95 px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-md backdrop-blur-md transition-all animate-in fade-in-0 zoom-in-95',
            sideClasses[side],
            className,
          )}
        >
          <span>{content}</span>
          {shortcut ? (
            <kbd className="inline-flex items-center rounded border border-border/60 bg-muted/80 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground shadow-xs">
              {shortcut}
            </kbd>
          ) : null}
        </div>
      )}
    </div>
  );
}
