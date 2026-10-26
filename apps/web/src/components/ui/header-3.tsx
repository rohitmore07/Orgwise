'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  BarChart,
  Code,
  FileText,
  MessageSquare,
  Network,
  Radar,
  Shield,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/landing/logo';
import { ThemeToggle } from '@/components/landing/theme-toggle';
import { getStoredSession, signOutNeon, syncOAuthSession, type NeonSession } from '@/lib/auth';
import { SignOutConfirmDialog } from '@/components/app-shell/sign-out-confirm-dialog';

type LinkItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description?: string;
};

const productLinks: LinkItem[] = [
  {
    title: 'Workforce Analytics',
    href: '#capabilities',
    description: 'Attrition, retention and engagement across departments',
    icon: BarChart,
  },
  {
    title: 'Department Comparison',
    href: '#capabilities',
    description: 'Head-to-head metrics with company averages',
    icon: Network,
  },
  {
    title: 'Executive Summary',
    href: '#capabilities',
    description: 'Board-ready narrative with print/PDF export',
    icon: FileText,
  },
  {
    title: 'Engagement Analytics',
    href: '#capabilities',
    description: 'Job, environment and relationship satisfaction scores',
    icon: MessageSquare,
  },
  {
    title: 'Workforce Copilot',
    href: '#solutions',
    description: 'Ask questions about your workforce in plain English',
    icon: Radar,
  },
  {
    title: 'CSV Import & API',
    href: '#solutions',
    description: 'Secure pipeline for employee and hiring records',
    icon: Code,
  },
];

const companyLinks: LinkItem[] = [
  { title: 'About Us', href: '#top', description: 'The team behind orgwise', icon: Users },
  {
    title: 'Role-Based Access',
    href: '#solutions',
    description: 'Admins, managers and viewers see only what they should',
    icon: Shield,
  },
  {
    title: 'Live Sandbox',
    href: '/sandbox',
    description: 'Explore the product with sample data',
    icon: Code,
  },
];

const companyLinks2: LinkItem[] = [
  { title: 'Terms of Service', href: '/legal/terms', icon: FileText },
  { title: 'Privacy Policy', href: '/legal/privacy', icon: Shield },
  { title: 'Data Processing Addendum', href: '/legal/dpa', icon: FileText },
];

function useScroll(threshold: number) {
  const [scrolled, setScrolled] = React.useState(false);

  const onScroll = React.useCallback(() => {
    setScrolled(window.scrollY > threshold);
  }, [threshold]);

  React.useEffect(() => {
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  // Also check on first load.
  React.useEffect(() => {
    onScroll();
  }, [onScroll]);

  return scrolled;
}

export function Header() {
  const [open, setOpen] = React.useState(false);
  const [session, setSession] = React.useState<NeonSession | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const scrolled = useScroll(10);

  React.useEffect(() => {
    setSession(getStoredSession());
    // Pick up a Managed Better Auth session (e.g. after an OAuth redirect) so
    // the signed-in indicator appears without a hard refresh.
    if (!getStoredSession()) {
      syncOAuthSession().then((s) => {
        if (s) setSession(s);
      });
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-50 w-full transition-[padding] duration-500 ease-out',
          scrolled && 'py-2.5',
        )}
      >
        <nav
          className={cn(
            'mx-auto flex w-full items-center justify-between px-5 transition-all duration-500 ease-out sm:px-8',
            scrolled
              ? 'h-14 max-w-6xl rounded-2xl border border-border/60 bg-background/85 shadow-lg shadow-black/5 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60'
              : 'h-16 max-w-7xl border-b border-transparent bg-transparent',
          )}
        >
          <div className="flex items-center gap-5">
            <a
              href="#top"
              className="group rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <Logo shimmer />
            </a>
            <NavigationMenu className="hidden md:flex">
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="bg-transparent">Product</NavigationMenuTrigger>
                  <NavigationMenuContent className="bg-background p-1 pr-1.5">
                    <ul className="bg-popover grid w-lg grid-cols-2 gap-2 rounded-md border p-2 shadow">
                      {productLinks.map((item, i) => (
                        <li key={i}>
                          <ListItem {...item} />
                        </li>
                      ))}
                    </ul>
                    <div className="p-2">
                      <p className="text-sm text-muted-foreground">
                        Interested?{' '}
                        <a href="#pricing" className="font-medium text-foreground hover:underline">
                          Schedule a demo
                        </a>
                      </p>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="bg-transparent">Company</NavigationMenuTrigger>
                  <NavigationMenuContent className="bg-background p-1 pb-1.5 pr-1.5">
                    <div className="grid w-lg grid-cols-2 gap-2">
                      <ul className="bg-popover space-y-2 rounded-md border p-2 shadow">
                        {companyLinks.map((item, i) => (
                          <li key={i}>
                            <ListItem {...item} />
                          </li>
                        ))}
                      </ul>
                      <ul className="space-y-2 p-3">
                        {companyLinks2.map((item, i) => (
                          <li key={i}>
                            <NavigationMenuLink
                              href={item.href}
                              className="flex flex-row items-center gap-x-2 rounded-md p-2 hover:bg-accent"
                            >
                              <item.icon className="size-4 text-foreground" />
                              <span className="font-medium">{item.title}</span>
                            </NavigationMenuLink>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <a
                    href="#pricing"
                    className="rounded-md px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                  >
                    Pricing
                  </a>
                </NavigationMenuLink>
              </NavigationMenuList>
            </NavigationMenu>
          </div>
          <div className="hidden items-center gap-2.5 md:flex">
            <ThemeToggle />
            {session ? (
              <div className="flex items-center gap-2">
                <span
                  className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300"
                  title={session.user.email}
                >
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  {session.user.name || session.user.email}
                </span>
                <Button size="sm" className="group relative overflow-hidden" asChild>
                  <Link href="/dashboard">
                    <span aria-hidden className="btn-shine absolute inset-0" />
                    <span className="relative">Open dashboard</span>
                  </Link>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
                  Sign Out
                </Button>
              </div>
            ) : (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/signin">Sign In</Link>
                </Button>
                <Button size="sm" className="group relative overflow-hidden" asChild>
                  <Link href="/signup">
                    <span aria-hidden className="btn-shine absolute inset-0" />
                    <span className="relative">Request Demo</span>
                  </Link>
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <Button
              size="icon"
              variant="outline"
              onClick={() => setOpen(!open)}
              className="md:hidden"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label="Toggle menu"
            >
              <MenuToggleIcon open={open} className="size-5" duration={300} />
            </Button>
          </div>
        </nav>
        <MobileMenu
          open={open}
          onClose={() => setOpen(false)}
          className={cn(scrolled ? 'top-[4.75rem]' : 'top-16')}
        >
          <NavigationMenu className="max-w-full">
            <div className="flex w-full flex-col gap-y-4">
              <div className="flex flex-col gap-y-2">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Product
                </span>
                {productLinks.map((link) => (
                  <ListItem key={link.title} {...link} onClick={() => setOpen(false)} />
                ))}
              </div>
              <div className="flex flex-col gap-y-2 border-t border-border pt-4">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Company
                </span>
                {companyLinks.map((link) => (
                  <ListItem key={link.title} {...link} onClick={() => setOpen(false)} />
                ))}
                {companyLinks2.map((link) => (
                  <ListItem key={link.title} {...link} onClick={() => setOpen(false)} />
                ))}
              </div>
            </div>
          </NavigationMenu>
          <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
            {session ? (
              <>
                <Button className="w-full" asChild>
                  <Link href="/dashboard" onClick={() => setOpen(false)}>
                    Open dashboard
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="w-full bg-transparent"
                  onClick={() => {
                    setConfirmOpen(true);
                  }}
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" className="w-full bg-transparent" asChild>
                  <Link href="/signin" onClick={() => setOpen(false)}>
                    Sign In
                  </Link>
                </Button>
                <Button className="w-full" asChild>
                  <Link href="/signup" onClick={() => setOpen(false)}>
                    Request Demo
                  </Link>
                </Button>
              </>
            )}
          </div>
        </MobileMenu>
        <SignOutConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          onConfirm={async () => {
            await signOutNeon();
            setSession(null);
            setOpen(false);
          }}
          userName={session?.user?.name || session?.user?.email}
        />
      </header>
    </>
  );
}

type MobileMenuProps = React.ComponentProps<'div'> & {
  open: boolean;
  onClose: () => void;
};

function MobileMenu({ open, onClose, children, className, ...props }: MobileMenuProps) {
  // ESC closes the panel; the header also locks body scroll while open.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof window === 'undefined') return null;

  return createPortal(
    <>
      {/* Tap-away backdrop below the sticky header. */}
      <div
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[slot=open]:animate-in data-[slot=open]:fade-in-0 md:hidden"
        data-slot={open ? 'open' : 'closed'}
      />
      {/* Full-height panel anchored below the header — content scrolls, actions stay pinned. */}
      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        data-slot={open ? 'open' : 'closed'}
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 flex flex-col overflow-hidden',
          'border-y border-border bg-background/95 supports-[backdrop-filter]:bg-background/85 backdrop-blur-xl',
          'data-[slot=open]:animate-in data-[slot=open]:slide-in-from-top-3 data-[slot=open]:fade-in-0 ease-out',
          // top offset matches the header height (top-16 at rest, below the floating pill when scrolled)
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <p className="font-display text-sm font-semibold text-foreground">Menu</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4.5" aria-hidden />
          </button>
        </div>
        {/* Scrollable body + pinned actions */}
        <div
          className="flex min-h-0 flex-1 flex-col justify-between overflow-y-auto overscroll-contain px-5 py-4"
          {...props}
        >
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
}

function ListItem({
  title,
  description,
  icon: Icon,
  className,
  href,
  ...props
}: React.ComponentProps<typeof NavigationMenuLink> & LinkItem) {
  return (
    <NavigationMenuLink
      className={cn(
        'flex w-full flex-row gap-x-2 rounded-md p-2 hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none data-[active=true]:bg-accent/50 data-[active=true]:text-accent-foreground',
        className,
      )}
      {...props}
      asChild
    >
      <a href={href}>
        <div className="flex aspect-square size-10 items-center justify-center rounded-md border bg-muted shadow-sm">
          <Icon className="size-5 text-foreground" />
        </div>
        <div className="flex flex-col items-start justify-center">
          <span className="font-medium">{title}</span>
          {description ? (
            <span className="text-xs text-muted-foreground">{description}</span>
          ) : null}
        </div>
      </a>
    </NavigationMenuLink>
  );
}
