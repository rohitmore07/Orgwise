'use client';

import type { Department, EmployeeView, Paginated, TeamSummary } from '@orgwise/types';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { PageHeader } from '@/components/app-shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useAsync } from '@/hooks/use-async';
import { api, ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { fullName } from '@/lib/format';

export default function TeamsPage() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const toast = useToast();

  const [departmentFilter, setDepartmentFilter] = useState('');
  const { data: departments } = useAsync<Department[]>(() => api.get('/departments'));
  const { data: employees } = useAsync<EmployeeView[]>(
    () =>
      api
        .get<Paginated<EmployeeView>>('/employees?pageSize=100')
        .then((r) => r.items)
        .catch(() => []),
    [],
  );
  const {
    data: teams,
    loading,
    error,
    refetch,
  } = useAsync<TeamSummary[]>(
    () => api.get(`/teams${departmentFilter ? `?departmentId=${departmentFilter}` : ''}`),
    [departmentFilter],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TeamSummary | null>(null);
  const [deleting, setDeleting] = useState<TeamSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [leadEmployeeId, setLeadEmployeeId] = useState('');

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setDepartmentId('');
    setLeadEmployeeId('');
    setDialogOpen(true);
  };

  const openEdit = (team: TeamSummary) => {
    setEditing(team);
    setName(team.name);
    setDescription(team.description ?? '');
    setDepartmentId(team.departmentId);
    setLeadEmployeeId(team.leadEmployeeId ?? '');
    setDialogOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name,
        description: description || undefined,
        departmentId,
        leadEmployeeId: leadEmployeeId || undefined,
      };
      if (editing) {
        await api.patch(`/teams/${editing.id}`, payload);
        toast.success(`Updated ${name}`);
      } else {
        await api.post('/teams', payload);
        toast.success(`Created ${name}`);
      }
      setDialogOpen(false);
      await refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Failed to save team');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSubmitting(true);
    try {
      await api.delete(`/teams/${deleting.id}`);
      toast.success(`${deleting.name} removed`);
      setDeleting(null);
      await refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Failed to delete team');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Organization"
        title="Teams"
        description="Sub-units within departments, with leads and headcount."
        actions={
          isAdmin ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" aria-hidden /> New Team
            </Button>
          ) : null
        }
      />

      <div className="mb-4 max-w-xs">
        <Select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          placeholder="All departments"
          aria-label="Filter teams by department"
          options={(departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton rows={5} />
          ) : error ? (
            <ErrorState description={error} onRetry={() => void refetch()} />
          ) : teams && teams.length === 0 ? (
            <EmptyState
              title="No teams found"
              description="Teams organize employees within a department."
              action={
                isAdmin ? (
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="size-4" aria-hidden /> New Team
                  </Button>
                ) : null
              }
            />
          ) : teams ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Members</TableHead>
                  {isAdmin ? <TableHead className="text-right">Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell>
                      <p className="text-sm font-medium text-foreground">{team.name}</p>
                      {team.description ? (
                        <p className="text-[11px] text-muted-foreground">{team.description}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {team.department?.name ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {team.leadEmployee
                        ? fullName(team.leadEmployee.firstName, team.leadEmployee.lastName)
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        <Users className="mr-1 size-3" aria-hidden /> {team.employeeCount}
                      </Badge>
                    </TableCell>
                    {isAdmin ? (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`Edit ${team.name}`}
                            onClick={() => openEdit(team)}
                          >
                            <Pencil className="size-3.5" aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            aria-label={`Delete ${team.name}`}
                            onClick={() => setDeleting(team)}
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      {/* Create / edit dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Edit Team' : 'New Team'}
        description={editing ? `Update ${editing.name}.` : 'Add a team within a department.'}
      >
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="team-name">Name</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Platform"
              required
            />
          </div>
          <div>
            <Label htmlFor="team-description">Description</Label>
            <Textarea
              id="team-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this team own?"
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="team-department">Department</Label>
            <Select
              id="team-department"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              placeholder="Select department"
              required
              options={(departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
            />
          </div>
          <div>
            <Label htmlFor="team-lead">Team Lead</Label>
            <Select
              id="team-lead"
              value={leadEmployeeId}
              onChange={(e) => setLeadEmployeeId(e.target.value)}
              placeholder="Unassigned"
              options={(employees ?? []).map((e) => ({
                value: e.id,
                label: `${fullName(e.firstName, e.lastName)} (${e.employeeCode})`,
              }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Create Team'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete confirm */}
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete team?"
        description={
          deleting
            ? `${deleting.name} will be removed. Teams with members cannot be deleted.`
            : undefined
        }
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleting(null)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void handleDelete()} disabled={submitting}>
            {submitting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
