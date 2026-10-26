'use client';

import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  FileText,
  MessageSquare,
  Network,
  Radar,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { EASE_OUT } from './anim';
import { SectionHeading } from './decor';
import { Reveal } from './reveal';
import { Sparkline } from './sparkline';
import { TiltCard } from './tilt-card';

const years = ['2026', '2027', '2028', '2029', '2030'];
const retentionByYear = [94.2, 92.8, 91.4, 89.7, 88.1];

const meshSources = [
  { name: 'CSV Import', tone: 'text-indigo-600 dark:text-indigo-300' },
  { name: 'Employees', tone: 'text-cyan-600 dark:text-cyan-300' },
  { name: 'Hiring Pipeline', tone: 'text-emerald-600 dark:text-emerald-300' },
  { name: 'Analytics', tone: 'text-violet-600 dark:text-violet-300' },
];

const narrativeRows = [96, 88, 92, 70, 84];

const sentiment = [
  { label: 'Positive', value: 72, color: '#10b981' },
  { label: 'Neutral', value: 21, color: '#64748b' },
  { label: 'Negative', value: 7, color: '#f43f5e' },
];

function CardShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border surface p-6 backdrop-blur-md transition-colors duration-300 hover:border-foreground/20 ${
        className ?? ''
      }`}
    >
      {children}
    </div>
  );
}

function CardHeader({
  icon: Icon,
  title,
  chip,
}: {
  icon: LucideIcon;
  title: string;
  chip?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 text-indigo-600 dark:text-indigo-300">
          <Icon className="size-4.5" aria-hidden />
        </span>
        <h3 className="font-display text-base font-semibold tracking-tight text-foreground">
          {title}
        </h3>
      </div>
      {chip ? (
        <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          {chip}
        </span>
      ) : null}
    </div>
  );
}

function AttritionPredictor() {
  const [index, setIndex] = useState(2);
  const retention = retentionByYear[index] ?? 91.4;
  const fillPercent = (index / (years.length - 1)) * 100;

  const projected = useMemo(() => [94.2, 93.4, 92.6, 91.8, 91.1], []);

  return (
    <CardShell className="lg:col-span-2">
      {' '}
      <CardHeader icon={Radar} title="Attrition Risk Predictor" chip="Roadmap" />{' '}
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
        <Radar className="size-3.5 shrink-0 text-cyan-400" aria-hidden />
        On the roadmap — today orgwise reports observed attrition patterns across departments,
        roles, tenure, and overtime.
      </div>
      <div className="mt-6 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="text-center sm:text-left">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground/80">
            Predicted retention · {years[index] ?? ''}
          </p>
          <motion.p
            key={retention}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            className="mt-1 font-display text-5xl font-semibold tracking-tight text-foreground"
          >
            {retention.toFixed(1)}%
          </motion.p>
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-400">
            <ArrowUpRight className="size-3.5" aria-hidden />
            Saved vs. 88.0% baseline policy
          </p>
        </div>
        <div className="rounded-xl border border-border/60 surface p-4">
          <label
            htmlFor="retention-timeline"
            className="mb-3 block text-xs font-medium text-muted-foreground"
          >
            Simulate policy impact over time
          </label>
          <input
            id="retention-timeline"
            type="range"
            min={0}
            max={years.length - 1}
            step={1}
            value={index}
            onChange={(event) => setIndex(Number(event.target.value))}
            className="range-premium"
            style={{ ['--range-fill' as string]: `${fillPercent}%` }}
            aria-valuetext={`Year ${years[index] ?? ''} — predicted retention ${retention}%`}
          />
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground/70">
            {years.map((year) => (
              <span key={year}>{year}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 h-14">
        <Sparkline data={projected} stroke="#06b6d4" width={320} height={56} />
      </div>
    </CardShell>
  );
}

function DataMesh() {
  const meshId = useId();

  return (
    <TiltCard className="h-full">
      <CardShell className="flex h-full flex-col">
        <CardHeader icon={Network} title="One Workforce Model" chip="Imported" />
        <div className="relative mt-6 flex flex-1 items-center justify-center py-6" aria-hidden>
          <svg viewBox="0 0 300 190" className="absolute inset-0 h-full w-full opacity-60">
            <defs>
              <linearGradient id={`${meshId}-mesh`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
            {[
              [150, 95, 40, 25],
              [150, 95, 150, 20],
              [150, 95, 260, 30],
              [150, 95, 265, 155],
            ].map(([x1, y1, x2, y2], index) => (
              <motion.line
                key={index}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={`url(#${meshId}-mesh)`}
                strokeWidth={1}
                strokeDasharray="3 6"
                whileInView={{ strokeDashoffset: [0, -18] }}
                viewport={{ once: false, amount: 0.2 }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'linear', delay: index * 0.4 }}
              />
            ))}
          </svg>
          <div className="relative z-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {meshSources.map((source) => (
              <span
                key={source.name}
                className={`rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium backdrop-blur ${source.tone}`}
              >
                {source.name}
              </span>
            ))}
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Employees · departments · hiring · engagement — normalized in one model
        </p>
      </CardShell>
    </TiltCard>
  );
}

function BoardNarratives() {
  return (
    <TiltCard className="h-full">
      <CardShell className="flex h-full flex-col">
        <CardHeader icon={FileText} title="Board-Ready Narratives" chip="Auto-generate" />
        <div className="mt-6 flex-1 rounded-xl border border-border/60 bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Q3 Workforce Narrative
          </p>
          <div className="mt-3 space-y-2">
            {narrativeRows.map((width, index) => (
              <motion.div
                key={index}
                initial={{ width: 0 }}
                whileInView={{ width: `${width}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.1 * index, ease: EASE_OUT }}
                className={`h-2 rounded-full ${index === 0 ? 'bg-indigo-400/70' : 'bg-track'}`}
              />
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <span className="rounded-md border border-border bg-muted px-2 py-1 text-[10px] font-medium text-foreground/80">
              Print / PDF
            </span>
            <span className="rounded-md border border-border bg-muted px-2 py-1 text-[10px] font-medium text-foreground/80">
              Executive summary
            </span>
          </div>
        </div>
        <p className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Workflow className="size-3.5 text-cyan-400" aria-hidden />
            Generated from your analytics
          </span>
          <span className="text-foreground/80">Board-ready in seconds</span>
        </p>
      </CardShell>
    </TiltCard>
  );
}

function SentimentRadar() {
  const circumference = 2 * Math.PI * 42;
  let offset = 0;

  return (
    <CardShell className="lg:col-span-2">
      <CardHeader icon={MessageSquare} title="Sentiment & Pulse Analytics" chip="Roadmap" />
      <div className="mt-6 grid items-center gap-6 sm:grid-cols-[auto_1fr]">
        <div
          className="relative mx-auto size-44"
          role="img"
          aria-label="Sentiment donut: 72% positive, 21% neutral, 7% negative"
        >
          <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
            {sentiment.map((segment) => {
              const fraction = segment.value / 100;
              const dash = circumference * fraction;
              const element = (
                <motion.circle
                  key={segment.label}
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  initial={{ strokeDashoffset: circumference }}
                  whileInView={{ strokeDashoffset: -offset }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.15 }}
                />
              );
              offset += dash;
              return element;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="font-display text-3xl font-semibold text-foreground">
              <motion.span
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 }}
              >
                72%
              </motion.span>
            </p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Positive</p>
          </div>
        </div>
        <div className="space-y-3">
          {sentiment.map((segment) => (
            <div key={segment.label}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground/80">{segment.label}</span>
                <span className="text-muted-foreground">{segment.value}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-track">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${segment.value}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.9, delay: 0.2, ease: EASE_OUT }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: segment.color }}
                />
              </div>
            </div>
          ))}
          <p className="pt-1 text-xs text-muted-foreground">
            On the roadmap — today orgwise tracks engagement from job satisfaction, environment,
            relationships, and work-life balance in your dataset.
          </p>
        </div>
      </div>
    </CardShell>
  );
}

export function Bento() {
  return (
    <section id="capabilities" className="scroll-mt-24 py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Capabilities"
          title="Four ways orgwise turns data into intelligence"
          description="Shipped today: analytics, insights, executive summaries, and the Workforce Copilot. Predictive modeling is on the roadmap."
        />
        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          <AttritionPredictor />
          <DataMesh />
          <BoardNarratives />
          <SentimentRadar />
        </div>
        <Reveal delay={0.15} className="mt-8 text-center">
          <a
            href="#solutions"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-lg dark:text-indigo-300 dark:hover:text-indigo-200"
          >
            Explore role-based views
            <ArrowUpRight className="size-4" aria-hidden />
          </a>
        </Reveal>
      </div>
    </section>
  );
}
