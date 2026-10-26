/** Shared motion constants so every section animates with the same physics. */

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export const SPRING = {
  type: 'spring',
  stiffness: 100,
  damping: 20,
} as const;

export const VIEWPORT = {
  once: true,
  margin: '-100px',
} as const;

export const staggerContainer = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.08,
    },
  },
} as const;

export const fadeUpItem = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: SPRING,
  },
} as const;
