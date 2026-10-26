import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell/app-shell';
import { ToastProvider } from '@/components/ui/toast';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'Workspace',
  description:
    'orgwise workspace — workforce analytics, employee management, organization structure and bulk imports.',
};
// Protected workspace shell. The edge middleware already redirects unauthenticated visitors to `/signin`; this…
// layout mounts the auth + toast providers and the role-aware sidebar.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppShell>{children}</AppShell>
      </ToastProvider>
    </AuthProvider>
  );
}
