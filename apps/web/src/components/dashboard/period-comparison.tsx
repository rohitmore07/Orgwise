'use client';

import type { PeriodComparison } from '@orgwise/types';
import { ArrowDown, ArrowUp, ArrowRight, Calendar, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface DeltaProps {
  value: string;
  label: string;
  invert?: boolean; // e.g. lower attrition is good
}

function Delta({ value, label, invert }: DeltaProps) {
  const num = parseFloat(value);
  const isPositive = num > 0;
  const isNegative = num < 0;
  const isGood = num !== 0 && (invert ? isNegative : isPositive);
  const isBad = num !== 0 && (invert ? isPositive : isNegative);

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          'flex items-center gap-1 text-sm font-semibold',
          isGood && 'text-emerald-600 dark:text-emerald-400',
          isBad && 'text-red-600 dark:text-red-400',
          num === 0 && 'text-muted-foreground',
        )}
      >
        {isPositive ? (
          <ArrowUp className="size-3" />
        ) : isNegative ? (
          <ArrowDown className="size-3" />
        ) : (
          <ArrowRight className="size-3" />
        )}
        {value}
      </span>
    </div>
  );
}

export function PeriodComparison() {
  const [data, setData] = useState<PeriodComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentStart, setCurrentStart] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [currentEnd, setCurrentEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [showPicker, setShowPicker] = useState(false);

  const fetchComparison = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ currentStart, currentEnd });
      const result = await api.get<PeriodComparison>(
        `/analytics/compare-periods?${params.toString()}`,
      );
      setData(result);
    } catch {
      // silently fail — component shows empty state
    } finally {
      setLoading(false);
    }
  }, [currentStart, currentEnd]);

  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  if (!data && !loading) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <TrendingUp className="size-4 text-muted-foreground" />
          Period Comparison
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setShowPicker(!showPicker)}>
          <Calendar className="size-3.5 mr-1" />
          {showPicker ? 'Hide' : 'Customize'}
        </Button>
      </CardHeader>
      <CardContent>
        {showPicker && (
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium uppercase text-muted-foreground">
                From
              </label>
              <Input
                type="date"
                value={currentStart}
                onChange={(e) => setCurrentStart(e.target.value)}
                className="h-8 w-36 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium uppercase text-muted-foreground">To</label>
              <Input
                type="date"
                value={currentEnd}
                onChange={(e) => setCurrentEnd(e.target.value)}
                className="h-8 w-36 text-xs"
              />
            </div>
            <Button size="sm" onClick={fetchComparison} disabled={loading}>
              {loading ? 'Loading…' : 'Compare'}
            </Button>
          </div>
        )}

        {loading && !data ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Loading comparison…
          </div>
        ) : data ? (
          <>
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {data.currentPeriod.start} → {data.currentPeriod.end}
              </span>
              <span>vs</span>
              <span className="font-medium text-foreground">
                {data.previousPeriod.start} → {data.previousPeriod.end}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <div className="text-center">
                <p className="text-2xl font-bold">{data.current.headcount}</p>
                <Delta value={String(data.deltas.headcount)} label="Headcount" />
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{data.current.attritionRate}</p>
                <Delta value={data.deltas.attritionRate} label="Attrition" invert />
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{data.current.averageTenure}y</p>
                <Delta value={`${data.deltas.averageTenure}y`} label="Avg Tenure" />
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{data.current.overtimeRate}</p>
                <Delta value={data.deltas.overtimeRate} label="Overtime" invert />
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{data.current.averageSatisfaction}</p>
                <Delta value={data.deltas.averageSatisfaction} label="Satisfaction" />
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{data.current.newHires}</p>
                <Delta value={String(data.deltas.newHires)} label="New Hires" />
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
