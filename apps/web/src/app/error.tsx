'use client';

import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
// App-level error boundary (Next.js `error.tsx`). Catches runtime errors that escape a route's own error states…
// and renders a branded recovery screen instead of a white page. Logs the error for debugging while keeping the…
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[orgwise] unhandled route error', error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="size-7 text-destructive" aria-hidden />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error occurred while rendering this page. Your session is safe — try again,
          or head back to the dashboard.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={reset}>
            <RotateCcw className="size-4" aria-hidden /> Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">
              <Home className="size-4" aria-hidden /> Home
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
