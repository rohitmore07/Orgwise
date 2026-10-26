'use client';

import type { DistributionSlice, DashboardOverview } from '@orgwise/types';
import { Activity, Building2, ShieldCheck, Users } from 'lucide-react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import type { LucideIcon } from 'lucide-react';
// Value import for formatting — grouped with the other app imports below.
import { formatNumber } from '@/lib/format';

const CHART_COLORS = [
  '#6366f1',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#f43f5e',
  '#8b5cf6',
  '#14b8a6',
  '#ec4899',
];

// ── KPI cards ────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  hint?: string;
  accent?: string;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = 'from-indigo-500 to-indigo-400',
}: KpiCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <span
          className={`flex size-9 items-center justify-center rounded-lg bg-gradient-to-br ${accent} text-white shadow-sm`}
        >
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground">
        {formatNumber(value)}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function DashboardKpis({ overview }: { overview: DashboardOverview }) {
  const { kpis } = overview;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Total Employees"
        value={kpis.totalEmployees}
        icon={Users}
        hint="Across all departments"
        accent="from-indigo-500 to-indigo-400"
      />
      <KpiCard
        label="Active"
        value={kpis.activeEmployees}
        icon={Activity}
        hint="Currently employed"
        accent="from-emerald-500 to-emerald-400"
      />
      <KpiCard
        label="Departments"
        value={kpis.totalDepartments}
        icon={Building2}
        hint="Org structure"
        accent="from-cyan-500 to-cyan-400"
      />
      <KpiCard
        label="Managers"
        value={kpis.totalManagers}
        icon={ShieldCheck}
        hint="Assigned managers"
        accent="from-violet-500 to-violet-400"
      />
    </div>
  );
}

// ── Charts ───────────────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <p className="font-medium text-foreground">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="mt-0.5 text-muted-foreground">
          <span className="font-medium text-foreground">{formatNumber(entry.value)}</span>{' '}
          {entry.name}
        </p>
      ))}
    </div>
  );
}

/** Horizontal bar chart of headcount per department. */
export function DepartmentDistributionChart({ data }: { data: DistributionSlice[] }) {
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">No department data yet</p>
    );
  }
  return (
    <div className="h-64 w-full" role="img" aria-label="Department distribution bar chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            type="number"
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={96}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
          <Bar dataKey="value" name="employees" radius={[0, 6, 6, 0]}>
            {data.map((_, index) => (
              <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut chart for status / gender distributions. */
export function DistributionDonut({ data, title }: { data: DistributionSlice[]; title: string }) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  if (total === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No {title.toLowerCase()} data yet
      </p>
    );
  }
  return (
    <div
      className="flex h-64 flex-col items-center"
      role="img"
      aria-label={`${title} distribution donut chart`}
    >
      <div className="relative h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={54}
              outerRadius={80}
              paddingAngle={2}
              stroke="var(--card)"
            >
              {data.map((_, index) => (
                <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-semibold text-foreground">
            {formatNumber(total)}
          </span>
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">total</span>
        </div>
      </div>
      <ul className="mt-3 grid w-full grid-cols-2 gap-x-3 gap-y-1.5">
        {data.map((slice, index) => (
          <li key={slice.name} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
              aria-hidden
            />
            <span className="truncate">{slice.name}</span>
            <span className="ml-auto font-medium text-foreground">{formatNumber(slice.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
