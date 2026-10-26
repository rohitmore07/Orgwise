'use client';

import type { OrgHierarchy, OrgHierarchyNode } from '@orgwise/types';
import { Building2, ChevronDown, ChevronRight, FolderTree, Search, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { STATUS_LABELS, STATUS_VARIANTS } from '@/lib/format';
import { cn } from '@/lib/utils';

interface OrgChartProps {
  data: OrgHierarchy | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Current search input (filtering happens server-side via the hierarchy API). */
  query: string;
  onQueryChange: (query: string) => void;
}
// Organization hierarchy — departments → teams → employees as an expandable tree. Built from one scoped API…
// response (no graph database, no per-node round trips); search is delegated to the backend (`?search=`) so the
// full dataset is never shipped to or filtered by the client.
export function OrgChart({ data, loading, error, onRetry, query, onQueryChange }: OrgChartProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // The tree arrives already pruned to matches when searching.
  const tree = data?.nodes ?? [];
  const searching = query.trim().length > 0;

  const toggle = (id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => {
    if (!data) return;
    const ids = new Set<string>();
    const collect = (nodes: OrgHierarchyNode[]) =>
      nodes.forEach((node) => {
        if (node.children.length > 0) ids.add(node.id);
        collect(node.children);
      });
    collect(data.nodes);
    setCollapsed(ids);
  };

  if (loading) {
    return (
      <div aria-busy="true" aria-label="Loading organization hierarchy" className="space-y-2 p-2">
        {[0, 1, 2, 3, 4].map((depth) => (
          <div key={depth} className="flex items-center gap-2">
            <Skeleton className="size-4 rounded" />
            <Skeleton
              className="h-4 rounded"
              style={{ width: `${Math.max(30, 70 - depth * 10)}%` }}
            />
          </div>
        ))}
      </div>
    );
  }
  if (error) return <ErrorState description={error} onRetry={onRetry} />;
  if (!data || data.nodes.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="No organization structure yet"
        description="Departments and teams will appear here once the organization is set up."
        action={
          <Button size="sm" variant="outline" asChild>
            <Link href="/imports">Import employee data</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search employees…"
            className="pl-9"
            aria-label="Search employees in the organization"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={expandAll}
            className="rounded-md border border-border px-2.5 py-1.5 font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="rounded-md border border-border px-2.5 py-1.5 font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Collapse all
          </button>
          <span className="ml-1 text-muted-foreground/70">
            {data.totalEmployees} {searching ? 'matching' : ''} employees
          </span>
        </div>
      </div>

      {searching && data.nodes.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="No matching employees"
          description="Try a different name or job title."
        />
      ) : (
        <div className="rounded-2xl border border-border bg-card/50 p-4">
          <ul className="space-y-0.5">
            {tree.map((node) => (
              <OrgNodeRow
                key={node.id}
                node={node}
                depth={0}
                collapsed={collapsed}
                onToggle={toggle}
                searchTerm={searching ? query.trim().toLowerCase() : ''}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function OrgNodeRow({
  node,
  depth,
  collapsed,
  onToggle,
  searchTerm,
}: {
  node: OrgHierarchyNode;
  depth: number;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  searchTerm: string;
}) {
  const hasChildren = node.children.length > 0;
  // While searching, ignore the collapsed set so matches are never hidden
  // behind a collapsed parent (the tree is already pruned to matches).
  const isCollapsed = !searchTerm && collapsed.has(node.id);
  const employee = node.employee;

  // Highlight search matches.
  const matches =
    searchTerm &&
    (employee
      ? `${employee.firstName} ${employee.lastName} ${employee.jobTitle}`
          .toLowerCase()
          .includes(searchTerm)
      : node.name.toLowerCase().includes(searchTerm));

  return (
    <li>
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/60',
          matches && 'bg-primary/5 ring-1 ring-primary/20',
        )}
        style={{ paddingLeft: `${depth * 22 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? `Expand ${node.name}` : `Collapse ${node.name}`}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isCollapsed ? (
              <ChevronRight className="size-4" aria-hidden />
            ) : (
              <ChevronDown className="size-4" aria-hidden />
            )}
          </button>
        ) : (
          <span className="w-[18px] shrink-0" aria-hidden />
        )}

        {node.type === 'department' ? (
          <Building2 className="size-4 shrink-0 text-indigo-500 dark:text-indigo-300" aria-hidden />
        ) : node.type === 'team' ? (
          <FolderTree className="size-4 shrink-0 text-cyan-500 dark:text-cyan-300" aria-hidden />
        ) : (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 text-[9px] font-bold text-indigo-500 dark:text-indigo-300">
            {initials(node.name)}
          </span>
        )}

        {employee ? (
          <Link
            href={`/employees/${employee.id}`}
            className="group flex min-w-0 flex-1 items-center gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
              {node.name}
            </span>
            <span className="truncate text-xs text-muted-foreground">{node.subtitle}</span>
            <Badge variant={STATUS_VARIANTS[employee.status]} className="ml-auto shrink-0">
              {STATUS_LABELS[employee.status]}
            </Badge>
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={cn(
                'truncate text-sm font-semibold',
                node.type === 'department' ? 'text-foreground' : 'text-foreground/90',
              )}
            >
              {node.name}
            </span>
            {node.type !== 'employee' ? (
              <Badge variant="outline" className="ml-auto shrink-0">
                {countEmployees(node)}
              </Badge>
            ) : null}
          </div>
        )}
      </div>

      {hasChildren && !isCollapsed ? (
        <ul className="space-y-0.5">
          {node.children.map((child) => (
            <OrgNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              collapsed={collapsed}
              onToggle={onToggle}
              searchTerm={searchTerm}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function countEmployees(node: OrgHierarchyNode): number {
  let count = node.employee ? 1 : 0;
  for (const child of node.children) count += countEmployees(child);
  return count;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
