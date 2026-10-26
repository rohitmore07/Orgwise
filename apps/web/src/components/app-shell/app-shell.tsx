'use client';

import {
  BarChart3,
  Building2,
  ChevronRight,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  PanelLeft,
  PanelLeftClose,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Users as UsersIcon,
  X,
  type LucideIcon,
} from 'lucide-react';
import { CopilotDrawer } from '@/components/copilot/copilot-drawer';
import { CopilotProvider, useCopilot } from '@/components/copilot/copilot-context';
import { FloatingCopilotButton } from '@/components/copilot/floating-copilot-button';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/landing/logo';
import { ThemeToggle } from '@/components/landing/theme-toggle';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { CommandPalette, CommandPaletteTrigger } from './command-palette';
import { KeyboardShortcutsModal } from './keyboard-shortcuts-modal';
import { SignOutConfirmDialog } from './sign-out-confirm-dialog';
import { NotificationsButton } from '@/components/notifications/notifications-button';
import { UserMenu } from './user-menu';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Roles that may see this item. */
  roles: Array<'admin' | 'manager' | 'viewer'>;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const DASHBOARD_ITEM: NavItem = {
  href: '/dashboard',
  label: 'Dashboard',
  icon: LayoutDashboard,
  roles: ['admin', 'manager', 'viewer'],
};
const EMPLOYEES_ITEM: NavItem = {
  href: '/employees',
  label: 'Employees',
  icon: UsersIcon,
  roles: ['admin', 'manager', 'viewer'],
};
const DEPARTMENTS_ITEM: NavItem = {
  href: '/departments',
  label: 'Departments',
  icon: Building2,
  roles: ['admin', 'manager', 'viewer'],
};
const TEAMS_ITEM: NavItem = {
  href: '/teams',
  label: 'Teams',
  icon: BarChart3,
  roles: ['admin', 'manager', 'viewer'],
};
const ORG_ITEM: NavItem = {
  href: '/organization',
  label: 'Org Chart',
  icon: Network,
  roles: ['admin', 'manager', 'viewer'],
};
const IMPORTS_ITEM: NavItem = {
  href: '/imports',
  label: 'CSV Import',
  icon: FileSpreadsheet,
  roles: ['admin', 'manager'],
};
const AUDIT_ITEM: NavItem = {
  href: '/audit-logs',
  label: 'Audit Log',
  icon: ScrollText,
  roles: ['admin'],
};
const USERS_ITEM: NavItem = {
  href: '/users',
  label: 'Users & Roles',
  icon: ShieldCheck,
  roles: ['admin'],
};
const SETTINGS_ITEM: NavItem = {
  href: '/settings',
  label: 'Settings',
  icon: Settings,
  roles: ['admin', 'manager', 'viewer'],
};

const NAV_SECTIONS: NavSection[] = [
  { label: 'Overview', items: [DASHBOARD_ITEM] },
  { label: 'Workforce', items: [EMPLOYEES_ITEM, DEPARTMENTS_ITEM, TEAMS_ITEM, ORG_ITEM] },
  { label: 'Operations', items: [IMPORTS_ITEM, AUDIT_ITEM] },
  { label: 'System', items: [USERS_ITEM, SETTINGS_ITEM] },
];

/** Page label per top-level route, used for breadcrumbs. */
const BREADCRUMB_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  employees: 'Employees',
  departments: 'Departments',
  teams: 'Teams',
  organization: 'Org Chart',
  imports: 'CSV Import',
  users: 'Users & Roles',
  'audit-logs': 'Audit Log',
  settings: 'Settings',
};

/** Generic label for second-level routes (e.g. employee/team details). */
const DETAIL_LABELS: Record<string, string> = {
  employees: 'Employee profile',
  teams: 'Team details',
};

const SECTION_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  employees: 'Employees',
  departments: 'Departments',
  teams: 'Teams',
  imports: 'CSV Import',
  organization: 'Organization Chart',
  users: 'Users & Roles',
  'audit-logs': 'Audit Log',
  settings: 'Settings',
};

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  viewer: 'Viewer',
};

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <CopilotProvider>
      <AppShellInner>{children}</AppShellInner>
      <FloatingCopilotButton />
      <CopilotDrawer />
      <KeyboardShortcutsModal />
    </CopilotProvider>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, profile, initializing, profileError, refreshProfile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Load saved sidebar state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('orgwise_sidebar_collapsed');
    if (stored !== null) {
      setIsCollapsed(stored === 'true');
    }
  }, []);
  // Track small screens so the mobile drawer is ALWAYS expanded: the desktop collapsed state is a pointer-driven…
  // convenience and must never produce an icon-only strip in the touch drawer.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsMobile(!mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const effectiveCollapsed = isMobile ? false : isCollapsed;

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('orgwise_sidebar_collapsed', String(next));
      return next;
    });
  };

  // Keyboard shortcut Ctrl+B / Cmd+B to toggle sidebar collapse state on desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isMobile) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        const target = e.target as HTMLElement;
        if (
          target &&
          (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        toggleCollapsed();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile]);

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Keep the browser tab in sync with the current section.
  useEffect(() => {
    const segment = pathname.split('/').filter(Boolean)[0];
    const section = segment ? (SECTION_TITLES[segment] ?? null) : null;
    document.title = section ? `${section} · orgwise` : 'orgwise';
  }, [pathname]);

  const { setOpen: setCopilotOpen } = useCopilot();
  // Workspace shortcuts: `/` opens search, `g` then a key navigates sections,
  // `a` opens the copilot. Never fires while typing in a field.
  useEffect(() => {
    let gPressed = false;
    const isTyping = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return Boolean(
        el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable),
      );
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (key === 'a' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setCopilotOpen(true);
        return;
      }
      if (key === 'g') {
        gPressed = true;
        return;
      }
      if (!gPressed) return;
      gPressed = false;
      const routes: Record<string, string> = {
        d: '/dashboard',
        e: '/employees',
        i: '/imports',
        o: '/organization',
        t: '/teams',
        c: '/departments',
      };
      const href = routes[key];
      if (href) router.push(href);
    };
    const reset = () => {
      gPressed = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', reset);
    };
  }, [router, setCopilotOpen, setPaletteOpen]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile topbar */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/60 bg-background/90 px-4 backdrop-blur-md lg:hidden">
        <Link href="/dashboard" aria-label="orgwise dashboard">
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search (command palette)"
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Search className="size-5" aria-hidden />
          </button>
          <ThemeToggle />
          <NotificationsButton />
          <UserMenu />
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-expanded={sidebarOpen}
            aria-label="Toggle navigation"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {sidebarOpen ? (
              <X className="size-5" aria-hidden />
            ) : (
              <Menu className="size-5" aria-hidden />
            )}
          </button>
        </div>
      </div>

      <div
        className={cn(
          'grid transition-[grid-template-columns] duration-300 ease-in-out',
          effectiveCollapsed ? 'lg:grid-cols-[4.5rem_1fr]' : 'lg:grid-cols-[16rem_1fr]',
        )}
      >
        {/* Sidebar */}
        <aside
          data-tour="sidebar"
          className={cn(
            'fixed inset-y-0 left-0 z-50 border-r border-border/60 bg-card/60 backdrop-blur-xl transition-all duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:bg-transparent',
            effectiveCollapsed ? 'w-[4.5rem]' : 'w-64',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          )}
        >
          <div className="flex h-full flex-col">
            {/* Sidebar header */}
            <div
              className={cn(
                'flex h-14 items-center border-b border-border/60 transition-all duration-300',
                effectiveCollapsed ? 'justify-center px-2' : 'justify-between px-5',
              )}
            >
              <Tooltip
                content={effectiveCollapsed ? 'Expand sidebar' : undefined}
                shortcut="Ctrl B"
                side="right"
                disabled={!effectiveCollapsed}
              >
                <Link
                  href="/dashboard"
                  aria-label="orgwise dashboard"
                  className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Logo showText={!effectiveCollapsed} />
                </Link>
              </Tooltip>

              {/* Desktop toggle button in sidebar header (visible when expanded) */}
              {!effectiveCollapsed ? (
                <div className="hidden lg:flex items-center">
                  <Tooltip content="Collapse sidebar" shortcut="Ctrl B" side="right">
                    <button
                      type="button"
                      onClick={toggleCollapsed}
                      aria-label="Collapse sidebar"
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                    >
                      <PanelLeftClose className="size-4.5" aria-hidden />
                    </button>
                  </Tooltip>
                </div>
              ) : null}

              {/* Mobile close button */}
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close navigation"
                className="rounded-md p-1 text-muted-foreground hover:text-foreground lg:hidden"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            {/* Navigation links */}
            <nav
              className={cn(
                'flex-1 space-y-4 overflow-y-auto py-4 transition-all duration-300',
                effectiveCollapsed ? 'px-2' : 'px-3',
              )}
              aria-label="Main navigation"
            >
              {NAV_SECTIONS.map((section, sectionIdx) => {
                const visibleItems = section.items.filter(
                  (item) => role && item.roles.includes(role),
                );
                if (visibleItems.length === 0) return null;
                return (
                  <div key={section.label}>
                    {!effectiveCollapsed ? (
                      <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                        {section.label}
                      </p>
                    ) : sectionIdx > 0 ? (
                      <div className="my-2.5 mx-2 border-t border-border/40" />
                    ) : null}

                    <div className="space-y-1">
                      {visibleItems.map((item) => {
                        const isActive =
                          pathname === item.href || pathname.startsWith(`${item.href}/`);

                        const linkNode = (
                          <Link
                            key={item.href}
                            href={item.href}
                            data-tour={item.href === '/imports' ? 'imports-link' : undefined}
                            aria-current={isActive ? 'page' : undefined}
                            className={cn(
                              'relative flex items-center rounded-xl font-medium transition-all duration-200',
                              effectiveCollapsed
                                ? 'size-10 justify-center mx-auto'
                                : 'gap-2.5 px-3 py-2 text-sm',
                              isActive
                                ? 'bg-primary/10 text-primary font-semibold shadow-xs'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                          >
                            {isActive ? (
                              <span
                                className={cn(
                                  'absolute rounded-full bg-primary',
                                  effectiveCollapsed
                                    ? '-left-1 top-1/2 h-5 w-1 -translate-y-1/2'
                                    : 'left-0 top-1/2 h-5 w-0.5 -translate-y-1/2',
                                )}
                                aria-hidden
                              />
                            ) : null}
                            <item.icon className="size-4.5 shrink-0" aria-hidden />
                            {!effectiveCollapsed ? (
                              <span className="truncate">{item.label}</span>
                            ) : null}
                          </Link>
                        );

                        if (effectiveCollapsed) {
                          return (
                            <div key={item.href} className="flex justify-center">
                              <Tooltip content={item.label} side="right">
                                {linkNode}
                              </Tooltip>
                            </div>
                          );
                        }

                        return linkNode;
                      })}
                    </div>
                  </div>
                );
              })}
            </nav>

            {/* Sidebar User Profile Footer */}
            <div
              className={cn(
                'border-t border-border/60 transition-all duration-300',
                effectiveCollapsed ? 'p-2' : 'p-3',
              )}
            >
              {initializing ? (
                <div
                  className={cn(
                    'animate-pulse rounded-lg bg-muted',
                    effectiveCollapsed ? 'size-10 mx-auto' : 'space-y-2 p-3',
                  )}
                >
                  {!effectiveCollapsed ? (
                    <>
                      <div className="h-3 w-24 rounded bg-muted-foreground/20" />
                      <div className="h-2.5 w-16 rounded bg-muted-foreground/15" />
                    </>
                  ) : null}
                </div>
              ) : profile ? (
                effectiveCollapsed ? (
                  <div className="flex flex-col items-center gap-2">
                    <Tooltip
                      content={`${profile.name || profile.email} (${ROLE_LABEL[profile.role] ?? profile.role})`}
                      side="right"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-xs font-bold text-white shadow-sm ring-1 ring-white/20 cursor-pointer">
                        {initials(profile.name || profile.email)}
                      </div>
                    </Tooltip>
                    <Tooltip content="Sign out" side="right">
                      <button
                        type="button"
                        onClick={() => setSignOutConfirmOpen(true)}
                        aria-label="Sign out of orgwise"
                        className="flex size-9 items-center justify-center rounded-lg border border-border text-destructive transition-colors hover:border-destructive/30 hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <LogOut className="size-4" aria-hidden />
                      </button>
                    </Tooltip>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 rounded-lg p-2">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-xs font-bold text-white">
                        {initials(profile.name || profile.email)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {profile.name}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {ROLE_LABEL[profile.role] ?? profile.role}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSignOutConfirmOpen(true)}
                      aria-label="Sign out of orgwise"
                      title="Sign out"
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-destructive transition-colors hover:border-destructive/30 hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <LogOut className="size-4" aria-hidden />
                      Sign out
                    </button>
                  </div>
                )
              ) : profileError ? (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-2 text-center">
                  {!effectiveCollapsed ? (
                    <>
                      <p className="text-[11px] leading-relaxed text-destructive">
                        {'Could not load profile'}
                      </p>
                      <button
                        type="button"
                        onClick={() => void refreshProfile()}
                        className="mt-2 w-full rounded-md border border-border px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted"
                      >
                        Retry
                      </button>
                    </>
                  ) : (
                    <Tooltip content="Retry loading profile" side="right">
                      <button
                        type="button"
                        onClick={() => void refreshProfile()}
                        className="p-1 text-xs text-destructive hover:underline"
                      >
                        !
                      </button>
                    </Tooltip>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        {/* Main column */}
        <div className="min-w-0">
          <header className="sticky top-0 z-30 hidden h-14 items-center justify-between border-b border-border/60 bg-background/85 px-6 backdrop-blur-md lg:flex">
            <div className="flex items-center gap-3 min-w-0">
              <Tooltip
                content={effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                shortcut="Ctrl B"
                side="bottom"
              >
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  aria-label={effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                >
                  <PanelLeft className="size-4.5" aria-hidden />
                </button>
              </Tooltip>
              <Breadcrumbs pathname={pathname} />
            </div>
            <div className="flex items-center gap-2">
              <CommandPaletteTrigger onOpen={() => setPaletteOpen(true)} />
              <NotificationsButton />
              <ThemeToggle />
              <UserMenu />
            </div>
          </header>

          <main
            key={pathname}
            className="page-enter mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
          >
            {children}
          </main>
        </div>
      </div>

      {/* Backdrop for the mobile drawer */}
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      ) : null}

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <SignOutConfirmDialog
        open={signOutConfirmOpen}
        onOpenChange={setSignOutConfirmOpen}
        onConfirm={handleSignOut}
        userName={profile?.name || profile?.email}
      />
    </div>
  );
}

/** Breadcrumb trail for the desktop topbar: Home / Section / (Detail). */
function Breadcrumbs({ pathname }: { pathname: string }) {
  const segments = pathname.split('/').filter(Boolean);
  const section = segments[0];
  const detail = segments[1];
  const sectionLabel = section ? (BREADCRUMB_LABELS[section] ?? titleCase(section)) : 'Home';

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
      <Link
        href="/dashboard"
        className="truncate text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      >
        Home
      </Link>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
      <Link
        href={section ? `/${section}` : '/dashboard'}
        aria-current={detail ? undefined : 'page'}
        className={cn(
          'truncate font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded',
          detail ? 'text-muted-foreground hover:text-foreground' : 'text-foreground',
        )}
      >
        {sectionLabel}
      </Link>
      {detail ? (
        <>
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
          <span aria-current="page" className="truncate text-foreground">
            {section ? (DETAIL_LABELS[section] ?? titleCase(detail)) : titleCase(detail)}
          </span>
        </>
      ) : null}
    </nav>
  );
}

function titleCase(value: string): string {
  return value
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
