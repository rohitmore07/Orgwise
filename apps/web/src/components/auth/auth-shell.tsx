'use client';

import { ArrowLeft, BarChart3, Network, Radar, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { GlowOrb, GridPattern, NoiseOverlay } from '@/components/landing/decor';
import { Logo } from '@/components/landing/logo';
import { ThemeToggle } from '@/components/landing/theme-toggle';

const VALUE_PROPS = [
  {
    icon: Network,
    title: 'Unified data mesh',
    description: 'HRIS, ATS, and engagement normalized into one governed model.',
  },
  {
    icon: Radar,
    title: 'Attrition prediction',
    description: 'Flight-risk scoring with policy simulation across scenarios.',
  },
  {
    icon: BarChart3,
    title: 'Board-ready analytics',
    description: 'Executive narratives generated from live workforce signals.',
  },
];

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Ambient backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <GridPattern />
        <GlowOrb className="-top-40 -left-40 bg-indigo-600/25" size={560} />
        <GlowOrb className="top-1/3 -right-40 bg-cyan-500/10" size={520} duration={11} />
        <NoiseOverlay />
      </div>

      {/* Top bar */}
      <header className="relative z-20 mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          aria-label="orgwise home"
          className="rounded-md p-1 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/"
            className="hidden items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:flex"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to site
          </Link>
        </div>
      </header>

      {/* Split layout */}
      <main className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-10 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:pb-24 lg:pt-10">
        {/* Brand / value panel */}
        <div className="hidden lg:block">
          <p className="eyebrow">Enterprise Workforce Intelligence</p>
          <h1 className="mt-4 text-balance font-display text-4xl font-semibold leading-tight tracking-tight text-foreground xl:text-5xl">
            Turn fragmented HR data into{' '}
            <span className="text-gradient">organizational foresight</span>
          </h1>
          <p className="mt-4 max-w-md text-pretty leading-relaxed text-muted-foreground">
            One platform to monitor workforce health, predict attrition, and report to the board —
            with real-time signals across every system you already use.
          </p>

          <ul className="mt-10 space-y-5">
            {VALUE_PROPS.map((item) => (
              <li key={item.title} className="flex items-start gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card/80 shadow-sm backdrop-blur">
                  <item.icon className="size-5 text-indigo-500 dark:text-indigo-300" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex items-center gap-2.5 rounded-xl border border-border bg-card/60 px-4 py-3 text-xs text-muted-foreground backdrop-blur">
            <ShieldCheck className="size-4 shrink-0 text-emerald-500" aria-hidden />
            SOC 2 Type II · GDPR · ISO 27001 — enterprise-grade security by default.
          </div>
        </div>

        {/* Form panel */}
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-2xl border border-border bg-card/80 p-6 shadow-2xl shadow-indigo-500/10 backdrop-blur-xl sm:p-8">
            {children}
          </div>
          <p className="mt-5 text-center text-xs text-muted-foreground/70 lg:hidden">
            Protected by SOC 2 Type II infrastructure · Your data stays in your region.
          </p>
        </div>
      </main>
    </div>
  );
}
