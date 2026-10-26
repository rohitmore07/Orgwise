'use client';

import type { DepartmentSummary, User } from '@orgwise/types';
import { Building2, Pencil, Plus, Trash2, Users } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useAsync } from '@/hooks/use-async';
import { api, ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

export default function DepartmentsPage() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const toast = useToast();
  const {
    data: departments,
    loading,
    error,
    refetch,
  } = useAsync<DepartmentSummary[]>(() => api.get('/departments'));
  // Manager candidates are filtered server-side by role — never fetched in
  // full and filtered in the browser.
  const { data: users } = useAsync<User[]>(
    () => api.get<User[]>('/users?role=manager,admin').catch(() => []),
    [],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentSummary | null>(null);
  const [deleting, setDeleting] = useState<DepartmentSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState('');
  const [managerUserId, setManagerUserId] = useState('');

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setParentId('');
    setManagerUserId('');
    setDialogOpen(true);
  };

  const openEdit = (department: DepartmentSummary) => {
    setEditing(department);
    setName(department.name);
    setDescription(department.description ?? '');
    setParentId(department.parentId ?? '');
    setManagerUserId(department.managerUserId ?? '');
    setDialogOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name,
        description: description || undefined,
        parentId: parentId || undefined,
        managerUserId: managerUserId || undefined,
      };
      if (editing) {
        await api.patch(`/departments/${editing.id}`, payload);
        toast.success(`Updated ${name}`);
      } else {
        await api.post('/departments', payload);
        toast.success(`Created ${name}`);
      }
      setDialogOpen(false);
      await refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Failed to save department');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSubmitting(true);
    try {
      await api.delete(`/departments/${deleting.id}`);
      toast.success(`${deleting.name} removed`);
      setDeleting(null);
      await refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Failed to delete department');
    } finally {
      setSubmitting(false);
    }
  };

  const managerOptions = (users ?? []).map((u) => ({
    value: u.id,
    label: `${u.name} (${u.email})`,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Organization"
        title="Departments"
        description="Organizational units, hierarchy, and assigned managers."
        actions={
          isAdmin ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" aria-hidden /> New Department
            </Button>
          ) : null
        }
      />

      {loading ? (
        <TableSkeleton variant="grid" rows={6} />
      ) : error ? (
        <ErrorState description={error} onRetry={() => void refetch()} />
      ) : departments && departments.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title="No departments yet"
              description="Create your first department to start organizing your workforce."
              action={
                isAdmin ? (
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="size-4" aria-hidden /> New Department
                  </Button>
                ) : null
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {departments?.map((department) => (
            <Card key={department.id} className="group transition-shadow hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/15 to-cyan-500/15">
                      <Building2
                        className="size-5 text-indigo-500 dark:text-indigo-300"
                        aria-hidden
                      />
                    </span>
                    <div>
                      <h3 className="font-display text-sm font-semibold text-foreground">
                        {department.name}
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        {department.parent
                          ? `Under ${department.parent.name}`
                          : 'Top-level department'}
                      </p>
                    </div>
                  </div>
                  {isAdmin ? (
                    // Actions stay visible on touch devices (no hover) and are
                    // revealed on hover only from sm up, where a pointer exists.
                    <div className="flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={`Edit ${department.name}`}
                        onClick={() => openEdit(department)}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        aria-label={`Delete ${department.name}`}
                        onClick={() => setDeleting(department)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    </div>
                  ) : null}
                </div>

                {department.description ? (
                  <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {department.description}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    <Users className="mr-1 size-3" aria-hidden /> {department.employeeCount}{' '}
                    employees
                  </Badge>
                  <Badge variant="outline">{department.teamCount} teams</Badge>
                  {department.children && department.children.length > 0 ? (
                    <Badge variant="info">{department.children.length} sub-units</Badge>
                  ) : null}
                </div>

                <div className="mt-4 border-t border-border/60 pt-3">
                  <p className="text-[11px] text-muted-foreground">Manager</p>
                  <p
                    className={cn(
                      'mt-0.5 text-sm',
                      department.manager
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground/70',
                    )}
                  >
                    {department.manager ? department.manager.name : 'Unassigned'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isAdmin ? (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Only administrators can modify the organization structure.
        </p>
      ) : null}

      {/* Create / edit dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Edit Department' : 'New Department'}
        description={
          editing ? `Update ${editing.name}.` : 'Add an organizational unit to your structure.'
        }
      >
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="dept-name">Name</Label>
            <Input
              id="dept-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Engineering"
              required
            />
          </div>
          <div>
            <Label htmlFor="dept-description">Description</Label>
            <Textarea
              id="dept-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this department do?"
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="dept-parent">Parent Department</Label>
            <Select
              id="dept-parent"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              placeholder="None (top-level)"
              options={(departments ?? [])
                .filter((d) => d.id !== editing?.id)
                .map((d) => ({ value: d.id, label: d.name }))}
            />
          </div>
          <div>
            <Label htmlFor="dept-manager">Assigned Manager</Label>
            <Select
              id="dept-manager"
              value={managerUserId}
              onChange={(e) => setManagerUserId(e.target.value)}
              placeholder="Unassigned"
              options={managerOptions}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Create Department'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete confirm */}
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete department?"
        description={
          deleting
            ? `${deleting.name} will be removed from the organization structure. Departments with employees cannot be deleted.`
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
