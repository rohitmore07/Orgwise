'use client';

import { useState } from 'react';
import { signInWithOAuth, type OAuthProvider } from '@/lib/auth';
import { cn } from '@/lib/utils';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.09-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l2.85-2.22.81-.61Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
      />
    </svg>
  );
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 2.87-.39c.97 0 1.95.13 2.87.39 2.19-1.49 3.15-1.18 3.15-1.18.62 1.58.23 2.75.11 3.04.73.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.66.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

const PROVIDERS: Array<{ id: OAuthProvider; label: string; Icon: typeof GoogleIcon }> = [
  { id: 'google', label: 'Google', Icon: GoogleIcon },
  { id: 'github', label: 'GitHub', Icon: GithubIcon },
];

export function SocialButtons() {
  const [loading, setLoading] = useState<OAuthProvider | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handle(provider: OAuthProvider) {
    setLoading(provider);
    setErrorMsg(null);
    // Default callback lands on the workspace dashboard — sending the user back to the public landing page after a…
    // successful login would strand them on the marketing site while signed in.
    const res = await signInWithOAuth(provider);
    if (res.error) {
      setErrorMsg(res.error);
      setLoading(null);
    }
    // On success the browser is redirected away by the OAuth flow.
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {PROVIDERS.map(({ id, label, Icon }) => {
          const isPending = loading === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handle(id)}
              disabled={loading !== null}
              aria-label={`Continue with ${label}`}
              className={cn(
                'group flex items-center justify-center gap-2.5 rounded-lg border border-border bg-muted/30 py-2.5 text-sm font-medium text-foreground',
                'transition-all duration-200 hover:border-indigo-500/40 hover:bg-indigo-500/5 hover:shadow-[0_4px_20px_rgba(99,102,241,0.15)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400',
                'disabled:cursor-not-allowed disabled:opacity-60',
              )}
            >
              <Icon className="size-4" />
              <span>{isPending ? 'Redirecting…' : label}</span>
            </button>
          );
        })}
      </div>
      {errorMsg ? (
        <p role="alert" className="mt-3 text-xs text-destructive">
          {errorMsg}
        </p>
      ) : null}
    </div>
  );
}
