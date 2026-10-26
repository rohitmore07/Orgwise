'use client';

import { ArrowRight, Mail, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { requestPasswordReset } from '@/lib/auth';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';

const FIELD_CLASS =
  'w-full rounded-lg border border-input bg-muted/50 py-2.5 pl-9 pr-4 text-sm placeholder:text-muted-foreground/70 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    const res = await requestPasswordReset(email);
    if (res.ok) {
      setSent(true);
    } else {
      setErrorMsg(res.error ?? 'Could not start password reset');
    }
    setLoading(false);
  }

  return (
    <AuthShell>
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          Reset your password
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Enter your work email and we&apos;ll send you a link to choose a new password.
        </p>

        {sent ? (
          <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  Check your inbox
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  If an account exists for <span className="font-medium">{email}</span>, a reset
                  link is on its way. The link expires after a short time — if it doesn&apos;t
                  arrive, check your spam folder.
                </p>
              </div>
            </div>
            <Link
              href="/signin"
              className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-500 dark:text-indigo-300 dark:hover:text-indigo-200"
            >
              Back to sign in <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>
        ) : (
          <>
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
                <label htmlFor="reset-email" className="mb-1.5 block text-xs font-medium">
                  Work Email
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-3 size-4 text-muted-foreground"
                    aria-hidden
                  />
                  <input
                    id="reset-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="leader@company.com"
                    className={FIELD_CLASS}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="mt-2 w-full justify-center font-semibold"
              >
                {loading ? 'Sending…' : 'Send reset link'}
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
          </>
        )}
      </div>
    </AuthShell>
  );
}
