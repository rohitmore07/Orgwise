'use client';

import { MotionConfig } from 'framer-motion';
import { SignedInRedirect } from './signed-in-redirect';
import { Header } from '@/components/ui/header-3';
import { HeroSection } from '@/components/ui/hero-3';
import { Bento } from './bento';
import { Cta } from './cta';
import { HowItWorks } from './how-it-works';
import { Footer } from './footer';
import { Roi } from './roi';
import { Security } from './security';
import { Showcase } from './showcase';

export function Landing() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen overflow-x-clip bg-background text-foreground selection:bg-indigo-500/40">
        {/* Completes the OAuth handshake + bounces signed-in visitors to the workspace. */}
        <SignedInRedirect />
        <Header />
        <main>
          <HeroSection />
          <Bento />
          <HowItWorks />
          <Showcase />
          <Security />
          <Roi />
          <Cta />
        </main>
        <Footer />
      </div>
    </MotionConfig>
  );
}
