'use client';

import { CountUp } from './count-up';
import { SectionHeading } from './decor';
import { Reveal } from './reveal';

const stats = [
  {
    value: 100,
    suffix: '%',
    decimals: 0,
    label: 'Analytics coverage',
    description: 'Every imported employee scored on engagement and risk dimensions',
  },
  {
    value: 6,
    suffix: '',
    decimals: 0,
    label: 'Auto-generated insights',
    description: 'Observed patterns surfaced from your workforce data',
  },
  {
    value: 4,
    suffix: '',
    decimals: 0,
    label: 'Hiring metrics',
    description: 'Time-to-hire, cost-per-hire, offer acceptance, pipeline health',
  },
  {
    value: 1,
    suffix: '',
    decimals: 0,
    label: 'One-click executive summary',
    description: 'Board-ready narrative with print/PDF export',
  },
];

export function Roi() {
  return (
    <section className="scroll-mt-24 bg-muted/40 py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Impact"
          title="Intelligence you can act on"
          description="Every number here is computed from the data you import — no marketing averages."
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <Reveal key={stat.label} delay={0.08 * index}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-border surface p-6 backdrop-blur-md transition-colors duration-300 hover:border-foreground/20">
                <p className="font-display text-5xl font-semibold tracking-tight">
                  <span className="text-gradient">
                    <CountUp to={stat.value} suffix={stat.suffix} decimals={stat.decimals} />
                  </span>
                </p>
                <p className="mt-4 text-sm font-semibold text-foreground">{stat.label}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {stat.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
