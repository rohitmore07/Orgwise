'use client';

import type { EmployeeView } from '@orgwise/types';
import {
  ArchiveRestore,
  ArrowLeft,
  Loader2,
  Mail,
  Pencil,
  Phone,
  RotateCcw,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageHeader } from '@/components/app-shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { ActivityTimeline } from '@/components/employees/activity-timeline';
import { useAsync } from '@/hooks/use-async';
import { api, ApiClientError } from '@/lib/api';
import { useCanWrite } from '@/lib/auth-context';
import {
  EDUCATION_LABELS,
  formatDate,
  formatIncome,
  formatYears,
  GENDER_LABELS,
  PERFORMANCE_LABELS,
  SATISFACTION_LABELS,
  STATUS_LABELS,
  STATUS_VARIANTS,
  fullName,
} from '@/lib/format';

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const canWrite = useCanWrite();
  const toast = useToast();
  const [restoring, setRestoring] = useState(false);
  // `params.id` must be a dependency so navigating between employee profiles
  // (via the list's View links) refetches instead of showing stale data.
  const {
    data: employee,
    loading,
    error,
    refetch,
  } = useAsync<EmployeeView>(() => api.get(`/employees/${params.id}`), [params.id]);

  const handleRestore = async () => {
    if (!employee) return;
    setRestoring(true);
    try {
      await api.patch(`/employees/${employee.id}/restore`);
      toast.success(`${fullName(employee.firstName, employee.lastName)} restored`);
      await refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Failed to restore employee');
    } finally {
      setRestoring(false);
    }
  };

  if (loading) {
    return (
      <div aria-busy="true" aria-label="Loading employee profile">
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3.5 w-64" />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-4 w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (error) return <ErrorState description={error} onRetry={() => void refetch()} />;
  if (!employee) return null;

  return (
    <div>
      <PageHeader
        eyebrow="Workforce"
        title={fullName(employee.firstName, employee.lastName)}
        description={`${employee.employeeCode} · ${employee.jobTitle}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/employees')}>
              <ArrowLeft className="size-4" aria-hidden /> Back
            </Button>
            {canWrite && !employee.deletedAt ? (
              <Button onClick={() => router.push(`/employees?edit=${employee.id}`)}>
                <Pencil className="size-4" aria-hidden /> Edit Profile
              </Button>
            ) : null}
          </div>
        }
      />

      {/* Soft-delete banner — the profile is retained for audit; restore revives it */}
      {employee.deletedAt ? (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
              <ArchiveRestore className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                Employee soft-deleted
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Removed {formatDate(employee.deletedAt)}. The profile is retained for audit
                purposes; restore it to reactivate the record.
              </p>
            </div>
          </div>
          {canWrite ? (
            <Button size="sm" onClick={() => void handleRestore()} disabled={restoring}>
              {restoring ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <RotateCcw className="size-3.5" aria-hidden />
              )}
              {restoring ? 'Restoring…' : 'Restore'}
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Identity summary */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-lg font-bold text-white">
            {initials(employee.firstName, employee.lastName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-semibold text-foreground">
                {fullName(employee.firstName, employee.lastName)}
              </h2>
              {/* Record lifecycle badges take precedence over the employment status badge — a deleted record's employment state is moot. */}
              {employee.deletedAt ? <Badge variant="danger">Deleted</Badge> : null}
              {!employee.deletedAt ? (
                <Badge variant={STATUS_VARIANTS[employee.status]}>
                  {STATUS_LABELS[employee.status]}
                </Badge>
              ) : null}
              {!employee.isActive && !employee.deletedAt ? (
                <Badge variant="danger">Inactive</Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {employee.jobTitle}
              {employee.department ? ` · ${employee.department.name}` : ''}
              {employee.team ? ` · ${employee.team.name}` : ''}
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Mail className="size-3.5" aria-hidden /> {employee.email}
            </p>
            {employee.phone ? (
              <p className="mt-1 flex items-center gap-1.5">
                <Phone className="size-3.5" aria-hidden /> {employee.phone}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ProfileSection title="Employment">
          <Row label="Job title" value={employee.jobTitle} />
          <Row label="Status" value={STATUS_LABELS[employee.status]} />
          <Row label="Department" value={employee.department?.name ?? '—'} />
          <Row label="Team" value={employee.team?.name ?? '—'} />
          <Row
            label="Manager"
            value={
              employee.manager
                ? fullName(employee.manager.firstName, employee.manager.lastName)
                : '—'
            }
          />
          <Row label="Hire date" value={formatDate(employee.hiredAt)} />
        </ProfileSection>

        <ProfileSection title="Personal">
          <Row label="Gender" value={GENDER_LABELS[employee.gender] ?? employee.gender} />
          <Row
            label="Date of birth"
            value={employee.dateOfBirth ? formatDate(employee.dateOfBirth) : '—'}
          />
          <Row label="Employee code" value={employee.employeeCode} />
          <Row label="User account" value={employee.userId ? 'Linked' : '—'} />
          <Row label="Created" value={formatDate(employee.createdAt)} />
          <Row label="Last updated" value={formatDate(employee.updatedAt)} />
        </ProfileSection>
      </div>

      {/* Workforce analytics profile — engagement dimensions + performance */}
      <div className="mt-6">
        <ProfileSection title="Workforce profile">
          <Row
            label="Attrition status"
            value={
              employee.attrition === true
                ? `Left ${employee.attritionDate ? formatDate(employee.attritionDate) : ''}`
                : employee.attrition === false
                  ? 'Retained'
                  : '—'
            }
          />
          <Row
            label="Overtime"
            value={
              employee.overTime === true
                ? 'Works overtime'
                : employee.overTime === false
                  ? 'No overtime'
                  : '—'
            }
          />
          <Row
            label="Job satisfaction"
            value={
              typeof employee.jobSatisfaction === 'number'
                ? `${SATISFACTION_LABELS[employee.jobSatisfaction] ?? employee.jobSatisfaction} (${employee.jobSatisfaction}/4)`
                : '—'
            }
          />
          <Row
            label="Work-life balance"
            value={
              typeof employee.workLifeBalance === 'number' ? `${employee.workLifeBalance}/4` : '—'
            }
          />
          <Row
            label="Performance rating"
            value={
              typeof employee.performanceRating === 'number'
                ? `${PERFORMANCE_LABELS[employee.performanceRating] ?? employee.performanceRating} (${employee.performanceRating}/4)`
                : '—'
            }
          />
          <Row
            label="Education"
            value={
              typeof employee.education === 'number'
                ? `${EDUCATION_LABELS[employee.education] ?? `Level ${employee.education}`}${
                    employee.educationField ? ` · ${employee.educationField}` : ''
                  }`
                : '—'
            }
          />
          <Row
            label="Monthly income"
            value={
              employee.monthlyIncome === null || employee.monthlyIncome === undefined
                ? canWrite
                  ? '—'
                  : 'Not available for your role'
                : formatIncome(employee.monthlyIncome)
            }
          />
          <Row label="Tenure" value={formatYears(employee.yearsAtCompany ?? undefined)} />
          <Row
            label="Age"
            value={employee.dateOfBirth ? formatYears(ageInYears(employee.dateOfBirth), 0) : '—'}
          />
          <Row
            label="Job level"
            value={typeof employee.jobLevel === 'number' ? `Level ${employee.jobLevel}` : '—'}
          />
        </ProfileSection>
      </div>

      <div className="mt-6">
        <ActivityTimeline employeeId={params.id} />
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        <Link
          href="/employees"
          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
        >
          <UserRound className="size-3" aria-hidden /> Back to all employees
        </Link>
      </p>
    </div>
  );
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/50 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function ageInYears(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, ms / (365.25 * 24 * 3600 * 1000));
}
