'use client';

import { Fingerprint, Globe, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { SectionHeading } from './decor';
import { Reveal } from './reveal';

const controls = [
  {
    icon: ShieldCheck,
    title: 'Role-based Access',
    description: 'Admin, manager, and viewer roles with department-level scoping',
  },
  {
    icon: Fingerprint,
    title: 'Secure Sessions',
    description: 'Neon Auth sign-in with server-validated, expiring sessions',
  },
  {
    icon: KeyRound,
    title: 'Audit Trail',
    description: 'Every state-changing action recorded with actor and timestamp',
  },
  {
    icon: Lock,
    title: 'Field-level Privacy',
    description: 'Salary and personal fields gated to authorized roles',
  },
  {
    icon: Globe,
    title: 'Data Quality Governance',
    description: 'Imports validated with per-row error reports and a dataset health score',
  },
];

export function Security() {
  return (
    <section id="enterprise" className="scroll-mt-24 py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Enterprise Security & Governance"
          title="Governance your workforce team can rely on"
          description="Access control is enforced on the backend for every API — never just hidden in the UI."
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {controls.map((item, index) => (
            <Reveal key={item.title} delay={0.08 * index}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-border surface p-6 backdrop-blur-md transition-colors duration-300 hover:border-indigo-400/40">
                <div
                  aria-hidden
                  className="absolute -top-16 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full bg-indigo-500/0 blur-2xl transition-colors duration-500 group-hover:bg-indigo-500/20"
                />
                <div className="relative">
                  <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 text-indigo-600 transition-transform duration-300 group-hover:scale-110 dark:text-indigo-300">
                    <item.icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.2} className="mt-10 text-center">
          <p className="text-sm text-muted-foreground/80">
            Role-scoped access · complete audit trail · no sensitive data written to logs
          </p>
        </Reveal>
      </div>
    </section>
  );
}
