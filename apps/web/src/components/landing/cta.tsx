'use client';

import { CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@orgwise/ui';
import { Eyebrow, GlowOrb } from './decor';
import { Magnetic } from './magnetic';
import { Reveal } from './reveal';

export function Cta() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (email.trim().length > 0) {
      setSubmitted(true);
    }
  }

  return (
    <section id="pricing" className="scroll-mt-24 py-24">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <Reveal>
          <div className="glass relative overflow-hidden rounded-3xl px-6 py-16 text-center sm:px-12">
            <GlowOrb className="-top-40 left-1/4 bg-indigo-600/25" size={440} />
            <GlowOrb className="-bottom-40 right-1/4 bg-cyan-500/15" size={440} duration={11} />
            <div className="relative mx-auto max-w-2xl">
              <Eyebrow>Enterprise</Eyebrow>
              <h2 className="mt-4 text-balance font-display text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
                Ready to see your workforce in real time?
              </h2>
              <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">
                Import your workforce CSV and see your first live dashboard in minutes — or explore
                the sandbox with sample data before you connect anything.
              </p>

              {submitted ? (
                <div
                  className="mx-auto mt-9 flex max-w-md items-center justify-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-6 py-5 text-emerald-600 dark:text-emerald-300"
                  role="status"
                >
                  <CheckCircle2 className="size-5 shrink-0" aria-hidden />
                  <p className="text-left text-sm">
                    Request received. Our team will reach out within one business day to schedule
                    your demo.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="mx-auto mt-9 flex max-w-md flex-col gap-3 sm:flex-row"
                >
                  <label htmlFor="cta-email" className="sr-only">
                    Work email
                  </label>
                  <input
                    id="cta-email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    className="h-11 flex-1 rounded-lg border border-border bg-muted/50 px-4 text-sm text-foreground backdrop-blur-md placeholder:text-muted-foreground/70 focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                  <Magnetic className="shrink-0">
                    <Button type="submit" size="lg" className="group relative overflow-hidden">
                      <span aria-hidden className="btn-shine absolute inset-0" />
                      <span className="relative">Request Demo</span>
                    </Button>
                  </Magnetic>
                </form>
              )}

              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground/80">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck
                    className="size-3.5 text-emerald-500 dark:text-emerald-400"
                    aria-hidden
                  />
                  Free to explore — live sandbox
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck
                    className="size-3.5 text-emerald-500 dark:text-emerald-400"
                    aria-hidden
                  />
                  Role-based access control
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-indigo-600 dark:text-indigo-300" aria-hidden />
                  Guided onboarding with sample data
                </span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
