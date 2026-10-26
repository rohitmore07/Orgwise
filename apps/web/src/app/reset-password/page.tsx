'use client';

import { ArrowRight, KeyRound, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { resetPasswordWithToken } from '@/lib/auth';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';

const FIELD_CLASS =
  'w-full rounded-lg border border-input bg-muted/50 py-2.5 pl-9 pr-4 text-sm placeholder:text-muted-foreground/70 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    const res = await resetPasswordWithToken(password, token);
    if (res.ok) {
      router.push('/signin?reset=1');
    } else {
      setErrorMsg(res.error ?? 'Could not reset your password');
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          Invalid reset link
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          This link is missing its reset token. It may be truncated or expired — request a new
          password reset to get a fresh link.
        </p>
        <Link
          href="/forgot-password"
          className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-500 dark:text-indigo-300 dark:hover:text-indigo-200"
        >
          Request a new link <ArrowRight className="size-3" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
        Choose a new password
      </h1>{' '}
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Pick a strong password — at least 8 characters. You&apos;ll use it the next time you sign
        in.
      </p>
      {errorMsg ? (
        <div
          role="alert"
          className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
        >
          {errorMsg}
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div>
          <label htmlFor="new-password" className="mb-1.5 block text-xs font-medium">
            New password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden />
            <input
              id="new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className={FIELD_CLASS}
            />
          </div>
        </div>

        <div>
          <label htmlFor="confirm-password" className="mb-1.5 block text-xs font-medium">
            Confirm new password
          </label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden />
            <input
              id="confirm-password"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••••••"
              className={FIELD_CLASS}
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="mt-2 w-full justify-center font-semibold"
        >
          {loading ? 'Resetting…' : 'Reset password'}
          {!loading ? <ArrowRight className="size-4" aria-hidden /> : null}
        </Button>
      </form>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Remembered your password?{' '}
        <Link
          href="/signin"
          className="font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-500 dark:text-indigo-300 dark:hover:text-indigo-200"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <Suspense
        fallback={<p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>}
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
