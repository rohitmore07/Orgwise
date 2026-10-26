'use client';

import type {
  DuplicateStrategy,
  ImportHistoryView,
  ImportPreview,
  ImportPreviewRow,
  ImportRowError,
  Paginated,
} from '@orgwise/types';
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  Download,
  FileSpreadsheet,
  FlaskConical,
  Layers,
  Loader2,
  RotateCcw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { PageHeader } from '@/components/app-shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { useToast } from '@/components/ui/toast';
import {
  api,
  ApiClientError,
  API_BASE_URL,
  downloadAuthenticated,
  fetchSampleCsv,
} from '@/lib/api';
import { getStoredSession, syncOAuthSession } from '@/lib/auth';
import { formatDate, formatDuration, formatNumber, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

const STRATEGIES: Array<{
  value: DuplicateStrategy;
  title: string;
  description: string;
}> = [
  {
    value: 'skip',
    title: 'Skip duplicates',
    description: 'Rows that already exist are skipped and reported.',
  },
  {
    value: 'fail',
    title: 'Fail on duplicates',
    description: 'Any duplicate (or invalid) row rejects the whole file.',
  },
  {
    value: 'update',
    title: 'Update existing',
    description: 'Matching employee codes are updated in place (upsert).',
  },
];

export default function ImportsPage() {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('skip');
  const [label, setLabel] = useState('');
  const [result, setResult] = useState<ImportHistoryView | null>(null);
  const [history, setHistory] = useState<Paginated<ImportHistoryView> | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [rollbackId, setRollbackId] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState(false);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      setHistory(await api.get<Paginated<ImportHistoryView>>('/imports?page=1&pageSize=10'));
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Failed to load import history');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // ── Phase 1: stage (dry-run preview) ────────────────────────────────────
  const stageFile = useCallback(
    async (file: File) => {
      if (!file) return;
      if (!file.name.toLowerCase().endsWith('.csv')) {
        toast.error('Please choose a CSV file');
        return;
      }
      setPreviewing(true);
      setResult(null);
      const form = new FormData();
      form.append('file', file);
      try {
        const staged = await api.post<ImportPreview>('/imports/preview', form);
        setPreview(staged);
        setStagedFile(file);
        setDuplicateStrategy('skip');
        setLabel('');
      } catch (err) {
        setPreview(null);
        setStagedFile(null);
        toast.error(err instanceof ApiClientError ? err.message : 'Could not analyze this file');
      } finally {
        setPreviewing(false);
      }
    },
    [toast],
  );

  const discardStaged = () => {
    setPreview(null);
    setStagedFile(null);
  };

  // ── Phase 2: confirm (real import, XHR so we can show progress) ────────
  const confirmImport = () => {
    if (!stagedFile) return;
    setUploading(true);
    setUploadProgress(0);
    const form = new FormData();
    form.append('file', stagedFile);
    form.append('duplicateStrategy', duplicateStrategy);
    if (label.trim()) form.append('label', label.trim());

    const run = (retried: boolean): void => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}/imports`);
      const session = getStoredSession();
      if (session?.token) xhr.setRequestHeader('Authorization', `Bearer ${session.token}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status === 401 && !retried) {
          void syncOAuthSession().then((ok) => {
            if (ok) run(true);
            else {
              setUploading(false);
              toast.error('Session expired — please sign in again');
            }
          });
          return;
        }
        setUploading(false);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const payload = JSON.parse(xhr.responseText) as { data: ImportHistoryView };
            setResult(payload.data);
            setPreview(null);
            setStagedFile(null);
            toast.success(
              `Imported ${payload.data.successCount} record${payload.data.successCount === 1 ? '' : 's'}`,
            );
            void loadHistory();
          } catch {
            toast.error('The import finished but the response could not be read');
          }
        } else {
          let message = `Import failed (${xhr.status})`;
          try {
            const payload = JSON.parse(xhr.responseText) as { message?: string };
            if (payload.message) message = payload.message;
          } catch {
            // keep the default
          }
          toast.error(message);
        }
      };
      xhr.onerror = () => {
        setUploading(false);
        toast.error('Could not reach the orgwise API. Is the API running?');
      };
      xhr.send(form);
    };
    run(false);
  };

  const rollback = async (id: string) => {
    setRollingBack(true);
    try {
      const updated = await api.post<ImportHistoryView>(`/imports/${id}/rollback`);
      setHistory((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((item) => (item.id === id ? updated : item)),
            }
          : prev,
      );
      setRollbackId(null);
      toast.success('Import rolled back — its records were removed from the workforce');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Rollback failed');
    } finally {
      setRollingBack(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void stageFile(file);
  };

  const downloadTemplate = useCallback(async () => {
    try {
      await downloadAuthenticated('/imports/template', 'orgwise-employees-template.csv');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Failed to download template');
    }
  }, [toast]);

  const downloadHiringTemplate = useCallback(async () => {
    try {
      await downloadAuthenticated('/imports/template/hiring', 'orgwise-hiring-template.csv');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Failed to download template');
    }
  }, [toast]);

  const loadSample = useCallback(async () => {
    try {
      const file = await fetchSampleCsv('/imports/sample');
      await stageFile(file);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Failed to load sample data');
    }
  }, [stageFile, toast]);

  return (
    <div>
      <PageHeader
        eyebrow="Onboarding"
        title="CSV Import"
        description="Import workforce data in two steps — preview & validate first, then confirm. Nothing is written until you approve."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void loadSample()}>
              <Sparkles className="size-4" aria-hidden /> Try sample data
            </Button>
            <Button variant="outline" onClick={() => void downloadTemplate()}>
              <Download className="size-4" aria-hidden /> Employee Template
            </Button>
            <Button variant="outline" onClick={() => void downloadHiringTemplate()}>
              <Download className="size-4" aria-hidden /> Hiring Template
            </Button>
          </div>
        }
      />

      {stagedFile && preview ? (
        <StagingPanel
          preview={preview}
          duplicateStrategy={duplicateStrategy}
          onStrategyChange={setDuplicateStrategy}
          label={label}
          onLabelChange={setLabel}
          uploading={uploading}
          progress={uploadProgress}
          onConfirm={() => void confirmImport()}
          onDiscard={discardStaged}
        />
      ) : (
        <UploadZone
          dragging={dragging}
          previewing={previewing}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => void handleDrop(e)}
          onBrowse={() => inputRef.current?.click()}
          inputRef={inputRef}
          onFile={(file) => void stageFile(file)}
        />
      )}

      {/* Import summary */}
      {result ? <ResultSummary result={result} /> : null}

      {/* Error report */}
      {result?.errorReport && result.errorReport.length > 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Error Report</CardTitle>
          </CardHeader>
          <CardContent>
            <ErrorReportTable report={result.errorReport} />
          </CardContent>
        </Card>
      ) : null}

      {/* Import history */}
      <div className="mt-8">
        <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
          Import History
        </h2>
        <Card className="mt-3">
          <CardContent className="p-0">
            {historyLoading ? (
              <TableSkeleton rows={4} toolbar={false} />
            ) : historyError ? (
              <ErrorState description={historyError} onRetry={() => void loadHistory()} />
            ) : history && history.items.length === 0 ? (
              <EmptyState
                title="No imports yet"
                description="Your CSV imports will appear here with their results."
                action={
                  <Button size="sm" onClick={() => inputRef.current?.click()}>
                    <CloudUpload className="size-4" aria-hidden /> Upload your first CSV
                  </Button>
                }
              />
            ) : history ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Rows</TableHead>
                    <TableHead>Imported</TableHead>
                    <TableHead className="hidden md:table-cell">Duplicates</TableHead>
                    <TableHead className="hidden md:table-cell">Duration</TableHead>
                    <TableHead className="hidden lg:table-cell">By</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <FileSpreadsheet
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <span className="min-w-0">
                            <span className="block truncate">{item.fileName}</span>
                            {item.label ? (
                              <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                <Layers className="size-3" aria-hidden />
                                {item.label}
                              </span>
                            ) : null}
                          </span>
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                          <Badge variant={item.type === 'hiring' ? 'secondary' : 'info'}>
                            {item.type === 'hiring' ? 'Hiring' : 'Employees'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                        {formatNumber(item.totalRows)}
                      </TableCell>
                      <TableCell className="text-sm text-emerald-500">
                        {item.successCount}
                        {item.updatedCount ? (
                          <span className="ml-1 text-cyan-500">+{item.updatedCount} up</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="hidden text-sm text-amber-500 md:table-cell">
                        {item.duplicateCount}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                        {formatDuration(item.durationMs)}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                        {item.importedBy?.name ?? '—'}
                      </TableCell>
                      <TableCell
                        className="text-sm text-muted-foreground"
                        title={formatDate(item.createdAt)}
                      >
                        {formatRelative(item.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {rollbackId === item.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="hidden text-xs text-muted-foreground sm:inline">
                              Undo this import?
                            </span>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={rollingBack}
                              onClick={() => void rollback(item.id)}
                            >
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={rollingBack}
                              onClick={() => setRollbackId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              item.status === 'rolled_back' ||
                              item.successCount === 0 ||
                              rollingBack
                            }
                            onClick={() => setRollbackId(item.id)}
                          >
                            <RotateCcw className="size-3.5" aria-hidden />
                            <span className="hidden sm:inline">Undo</span>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function statusVariant(
  status: ImportHistoryView['status'],
): 'success' | 'warning' | 'danger' | 'secondary' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'partial':
      return 'warning';
    case 'rolled_back':
      return 'secondary';
    default:
      return 'danger';
  }
}

function UploadZone({
  dragging,
  previewing,
  onDragOver,
  onDragLeave,
  onDrop,
  onBrowse,
  inputRef,
  onFile,
}: {
  dragging: boolean;
  previewing: boolean;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onBrowse: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onBrowse}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onBrowse();
      }}
      aria-label="Upload a CSV file"
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors sm:p-10',
        dragging
          ? 'border-indigo-500 bg-indigo-500/5'
          : 'border-border bg-card/50 hover:border-indigo-500/50 hover:bg-card',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
      {previewing ? (
        <>
          <Loader2 className="size-8 animate-spin text-indigo-500" aria-hidden />
          <p className="text-sm font-medium text-foreground">Analyzing your file…</p>
          <p className="text-xs text-muted-foreground">
            Validating rows, resolving departments & managers, and checking duplicates.
          </p>
        </>
      ) : (
        <>
          <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 to-cyan-500/15">
            <CloudUpload className="size-6 text-indigo-500 dark:text-indigo-300" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Drop your CSV here, or click to browse
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              You&apos;ll review a preview before anything is imported · employee or hiring-pipeline
              files are auto-detected
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function StagingPanel({
  preview,
  duplicateStrategy,
  onStrategyChange,
  label,
  onLabelChange,
  uploading,
  progress,
  onConfirm,
  onDiscard,
}: {
  preview: ImportPreview;
  duplicateStrategy: DuplicateStrategy;
  onStrategyChange: (s: DuplicateStrategy) => void;
  label: string;
  onLabelChange: (s: string) => void;
  uploading: boolean;
  progress: number;
  onConfirm: () => void;
  onDiscard: () => void;
}) {
  const { columnMatch } = preview;
  const allMatched = columnMatch.matched === columnMatch.total;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-1 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileSpreadsheet className="size-4 text-indigo-500" aria-hidden />
            {preview.fileName}
            <Badge variant={preview.type === 'hiring' ? 'secondary' : 'info'}>
              {preview.type === 'hiring' ? 'Hiring pipeline' : 'Employees'}
            </Badge>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Preview only — no data has been written yet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={uploading} onClick={onDiscard}>
            Choose a different file
          </Button>
          <Button size="sm" disabled={uploading} onClick={onConfirm}>
            {uploading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden /> Importing… {progress}%
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" aria-hidden />
                Import {formatNumber(preview.validRows)} record
                {preview.validRows === 1 ? '' : 's'}
              </>
            )}
          </Button>
        </div>
      </div>

      {uploading ? (
        <CardContent className="space-y-2 p-6">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Writing {formatNumber(preview.validRows)} validated records…
          </p>
        </CardContent>
      ) : (
        <CardContent className="space-y-5 p-4 sm:p-6">
          {/* Counts */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <CountChip
              label="Total rows"
              value={formatNumber(preview.totalRows)}
              className="text-foreground"
            />
            <CountChip
              label="Ready to import"
              value={formatNumber(preview.validRows)}
              className="text-emerald-500"
              icon={<CheckCircle2 className="size-4 text-emerald-500" aria-hidden />}
            />
            <CountChip
              label="Duplicates"
              value={formatNumber(preview.duplicateCount)}
              className="text-amber-500"
              icon={<AlertTriangle className="size-4 text-amber-500" aria-hidden />}
            />
            <CountChip
              label="Invalid rows"
              value={formatNumber(preview.invalidRows)}
              className="text-rose-500"
              icon={<XCircle className="size-4 text-rose-500" aria-hidden />}
            />
          </div>

          {/* Column match */}
          <div
            className={cn(
              'flex flex-col gap-1 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between',
              allMatched
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-amber-500/30 bg-amber-500/5',
            )}
          >
            <p className="flex items-center gap-2 text-sm text-foreground">
              {allMatched ? (
                <CheckCircle2 className="size-4 text-emerald-500" aria-hidden />
              ) : (
                <AlertTriangle className="size-4 text-amber-500" aria-hidden />
              )}
              Matched {columnMatch.matched}/{columnMatch.total} columns
              {columnMatch.aliased.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  · auto-mapped: {columnMatch.aliased.join(', ')}
                </span>
              )}
            </p>
            {!allMatched && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Missing: {columnMatch.missing.join(', ')}
              </p>
            )}
          </div>

          {/* Preview rows */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Preview
              {preview.totalRows > preview.previewRows.length
                ? ` — first ${preview.previewRows.length} of ${preview.totalRows} rows`
                : ''}
            </p>
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Row</TableHead>
                    <TableHead>Employee / Requisition</TableHead>
                    <TableHead className="hidden md:table-cell">Department</TableHead>
                    <TableHead className="hidden lg:table-cell">Team</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.previewRows.map((row) => (
                    <PreviewRow key={row.row} row={row} type={preview.type} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Options */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Duplicate strategy
              </p>
              <div className="space-y-2">
                {STRATEGIES.map((strategy) => (
                  <label
                    key={strategy.value}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                      duplicateStrategy === strategy.value
                        ? 'border-indigo-500 bg-indigo-500/5'
                        : 'border-border hover:bg-muted/40',
                    )}
                  >
                    <input
                      type="radio"
                      name="duplicateStrategy"
                      className="mt-1 size-4 accent-indigo-500"
                      checked={duplicateStrategy === strategy.value}
                      onChange={() => onStrategyChange(strategy.value)}
                    />
                    <span>
                      <span className="block text-sm font-medium text-foreground">
                        {strategy.title}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {strategy.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Batch label (optional)
                </p>
                <Input
                  value={label}
                  onChange={(e) => onLabelChange(e.target.value)}
                  maxLength={80}
                  placeholder="e.g. Q3 New Hires"
                  className="max-w-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Shown in import history so batches are easy to find.
                </p>
              </div>
              {preview.managersProvisioned > 0 ? (
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3 text-xs text-cyan-600 dark:text-cyan-400">
                  <FlaskConical className="mr-1 inline size-3.5" aria-hidden />
                  {preview.managersProvisioned} manager
                  {preview.managersProvisioned === 1 ? '' : 's'} referenced in this file will be
                  auto-created so every row can import.
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function CountChip({
  label,
  value,
  className,
  icon,
}: {
  label: string;
  value: string;
  className: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 flex items-center gap-1.5 font-display text-xl font-semibold',
          className,
        )}
      >
        {icon}
        {value}
      </p>
    </div>
  );
}

function PreviewRow({ row, type }: { row: ImportPreviewRow; type: ImportPreview['type'] }) {
  const invalid = row.status === 'invalid';
  return (
    <TableRow className={invalid ? 'bg-rose-500/5' : undefined}>
      <TableCell className="font-mono text-xs text-muted-foreground">{row.row}</TableCell>
      <TableCell>
        <p className="text-sm font-medium text-foreground">
          {row.name ?? (type === 'hiring' ? row.employeeCode : '—')}
        </p>
        <p className="text-xs text-muted-foreground">
          {row.employeeCode ?? ''}
          {row.email ? ` · ${row.email}` : ''}
        </p>
        {invalid && row.errors.length > 0 ? (
          <ul className="mt-1 space-y-0.5">
            {row.errors.map((message, i) => (
              <li key={i} className="flex items-start gap-1 text-xs text-rose-500">
                <XCircle className="mt-0.5 size-3 shrink-0" aria-hidden />
                {message}
              </li>
            ))}
          </ul>
        ) : null}
      </TableCell>
      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
        {row.department ?? '—'}
      </TableCell>
      <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
        {row.team ?? '—'}
      </TableCell>
      <TableCell>
        <Badge variant={invalid ? 'danger' : 'success'}>{invalid ? 'Invalid' : 'Ready'}</Badge>
      </TableCell>
    </TableRow>
  );
}

function ResultSummary({ result }: { result: ImportHistoryView }) {
  return (
    <Card className="mt-6 overflow-hidden">
      <div className="flex flex-col gap-1 border-b bg-emerald-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CheckCircle2 className="size-4 text-emerald-500" aria-hidden />
          Import {result.status === 'failed' ? 'rejected' : 'complete'} — {result.fileName}
        </p>
        <p className="text-xs text-muted-foreground">
          {result.totalRows} rows in {formatDuration(result.durationMs)} ·{' '}
          {result.type === 'hiring' ? 'hiring pipeline' : 'employees'}
        </p>
      </div>
      <CardContent className="grid grid-cols-2 gap-4 p-4 lg:grid-cols-4">
        <ResultCard
          label="Added"
          value={formatNumber(result.successCount)}
          tone="text-emerald-500"
          icon={<CheckCircle2 className="size-4 text-emerald-500" aria-hidden />}
        />
        <ResultCard
          label="Updated"
          value={formatNumber(result.updatedCount ?? 0)}
          tone="text-cyan-500"
          icon={<RotateCcw className="size-4 text-cyan-500" aria-hidden />}
        />
        <ResultCard
          label="Duplicates"
          value={formatNumber(result.duplicateCount)}
          tone="text-amber-500"
          icon={<AlertTriangle className="size-4 text-amber-500" aria-hidden />}
        />
        <ResultCard
          label="Failed"
          value={formatNumber(result.failedCount)}
          tone="text-rose-500"
          icon={<XCircle className="size-4 text-rose-500" aria-hidden />}
        />
      </CardContent>
    </Card>
  );
}

function ResultCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-1 flex items-center gap-1.5 font-display text-2xl font-semibold', tone)}>
        {icon}
        {value}
      </p>
    </div>
  );
}

function ErrorReportTable({ report }: { report: ImportRowError[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Row</TableHead>
          <TableHead>Employee</TableHead>
          <TableHead>Errors</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.map((row, index) => (
          <TableRow key={index}>
            <TableCell className="font-mono text-xs text-muted-foreground">{row.row}</TableCell>
            <TableCell className="text-sm text-foreground">
              {row.employeeCode ?? row.email ?? '—'}
            </TableCell>
            <TableCell>
              <ul className="space-y-1">
                {row.errors.map((message, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-rose-500">
                    <XCircle className="mt-0.5 size-3 shrink-0" aria-hidden />
                    {message}
                  </li>
                ))}
              </ul>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
