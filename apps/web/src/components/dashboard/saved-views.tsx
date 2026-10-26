'use client';

import type { DashboardFilters } from '@orgwise/types';
import { Bookmark, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { filtersKey, filtersToQuery, queryToFilters } from '@/lib/analytics-filters';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'orgwise_saved_views';

interface SavedView {
  id: string;
  name: string;
  query: string;
  createdAt: number;
}

type FilterSetter = (
  key: keyof DashboardFilters,
  value: string | number | boolean | undefined,
) => void;

interface SavedViewsProps {
  filters: DashboardFilters;
  setFilter: FilterSetter;
  resetFilters: () => void;
  activeCount: number;
}

/** Named, persistent filter sets shown as chips above the global filters. */
export function SavedViews({ filters, setFilter, resetFilters, activeCount }: SavedViewsProps) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setViews(raw ? (JSON.parse(raw) as SavedView[]) : []);
    } catch {
      setViews([]);
    }
  }, []);

  const persist = (next: SavedView[]) => {
    setViews(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const currentKey = useMemo(() => filtersKey(filters), [filters]);

  const applyView = (view: SavedView) => {
    const parsed = queryToFilters(view.query);
    if (Object.keys(parsed).length === 0) {
      resetFilters();
      return;
    }
    Object.entries(parsed).forEach(([key, value]) =>
      setFilter(key as keyof DashboardFilters, value as string | number | boolean | undefined),
    );
  };

  const saveView = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    persist([
      ...views,
      {
        id: `${Date.now()}`,
        name: trimmed,
        query: filtersToQuery(filters).toString(),
        createdAt: Date.now(),
      },
    ]);
    setName('');
    setSaveOpen(false);
  };

  const deleteView = (id: string) => {
    persist(views.filter((view) => view.id !== id));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {views.length > 0 ? (
        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Bookmark className="size-3.5" aria-hidden />
          Saved views
        </span>
      ) : null}
      {views.map((view) => {
        const isActive = currentKey === view.query;
        return (
          <span
            key={view.id}
            className={cn(
              'group inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              isActive
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
            )}
          >
            <button
              type="button"
              onClick={() => applyView(view)}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
            >
              {view.name}
            </button>
            <button
              type="button"
              onClick={() => deleteView(view.id)}
              aria-label={`Delete saved view ${view.name}`}
              className="rounded-full p-0.5 text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        );
      })}
      {activeCount > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 rounded-full text-xs"
          onClick={() => setSaveOpen(true)}
        >
          <Plus className="size-3.5" aria-hidden />
          Save view
        </Button>
      ) : null}

      <Dialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title="Save current filters"
        description="Give this filter combination a name so you can return to it anytime."
        size="sm"
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Q3 Sales review"
          aria-label="Saved view name"
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveView();
          }}
          autoFocus
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setSaveOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={saveView} disabled={!name.trim()}>
            Save view
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
