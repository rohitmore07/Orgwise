'use client';

import type { EmployeeView } from '@orgwise/types';
import {
  Building2,
  FileSpreadsheet,
  LayoutDashboard,
  Plus,
  ScrollText,
  Search,
  ShieldCheck,
  Users as UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { fullName } from '@/lib/format';
import { cn } from '@/lib/utils';

interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  href: string;
  keywords?: string;
  /** Roles that may see this item; undefined = everyone. */
  roles?: Array<'admin' | 'manager' | 'viewer'>;
}

interface PaletteGroup {
  label: string;
  items: PaletteItem[];
}

/** Navigation destinations, role-gated the same way as the sidebar. */
const NAV_ITEMS: PaletteItem[] = [
  {
    id: 'nav-dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
    roles: ['admin', 'manager', 'viewer'],
  },
  {
    id: 'nav-employees',
    label: 'Employees',
    icon: UsersIcon,
    href: '/employees',
    keywords: 'people headcount hire',
    roles: ['admin', 'manager', 'viewer'],
  },
  {
    id: 'nav-departments',
    label: 'Departments',
    icon: Building2,
    href: '/departments',
    keywords: 'org units structure',
    roles: ['admin', 'manager', 'viewer'],
  },
  {
    id: 'nav-teams',
    label: 'Teams',
    icon: Building2,
    href: '/teams',
    keywords: 'squads pods',
    roles: ['admin', 'manager', 'viewer'],
  },
  {
    id: 'nav-imports',
    label: 'CSV Import',
    icon: FileSpreadsheet,
    href: '/imports',
    keywords: 'bulk upload onboarding',
    roles: ['admin', 'manager'],
  },
  {
    id: 'nav-users',
    label: 'Users & Roles',
    icon: ShieldCheck,
    href: '/users',
    keywords: 'access rbac permissions',
    roles: ['admin'],
  },
  {
    id: 'nav-audit',
    label: 'Audit Log',
    icon: ScrollText,
    href: '/audit-logs',
    keywords: 'history trail activity',
    roles: ['admin'],
  },
];

/** Write-gated shortcuts for common creation flows. */
const ACTION_ITEMS: PaletteItem[] = [
  {
    id: 'act-employee',
    label: 'Add employee',
    hint: 'New profile',
    icon: Plus,
    href: '/employees',
    keywords: 'create new hire person',
  },
  {
    id: 'act-import',
    label: 'Import employees from CSV',
    hint: 'Bulk upload',
    icon: FileSpreadsheet,
    href: '/imports',
    keywords: 'bulk upload rows',
  },
  {
    id: 'act-department',
    label: 'Create department',
    hint: 'Org structure',
    icon: Building2,
    href: '/departments',
    keywords: 'new org unit',
  },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { role } = useAuth();
  const canWrite = role === 'admin' || role === 'manager';

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [employees, setEmployees] = useState<EmployeeView[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebouncedValue(query, 250);

  // Toggle with ⌘K / Ctrl+K anywhere in the app.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  // Focus the input on open; clear state + restore focus on close.
  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    setSelected(0);
    setEmployees([]);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => inputRef.current?.focus());
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      previouslyFocused?.focus();
    };
  }, [open]);

  // Live employee search — only when the palette is open and the user typed.
  useEffect(() => {
    if (!open || !debouncedQuery.trim()) {
      setEmployees([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    api
      .get<{ items: EmployeeView[] }>(
        `/employees?search=${encodeURIComponent(debouncedQuery)}&pageSize=6`,
      )
      .then((result) => {
        if (!cancelled) setEmployees(result.items);
      })
      .catch(() => {
        if (!cancelled) setEmployees([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, debouncedQuery]);

  const groups = useMemo<PaletteGroup[]>(() => {
    const navigate: PaletteItem[] = NAV_ITEMS.filter(
      (item) => !item.roles || (role && item.roles.includes(role)),
    );
    const actions: PaletteItem[] = canWrite ? ACTION_ITEMS : [];
    const people: PaletteItem[] = employees.map((employee) => ({
      id: `emp-${employee.id}`,
      label: fullName(employee.firstName, employee.lastName),
      hint: `${employee.jobTitle}${employee.department ? ` · ${employee.department.name}` : ''}`,
      icon: UsersIcon,
      href: `/employees/${employee.id}`,
      keywords: `${employee.email} ${employee.employeeCode}`,
    }));

    const filtered = (items: PaletteItem[]) => {
      const term = query.trim().toLowerCase();
      if (!term) return items;
      return items.filter(
        (item) =>
          item.label.toLowerCase().includes(term) ||
          item.hint?.toLowerCase().includes(term) ||
          item.keywords?.toLowerCase().includes(term),
      );
    };

    return [
      { label: 'Quick actions', items: filtered(actions) },
      { label: 'Navigate', items: filtered(navigate) },
      ...(query.trim() ? [{ label: 'People', items: people }] : []),
    ].filter((group) => group.items.length > 0);
  }, [role, canWrite, query, employees]);

  const flatItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  // Keep the selection within bounds when the result set changes.
  useEffect(() => {
    setSelected((current) => Math.min(current, Math.max(flatItems.length - 1, 0)));
  }, [flatItems.length]);

  const goTo = useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [router, onOpenChange],
  );

  // Keyboard navigation: ↑/↓ move, Enter selects, Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelected((current) => Math.min(current + 1, flatItems.length - 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelected((current) => Math.max(current - 1, 0));
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const item = flatItems[selected];
        if (item) goTo(item.href);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, flatItems, selected, goTo, onOpenChange]);

  // Keep the highlighted row visible while scrolling.
  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
      onMouseDown={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="mx-auto mt-16 w-[min(42rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:mt-24"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border/60 px-4">
          {searching ? (
            <Search className="size-4 animate-pulse text-muted-foreground" aria-hidden />
          ) : (
            <Search className="size-4 text-muted-foreground" aria-hidden />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(0);
            }}
            placeholder="Search pages, people, or actions…"
            aria-label="Search"
            className="h-14 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
          />
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[24rem] overflow-y-auto p-2">
          {flatItems.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {query.trim() ? `No results for “${query.trim()}”` : 'Start typing to search…'}
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="mb-1">
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  const index = flatItems.indexOf(item);
                  const isActive = index === selected;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      data-active={isActive}
                      onClick={() => onOpenChange(false)}
                      onMouseMove={() => setSelected(index)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                        isActive ? 'bg-primary/10 text-primary' : 'text-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-7 shrink-0 items-center justify-center rounded-md',
                          isActive
                            ? 'bg-primary/15 text-primary'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <item.icon className="size-3.5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{item.label}</span>
                        {item.hint ? (
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {item.hint}
                          </span>
                        ) : null}
                      </span>
                      {isActive ? (
                        <kbd className="rounded border border-primary/20 bg-primary/10 px-1.5 font-mono text-[10px] text-primary">
                          ↵
                        </kbd>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 border-t border-border/60 bg-muted/30 px-4 py-2.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">
              ↑↓
            </kbd>{' '}
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">
              ↵
            </kbd>{' '}
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">
              esc
            </kbd>{' '}
            close
          </span>
          <span className="ml-auto hidden sm:block">
            {role ? (
              <span className="capitalize">
                {role === 'admin' ? 'Administrator' : role === 'manager' ? 'Manager' : 'Viewer'}{' '}
                workspace
              </span>
            ) : null}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Visible trigger button used in the topbars. */
export function CommandPaletteTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-9 items-center gap-2 rounded-lg border border-input bg-background/60 px-3 text-xs text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Open command palette"
    >
      <Search className="size-3.5" aria-hidden />
      <span className="hidden sm:inline">Search…</span>
      <kbd className="ml-1 hidden rounded border border-border bg-muted px-1 font-mono text-[10px] sm:inline">
        ⌘K
      </kbd>
    </button>
  );
}
