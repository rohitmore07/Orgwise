'use client';

import { motion } from 'framer-motion';
import { ArrowRight, ChevronDown, Play, ShieldCheck, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fadeUpItem, staggerContainer } from '@/components/landing/anim';
import { GlowOrb, GridPattern, NetworkGraph, NoiseOverlay } from '@/components/landing/decor';
import { HeroDashboard, MOCK_SNAPSHOT } from '@/components/landing/hero-dashboard';
import { Magnetic } from '@/components/landing/magnetic';
import { fetchLiveSignals } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TRUST_AVATARS = [
  { initials: 'VN', className: 'from-indigo-500 to-indigo-400' },
  { initials: 'SK', className: 'from-cyan-500 to-cyan-400' },
  { initials: 'DM', className: 'from-emerald-500 to-emerald-400' },
  { initials: 'AR', className: 'from-violet-500 to-violet-400' },
];
// Live KPI chip values. Mirrors the dashboard's fetch pattern (poll every 30s) so the floating chips never…
// contradict the dashboard beside them; falls back to the shared MOCK_SNAPSHOT when the API is unreachable.
function useLiveMetrics() {
  const [snapshot, setSnapshot] = useState(MOCK_SNAPSHOT);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const [signals] = await Promise.allSettled([fetchLiveSignals()]);
      if (cancelled) return;
      if (signals.status === 'fulfilled' && signals.value) {
        setSnapshot(signals.value);
      }
    }
    void refresh();
    const interval = setInterval(() => void refresh(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return snapshot;
}

export function HeroSection() {
  const snapshot = useLiveMetrics();

  return (
    <section id="top" className="relative overflow-hidden pb-16 pt-10 sm:pt-14">
      {/* Ambient backdrop */}
      <div aria-hidden="true" className="absolute inset-0 size-full overflow-hidden">
        <div
          className={cn(
            'absolute inset-0 isolate -z-10',
            'bg-[radial-gradient(20%_80%_at_20%_0%,--theme(--color-foreground/.06),transparent)]',
          )}
        />
        <GridPattern />
        <GlowOrb className="-top-32 -left-40 bg-indigo-600/20" size={520} />
        <GlowOrb className="top-40 -right-32 bg-cyan-500/10" size={460} duration={11} />
        <NetworkGraph className="absolute inset-x-0 top-4 mx-auto h-[380px] w-full max-w-6xl opacity-50" />
        <NoiseOverlay />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 sm:px-8">
        <motion.div variants={staggerContainer} initial="hidden" animate="show">
          {/* Status pill */}
          <motion.div variants={fadeUpItem} className="flex justify-center">
            <a
              href="#capabilities"
              className={cn(
                'group flex w-fit max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-full border border-border bg-card/80 p-1.5 pr-3 shadow-sm backdrop-blur-md transition-colors hover:border-foreground/25',
              )}
            >
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 shadow-sm">
                <span className="relative flex size-1.5" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
                </span>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-widest">Now</p>
              </span>

              {/* Short copy on phones so the pill fits; full claim from sm up. */}
              <span className="text-xs font-medium leading-snug text-foreground/80">
                <span className="sm:hidden">Announcing orgwise 2.0</span>
                <span className="hidden sm:inline">
                  Announcing orgwise 2.0 — Workforce Copilot &amp; Hiring Analytics
                </span>
              </span>
              <span className="hidden h-5 border-l border-border sm:block" aria-hidden />

              <div className="pr-1" aria-hidden>
                <ArrowRight className="size-3 -translate-x-0.5 text-muted-foreground transition-transform duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-foreground" />
              </div>
            </a>
          </motion.div>
        </motion.div>

        <motion.div variants={staggerContainer} initial="hidden" animate="show">
          <motion.h1
            variants={fadeUpItem}
            className="mx-auto max-w-5xl text-balance text-center font-display text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-6xl lg:text-7xl"
          >
            Transform Fragmented HR Signals into{' '}
            <span className="text-gradient">Actionable Workforce Intelligence</span>
          </motion.h1>
        </motion.div>

        <motion.div
          variants={fadeUpItem}
          initial="hidden"
          animate="show"
          className="mx-auto max-w-3xl text-center space-y-3"
        >
          <p className="text-balance text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl font-normal">
            orgwise turns your workforce data — imported from CSV or connected systems — into a
            single intelligence layer for analytics, insights, and decision support.
          </p>
          <p className="text-pretty text-xs leading-relaxed text-muted-foreground/80 sm:text-sm max-w-2xl mx-auto">
            Empower HR leaders, executives, and managers to understand attrition drivers, engagement
            patterns, and organizational health — with role-based access control and a complete
            audit trail on every action.
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="mx-auto flex w-fit flex-wrap items-center justify-center gap-3 pt-2"
        >
          <motion.div variants={fadeUpItem} className="w-full sm:w-auto">
            <Magnetic className="w-full sm:w-auto">
              <Button
                asChild
                size="lg"
                className="group relative w-full overflow-hidden sm:w-auto px-6"
              >
                <Link href="/signup">
                  <span aria-hidden className="btn-shine absolute inset-0" />
                  <span className="relative font-medium">Schedule Enterprise Demo</span>
                  <ArrowRight
                    className="relative size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </Button>
            </Magnetic>
          </motion.div>
          <motion.div variants={fadeUpItem} className="w-full sm:w-auto">
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto px-6">
              <Link href="/sandbox">
                <span className="flex size-6 items-center justify-center rounded-full bg-indigo-500/20">
                  <Play className="size-3 fill-current" aria-hidden />
                </span>
                Explore Live Sandbox
              </Link>
            </Button>
          </motion.div>
        </motion.div>

        {/* Social proof & compliance */}
        <motion.div
          variants={fadeUpItem}
          initial="hidden"
          animate="show"
          className="mx-auto flex flex-col items-center gap-3 pt-2 sm:flex-row sm:gap-4"
        >
          <div className="flex -space-x-2.5" aria-hidden>
            {TRUST_AVATARS.map((avatar) => (
              <span
                key={avatar.initials}
                className={cn(
                  'flex size-8 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-semibold text-white ring-2 ring-background',
                  avatar.className,
                )}
              >
                {avatar.initials}
              </span>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground text-center sm:text-left">
            Built for{' '}
            <span className="font-semibold text-foreground">
              HR leaders, managers, and executives
            </span>
            <span className="mt-1 flex items-center justify-center sm:justify-start gap-1.5">
              <ShieldCheck className="size-3.5 text-emerald-500" aria-hidden />
              Role-based access · Field-level privacy · Full audit trail
            </span>
          </p>
        </motion.div>
      </div>

      {/* Framed product visual — below the copy */}
      <div className="relative mx-auto max-w-5xl px-5 sm:px-8">
        <div
          aria-hidden
          className={cn(
            'absolute -inset-x-20 inset-y-0 -translate-y-1/3 scale-120 rounded-full',
            'bg-[radial-gradient(ellipse_at_center,--theme(--color-foreground/.08),transparent,transparent)]',
            'blur-[50px]',
          )}
        />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative mt-8 sm:mt-12 md:mt-16"
        >
          <div className="relative mx-auto max-w-5xl">
            <div className="relative overflow-hidden rounded-lg border border-border bg-background p-2 shadow-xl ring-1 ring-card">
              <HeroDashboard />
            </div>

            {/* Floating metric chips — siblings of the frame so overflow-hidden never clips them */}
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              aria-hidden
              className="pointer-events-none absolute -bottom-5 -left-4 hidden items-center gap-2.5 rounded-xl border border-border bg-card/90 px-3.5 py-2.5 shadow-lg shadow-indigo-500/10 backdrop-blur-md sm:flex"
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15">
                <TrendingUp className="size-4 text-emerald-500" aria-hidden />
              </span>
              <span>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Attrition
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {snapshot.flightRiskPercent.toFixed(1)}%
                  <span className="font-normal text-muted-foreground"> observed</span>
                </p>
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 1.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              aria-hidden
              className="pointer-events-none absolute -right-4 -top-5 hidden items-center gap-2.5 rounded-xl border border-border bg-card/90 px-3.5 py-2.5 shadow-lg shadow-indigo-500/10 backdrop-blur-md sm:flex"
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/15">
                <ShieldCheck className="size-4 text-indigo-500" aria-hidden />
              </span>
              <span>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Governance
                </p>
                <p className="text-sm font-semibold text-foreground">Role-based access</p>
              </span>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Scroll cue */}
      <motion.a
        href="#capabilities"
        aria-label="Scroll to capabilities"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 0.8 }}
        className="relative z-10 mx-auto mt-12 hidden w-fit flex-col items-center gap-1.5 text-muted-foreground/70 transition-colors hover:text-foreground sm:flex"
      >
        <span className="text-[10px] uppercase tracking-[0.2em]">Scroll</span>
        <motion.span
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronDown className="size-4" aria-hidden />
        </motion.span>
      </motion.a>
    </section>
  );
}
