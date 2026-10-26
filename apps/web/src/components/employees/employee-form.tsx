'use client';

import type { Department, EmployeeView, Gender, Team } from '@orgwise/types';
import { Loader2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import { GENDER_LABELS, STATUS_LABELS } from '@/lib/format';

export interface EmployeeFormValues {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  gender: Gender | '';
  dateOfBirth: string;
  hiredAt: string;
  status: 'active' | 'on_leave' | 'probation' | 'terminated' | '';
  departmentId: string;
  teamId: string;
  managerId: string;
}

type EmployeeFormProps = {
  initial?: EmployeeView | null;
  departments: Department[];
  /** Manager candidates — a backend-fetched reference list, never filtered client-side. */
  employees: EmployeeView[];
  submitting: boolean;
  onSubmit: (values: EmployeeFormValues) => void;
};

const EMPTY_VALUES: EmployeeFormValues = {
  employeeCode: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  jobTitle: '',
  gender: '',
  dateOfBirth: '',
  hiredAt: '',
  status: 'active',
  departmentId: '',
  teamId: '',
  managerId: '',
};

function toValues(employee: EmployeeView): EmployeeFormValues {
  return {
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    phone: employee.phone ?? '',
    jobTitle: employee.jobTitle,
    gender: employee.gender,
    dateOfBirth: employee.dateOfBirth ? employee.dateOfBirth.slice(0, 10) : '',
    hiredAt: employee.hiredAt.slice(0, 10),
    status: employee.status,
    departmentId: employee.departmentId,
    teamId: employee.teamId ?? '',
    managerId: employee.managerId ?? '',
  };
}

/** Create/edit employee form shared by the employee screen dialog. */
export function EmployeeForm({
  initial,
  departments,
  employees,
  submitting,
  onSubmit,
}: EmployeeFormProps) {
  const [values, setValues] = useState<EmployeeFormValues>(() =>
    initial ? toValues(initial) : EMPTY_VALUES,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Teams of the selected department — fetched from the backend on department
  // change (the client never filters a full team list itself).
  const [departmentTeams, setDepartmentTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

  useEffect(() => {
    setValues(initial ? toValues(initial) : EMPTY_VALUES);
    setErrors({});
    setDepartmentTeams([]);
  }, [initial]);

  // Backend-driven dependent select: `GET /teams?departmentId=` returns only
  // the teams of the chosen department.
  useEffect(() => {
    if (!values.departmentId) {
      setDepartmentTeams([]);
      return;
    }
    let cancelled = false;
    // Drop the previous department's options immediately so the disabled
    // "Loading teams…" state never shows stale teams.
    setDepartmentTeams([]);
    setTeamsLoading(true);
    api
      .get<Team[]>(`/teams?departmentId=${encodeURIComponent(values.departmentId)}`)
      .then((teams) => {
        if (!cancelled) setDepartmentTeams(teams);
      })
      .catch(() => {
        if (!cancelled) setDepartmentTeams([]);
      })
      .finally(() => {
        if (!cancelled) setTeamsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [values.departmentId]);

  const set = <K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!values.employeeCode.trim()) next.employeeCode = 'Required';
    else if (!/^[A-Za-z0-9._-]{2,30}$/.test(values.employeeCode))
      next.employeeCode = 'Letters, numbers, dots, dashes, underscores (2–30)';
    if (!values.firstName.trim()) next.firstName = 'Required';
    if (!values.lastName.trim()) next.lastName = 'Required';
    if (!values.email.trim()) next.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = 'Invalid email';
    if (!values.jobTitle.trim()) next.jobTitle = 'Required';
    if (!values.gender) next.gender = 'Required';
    if (!values.hiredAt) next.hiredAt = 'Required';
    if (!values.departmentId) next.departmentId = 'Required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    onSubmit(values);
  };

  const field = (key: string) =>
    errors[key] ? <p className="mt-1 text-[11px] text-destructive">{errors[key]}</p> : null;

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2">
        <Label htmlFor="employee-code">Employee Code</Label>
        <Input
          id="employee-code"
          value={values.employeeCode}
          onChange={(e) => set('employeeCode', e.target.value)}
          placeholder="EMP-0001"
          disabled={!!initial}
        />
        {field('employeeCode')}
      </div>

      <div>
        <Label htmlFor="first-name">First Name</Label>
        <Input
          id="first-name"
          value={values.firstName}
          onChange={(e) => set('firstName', e.target.value)}
          placeholder="Alex"
        />
        {field('firstName')}
      </div>
      <div>
        <Label htmlFor="last-name">Last Name</Label>
        <Input
          id="last-name"
          value={values.lastName}
          onChange={(e) => set('lastName', e.target.value)}
          placeholder="Morgan"
        />
        {field('lastName')}
      </div>

      <div>
        <Label htmlFor="email">Work Email</Label>
        <Input
          id="email"
          type="email"
          value={values.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="alex@company.com"
        />
        {field('email')}
      </div>
      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          value={values.phone}
          onChange={(e) => set('phone', e.target.value)}
          placeholder="+1 555 010 0000"
        />
      </div>

      <div>
        <Label htmlFor="job-title">Job Title</Label>
        <Input
          id="job-title"
          value={values.jobTitle}
          onChange={(e) => set('jobTitle', e.target.value)}
          placeholder="Senior Engineer"
        />
        {field('jobTitle')}
      </div>
      <div>
        <Label htmlFor="gender">Gender</Label>
        <Select
          id="gender"
          value={values.gender}
          onChange={(e) => set('gender', e.target.value as Gender)}
          placeholder="Select gender"
          options={(Object.keys(GENDER_LABELS) as Gender[]).map((g) => ({
            value: g,
            label: GENDER_LABELS[g],
          }))}
        />
        {field('gender')}
      </div>

      <div>
        <Label htmlFor="date-of-birth">Date of Birth</Label>
        <Input
          id="date-of-birth"
          type="date"
          value={values.dateOfBirth}
          onChange={(e) => set('dateOfBirth', e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="hired-at">Hire Date</Label>
        <Input
          id="hired-at"
          type="date"
          value={values.hiredAt}
          onChange={(e) => set('hiredAt', e.target.value)}
        />
        {field('hiredAt')}
      </div>

      <div>
        <Label htmlFor="status">Status</Label>
        <Select
          id="status"
          value={values.status}
          onChange={(e) => set('status', e.target.value as EmployeeFormValues['status'])}
          options={(Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>).map((s) => ({
            value: s,
            label: STATUS_LABELS[s],
          }))}
        />
      </div>
      <div>
        <Label htmlFor="department">Department</Label>
        <Select
          id="department"
          value={values.departmentId}
          onChange={(e) => {
            set('departmentId', e.target.value);
            set('teamId', ''); // reset team when department changes
          }}
          placeholder="Select department"
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
        />
        {field('departmentId')}
      </div>

      <div>
        <Label htmlFor="team">Team</Label>
        <Select
          id="team"
          value={values.teamId}
          onChange={(e) => set('teamId', e.target.value)}
          disabled={teamsLoading}
          placeholder={
            teamsLoading
              ? 'Loading teams…'
              : values.departmentId
                ? 'Select team'
                : 'Choose a department first'
          }
          options={departmentTeams.map((t) => ({ value: t.id, label: t.name }))}
        />
      </div>
      <div>
        <Label htmlFor="manager">Manager</Label>
        <Select
          id="manager"
          value={values.managerId}
          onChange={(e) => set('managerId', e.target.value)}
          placeholder="No manager"
          options={employees
            .filter((e) => e.id !== initial?.id)
            .map((e) => ({
              value: e.id,
              label: `${e.firstName} ${e.lastName} (${e.employeeCode})`,
            }))}
        />
      </div>

      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="submit" disabled={submitting} className="min-w-28">
          {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {initial ? 'Save Changes' : 'Create Employee'}
        </Button>
      </div>
    </form>
  );
}
