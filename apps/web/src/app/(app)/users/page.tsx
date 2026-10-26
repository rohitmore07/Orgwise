'use client';

import type { User } from '@orgwise/types';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useCallback, useState } from 'react';
import { PageHeader } from '@/components/app-shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
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
import { useAsync } from '@/hooks/use-async';
import { api, ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/format';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'viewer', label: 'Viewer' },
];

const ROLE_BADGE = {
  admin: 'default',
  manager: 'info',
  viewer: 'secondary',
} as const;

export default function UsersPage() {
  const toast = useToast();
  const { profile } = useAuth();
  const { data: users, loading, error, refetch } = useAsync<User[]>(() => api.get('/users'));
  const [changingId, setChangingId] = useState<string | null>(null);

  const changeRole = useCallback(
    async (user: User, role: User['role']) => {
      if (role === user.role) return;
      setChangingId(user.id);
      try {
        await api.patch(`/users/${user.id}/role`, { role });
        toast.success(`${user.name} is now a ${role}`);
        await refetch();
      } catch (err) {
        toast.error(err instanceof ApiClientError ? err.message : 'Failed to update role');
      } finally {
        setChangingId(null);
      }
    },
    [refetch, toast],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Access Control"
        title="Users & Roles"
        description="Manage platform accounts and their access level. Managers gain scoped write access to their assigned departments."
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton rows={5} />
          ) : error ? (
            <ErrorState description={error} onRetry={() => void refetch()} />
          ) : users && users.length === 0 ? (
            <EmptyState
              title="No users yet"
              description="Accounts appear here once users sign in."
            />
          ) : users ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 text-xs font-semibold text-indigo-500 dark:text-indigo-300">
                          {initials(user.name || user.email)}
                        </div>
                        <p className="text-sm font-medium text-foreground">{user.name}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.employeeId ? 'Linked' : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={ROLE_BADGE[user.role]}>{user.role}</Badge>
                        {changingId === user.id ? (
                          <Loader2
                            className="size-3.5 animate-spin text-muted-foreground"
                            aria-hidden
                          />
                        ) : (
                          <Select
                            value={user.role}
                            onChange={(e) => void changeRole(user, e.target.value as User['role'])}
                            aria-label={`Change role for ${user.name}`}
                            options={ROLE_OPTIONS}
                            className="h-8 w-32 text-xs"
                            // You cannot change your own role (API enforces it) — keep the control disabled so admins don't hit the…
                            // confusing "cannot change your own role" error.
                            disabled={user.id === profile?.id}
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 text-emerald-500" aria-hidden />
        Role changes are applied immediately and recorded in the audit trail.
      </p>
    </div>
  );
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
