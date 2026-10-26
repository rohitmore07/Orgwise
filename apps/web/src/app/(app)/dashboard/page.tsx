'use client';

import type {
  AnalyticsOverview,
  DepartmentComparison,
  FilterOptions,
  Role,
} from '@orgwise/types';
import {
  Building2,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  ScrollText,
  Sparkles,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/app-shell/page-header';
import { AnalyticsFilters } from '@/components/dashboard/analytics-filters';
import { AnalyticsKpis } from '@/components/dashboard/analytics-kpis';
import { AskCopilotCard } from '@/components/dashboard/ask-copilot-card';
import { AttritionSection } from '@/components/dashboard/attrition-section';
import { CompareSection } from '@/components/dashboard/compare-section';
import { CompositionSection } from '@/components/dashboard/composition-section';
import { DataQualityCard } from '@/components/dashboard/data-quality-card';
import { EngagementSection } from '@/components/dashboard/engagement-section';
import { PeriodComparison } from '@/components/dashboard/period-comparison';
import { TalentSection } from '@/components/dashboard/talent-section';
import { ExecutiveSummaryCard } from '@/components/dashboard/executive-summary';
import { InsightsSection } from '@/components/dashboard/insights-section';
import { SavedViews } from '@/components/dashboard/saved-views';
import { OnboardingTour } from '@/components/onboarding/onboarding-tour';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalyticsFilters } from '@/hooks/use-analytics-filters';
import { useAsync } from '@/hooks/use-async';
import { api, purgeApiCache } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatRelative } from '@/lib/format';
import { filtersToQuery } from '@/lib/analytics-filters';

const WELCOME_DISMISS_KEY = 'orgwise_welcome_dismissed';

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'retention', label: 'Retention & Attrition' },
  { id: 'engagement', label: 'Engagement & Culture' },
  { id: 'talent', label: 'Talent & Hiring' },
  { id: 'composition', label: 'Composition' },
  { id: 'compare', label: 'Compare' },
  { id: 'insights', label: 'Insights' },
  { id: 'health', label: 'Data health' },
] as const;

export default function DashboardPage() {
  const { role, profile } = useAuth();
  const { filters, setFilter, resetFilters, activeCount, hydrated } = useAnalyticsFilters();
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  // The welcome card is a first-run hint for accounts with no linked employee
  // profile; the dismissal is per-tab-session so it returns on the next login.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(WELCOME_DISMISS_KEY)) setWelcomeDismissed(true);
    } catch {
      // sessionStorage unavailable (private mode) — the card just stays visible.
    }
  }, []);

  const dismissWelcome = () => {
    setWelcomeDismissed(true);
    try {
      sessionStorage.setItem(WELCOME_DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  };

  const query = useMemo(() => filtersToQuery(filters).toString(), [filters]);

  const {
    data: overview,
    loading,
    error,
    refetch,
  } = useAsync<AnalyticsOverview | null>(
    () =>
      hydrated ? api.get(`/analytics/overview${query ? `?${query}` : ''}`) : Promise.resolve(null),
    [query, hydrated],
  );

  const { data: filterOptions } = useAsync<FilterOptions | null>(
    () => api.get('/analytics/filters'),
    [],
  );

  // Track when the latest payload was fetched for the "Updated X ago" label.
  useEffect(() => {
    if (overview) setRefreshedAt(new Date());
  }, [overview]);

  // Default comparison: the three largest departments by headcount.
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  useEffect(() => {
    if (compareSelection.length === 0 && overview && overview.departments.length > 0) {
      const topNames = overview.composition.department.slice(0, 3).map((s) => s.name);
      const ids = overview.departments.filter((d) => topNames.includes(d.name)).map((d) => d.id);
      if (ids.length >= 2) setCompareSelection(ids);
    }
  }, [overview, compareSelection.length]);

  const compareKey = useMemo(() => [...compareSelection].sort().join(','), [compareSelection]);
  const { data: compare, loading: compareLoading } = useAsync<DepartmentComparison[]>(
    () =>
      compareSelection.length >= 2
        ? api.get(`/analytics/compare?departmentIds=${compareSelection.join(',')}`)
        : Promise.resolve([]),
    [compareKey],
  );
  // Company-wide averages for the comparison table — same filter scope as the
  // selected departments, so deviations read against a fair baseline.
  const companyAverage = useMemo(() => {
    if (!overview) return null;
    const kpis = overview.kpis;
    const slices = overview.engagement.jobSatisfaction;
    const total = slices.reduce((sum, slice) => sum + slice.value, 0);
    const weighted = slices.reduce((sum, slice) => {
      const level = Number.parseInt(String(slice.name).replace(/\D/g, ''), 10);
      return Number.isFinite(level) ? sum + level * slice.value : sum;
    }, 0);
    return {
      headcount: kpis.totalEmployees,
      attritionRate: kpis.attritionRate,
      averageTenureYears: kpis.averageTenureYears,
      averageMonthlyIncome: kpis.averageMonthlyIncome,
      overtimeRate: kpis.overtimeRate,
      averageJobSatisfaction: total > 0 ? weighted / total : null,
      averagePerformanceRating: kpis.averagePerformanceRating,
    };
  }, [overview]);

  const toggleCompare = (id: string) => {
    setCompareSelection((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  };

  const canWrite = role === 'admin' || role === 'manager';
  const showWelcome = Boolean(profile && !profile.employeeId && !welcomeDismissed);
  const isOrgEmpty = Boolean(overview && overview.kpis.totalEmployees === 0);
  const showSkeleton = (loading && !overview) || !hydrated;

  const handleRefresh = () => {
    setRefreshedAt(null);
    // A manual refresh must bypass the 30s GET cache.
    purgeApiCache();
    void refetch();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Workforce Intelligence"
        title="Analytics Dashboard"
        description="What is happening in your workforce, where the important changes are, and what deserves attention next."
        actions={
          <div className="flex items-center gap-2">
            {refreshedAt ? (
              <span
                className="hidden text-xs text-muted-foreground sm:inline"
                title={formatDate(refreshedAt.toISOString())}
              >
                Updated {formatRelative(refreshedAt.toISOString())}
              </span>
            ) : null}
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={loading ? 'size-3.5 animate-spin' : 'size-3.5'} aria-hidden />
              Refresh
            </Button>
          </div>
        }
      />

      {showWelcome ? (
        <div className="mb-6">
          <WelcomeCard role={role} name={profile?.name} onDismiss={dismissWelcome} />
        </div>
      ) : null}

      {showSkeleton ? (
        <DashboardSkeleton />
      ) : error && !overview ? (
        <ErrorState description={error} onRetry={() => void refetch()} />
      ) : overview && isOrgEmpty ? (
        <EmptyOrgState canWrite={canWrite} />
      ) : overview ? (
        <div className="space-y-8">
          <ExecutiveSummaryCard summary={overview.executiveSummary} />

          {/* Ask orgwise — the copilot's front door on the dashboard */}
          <AskCopilotCard filters={filters} options={filterOptions} />

          {/* Saved views — named, persistent filter combinations */}
          <SavedViews
            filters={filters}
            setFilter={setFilter}
            resetFilters={resetFilters}
            activeCount={activeCount}
          />

          {/* Global filters — one coherent state feeding every section below */}
          <AnalyticsFilters
            filters={filters}
            setFilter={setFilter}
            resetFilters={resetFilters}
            activeCount={activeCount}
            options={filterOptions}
          />

          {/* Quick actions */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Quick actions
            </span>
            {canWrite ? (
              <Button variant="secondary" size="sm" asChild>
                <Link href="/employees?new=1">
                  <Plus className="size-3.5" aria-hidden /> Add employee
                </Link>
              </Button>
            ) : null}
            {canWrite ? (
              <Button variant="secondary" size="sm" asChild>
                <Link href="/imports">
                  <FileSpreadsheet className="size-3.5" aria-hidden /> Import CSV
                </Link>
              </Button>
            ) : null}
            {role === 'admin' ? (
              <Button variant="secondary" size="sm" asChild>
                <Link href="/departments">
                  <Building2 className="size-3.5" aria-hidden /> Departments
                </Link>
              </Button>
            ) : null}
            {role === 'admin' ? (
              <Button variant="secondary" size="sm" asChild>
                <Link href="/audit-logs">
                  <ScrollText className="size-3.5" aria-hidden /> Audit log
                </Link>
              </Button>
            ) : null}
          </div>

          {/* In-page section navigation */}
          <nav
            aria-label="Dashboard sections"
            className="sticky top-14 z-20 -mx-1 flex gap-1.5 overflow-x-auto rounded-xl border border-border/60 bg-background/85 px-2 py-1.5 backdrop-blur-md lg:top-[3.5rem]"
          >
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {section.label}
              </a>
            ))}
          </nav>

          <section id="overview" data-tour="kpis" className="scroll-mt-28 space-y-6">
            <SectionHeading
              eyebrow="Workforce Overview"
              title="The workforce at a glance"
              description="Current headcount, stability and composition for the active filters."
            />
            <AnalyticsKpis kpis={overview.kpis} />
          </section>

          <section id="retention" className="scroll-mt-28 space-y-6">
            <SectionHeading
              eyebrow="Retention & Attrition"
              title="Where is retention risk concentrated?"
              description="Observed attrition across departments, roles, tenure, overtime and satisfaction — click any slice to investigate."
            />
            <AttritionSection overview={overview} />
          </section>

          <section id="engagement" className="scroll-mt-28 space-y-6">
            <SectionHeading
              eyebrow="Engagement & Culture"
              title="How engaged is the workforce?"
              description="Satisfaction dimensions measured on a 1–4 scale, plus overtime prevalence."
            />
            <EngagementSection overview={overview} />
          </section>

          <section id="talent" className="scroll-mt-28 space-y-6">
            <SectionHeading
              eyebrow="Talent / Hiring"
              title="How is new talent entering and staying?"
              description="Hiring velocity, quality-of-hire proxies and early attrition — computed from the current dataset."
            />
            <TalentSection overview={overview} />
          </section>

          <section id="composition" className="scroll-mt-28 space-y-6">
            <SectionHeading
              eyebrow="Workforce Composition"
              title="Who makes up the workforce?"
              description="Distribution by department, role, gender, age, education and tenure — click a slice to explore that population."
            />
            <CompositionSection overview={overview} />
          </section>

          <section id="compare" className="scroll-mt-28 space-y-6">
            <SectionHeading
              eyebrow="Department Comparison"
              title="How do departments differ?"
              description="Select departments to compare headcount, attrition, tenure, income, overtime, satisfaction and performance side-by-side."
            />
            <CompareSection
              departments={overview.departments}
              selection={compareSelection}
              onToggle={toggleCompare}
              onClear={() => setCompareSelection([])}
              data={compare}
              loading={compareLoading}
              companyAverage={companyAverage}
            />
          </section>

          <section id="periods" className="scroll-mt-28 space-y-6">
            <PeriodComparison />
          </section>

          <section id="insights" className="scroll-mt-28 space-y-6">
            <SectionHeading
              eyebrow="Workforce Insights"
              title="Observed patterns worth investigating"
              description="Deterministic observations from the current dataset — correlations, not predictions. Each card links to the underlying records."
            />
            <InsightsSection insights={overview.insights} />
          </section>

          <section id="health" className="scroll-mt-28 space-y-6">
            <SectionHeading
              eyebrow="Data Quality"
              title="Is the dataset ready for analytics?"
              description="Analytics quality depends on data quality — missing values lower the readiness score and are listed below."
            />
            <div className="max-w-2xl">
              <DataQualityCard quality={overview.dataQuality} />
            </div>
          </section>
          <OnboardingTour />
        </div>
      ) : null}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-indigo-400 dark:text-indigo-300">
        {eyebrow}
      </p>
      <h2 className="mt-1 font-display text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
// First-run welcome card for accounts with no linked employee profile. Explains the caller's role and points at…
// the right next step.
function WelcomeCard({
  role,
  name,
  onDismiss,
}: {
  role: Role | null;
  name?: string;
  onDismiss: () => void;
}) {
  const firstName = name?.trim().split(/\s+/)[0] ?? 'there';
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';

  const title = isAdmin
    ? `Welcome, ${firstName} — you have full access`
    : isManager
      ? `Welcome, ${firstName} — you're a department manager`
      : `Welcome to orgwise, ${firstName}`;

  const body = isAdmin
    ? "You're signed in as an Administrator. Import your workforce CSV, organize departments and teams, and manage user roles from the sidebar — every feature is available to you."
    : isManager
      ? "You're signed in as a Manager. You can add, edit, and import employees within your assigned departments — read-only everywhere else."
      : "You're signed in as a Viewer with read-only access. Browse the analytics dashboard, employee directory, and organizational structure. To contribute, ask an Administrator to link your employee profile or upgrade your role.";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-card to-cyan-500/10 p-5">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss welcome message"
        className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-4" aria-hidden />
      </button>
      <div className="flex items-start gap-3.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-sm">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{body}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {isAdmin || isManager ? (
              <Button size="sm" asChild>
                <Link href="/imports">Import CSV</Link>
              </Button>
            ) : null}
            <Button size="sm" variant="outline" asChild>
              <Link href="/employees">Browse employees</Link>
            </Button>
            {isAdmin ? (
              <Button size="sm" variant="outline" asChild>
                <Link href="/users">Manage users</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Guidance shown when the organization has no workforce records yet. */
function EmptyOrgState({ canWrite }: { canWrite: boolean }) {
  return (
    <EmptyState
      icon={UsersIcon}
      title={canWrite ? 'Your organization has no workforce data yet' : 'No workforce data yet'}
      description={
        canWrite
          ? 'Import your employee CSV or add your first employee to start analyzing your workforce.'
          : "This organization doesn't have any workforce data yet. Check back soon — or ask an Administrator to import a dataset."
      }
      action={
        canWrite ? (
          <div className="flex gap-2">
            <Button size="sm" asChild>
              <Link href="/imports">Import CSV</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/employees">Add employee</Link>
            </Button>
          </div>
        ) : undefined
      }
    />
  );
}

/** Skeleton mirror of the analytics dashboard while metrics load. */
function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-hidden>
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => (
          <Skeleton key={index} className="h-10 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
          <div key={index} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="size-9 rounded-lg" />
            </div>
            <Skeleton className="mt-4 h-8 w-16" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="mt-5 h-56 w-full" />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-5 h-56 w-full" />
        </div>
      </div>
    </div>
  );
}
