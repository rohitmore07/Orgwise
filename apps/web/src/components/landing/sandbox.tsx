'use client';

import { motion } from 'framer-motion';
import { Activity, RefreshCw, ShieldCheck, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { HealthStatus, LiveSignalsSnapshot } from '@orgwise/types';
import { fetchHealth, fetchLiveSignals } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { EASE_OUT } from './anim';
import { GlowOrb, GridPattern, NoiseOverlay } from './decor';
import { formatAgo, formatUptime, HeroDashboard, MOCK_SNAPSHOT } from './hero-dashboard';

const SOURCE_TONES: Record<string, string> = {
  'Employee records': 'from-indigo-500 to-indigo-400',
  Departments: 'from-cyan-500 to-cyan-400',
  Teams: 'from-violet-500 to-violet-400',
  'Hiring records': 'from-emerald-500 to-emerald-400',
  Imports: 'from-fuchsia-500 to-fuchsia-400',
  'Copilot conversations': 'from-amber-500 to-amber-400',
};

type SyncMode = 'loading' | 'live' | 'demo';
// Live sandbox page body. Mirrors the hero's fetch pattern (poll every 30s) so every panel on the page agrees…
// on the same snapshot; falls back to the shared MOCK_SNAPSHOT when the API is unreachable. A manual refresh…
export function Sandbox() {
  const [snapshot, setSnapshot] = useState<LiveSignalsSnapshot | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [mode, setMode] = useState<SyncMode>('loading');
  const [now, setNow] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    const [signals, healthResult] = await Promise.allSettled([fetchLiveSignals(), fetchHealth()]);

    if (signals.status === 'fulfilled' && signals.value) {
      setSnapshot(signals.value);
      if (healthResult.status === 'fulfilled' && healthResult.value) {
        setHealth(healthResult.value);
      }
      setMode('live');
    } else {
      setMode('demo');
    }
  }

  useEffect(() => {
    setNow(Date.now());
    void refresh();
    const interval = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Keep relative labels fresh while showing live data.
  useEffect(() => {
    if (mode !== 'live') return;
    const interval = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(interval);
  }, [mode]);

  async function manualRefresh() {
    setRefreshing(true);
    setNow(Date.now());
    await refresh();
    setRefreshing(false);
  }

  const data = snapshot ?? MOCK_SNAPSHOT;
  const totalSignals = data.signalsBySource.reduce((sum, source) => sum + source.count, 0);
  const maxSource = Math.max(...data.signalsBySource.map((source) => source.count));

  return (
    <div className="relative overflow-hidden">
      {/* Ambient backdrop */}
      <div aria-hidden="true" className="absolute inset-0 size-full overflow-hidden">
        <GridPattern />
        <GlowOrb className="-top-40 -left-32 bg-indigo-600/15" size={480} />
        <GlowOrb className="top-32 -right-28 bg-cyan-500/10" size={420} duration={11} />
        <NoiseOverlay />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-indigo-400 dark:text-indigo-300">
              Live Sandbox
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Workforce Intelligence, live
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Workforce health, attrition, and engagement computed from the orgwise dataset —
              running against the live API.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              aria-live="polite"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-2 text-xs text-foreground/80 backdrop-blur-md"
            >
              {mode === 'loading' ? (
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-amber-400" aria-hidden />
                  Connecting…
                </span>
              ) : mode === 'live' ? (
                <span className="flex items-center gap-1.5">
                  <span className="relative flex size-1.5" aria-hidden>
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
                  </span>
                  Live · synced {now === null ? '…' : formatAgo(data.generatedAt, now)}
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-amber-400" aria-hidden />
                  API offline · demo data
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => void manualRefresh()}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-2 text-xs font-medium text-foreground/80 backdrop-blur-md transition-colors hover:border-foreground/25 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} aria-hidden />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-8">
          <HeroDashboard />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* Signals by source */}
          <section
            aria-label="Signals by source"
            className="rounded-2xl border border-border bg-card p-6 backdrop-blur-md lg:col-span-2"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Signals by source</h2>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Activity className="size-3.5 text-cyan-400" aria-hidden />
                {formatNumber(totalSignals)} total
              </p>
            </div>
            <div className="mt-5 space-y-4">
              {data.signalsBySource.map((source) => (
                <div key={source.source}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground/80">{source.source}</span>
                    <span className="text-muted-foreground/80">
                      {formatNumber(source.count)} ·{' '}
                      {((source.count / totalSignals) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-track">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(source.count / maxSource) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, ease: EASE_OUT }}
                      className={cn(
                        'h-full rounded-full bg-gradient-to-r',
                        SOURCE_TONES[source.source] ?? 'from-indigo-500 to-indigo-400',
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Sandbox overview */}
          <section
            aria-label="Sandbox overview"
            className="flex flex-col rounded-2xl border border-border bg-card p-6 backdrop-blur-md"
          >
            <h2 className="text-sm font-semibold text-foreground">Sandbox overview</h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
              <li className="flex gap-2.5">
                <TrendingUp className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
                Workforce analytics — recomputed from imported data{' '}
                {now === null ? 'recently' : formatAgo(data.modelRefreshedAt, now)}
              </li>
              <li className="flex gap-2.5">
                <Activity className="mt-0.5 size-4 shrink-0 text-indigo-400" aria-hidden />
                {formatNumber(data.headcount)} employees monitored across {data.departments.length}{' '}
                departments
              </li>
              <li className="flex gap-2.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-cyan-400" aria-hidden />
                Enterprise governance — role-based access · audit trail
              </li>
            </ul>
            <div className="mt-auto border-t border-border/60 pt-4 text-xs text-muted-foreground/80">
              API{' '}
              {health ? (
                <>up · {formatUptime(health.uptimeSeconds)} uptime</>
              ) : (
                'unreachable — showing deterministic demo data'
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
