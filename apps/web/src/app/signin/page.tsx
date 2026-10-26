import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth/auth-form';
import { AuthShell } from '@/components/auth/auth-shell';

export const metadata: Metadata = {
  title: 'Sign In',
  description:
    'Sign in to orgwise to access your organization workspace and live workforce intelligence.',
};

export default function SignInPage() {
  return (
    <AuthShell>
      <Suspense
        fallback={<p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>}
      >
        <AuthForm mode="signin" />
      </Suspense>
    </AuthShell>
  );
}
