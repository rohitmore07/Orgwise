'use client';

import { Download, Sparkles } from 'lucide-react';
import { useCopilot } from '@/components/copilot/copilot-context';
import { Button } from '@/components/ui/button';

/** Serializes rows to CSV and triggers a browser download. */
export function downloadCsv(filename: string, rows: Record<string, unknown>[]): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]!);
  const escape = (value: unknown) => {
    const s = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Icon button that opens the copilot with a prefilled question. */
export function AskAboutDataButton({
  question,
  label = 'Ask',
}: {
  question: string;
  label?: string;
}) {
  const { openWithQuestion } = useCopilot();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 gap-1 text-xs"
      onClick={() => openWithQuestion(question)}
    >
      <Sparkles className="size-3.5" aria-hidden />
      {label}
    </Button>
  );
}

/** Icon button that downloads the given rows as a CSV file. */
export function ExportCsvButton({
  filename,
  rows,
}: {
  filename: string;
  rows: Record<string, unknown>[];
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 gap-1 text-xs"
      disabled={rows.length === 0}
      onClick={() => downloadCsv(filename, rows)}
    >
      <Download className="size-3.5" aria-hidden />
      Export
    </Button>
  );
}
