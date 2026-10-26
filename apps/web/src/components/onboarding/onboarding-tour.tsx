'use client';

import { ArrowRight, Bot, LayoutDashboard, ScanLine, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'orgwise_onboarded';
const CARD_WIDTH = 320;

const STEPS = [
  {
    target: 'sidebar',
    title: 'Navigate your workspace',
    body: 'Employees, departments, teams, imports and admin tools all live in the sidebar.',
    icon: LayoutDashboard,
  },
  {
    target: 'kpis',
    title: 'Monitor workforce health',
    body: 'Headcount, attrition, tenure and more — every metric reacts to the global filters.',
    icon: ScanLine,
  },
  {
    target: 'imports-link',
    title: 'Bring in employee data',
    body: 'Upload a CSV and the analytics engine handles validation, dedup and insights.',
    icon: Upload,
  },
  {
    target: 'copilot',
    title: 'Ask about your workforce',
    body: 'Ask natural-language questions and get grounded answers with deep links into the data.',
    icon: Bot,
  },
] as const;

/** One-time guided tour shown on the first dashboard visit. */
export function OnboardingTour() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setVisible(localStorage.getItem(STORAGE_KEY) !== '1');
  }, []);

  const measure = useCallback(() => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${STEPS[step]!.target}"]`);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  useEffect(() => {
    if (!visible) return;
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [visible, measure]);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const finish = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }, []);

  if (!mounted || !visible) return null;

  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;
  const anchored = Boolean(rect && rect.width > 0 && rect.top > -20 && rect.bottom > 0);

  const cardStyle =
    anchored && rect
      ? {
          left: Math.min(Math.max(16, rect.left), window.innerWidth - CARD_WIDTH - 16),
          top:
            rect.bottom + 16 + 232 < window.innerHeight
              ? rect.bottom + 16
              : Math.max(16, rect.top - 232 - 16),
          width: CARD_WIDTH,
        }
      : undefined;

  const card = (
    <div
      className="rounded-2xl border border-border bg-card p-6 shadow-2xl"
      style={cardStyle ? undefined : { width: `min(${CARD_WIDTH}px, calc(100vw - 2rem))` }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 to-cyan-500/15">
          <current.icon className="size-5 text-indigo-500 dark:text-indigo-300" aria-hidden />
        </span>
        <button
          type="button"
          onClick={finish}
          aria-label="Skip tour"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <p className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Step {step + 1} of {STEPS.length}
      </p>
      <h3 className="mt-1 font-display text-base font-semibold tracking-tight text-foreground">
        {current.title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{current.body}</p>
      <div className="mt-5 flex items-center justify-between">
        <div className="flex items-center gap-1.5" aria-hidden>
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === step ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/30',
              )}
            />
          ))}
        </div>
        <Button size="sm" onClick={() => (isLast ? finish() : setStep((s) => s + 1))}>
          {isLast ? 'Get started' : 'Next'}
          <ArrowRight className="size-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  );

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Welcome tour" className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" aria-hidden />
      {anchored && rect ? (
        <div
          className="absolute rounded-2xl border-2 border-primary shadow-[0_0_0_4px_rgba(99,102,241,0.25)] transition-all duration-300"
          style={{
            left: rect.left - 8,
            top: rect.top - 8,
            width: rect.width + 16,
            height: rect.height + 16,
          }}
          aria-hidden
        />
      ) : null}
      {anchored && cardStyle ? (
        <div className="absolute" style={cardStyle}>
          {card}
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-4">{card}</div>
      )}
    </div>,
    document.body,
  );
}
