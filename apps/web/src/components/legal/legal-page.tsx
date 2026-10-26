import Link from 'next/link';
import { Footer } from '@/components/landing/footer';
import { GlowOrb, NoiseOverlay } from '@/components/landing/decor';
import { Header } from '@/components/ui/header-3';

export type LegalSection = {
  heading: string;
  body: string[];
};

export function LegalPage({
  eyebrow = 'Legal',
  title,
  updated,
  intro,
  sections,
}: {
  eyebrow?: string;
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <div
      id="top"
      className="relative min-h-screen overflow-x-clip bg-background text-foreground selection:bg-indigo-500/40"
    >
      <Header />
      {/* Ambient decor behind the prose (decorative) */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <GlowOrb className="-top-40 -left-40 bg-indigo-600/12" size={560} />
        <GlowOrb className="top-1/2 -right-40 bg-cyan-500/8" size={480} duration={11} />
        <NoiseOverlay />
      </div>
      <main className="relative z-10 mx-auto w-full max-w-3xl px-5 pb-24 pt-16 sm:px-8 sm:pt-20">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <span aria-hidden>←</span> Back to orgwise
        </Link>
        <p className="eyebrow mt-12">{eyebrow}</p>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          {title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: {updated}</p>
        <p className="mt-8 text-pretty leading-relaxed text-muted-foreground">{intro}</p>

        <div className="mt-10 space-y-10 border-t border-border/60 pt-10">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
                {section.heading}
              </h2>
              <div className="mt-3 space-y-3">
                {section.body.map((paragraph, index) => (
                  <p key={index} className="text-sm leading-relaxed text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-12 text-sm text-muted-foreground/70">
          Questions about this document? Contact us at{' '}
          <a
            href="mailto:legal@orgwise.com"
            className="text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
          >
            legal@orgwise.com
          </a>
          .
        </p>
      </main>
      <Footer />
    </div>
  );
}
