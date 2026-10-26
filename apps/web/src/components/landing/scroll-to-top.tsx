'use client';

import type { ComponentProps, MouseEvent } from 'react';

const SCROLL_DURATION_MS = 600;
/** ease-out cubic — fast start, gentle landing. */
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
// Anchor that smooth-scrolls to the top with a fixed, eased duration — independent of the page's CSS…
// `scroll-behavior`, so the timing feels consistent everywhere. Falls back to the browser default (and to the…
export function ScrollToTopLink({ className, children, ...props }: ComponentProps<'a'>) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>): void {
    event.preventDefault();

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.scrollTo({ top: 0 });
      return;
    }

    const start = window.scrollY;
    const startTime = performance.now();

    function frame(now: number): void {
      const progress = Math.min(1, (now - startTime) / SCROLL_DURATION_MS);
      window.scrollTo(0, Math.round(start * (1 - easeOutCubic(progress))));
      if (progress < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  return (
    <a href="#top" onClick={handleClick} className={className} {...props}>
      {children}
    </a>
  );
}
