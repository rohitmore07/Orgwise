'use client';

import { useId } from 'react';

export function Logo({
  className = '',
  size = 'md',
  shimmer = false,
  showText = true,
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Brand-gradient hover shimmer over the wordmark (requires a `.group` ancestor). */
  shimmer?: boolean;
  /** Whether to display the text wordmark alongside the mark icon. */
  showText?: boolean;
}) {
  const isSm = size === 'sm';
  const isLg = size === 'lg';
  // The sidebar + mobile topbar render two Logo instances on the same page. Fixed gradient ids would collide, and…
  // `url(#id)` resolves to the FIRST matching id in the document — making one logo's mark render with the wrong…
  const gradientId = useId();
  const outerId = `pl-logo-outer-${gradientId}`;
  const innerId = `pl-logo-inner-${gradientId}`;
  const coreId = `pl-logo-core-${gradientId}`;

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Premium Geometric Lens Mark */}
      <div
        className={`relative flex items-center justify-center rounded-xl bg-gradient-to-b from-white/10 to-white/05 p-0.5 shadow-lg shadow-indigo-500/10 ring-1 ring-white/15 backdrop-blur-md transition-all group-hover:ring-indigo-400/40 ${
          isSm ? 'size-7' : isLg ? 'size-9' : 'size-8'
        }`}
      >
        <div className="flex size-full items-center justify-center rounded-[10px] bg-[#070c18]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className={`${isSm ? 'size-4' : isLg ? 'size-5' : 'size-4.5'}`}
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Outer precision focus ring */}
            <circle
              cx="12"
              cy="12"
              r="8.5"
              stroke={`url(#${outerId})`}
              strokeWidth="1.5"
              strokeDasharray="18 4 6 4"
            />
            {/* Inner optical lens curve */}
            <circle cx="12" cy="12" r="4.5" stroke={`url(#${innerId})`} strokeWidth="1.75" />
            {/* Core focus point */}
            <circle cx="12" cy="12" r="2" fill={`url(#${coreId})`} />
            <defs>
              <linearGradient
                id={outerId}
                x1="3"
                y1="3"
                x2="21"
                y2="21"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#818CF8" />
                <stop offset="0.5" stopColor="#6366F1" />
                <stop offset="1" stopColor="#06B6D4" />
              </linearGradient>
              <linearGradient
                id={innerId}
                x1="7.5"
                y1="7.5"
                x2="16.5"
                y2="16.5"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#38BDF8" />
                <stop offset="1" stopColor="#818CF8" />
              </linearGradient>
              <linearGradient
                id={coreId}
                x1="10"
                y1="10"
                x2="14"
                y2="14"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#F8FAFC" />
                <stop offset="1" stopColor="#38BDF8" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* Enterprise SaaS Wordmark */}
      {showText ? (
        <span
          className={`relative font-display font-bold tracking-tight text-foreground ${
            isSm ? 'text-base' : isLg ? 'text-xl' : 'text-lg'
          }`}
        >
          org
          <span className="font-semibold bg-gradient-to-r from-indigo-600 via-sky-500 to-cyan-500 bg-clip-text text-transparent dark:from-indigo-300 dark:via-sky-300 dark:to-cyan-400">
            wise
          </span>
          {shimmer ? (
            <span
              aria-hidden
              className="watermark-shimmer pointer-events-none absolute inset-0 font-bold"
            >
              orgwise
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
