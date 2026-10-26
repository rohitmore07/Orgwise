'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  CheckCircle2,
  LayoutDashboard,
  LineChart,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useRef, useState, type KeyboardEvent } from 'react';
import { EASE_OUT } from './anim';
import { SectionHeading } from './decor';
import { CountUp } from './count-up';

type ViewDef =
  | {
      id: 'executive';
      label: string;
      icon: LucideIcon;
      headline: string;
      points: string[];
      accent: string;
      kpis: Array<{
        label: string;
        value: number;
        decimals?: number;
        prefix?: string;
        suffix?: string;
      }>;
    }
  | {
      id: 'hrbp';
      label: string;
      icon: LucideIcon;
      headline: string;
      points: string[];
      accent: string;
      teams: Array<{ name: string; risk: string; tone: string; bar: number }>;
    }
  | {
      id: 'manager';
      label: string;
      icon: LucideIcon;
      headline: string;
      points: string[];
      accent: string;
      goals: Array<{ label: string; value: number }>;
    };

const views = [
  {
    id: 'executive',
    label: 'Executive View',
    icon: LayoutDashboard,
    headline: 'The executive pulse, always current',
    points: [
      'Workforce health summary with key areas requiring attention',
      'Attrition breakdown by department, role, tenure, and overtime',
      'Deterministic executive summary with one-click print/PDF export',
    ],
    accent: 'from-indigo-500 to-violet-500',
    kpis: [
      { label: 'Headcount', value: 150 },
      { label: 'Attrition', value: 16.7, decimals: 1, suffix: '%' },
      { label: 'Avg tenure', value: 4.9, decimals: 1, suffix: 'yrs' },
    ],
  },
  {
    id: 'hrbp',
    label: 'HRBP View',
    icon: Users,
    headline: 'Every team, every risk, one dashboard',
    points: [
      'Team-level attrition and engagement at a glance',
      'Department comparison against the company average',
      'Drill from any insight to the employees behind it',
    ],
    accent: 'from-cyan-500 to-sky-500',
    teams: [
      { name: 'Engineering', risk: '11.5%', tone: 'text-emerald-400', bar: 18 },
      { name: 'Sales', risk: '40.9%', tone: 'text-rose-400', bar: 62 },
      { name: 'Marketing', risk: '16.7%', tone: 'text-amber-400', bar: 34 },
      { name: 'Data & Analytics', risk: '8.3%', tone: 'text-emerald-400', bar: 12 },
    ],
  },
  {
    id: 'manager',
    label: 'Manager View',
    icon: Target,
    headline: 'Daily actions, backed by data',
    points: [
      'Team dashboard scoped to the departments you manage',
      'Attrition, overtime, and satisfaction for your team',
      'Employee explorer with filters, sorting, and drill-down',
    ],
    accent: 'from-emerald-500 to-teal-500',
    goals: [
      { label: 'Team engagement', value: 74 },
      { label: 'Overtime rate', value: 38 },
      { label: 'Open roles', value: 3 },
    ],
  },
] as const satisfies readonly ViewDef[];

function PreviewPane({ active }: { active: ViewDef }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 backdrop-blur-xl">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-indigo-500/15 blur-3xl"
      />
      <div className="relative">
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-rose-500/80" />
          <span className="size-2.5 rounded-full bg-amber-400/80" />
          <span className="size-2.5 rounded-full bg-emerald-500/80" />
        </div>

        {'kpis' in active ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {active.kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-border/60 bg-muted p-4">
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {kpi.label}
                </p>
                <p className="mt-1.5 font-display text-2xl font-semibold text-foreground">
                  <CountUp
                    to={kpi.value}
                    decimals={kpi.decimals ?? 0}
                    prefix={kpi.prefix ?? ''}
                    suffix={kpi.suffix ?? ''}
                  />
                </p>
                <div className="mt-3 h-8" aria-hidden>
                  <div className="flex h-full items-end gap-1">
                    {[45, 62, 51, 78, 66, 88].map((height, index) => (
                      <motion.div
                        key={index}
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ duration: 0.6, delay: 0.25 + index * 0.07, ease: EASE_OUT }}
                        className={`flex-1 rounded-t-sm bg-gradient-to-t ${active.accent}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {'teams' in active ? (
          <div className="mt-5 space-y-3">
            {active.teams.map((team, index) => (
              <motion.div
                key={team.name}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.08, duration: 0.4, ease: EASE_OUT }}
                className="rounded-xl border border-border/60 bg-muted px-4 py-3"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground/80">{team.name}</span>
                  <span className={`font-medium ${team.tone}`}>Flight risk {team.risk}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-track">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${team.bar}%` }}
                    transition={{ duration: 0.7, delay: 0.3 + index * 0.08, ease: EASE_OUT }}
                    className={`h-full rounded-full ${
                      team.tone === 'text-rose-400'
                        ? 'bg-rose-500'
                        : team.tone === 'text-amber-400'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                    }`}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        ) : null}

        {'goals' in active ? (
          <div className="mt-5 space-y-4">
            {active.goals.map((goal, index) => (
              <div key={goal.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground/80">{goal.label}</span>
                  <span className="text-muted-foreground">{goal.value}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-track">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${goal.value}%` }}
                    transition={{ duration: 0.7, delay: 0.2 + index * 0.1, ease: EASE_OUT }}
                    className={`h-full rounded-full bg-gradient-to-r ${active.accent}`}
                  />
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-300">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />3 high-attrition patterns
              flagged in your team
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Showcase() {
  const [activeId, setActiveId] = useState<ViewDef['id']>(views[0].id);
  const activeIndex = Math.max(
    0,
    views.findIndex((view) => view.id === activeId),
  );
  const active = views[activeIndex] ?? views[0];
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const next = (activeIndex + direction + views.length) % views.length;
    const nextId = views[next]?.id ?? views[0].id;
    setActiveId(nextId);
    tabRefs.current[next]?.focus();
  }

  return (
    <section id="solutions" className="scroll-mt-24 bg-muted/40 py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Solutions"
          title="One platform, three lenses on the workforce"
          description="Every role sees the same governed data through the lens that matters to their decisions."
        />

        <div
          className="mx-auto mt-12 max-w-3xl"
          role="tablist"
          aria-label="Role-based views"
          onKeyDown={handleKeyDown}
        >
          <div className="flex flex-wrap justify-center gap-2 rounded-2xl border border-border surface p-2 backdrop-blur-md">
            {views.map((view) => (
              <button
                key={view.id}
                type="button"
                role="tab"
                id={`tab-${view.id}`}
                aria-selected={view.id === activeId}
                aria-controls={`panel-${view.id}`}
                tabIndex={view.id === activeId ? 0 : -1}
                ref={(element) => {
                  tabRefs.current[views.indexOf(view)] = element;
                }}
                onClick={() => setActiveId(view.id)}
                className={`relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                  view.id === activeId
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {view.id === activeId ? (
                  <motion.span
                    layoutId="showcase-tab"
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-500/30 to-cyan-500/30 ring-1 ring-inset ring-border"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    aria-hidden
                  />
                ) : null}
                <view.icon className="relative size-4" aria-hidden />
                <span className="relative">{view.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-10 grid max-w-6xl items-start gap-8 lg:grid-cols-[1fr_1.25fr]">
          <div
            role="tabpanel"
            id={`panel-${active.id}`}
            aria-labelledby={`tab-${active.id}`}
            className="min-h-64"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: EASE_OUT }}
              >
                <h3 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  {active.headline}
                </h3>
                <ul className="mt-6 space-y-4">
                  {active.points.map((point) => (
                    <li key={point} className="flex items-start gap-3 text-foreground/80">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                        <CheckCircle2 className="size-3.5" aria-hidden />
                      </span>
                      <span className="leading-relaxed">{point}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-2 text-xs text-foreground/80 backdrop-blur">
                  <LineChart className="size-3.5 text-cyan-400" aria-hidden />
                  Powered by the same governed workforce model
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="min-h-72">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3, ease: EASE_OUT }}
              >
                <PreviewPane active={active} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="mx-auto mt-12 flex max-w-2xl items-center justify-center gap-2 text-xs text-muted-foreground/70">
          <BarChart3 className="size-3.5" aria-hidden />
          <span>Use arrow keys to switch views</span>
        </div>
      </div>
    </section>
  );
}
