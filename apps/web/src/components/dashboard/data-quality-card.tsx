'use client';

import type { DataQuality } from '@orgwise/types';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  FileSpreadsheet,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatNumber, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

function readinessTone(percent: number): 'success' | 'warning' | 'danger' {
  if (percent >= 90) return 'success';
  if (percent >= 70) return 'warning';
  return 'danger';
}
// Dataset Health — analytics quality depends on data quality. Shows record counts, the share of analytics-ready…
// records, and which fields are missing values so admins know exactly what to enrich next.
export function DataQualityCard({ quality }: { quality: DataQuality }) {
  const [showAllMissing, setShowAllMissing] = useState(false);
  const tone = readinessTone(quality.readinessPercent);
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - quality.readinessPercent / 100);
  const hiddenMissingCount = Math.max(0, quality.missingFields.length - 4);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-indigo-500/20">
          <Database className="size-4 text-cyan-500 dark:text-cyan-300" aria-hidden />
        </span>
        <div>
          <h3 className="font-display text-sm font-semibold text-foreground">Dataset health</h3>
          <p className="text-xs text-muted-foreground">Readiness of the analytics dataset</p>
        </div>
        <Badge variant={tone} className="ml-auto">
          {quality.readinessPercent}% ready
        </Badge>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div
          className="relative size-20 shrink-0"
          role="img"
          aria-label={`${quality.readinessPercent}% ready`}
        >
          <svg viewBox="0 0 80 80" className="size-20 -rotate-90">
            <circle cx="40" cy="40" r={radius} fill="none" stroke="var(--border)" strokeWidth="7" />
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              stroke={tone === 'success' ? '#10b981' : tone === 'warning' ? '#f59e0b' : '#f43f5e'}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-semibold text-foreground">
            {quality.readinessPercent}%
          </span>
        </div>
        <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <dt className="text-muted-foreground">Total records</dt>
            <dd className="font-semibold text-foreground">{formatNumber(quality.totalRecords)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Analytics-ready</dt>
            <dd className="flex items-center gap-1 font-semibold text-emerald-500">
              <CheckCircle2 className="size-3.5" aria-hidden /> {formatNumber(quality.validRecords)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Duplicates</dt>
            <dd className="font-semibold text-foreground">
              {formatNumber(quality.duplicateRecords)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Deleted (retained)</dt>
            <dd className="flex items-center gap-1 font-semibold text-foreground">
              <Trash2 className="size-3.5 text-muted-foreground" aria-hidden />{' '}
              {formatNumber(quality.deletedRecords)}
            </dd>
          </div>
        </dl>
      </div>

      {quality.missingFields.length > 0 ? (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Missing values
          </p>
          <ul className="mt-1.5 space-y-1">
            {(showAllMissing ? quality.missingFields : quality.missingFields.slice(0, 4)).map(
              (m) => (
                <li
                  key={m.field}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-card/50 px-2.5 py-1.5 text-xs"
                >
                  <span className="text-foreground/90">{m.label}</span>
                  <span className="font-medium text-amber-500">
                    {formatNumber(m.count)} missing
                  </span>
                </li>
              ),
            )}
          </ul>
          {hiddenMissingCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowAllMissing((value) => !value)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              {showAllMissing ? (
                <>
                  <ChevronUp className="size-3.5" aria-hidden /> Show fewer
                </>
              ) : (
                <>
                  <ChevronDown className="size-3.5" aria-hidden /> Show all{' '}
                  {quality.missingFields.length} fields
                </>
              )}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-emerald-500">
          <CheckCircle2 className="size-3.5" aria-hidden /> All core analytics fields are populated.
        </p>
      )}

      <div
        className={cn(
          'mt-4 space-y-2.5 border-t border-border/60 pt-3 text-[11px] text-muted-foreground',
        )}
      >
        {quality.lastImport ? (
          <p className="flex items-center gap-1.5">
            <FileSpreadsheet className="size-3.5" aria-hidden />
            Last import:{' '}
            <span className="font-medium text-foreground">{quality.lastImport.fileName}</span>
            {' · '}
            {quality.lastImport.successCount}/{quality.lastImport.totalRows} rows ·{' '}
            {formatRelative(quality.lastImport.createdAt)}
          </p>
        ) : (
          <p>No imports yet — upload a CSV to enrich the dataset.</p>
        )}
        {quality.missingFields.length > 0 ? (
          <Button size="sm" variant="outline" asChild>
            <Link href="/imports">
              <FileSpreadsheet className="size-3.5" aria-hidden /> Fix in next import
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
