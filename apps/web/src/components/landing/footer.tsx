import Link from 'next/link';
import { GithubIcon, LinkedinIcon, XIcon } from './social-icons';
import { Logo } from './logo';
import { NoiseOverlay } from './decor';
import { ScrollToTopLink } from './scroll-to-top';

const socials = [
  { label: 'GitHub', icon: GithubIcon },
  { label: 'LinkedIn', icon: LinkedinIcon },
  { label: 'X', icon: XIcon },
];

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-border/40 bg-background">
      {/* Premium brand-lit hairline along the top edge (decorative) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent dark:via-indigo-400/40"
      />
      {/* Indigo bloom spilling down from the top edge — stronger in dark where near-black swallows low alphas (decorative) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(60%_100%_at_50%_0%,--theme(--color-indigo-500/0.12),transparent_70%)] dark:bg-[radial-gradient(60%_100%_at_50%_0%,--theme(--color-indigo-400/0.16),transparent_70%)]"
      />
      {/* Cyan bloom rising from the bottom edge — echoes the watermark's cyan accent (decorative) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[radial-gradient(60%_100%_at_50%_100%,--theme(--color-cyan-500/0.09),transparent_70%)] dark:bg-[radial-gradient(60%_100%_at_50%_100%,--theme(--color-cyan-400/0.12),transparent_70%)]"
      />
      {/* Giant background watermark — sits BEHIND all footer content and takes zero layout space. Links back to the top; glows and shimmers on hover. */}
      <div className="absolute inset-0 z-0 flex select-none items-end justify-center overflow-hidden">
        {/* Radial brand glow so the watermark melts into the background (decorative only) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 top-1/4 bg-[radial-gradient(60%_110%_at_50%_100%,--theme(--color-indigo-500/0.14),transparent_72%),radial-gradient(38%_80%_at_68%_100%,--theme(--color-cyan-500/0.09),transparent_72%)]"
        />
        <ScrollToTopLink
          aria-label="Back to top"
          className="group block cursor-pointer rounded-xl transition-[opacity,transform] duration-300 ease-out hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <span className="sr-only">Back to top</span>
          {/* Masked fade so the giant wordmark melts into the footer as it climbs */}
          <span
            aria-hidden
            className="relative block -mb-[0.18em] [mask-image:linear-gradient(to_top,black_55%,transparent_96%)] [-webkit-mask-image:linear-gradient(to_top,black_55%,transparent_96%)]"
          >
            <p className="watermark-glow relative text-center font-display text-[clamp(6rem,18vw,17rem)] font-bold leading-[0.85] tracking-tighter">
              {/* Premium brand-gradient wordmark — neutral → indigo → cyan across the whole word, low-opacity watermark that brightens on hover */}
              <span className="bg-gradient-to-r from-foreground/[0.1] via-indigo-500/[0.15] to-cyan-500/[0.13] bg-clip-text text-transparent duration-300 group-hover:from-foreground/[0.2] group-hover:via-indigo-500/[0.3] group-hover:to-cyan-500/[0.26] dark:from-foreground/[0.13] dark:via-indigo-300/[0.2] dark:to-cyan-400/[0.17] dark:group-hover:from-foreground/[0.24] dark:group-hover:via-indigo-300/[0.36] dark:group-hover:to-cyan-400/[0.32]">
                orgwise
              </span>
            </p>
            {/* Animated gradient shimmer sweeping across the glyphs on hover */}
            <span
              aria-hidden
              className="watermark-shimmer pointer-events-none absolute inset-0 text-center font-display text-[clamp(6rem,18vw,17rem)] font-bold leading-[0.85] tracking-tighter"
            >
              orgwise
            </span>
          </span>
        </ScrollToTopLink>
      </div>

      {/* Film-grain noise over the watermark for depth (decorative) */}
      <NoiseOverlay />

      {/* Content layer — editorial brand block + link columns, floating above the watermark */}
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col px-5 pt-16 sm:px-8">
        <div className="flex flex-col justify-between gap-12 md:flex-row md:items-start">
          {/* Brand block */}
          <div className="max-w-sm">
            <a
              href="#top"
              className="group flex w-fit items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <Logo size="sm" />
            </a>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Enterprise Workforce Intelligence Platform — workforce analytics, insights, and an AI
              copilot for HR leaders and executives.
            </p>
            <div className="mt-6 flex items-center gap-3">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href="#top"
                  aria-label={social.label}
                  className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted/50 text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-foreground hover:shadow-[0_4px_20px_rgba(99,102,241,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  <social.icon className="size-4" />
                </a>
              ))}
            </div>
          </div>{' '}
          {/* Link columns */}
          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-x-12 gap-y-10 sm:grid-cols-2 md:grid-cols-4 md:gap-x-16"
          >
            <FooterColumn
              title="Product"
              links={[
                { label: 'Capabilities', href: '/#capabilities' },
                { label: 'How it works', href: '/#how-it-works' },
                { label: 'Solutions', href: '/#solutions' },
                { label: 'Pricing', href: '/#pricing' },
                { label: 'Live Sandbox', href: '/sandbox' },
              ]}
            />
            <FooterColumn
              title="Company"
              links={[
                { label: 'About', href: '/#top' },
                { label: 'Enterprise', href: '/#enterprise' },
                { label: 'Contact', href: '/signup' },
              ]}
            />
            <FooterColumn
              title="Resources"
              links={[
                { label: 'Documentation', href: '/#capabilities' },
                { label: 'API Reference', href: '/sandbox' },
                { label: 'Guides', href: '/#solutions' },
                { label: 'Compliance', href: '/#enterprise' },
              ]}
            />
            <FooterColumn
              title="Legal"
              links={[
                { label: 'Privacy', href: '/legal/privacy' },
                { label: 'Terms', href: '/legal/terms' },
                { label: 'Security', href: '/#enterprise' },
                { label: 'DPA', href: '/legal/dpa' },
              ]}
            />
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-border/40 pt-6 pb-10 sm:flex-row sm:items-center">
          {/* `suppressHydrationWarning`: the year is time-dependent — the server renders it at request time and the client… at hydration time. They can disagree (a request straddling a year boundary), which is exactly the case React… */}
          <p className="text-xs text-muted-foreground/70" suppressHydrationWarning>
            © {new Date().getFullYear()} orgwise. All rights reserved.
          </p>
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs text-muted-foreground">
            <span aria-hidden className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
            </span>
            All systems operational
          </div>
        </div>
      </div>
    </footer>
  );
}
function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; href: string }>;
}) {
  return (
    <div>
      <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span aria-hidden className="size-1 rounded-full bg-indigo-500/80 dark:bg-indigo-400/80" />
        {title}
      </h2>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="group/link relative inline-block text-sm text-muted-foreground/80 transition-all duration-200 hover:translate-x-0.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              {link.label}
              <span
                aria-hidden
                className="absolute -bottom-0.5 left-0 h-px w-0 bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all duration-300 group-hover/link:w-full"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
