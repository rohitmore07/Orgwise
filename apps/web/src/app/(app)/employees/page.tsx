'use client';

import type {
  Department,
  EmployeeStatus,
  EmployeeView,
  FilterOptions,
  Gender,
  Paginated,
  Team,
} from '@orgwise/types';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Eye,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Upload,
  Search,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/app-shell/page-header';
import { EmployeeForm, type EmployeeFormValues } from '@/components/employees/employee-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { api, ApiClientError } from '@/lib/api';
import { useAuth, useCanWrite } from '@/lib/auth-context';
import { queryToFilters } from '@/lib/analytics-filters';
import {
  AGE_GROUP_LABELS,
  formatDate,
  GENDER_LABELS,
  SATISFACTION_LABELS,
  STATUS_LABELS,
  STATUS_VARIANTS,
  TENURE_GROUP_LABELS,
  fullName,
} from '@/lib/format';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 10;

type SortField = 'firstName' | 'lastName' | 'email' | 'jobTitle' | 'status' | 'hiredAt';

export default function EmployeesPage() {
  const toast = useToast();
  const { role } = useAuth();
  const canWrite = useCanWrite();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 300);
  const [departmentId, setDepartmentId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [status, setStatus] = useState<EmployeeStatus | ''>('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [jobTitle, setJobTitle] = useState('');
  const [overTime, setOverTime] = useState('');
  const [attrition, setAttrition] = useState('');
  const [jobSatisfaction, setJobSatisfaction] = useState('');
  const [environmentSatisfaction, setEnvironmentSatisfaction] = useState('');
  const [relationshipSatisfaction, setRelationshipSatisfaction] = useState('');
  const [workLifeBalance, setWorkLifeBalance] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [tenureGroup, setTenureGroup] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('hiredAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [result, setResult] = useState<Paginated<EmployeeView> | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [jobTitles, setJobTitles] = useState<string[]>([]);
  /** Full reference list for the form's manager picker (fetched server-side). */
  const [managerCandidates, setManagerCandidates] = useState<EmployeeView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeView | null>(null);
  const [deleting, setDeleting] = useState<EmployeeView | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Employee id currently being restored — guards against double-submits. */
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const loadReferences = useCallback(async () => {
    try {
      const [depts, teamsResult, filterOptions, candidates] = await Promise.all([
        api.get<Department[]>('/departments'),
        api.get<Team[]>('/teams'),
        api.get<FilterOptions>('/analytics/filters'),
        // Manager picker options come from the backend (fullest allowed page),
        // not from the current 10-row table page.
        api.get<Paginated<EmployeeView>>('/employees?pageSize=100'),
      ]);
      setDepartments(depts);
      setTeams(teamsResult);
      setJobTitles(filterOptions.jobTitles);
      setManagerCandidates(candidates.items);
    } catch {
      // Reference load failure is non-fatal; forms will show empty selects.
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sortBy,
        sortOrder,
      });
      if (search) params.set('search', search);
      if (departmentId) params.set('departmentId', departmentId);
      if (teamId) params.set('teamId', teamId);
      if (status) params.set('status', status);
      if (gender) params.set('gender', gender);
      if (jobTitle) params.set('jobTitle', jobTitle);
      if (overTime) params.set('overTime', overTime);
      if (attrition) params.set('attrition', attrition);
      if (jobSatisfaction) params.set('jobSatisfaction', jobSatisfaction);
      if (environmentSatisfaction) params.set('environmentSatisfaction', environmentSatisfaction);
      if (relationshipSatisfaction)
        params.set('relationshipSatisfaction', relationshipSatisfaction);
      if (workLifeBalance) params.set('workLifeBalance', workLifeBalance);
      if (ageGroup) params.set('ageGroup', ageGroup);
      if (tenureGroup) params.set('tenureGroup', tenureGroup);
      if (includeDeleted) params.set('includeDeleted', 'true');
      const data = await api.get<Paginated<EmployeeView>>(`/employees?${params.toString()}`);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [
    page,
    search,
    departmentId,
    teamId,
    status,
    gender,
    jobTitle,
    overTime,
    attrition,
    jobSatisfaction,
    environmentSatisfaction,
    relationshipSatisfaction,
    workLifeBalance,
    ageGroup,
    tenureGroup,
    sortBy,
    sortOrder,
    includeDeleted,
  ]);

  useEffect(() => {
    void loadReferences();
  }, [loadReferences]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reset to page 1 when filters change.
  useEffect(() => {
    setPage(1);
  }, [
    search,
    departmentId,
    teamId,
    status,
    gender,
    jobTitle,
    overTime,
    attrition,
    jobSatisfaction,
    environmentSatisfaction,
    relationshipSatisfaction,
    workLifeBalance,
    ageGroup,
    tenureGroup,
    sortBy,
    sortOrder,
    includeDeleted,
  ]);
  // Hydrate filters from the URL query — on first mount (dashboard chart drill-downs open the explorer…
  // pre-filtered, e.g. ?attrition=true) and on every popstate (browser back/forward between drill-down URLs while…
  useEffect(() => {
    const hydrate = () => {
      const fromUrl = queryToFilters(window.location.search);
      setDepartmentId(fromUrl.departmentId ?? '');
      setTeamId(fromUrl.teamId ?? '');
      setStatus(fromUrl.status ?? '');
      setGender(fromUrl.gender ?? '');
      setJobTitle(fromUrl.jobTitle ?? '');
      setOverTime(fromUrl.overTime === undefined ? '' : String(fromUrl.overTime));
      setAttrition(fromUrl.attrition === undefined ? '' : String(fromUrl.attrition));
      setJobSatisfaction(
        fromUrl.jobSatisfaction === undefined ? '' : String(fromUrl.jobSatisfaction),
      );
      setEnvironmentSatisfaction(
        fromUrl.environmentSatisfaction === undefined
          ? ''
          : String(fromUrl.environmentSatisfaction),
      );
      setRelationshipSatisfaction(
        fromUrl.relationshipSatisfaction === undefined
          ? ''
          : String(fromUrl.relationshipSatisfaction),
      );
      setWorkLifeBalance(
        fromUrl.workLifeBalance === undefined ? '' : String(fromUrl.workLifeBalance),
      );
      setAgeGroup(fromUrl.ageGroup ?? '');
      setTenureGroup(fromUrl.tenureGroup ?? '');
    };
    hydrate();
    window.addEventListener('popstate', hydrate);
    return () => window.removeEventListener('popstate', hydrate);
  }, []);
  // Auto-open the edit dialog when arriving with ?edit=<id> (e.g. the employee profile page's "Edit Profile"…
  // action). window.location is used instead of useSearchParams so the page keeps its static prerender.
  useEffect(() => {
    const editId = new URLSearchParams(window.location.search).get('edit');
    if (!editId) return;
    api
      .get<EmployeeView>(`/employees/${editId}`)
      .then((employee) => {
        setEditing(employee);
        setDialogOpen(true);
      })
      .catch(() => {
        toast.error('Could not load the requested employee');
      });
  }, [toast]);

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleSubmit = async (values: EmployeeFormValues) => {
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        gender: values.gender,
        status: values.status || 'active',
        dateOfBirth: values.dateOfBirth || undefined,
        hiredAt: new Date(values.hiredAt).toISOString(),
        teamId: values.teamId || undefined,
        managerId: values.managerId || undefined,
      };
      if (editing) {
        await api.patch(`/employees/${editing.id}`, payload);
        toast.success(`Updated ${fullName(values.firstName, values.lastName)}`);
      } else {
        await api.post('/employees', payload);
        toast.success(`Created ${fullName(values.firstName, values.lastName)}`);
      }
      setDialogOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Failed to save employee');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSubmitting(true);
    try {
      await api.delete(`/employees/${deleting.id}`);
      toast.success(`${fullName(deleting.firstName, deleting.lastName)} removed`);
      setDeleting(null);
      // If we just removed the only row on a page beyond the first, step back one page — otherwise the table would…
      // land on an out-of-range page and wrongly show the empty state. The page change re-triggers `load()`.
      if (result && result.items.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await load();
      }
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Failed to delete employee');
    } finally {
      setSubmitting(false);
    }
  };

  /** Restore a soft-deleted employee — the inverse of delete, audited as "restore". */
  const handleRestore = async (employee: EmployeeView) => {
    setRestoringId(employee.id);
    try {
      await api.patch(`/employees/${employee.id}/restore`);
      toast.success(`${fullName(employee.firstName, employee.lastName)} restored`);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Failed to restore employee');
    } finally {
      setRestoringId(null);
    }
  };

  const SortHeader = ({
    field,
    children,
    className,
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => (
    <button
      type="button"
      onClick={() => toggleSort(field)}
      className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-foreground focus-visible:outline-none ${className ?? ''}`}
    >
      {children}
      {sortBy === field ? (
        sortOrder === 'asc' ? (
          <ArrowUp className="size-3" aria-hidden />
        ) : (
          <ArrowDown className="size-3" aria-hidden />
        )
      ) : (
        <ArrowUpDown className="size-3 opacity-40" aria-hidden />
      )}
    </button>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Workforce"
        title="Employees"
        description="Search, filter, and manage employee profiles across the organization."
        actions={
          canWrite ? (
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden /> Add Employee
            </Button>
          ) : null
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="relative lg:col-span-2">
              <Search
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, email, code, title…"
                className="pl-9"
                aria-label="Search employees"
              />
            </div>
            <Select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              placeholder="All departments"
              aria-label="Filter by department"
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
            />
            <Select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              placeholder="All teams"
              aria-label="Filter by team"
              options={teams.map((t) => ({ value: t.id, label: t.name }))}
            />
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as EmployeeStatus | '')}
              placeholder="All statuses"
              aria-label="Filter by status"
              options={(Object.keys(STATUS_LABELS) as EmployeeStatus[]).map((s) => ({
                value: s,
                label: STATUS_LABELS[s],
              }))}
            />
            <Select
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender | '')}
              placeholder="All genders"
              aria-label="Filter by gender"
              options={(Object.keys(GENDER_LABELS) as Gender[]).map((g) => ({
                value: g,
                label: GENDER_LABELS[g],
              }))}
            />
            <Select
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="All job titles"
              aria-label="Filter by job title"
              options={jobTitles.map((title) => ({ value: title, label: title }))}
            />
            <Select
              value={attrition}
              onChange={(e) => setAttrition(e.target.value)}
              placeholder="All attrition"
              aria-label="Filter by attrition"
              options={[
                { value: 'true', label: 'Left (attrition)' },
                { value: 'false', label: 'Retained' },
              ]}
            />
            <Select
              value={overTime}
              onChange={(e) => setOverTime(e.target.value)}
              placeholder="All overtime"
              aria-label="Filter by overtime"
              options={[
                { value: 'true', label: 'Works overtime' },
                { value: 'false', label: 'No overtime' },
              ]}
            />
            <Select
              value={jobSatisfaction}
              onChange={(e) => setJobSatisfaction(e.target.value)}
              placeholder="All job satisfaction"
              aria-label="Filter by job satisfaction"
              options={Object.entries(SATISFACTION_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <Select
              value={environmentSatisfaction}
              onChange={(e) => setEnvironmentSatisfaction(e.target.value)}
              placeholder="All env. satisfaction"
              aria-label="Filter by environment satisfaction"
              options={Object.entries(SATISFACTION_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <Select
              value={relationshipSatisfaction}
              onChange={(e) => setRelationshipSatisfaction(e.target.value)}
              placeholder="All rel. satisfaction"
              aria-label="Filter by relationship satisfaction"
              options={Object.entries(SATISFACTION_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <Select
              value={workLifeBalance}
              onChange={(e) => setWorkLifeBalance(e.target.value)}
              placeholder="All work-life balance"
              aria-label="Filter by work-life balance"
              options={Object.entries(SATISFACTION_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <Select
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value)}
              placeholder="All age groups"
              aria-label="Filter by age group"
              options={Object.entries(AGE_GROUP_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <Select
              value={tenureGroup}
              onChange={(e) => setTenureGroup(e.target.value)}
              placeholder="All tenure"
              aria-label="Filter by tenure"
              options={Object.entries(TENURE_GROUP_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
            <button
              type="button"
              role="switch"
              aria-checked={includeDeleted}
              onClick={() => setIncludeDeleted((value) => !value)}
              className="flex items-center gap-2.5 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                aria-hidden
                className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                  includeDeleted ? 'bg-primary' : 'bg-muted-foreground/25',
                )}
              >
                <span
                  className={cn(
                    'inline-block size-3.5 transform rounded-full bg-white shadow transition-transform',
                    includeDeleted ? 'translate-x-[18px]' : 'translate-x-[3px]',
                  )}
                />
              </span>
              Show deleted employees
            </button>
            {includeDeleted ? (
              <p className="text-[11px] text-muted-foreground">
                Deleted records appear dimmed with a “Deleted” badge and can be restored.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton rows={8} />
          ) : error ? (
            <ErrorState description={error} onRetry={() => void load()} />
          ) : result && result.items.length === 0 ? (
            <EmptyState
              title="No employees found"
              description={
                search || departmentId || status || gender
                  ? 'Try adjusting your filters or search query.'
                  : 'Add your first employee to get started.'
              }
              action={
                canWrite ? (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditing(null);
                        setDialogOpen(true);
                      }}
                    >
                      <Plus className="size-4" aria-hidden /> Add Employee
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/imports">
                        <Upload className="size-4" aria-hidden /> Import CSV
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const params = new URLSearchParams();
                        if (searchInput) params.set('search', searchInput);
                        if (departmentId) params.set('departmentId', departmentId);
                        if (status) params.set('status', status);
                        if (gender) params.set('gender', gender);
                        window.open(`/api/v1/employees/export?${params.toString()}`, '_blank');
                      }}
                    >
                      <Download className="size-4" aria-hidden /> Export CSV
                    </Button>
                  </div>
                ) : null
              }
            />
          ) : result ? (
            <>
              {selectedIds.length > 0 && canWrite && (
                <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
                  <span className="text-sm font-medium text-foreground">
                    {selectedIds.length} selected
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (!confirm(`Set status to 'on leave' for ${selectedIds.length} employees?`))
                        return;
                      await api.post('/employees/bulk', {
                        employeeIds: selectedIds,
                        action: 'update_status',
                        status: 'on_leave',
                      });
                      setSelectedIds([]);
                      load();
                    }}
                  >
                    On Leave
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (!confirm(`Set status to 'active' for ${selectedIds.length} employees?`))
                        return;
                      await api.post('/employees/bulk', {
                        employeeIds: selectedIds,
                        action: 'update_status',
                        status: 'active',
                      });
                      setSelectedIds([]);
                      load();
                    }}
                  >
                    Activate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (
                        !confirm(
                          `Terminate ${selectedIds.length} employees? This can be undone via restore.`,
                        )
                      )
                        return;
                      await api.post('/employees/bulk', {
                        employeeIds: selectedIds,
                        action: 'delete',
                      });
                      setSelectedIds([]);
                      load();
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    Terminate
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
                    Clear
                  </Button>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    {canWrite && (
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          className="size-4 rounded border-border accent-primary"
                          checked={
                            selectedIds.length === result.items.length && result.items.length > 0
                          }
                          onChange={() => {
                            if (selectedIds.length === result.items.length) {
                              setSelectedIds([]);
                            } else {
                              setSelectedIds(result.items.map((e) => e.id));
                            }
                          }}
                        />
                      </TableHead>
                    )}
                    <TableHead>
                      <SortHeader field="firstName">Employee</SortHeader>
                    </TableHead>
                    <TableHead>
                      <SortHeader field="jobTitle">Job Title</SortHeader>
                    </TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="hidden md:table-cell">Manager</TableHead>
                    <TableHead>
                      <SortHeader field="status">Status</SortHeader>
                    </TableHead>
                    <TableHead>Profile</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      <SortHeader field="hiredAt">Hired</SortHeader>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((employee) => {
                    const isDeleted = Boolean(employee.deletedAt);
                    return (
                      <TableRow key={employee.id} className={isDeleted ? 'opacity-60' : undefined}>
                        {canWrite && (
                          <TableCell className="w-10">
                            <input
                              type="checkbox"
                              className="size-4 rounded border-border accent-primary"
                              checked={selectedIds.includes(employee.id)}
                              onChange={() => {
                                setSelectedIds((prev) =>
                                  prev.includes(employee.id)
                                    ? prev.filter((id) => id !== employee.id)
                                    : [...prev, employee.id],
                                );
                              }}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 text-xs font-semibold text-indigo-500 dark:text-indigo-300">
                              {initials(employee.firstName, employee.lastName)}
                            </div>
                            <div className="min-w-0">
                              {isDeleted ? (
                                <span className="block truncate text-sm font-medium text-muted-foreground">
                                  {fullName(employee.firstName, employee.lastName)}
                                </span>
                              ) : (
                                <Link
                                  href={`/employees/${employee.id}`}
                                  className="block truncate text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                                >
                                  {fullName(employee.firstName, employee.lastName)}
                                </Link>
                              )}
                              <p className="truncate text-[11px] text-muted-foreground">
                                {employee.employeeCode} · {employee.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {employee.jobTitle}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {employee.department?.name ?? '—'}
                          {employee.team ? (
                            <span className="text-[11px] text-muted-foreground/70">
                              {' '}
                              · {employee.team.name}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                          {employee.manager
                            ? fullName(employee.manager.firstName, employee.manager.lastName)
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {isDeleted ? (
                            <Badge variant="outline">
                              Deleted {formatDate(employee.deletedAt)}
                            </Badge>
                          ) : (
                            <Badge variant={STATUS_VARIANTS[employee.status]}>
                              {STATUS_LABELS[employee.status]}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {employee.attrition ? (
                              <Badge variant="danger">Left</Badge>
                            ) : employee.attrition === false ? (
                              <Badge variant="success">Retained</Badge>
                            ) : null}
                            {employee.overTime ? <Badge variant="warning">Overtime</Badge> : null}
                            {!isDeleted && typeof employee.jobSatisfaction === 'number' ? (
                              <Badge variant="info">Sat {employee.jobSatisfaction}/4</Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                          {formatDate(employee.hiredAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {!isDeleted ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                aria-label={`View ${fullName(employee.firstName, employee.lastName)} profile`}
                                asChild
                              >
                                <Link href={`/employees/${employee.id}`}>
                                  <Eye className="size-3.5" aria-hidden />
                                </Link>
                              </Button>
                            ) : null}
                            {!isDeleted ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                aria-label={`Edit ${fullName(employee.firstName, employee.lastName)}`}
                                onClick={() => {
                                  setEditing(employee);
                                  setDialogOpen(true);
                                }}
                                disabled={!canWrite}
                              >
                                <Pencil className="size-3.5" aria-hidden />
                              </Button>
                            ) : null}
                            {isDeleted && canWrite ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400"
                                aria-label={`Restore ${fullName(employee.firstName, employee.lastName)}`}
                                title="Restore this employee"
                                onClick={() => void handleRestore(employee)}
                                disabled={restoringId === employee.id}
                              >
                                {restoringId === employee.id ? (
                                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                                ) : (
                                  <RotateCcw className="size-3.5" aria-hidden />
                                )}
                              </Button>
                            ) : null}
                            {!isDeleted ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive hover:text-destructive"
                                aria-label={`Delete ${fullName(employee.firstName, employee.lastName)}`}
                                onClick={() => setDeleting(employee)}
                                disabled={!canWrite}
                              >
                                <Trash2 className="size-3.5" aria-hidden />
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Pagination
                page={result.page}
                totalPages={result.totalPages}
                total={result.total}
                pageSize={result.pageSize}
                onPageChange={setPage}
                className="px-4"
              />
            </>
          ) : null}
        </CardContent>
      </Card>

      {role === 'viewer' ? (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Viewer mode — you can browse but not modify employee records.
        </p>
      ) : null}

      {/* Create / edit dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Edit Employee' : 'Add Employee'}
        description={
          editing
            ? `Update ${fullName(editing.firstName, editing.lastName)}'s profile.`
            : 'Create a new employee profile.'
        }
        size="lg"
      >
        <EmployeeForm
          key={editing?.id ?? 'new'}
          initial={editing}
          departments={departments}
          employees={managerCandidates}
          submitting={submitting}
          onSubmit={(values) => void handleSubmit(values)}
        />
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Remove employee?"
        description={
          deleting
            ? `${fullName(deleting.firstName, deleting.lastName)} (${deleting.employeeCode}) will be soft-deleted. Their record is retained in history and audits.`
            : undefined
        }
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleting(null)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void handleDelete()} disabled={submitting}>
            {submitting ? 'Removing…' : 'Remove Employee'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}
