'use client';

import type { AttritionSlice, DistributionSlice } from '@orgwise/types';
import { useRouter } from 'next/navigation';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatNumber } from '@/lib/format';

export const CHART_COLORS = [
  '#6366f1',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#f43f5e',
  '#8b5cf6',
  '#14b8a6',
  '#ec4899',
];

/** Color for an attrition rate — traffic-light semantics. */
export function attritionColor(rate: number | null): string {
  if (rate === null) return 'var(--muted-foreground)';
  if (rate < 0.1) return '#10b981';
  if (rate < 0.2) return '#f59e0b';
  return '#f43f5e';
}

/** Builds a `Record` of explorer params from a chart-slice name (see callers). */
export type SliceParams = (name: string, entry?: { headcount?: number }) => Record<string, string>;

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

/** Generic clickable bar chart — clicking a bar drills into the explorer. */
export function ClickableBarChart({
  data,
  onSelect,
  fill,
  layout = 'vertical',
  height = 224,
  valueName = 'employees',
  valueFormatter,
}: {
  data: DistributionSlice[];
  onSelect: (name: string) => void;
  fill?: (name: string) => string;
  layout?: 'horizontal' | 'vertical';
  height?: number;
  valueName?: string;
  valueFormatter?: (value: number) => string;
}) {
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">No data for this view yet</p>
    );
  }
  const horizontal = layout === 'horizontal';
  return (
    <div
      className="w-full"
      style={{ height }}
      role="img"
      aria-label="Clickable distribution bar chart"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
        >
          <CartesianGrid
            horizontal={!horizontal}
            vertical={horizontal}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          {horizontal ? (
            <>
              <XAxis
                type="number"
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => valueFormatter?.(v) ?? String(v)}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={104}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="name"
                tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-22}
                textAnchor="end"
                height={54}
              />
              <YAxis
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => valueFormatter?.(v) ?? String(v)}
              />
            </>
          )}
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
          <Bar dataKey="value" name={valueName} radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={entry.name}
                fill={fill?.(entry.name) ?? CHART_COLORS[index % CHART_COLORS.length]}
                className="cursor-pointer"
                onClick={() => onSelect(entry.name)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Attrition-rate bar chart with traffic-light coloring + drill-down. */
export function AttritionRateChart({
  slices,
  onSelect,
  layout = 'vertical',
  height = 224,
}: {
  slices: AttritionSlice[];
  onSelect: (name: string) => void;
  layout?: 'horizontal' | 'vertical';
  height?: number;
}) {
  if (slices.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">No data for this view yet</p>
    );
  }
  const data = slices.map((s) => ({
    name: s.name,
    rate: s.attritionRate !== null ? Math.round(s.attritionRate * 1000) / 10 : 0,
    headcount: s.headcount,
    attritionCount: s.attritionCount,
    hasRate: s.attritionRate !== null,
  }));
  const horizontal = layout === 'horizontal';

  return (
    <div className="w-full" style={{ height }} role="img" aria-label="Attrition rate chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
        >
          <CartesianGrid
            horizontal={!horizontal}
            vertical={horizontal}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          {horizontal ? (
            <>
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={104}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="name"
                tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-22}
                textAnchor="end"
                height={54}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
            </>
          )}
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const entry = payload[0]!.payload as (typeof data)[number];
              return (
                <div className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
                  <p className="font-medium text-foreground">{label}</p>
                  <p className="mt-0.5 text-muted-foreground">
                    Attrition rate:{' '}
                    <span className="font-medium text-foreground">
                      {entry.hasRate ? `${entry.rate}%` : 'n/a'}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    {formatNumber(entry.attritionCount)} of {formatNumber(entry.headcount)} left
                  </p>
                </div>
              );
            }}
            cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
          />
          <Bar dataKey="rate" name="attrition rate" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={entry.hasRate ? attritionColor(entry.rate / 100) : 'var(--muted-foreground)'}
                className="cursor-pointer"
                onClick={() => onSelect(entry.name)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Clickable donut chart with a center total. */
export function ClickableDonut({
  data,
  title,
  onSelect,
}: {
  data: DistributionSlice[];
  title: string;
  onSelect: (name: string) => void;
}) {
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
      className="flex h-56 flex-col items-center"
      role="img"
      aria-label={`${title} distribution donut chart`}
    >
      <div className="relative h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={74}
              paddingAngle={2}
              stroke="var(--card)"
            >
              {data.map((slice, index) => (
                <Cell
                  key={slice.name}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  className="cursor-pointer"
                  onClick={() => onSelect(slice.name)}
                />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-xl font-semibold text-foreground">
            {formatNumber(total)}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">total</span>
        </div>
      </div>
      <ul className="mt-2 grid w-full grid-cols-2 gap-x-3 gap-y-1">
        {data.map((slice, index) => (
          <li
            key={slice.name}
            className="flex items-center gap-2 text-[11px] text-muted-foreground"
          >
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

/** Shared helper: navigate to the explorer with the given params. */
export function useExplorerNavigation() {
  const router = useRouter();
  return (params: Record<string, string>) => {
    const query = new URLSearchParams(params).toString();
    router.push(`/employees?${query}`);
  };
}
