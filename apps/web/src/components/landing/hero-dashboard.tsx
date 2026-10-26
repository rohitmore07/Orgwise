'use client';

import { motion } from 'framer-motion';
import { Activity, TrendingUp, Users } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import type { DepartmentTone, HealthStatus, LiveSignalsSnapshot } from '@orgwise/types';
import { fetchHealth, fetchLiveSignals } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { CountUp } from './count-up';
import { Sparkline } from './sparkline';
import { EASE_OUT } from './anim';

const GAUGE_RADIUS = 48;
const GAUGE_LENGTH = Math.PI * GAUGE_RADIUS; // semicircle arc length

// Offline fallback — a static snapshot mirroring the API contract. Rendered while connecting and whenever the…
// API is unreachable, so the landing page never depends on the backend being up. Exported so stories/tests can…
export const MOCK_SNAPSHOT: LiveSignalsSnapshot = {
  generatedAt: new Date(0).toISOString(),
  uptimeSeconds: 0,
  healthScore: 91,
  healthDelta: 0,
  headcount: 150,
  engagementPercent: 74,
  flightRiskPercent: 16.7,
  signalsTotal: 228,
  signalsBySource: [
    { source: 'Employee records', count: 150 },
    { source: 'Departments', count: 10 },
    { source: 'Teams', count: 15 },
    { source: 'Hiring records', count: 48 },
    { source: 'Imports', count: 5 },
    { source: 'Copilot conversations', count: 0 },
  ],
  modelRefreshedAt: new Date(0).toISOString(),
  departments: [
    { name: 'Engineering', pct: 35, tone: 'indigo' },
    { name: 'Sales', pct: 15, tone: 'cyan' },
    { name: 'Product', pct: 8, tone: 'emerald' },
    { name: 'Marketing', pct: 8, tone: 'violet' },
  ],
  heatMap: [
    0.1, 0.08, 0.12, 0.15, 0.09, 0.11, 0.14, 0.07, 0.1, 0.13, 0.09, 0.08, 0.16, 0.12, 0.2, 0.28,
    0.18, 0.14, 0.22, 0.17, 0.12, 0.15, 0.19, 0.13, 0.3, 0.24, 0.34, 0.42, 0.28, 0.22, 0.36, 0.26,
    0.18, 0.24, 0.31, 0.21, 0.45, 0.36, 0.5, 0.58, 0.4, 0.34, 0.52, 0.38, 0.3, 0.4, 0.48, 0.35,
  ],
  spark: [
    {
      label: 'Headcount',
      value: 150,
      suffix: '',
      decimals: 0,
      data: [52, 22, 12, 12, 16, 12, 8, 5],
    },
    {
      label: 'Engagement',
      value: 74,
      suffix: '%',
      decimals: 0,
      data: [70, 72, 71, 73, 74, 76, 75, 78],
    },
    {
      label: 'Attrition',
      value: 16.7,
      suffix: '%',
      decimals: 1,
      data: [11.5, 40.9, 16.7, 12.5, 10, 8.3, 20, 0],
    },
  ],
};

const SPARK_COLORS = ['#818cf8', '#06b6d4', '#10b981'];

const DEPT_GRADIENTS: Record<DepartmentTone, string> = {
  indigo: 'from-indigo-500 to-indigo-400',
  cyan: 'from-cyan-500 to-cyan-400',
  emerald: 'from-emerald-500 to-emerald-400',
  violet: 'from-violet-500 to-violet-400',
};

function heatClass(risk: number) {
  if (risk < 0.2) return 'bg-emerald-500/50';
  if (risk < 0.35) return 'bg-emerald-400/25';
  if (risk < 0.5) return 'bg-amber-400/40';
  return 'bg-rose-500/60';
}

/** Relative time label, e.g. "just now", "14s ago", "4m ago". */
export function formatAgo(timestamp: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(timestamp)) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

/** Compact uptime label, e.g. "42s", "7m", "2h". */
export function formatUptime(uptimeSeconds: number): string {
  if (uptimeSeconds < 60) return `${uptimeSeconds}s`;
  if (uptimeSeconds < 3600) return `${Math.round(uptimeSeconds / 60)}m`;
  return `${Math.round(uptimeSeconds / 3600)}h`;
}

type SyncMode = 'loading' | 'live' | 'demo';

export function HeroDashboard() {
  const gaugeId = useId();
  const [snapshot, setSnapshot] = useState<LiveSignalsSnapshot | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [mode, setMode] = useState<SyncMode>('loading');
  // Time base for relative labels. Null until mounted so the server-rendered
  // HTML is stable — `new Date()` in render is a hydration-mismatch hazard.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const [signals, healthResult] = await Promise.allSettled([fetchLiveSignals(), fetchHealth()]);
      if (cancelled) return;

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
    // Initial fetch + periodic refresh so the dashboard reconnects on its own if the API was briefly unavailable,…
    // and the signal count keeps advancing without a page reload.
    setNow(Date.now());
    void refresh();
    const refreshInterval = setInterval(() => void refresh(), 30_000);

    return () => {
      cancelled = true;
      clearInterval(refreshInterval);
    };
  }, []);

  // Keep relative labels fresh only while showing live data.
  useEffect(() => {
    if (mode !== 'live') return;
    const interval = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(interval);
  }, [mode]);

  const data = snapshot ?? MOCK_SNAPSHOT;
  const gaugeProgress = data.healthScore / 100;

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-4 rounded-[2rem] bg-gradient-to-tr from-indigo-500/20 via-transparent to-cyan-500/20 blur-2xl"
      />
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-indigo-500/10 backdrop-blur-2xl dark:shadow-indigo-950/40">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-rose-500/80" />
            <span className="size-2.5 rounded-full bg-amber-400/80" />
            <span className="size-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="size-3.5 text-cyan-400" aria-hidden />
            Workforce Health · {mode === 'demo' ? 'Demo' : 'Live'}
          </p>
          <p
            aria-live="polite"
            className="flex items-center gap-1.5 text-xs text-muted-foreground/80"
          >
            {mode === 'loading' ? (
              'Connecting…'
            ) : mode === 'live' ? (
              <>
                <span className="relative flex size-1.5" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
                </span>
                Synced {now === null ? '…' : formatAgo(data.generatedAt, now)}
                {health ? <> · API up {formatUptime(health.uptimeSeconds)}</> : null}
              </>
            ) : (
              <>
                <span className="relative flex size-1.5" aria-hidden>
                  <span className="relative inline-flex size-1.5 rounded-full bg-amber-400" />
                </span>
                API offline · demo data
              </>
            )}
          </p>
        </div>

        <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
          {/* Health score gauge */}
          <div className="rounded-xl border border-border/60 bg-muted p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Health Score
              </p>
              {data.healthDelta > 0 ? (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                  ▲ {data.healthDelta.toFixed(1)} pts
                </span>
              ) : (
                <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Current dataset
                </span>
              )}
            </div>
            <div className="relative mx-auto mt-4 w-fit">
              <svg viewBox="0 0 120 62" className="h-24 w-auto" aria-hidden>
                <defs>
                  <linearGradient id={`${gaugeId}-gauge`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
                <path
                  d={`M 12 56 A ${GAUGE_RADIUS} ${GAUGE_RADIUS} 0 0 1 108 56`}
                  fill="none"
                  className="stroke-track"
                  strokeWidth={8}
                  strokeLinecap="round"
                />
                <motion.path
                  d={`M 12 56 A ${GAUGE_RADIUS} ${GAUGE_RADIUS} 0 0 1 108 56`}
                  fill="none"
                  stroke={`url(#${gaugeId}-gauge)`}
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeDasharray={GAUGE_LENGTH}
                  initial={{ strokeDashoffset: GAUGE_LENGTH }}
                  whileInView={{ strokeDashoffset: GAUGE_LENGTH * (1 - gaugeProgress) }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.6, ease: EASE_OUT, delay: 0.3 }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
                <p className="font-display text-3xl font-semibold text-foreground">
                  <CountUp to={data.healthScore} />
                </p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/80">
                  / 100
                </p>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground/80">
              Composite of data quality, retention, and engagement signals
            </p>
          </div>

          {/* Attrition risk heat map */}
          <div className="rounded-xl border border-border/60 bg-muted p-5">
            <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
              Attrition Risk Heat Map
            </p>
            <div
              className="mt-4 grid grid-cols-12 gap-1"
              role="img"
              aria-label="Attrition risk heat map by team and quarter"
            >
              {data.heatMap.map((risk, index) => (
                <motion.span
                  key={index}
                  initial={{ opacity: 0, scale: 0.7 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.25 }}
                  className={`aspect-square rounded-[3px] ${heatClass(risk)}`}
                />
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground/80">
              <span>Teams →</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500/60" /> Low
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-amber-400/50" /> Medium
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-rose-500/60" /> High
                </span>
              </div>
            </div>
          </div>

          {/* Department breakdown */}
          <div className="rounded-xl border border-border/60 bg-muted p-5">
            <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
              Department Breakdown
            </p>
            <div className="mt-4 space-y-3.5">
              {data.departments.map((dept, index) => (
                <div key={dept.name}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground/80">{dept.name}</span>
                    <span className="text-muted-foreground/80">{dept.pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-track">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${dept.pct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: 0.15 * index, ease: EASE_OUT }}
                      className={`h-full rounded-full bg-gradient-to-r ${DEPT_GRADIENTS[dept.tone]}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sparkline stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            {data.spark.map((stat, index) => (
              <div key={stat.label} className="rounded-xl border border-border/60 bg-muted p-4">
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground/80">
                  {stat.label}
                </p>
                <p className="mt-1.5 font-display text-xl font-semibold text-foreground">
                  <CountUp to={stat.value} suffix={stat.suffix} decimals={stat.decimals} />
                </p>
                <div className="mt-2 h-10">
                  <Sparkline data={stat.data} stroke={SPARK_COLORS[index] ?? '#818cf8'} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-5 py-3 text-xs text-muted-foreground/80">
          <p className="flex items-center gap-1.5">
            <Users className="size-3.5 text-indigo-400" aria-hidden />
            {formatNumber(data.signalsTotal)} live signals unified across{' '}
            {data.signalsBySource.length} sources
          </p>
          <p className="flex items-center gap-1.5">
            <TrendingUp className="size-3.5 text-emerald-400" aria-hidden />
            {mode === 'demo'
              ? 'Workforce analytics snapshot · demo data'
              : `Analytics snapshot computed ${
                  now === null ? 'recently' : formatAgo(data.modelRefreshedAt, now)
                }`}
          </p>
        </div>
      </div>
    </div>
  );
}
