'use client';

import { ArrowRight, Lock, Mail, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { getStoredSession, signInWithEmail, signUpWithEmail, syncOAuthSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SocialButtons } from '@/components/auth/social-buttons';

export type AuthMode = 'signin' | 'signup';

interface AuthFormProps {
  mode: AuthMode;
}

const FIELD_CLASS =
  'w-full rounded-lg border border-input bg-muted/50 py-2.5 pl-9 pr-4 text-sm placeholder:text-muted-foreground/70 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justReset = searchParams.get('reset') === '1';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isSignUp = mode === 'signup';
  // Already signed in (locally or via a Better Auth session, e.g. returning
  // from an OAuth callback)? Skip the form and head to the workspace.
  useEffect(() => {
    if (getStoredSession()) {
      router.replace('/dashboard');
      return;
    }
    syncOAuthSession().then((session) => {
      if (session) router.replace('/dashboard');
    });
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const res = isSignUp
      ? await signUpWithEmail(email, password, name)
      : await signInWithEmail(email, password);
    if (res.error) {
      setErrorMsg(res.error);
    } else if (res.session) {
      router.push('/dashboard');
    }
    setLoading(false);
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
        {isSignUp ? 'Create your Enterprise Account' : 'Welcome back'}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {isSignUp
          ? 'Start with a free workspace and get real-time predictive workforce intelligence.'
          : 'Sign in to access your organization workspace and live workforce signals.'}
      </p>

      {justReset && !isSignUp ? (
        <div className="mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
          Password updated — sign in with your new password.
        </div>
      ) : null}

      {errorMsg ? (
        <div
          role="alert"
          className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
        >
          {errorMsg}
        </div>
      ) : null}

      <div className="mt-6">
        <SocialButtons />
      </div>

      <div className="relative my-6" aria-hidden>
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border/60" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-card px-3 text-xs uppercase tracking-wider text-muted-foreground/80">
            or continue with email
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isSignUp ? (
          <div>
            <label htmlFor="auth-name" className="mb-1.5 block text-xs font-medium">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden />
              <input
                id="auth-name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className={FIELD_CLASS}
              />
            </div>
          </div>
        ) : null}

        <div>
          <label htmlFor="auth-email" className="mb-1.5 block text-xs font-medium">
            Work Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden />
            <input
              id="auth-email"
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

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="auth-password" className="block text-xs font-medium">
              Password
            </label>
            {!isSignUp ? (
              <Link
                href="/forgot-password"
                className="text-[11px] font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-500 dark:text-indigo-300 dark:hover:text-indigo-200"
              >
                Forgot password?
              </Link>
            ) : null}
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden />
            <input
              id="auth-password"
              name="password"
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
          {loading ? 'Authenticating…' : isSignUp ? 'Create Account' : 'Sign In'}
          {!loading ? <ArrowRight className="size-4" aria-hidden /> : null}
        </Button>
      </form>

      <div className="mt-6 border-t border-border/60 pt-4 text-center">
        <p className="text-xs text-muted-foreground">
          {isSignUp ? 'Already have an enterprise workspace?' : "Don't have an account yet?"}{' '}
          <Link
            href={isSignUp ? '/signin' : '/signup'}
            className={cn(
              'font-medium text-indigo-600 underline underline-offset-2 transition-colors',
              'hover:text-indigo-500 dark:text-indigo-300 dark:hover:text-indigo-200',
            )}
          >
            {isSignUp ? 'Sign in' : 'Request access'}
          </Link>
        </p>
        <p className="mt-3 text-[11px] text-muted-foreground/70">
          Protected by SOC 2 Type II infrastructure · Your data stays in your region.
        </p>
      </div>
    </div>
  );
}
