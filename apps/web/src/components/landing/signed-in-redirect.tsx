'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { syncOAuthSession } from '@/lib/auth';
// Redirects signed-in visitors away from the marketing site into the workspace. This is the safety net for the…
// OAuth handshake. When Neon Auth finishes a Google/GitHub sign-in it lands the browser back on the app with a…
export function SignedInRedirect() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const session = await syncOAuthSession();
      if (!cancelled && session) {
        router.replace('/dashboard');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
