'use client';

import { ArrowLeft, Compass } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

/** Branded 404 page for unknown routes. */
export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 to-cyan-500/15">
          <Compass className="size-7 text-indigo-500 dark:text-indigo-300" aria-hidden />
        </div>
        <p className="mt-5 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          404
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you are looking for doesn&apos;t exist or has moved.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild>
            <Link href="/">
              <Compass className="size-4" aria-hidden /> Go home
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="size-4" aria-hidden /> Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
