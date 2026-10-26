'use client';

import { motion } from 'framer-motion';
import { useId, type ReactNode } from 'react';
import { Reveal } from './reveal';

export function GlowOrb({
  className,
  size = 480,
  duration = 9,
}: {
  className?: string;
  size?: number;
  duration?: number;
}) {
  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-3xl ${className ?? ''}`}
      style={{ width: size, height: size }}
      // Pulsate only while in view so the animation never runs off-screen.
      whileInView={{ opacity: [0.45, 0.8, 0.45], scale: [1, 1.08, 1] }}
      viewport={{ once: false, amount: 0.1 }}
      transition={{ duration, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

export function GridPattern({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 grid-pattern ${className ?? ''}`}
    />
  );
}

export function NoiseOverlay({ className }: { className?: string }) {
  return <div aria-hidden className={`noise-overlay ${className ?? ''}`} />;
}

const EDGES: Array<[number, number, number, number]> = [
  [120, 120, 300, 90],
  [300, 90, 480, 150],
  [480, 150, 640, 110],
  [120, 120, 200, 260],
  [200, 260, 420, 230],
  [420, 230, 560, 300],
  [300, 90, 420, 230],
  [560, 300, 700, 240],
];

const NODES: Array<[number, number]> = [
  [120, 120],
  [300, 90],
  [480, 150],
  [640, 110],
  [200, 260],
  [420, 230],
  [560, 300],
  [700, 240],
];

/** Ambient SVG network — abstract workforce graph, purely decorative. */
export function NetworkGraph({ className }: { className?: string }) {
  const id = useId();
  const viewport = { once: false, amount: 0.1 } as const;

  return (
    <svg
      aria-hidden
      viewBox="0 0 800 400"
      fill="none"
      className={`pointer-events-none ${className ?? ''}`}
    >
      <defs>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      {EDGES.map(([x1, y1, x2, y2], index) => (
        <motion.line
          key={`${index}-${x1}-${y1}-${x2}-${y2}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={`url(#${id}-edge)`}
          strokeWidth={1}
          strokeDasharray="4 8"
          whileInView={{ strokeDashoffset: [0, -24] }}
          viewport={viewport}
          transition={{ duration: 5, repeat: Infinity, ease: 'linear', delay: index * 0.35 }}
        />
      ))}
      {NODES.map(([cx, cy], index) => (
        <motion.circle
          key={`${index}-${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r={index % 3 === 0 ? 4 : 2.5}
          fill="#818cf8"
          whileInView={{ opacity: [0.35, 1, 0.35] }}
          viewport={viewport}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: index * 0.4 }}
        />
      ))}
    </svg>
  );
}

export function GlassBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3.5 py-1.5 text-xs font-medium text-foreground/90 backdrop-blur-md">
      <span className="relative flex size-1.5" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
      </span>
      {children}
    </span>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: 'center' | 'left';
}) {
  return (
    <Reveal
      className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl text-left'}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-4 text-balance font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </Reveal>
  );
}
