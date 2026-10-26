'use client';

import { ArrowRight, BarChart3, MousePointerClick, UploadCloud } from 'lucide-react';
import { SectionHeading } from './decor';
import { Reveal } from './reveal';

const STEPS = [
  {
    icon: UploadCloud,
    step: '01',
    title: 'Connect your data',
    description:
      'Upload a workforce CSV — employees, departments, teams, and hiring records — through the secure import pipeline. Data is validated, deduplicated, and loaded into PostgreSQL.',
  },
  {
    icon: BarChart3,
    step: '02',
    title: 'Analyze your workforce',
    description:
      'Attrition, engagement, composition, productivity, and talent metrics are computed automatically across departments, teams, and roles — with an executive summary and insights.',
  },
  {
    icon: MousePointerClick,
    step: '03',
    title: 'Take action',
    description:
      'Drill from a chart to the employees behind it, compare departments, and ask the orgwise Copilot to investigate patterns — then export a board-ready report.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="How it works"
          title="From raw CSV to strategic insight in three steps"
          description="No data team required — import a file and orgwise does the rest."
        />
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {STEPS.map((step, index) => (
            <Reveal key={step.step} delay={0.1 * index}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-border surface p-7 backdrop-blur-md transition-colors duration-300 hover:border-foreground/20">
                <div className="flex items-center justify-between">
                  <span className="flex size-12 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-500 transition-colors duration-300 group-hover:bg-indigo-500/20 dark:text-indigo-300">
                    <step.icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-mono text-sm font-semibold text-muted-foreground/50">
                    {step.step}
                  </span>
                </div>
                <h3 className="mt-6 font-display text-lg font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
                {index < STEPS.length - 1 ? (
                  <ArrowRight
                    aria-hidden
                    className="absolute top-1/2 -right-3 hidden size-5 -translate-y-1/2 text-muted-foreground/30 lg:block"
                  />
                ) : null}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
