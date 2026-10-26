import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth/auth-form';
import { AuthShell } from '@/components/auth/auth-shell';

export const metadata: Metadata = {
  title: 'Request Access',
  description:
    'Create your orgwise enterprise account and start with real-time predictive workforce intelligence.',
};

export default function SignUpPage() {
  return (
    <AuthShell>
      <Suspense
        fallback={<p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>}
      >
        <AuthForm mode="signup" />
      </Suspense>
    </AuthShell>
  );
}
