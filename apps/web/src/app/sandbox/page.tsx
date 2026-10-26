import type { Metadata } from 'next';
import { Footer } from '@/components/landing/footer';
import { Sandbox } from '@/components/landing/sandbox';
import { Header } from '@/components/ui/header-3';

export const metadata: Metadata = {
  title: 'Live Sandbox',
  description:
    'Explore orgwise with live workforce intelligence — real-time health score, attrition risk, and unified signals across HRIS, ATS, and engagement sources.',
};

export default function SandboxPage() {
  return (
    // #top anchor so the header logo and footer watermark scroll-to-top work here too
    <div
      id="top"
      className="relative min-h-screen overflow-x-clip bg-background text-foreground selection:bg-indigo-500/40"
    >
      <Header />
      <main>
        <Sandbox />
      </main>
      <Footer />
    </div>
  );
}
