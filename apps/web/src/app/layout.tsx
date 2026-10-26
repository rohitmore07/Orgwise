import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Orgwise — Enterprise Workforce Intelligence Platform',
    template: '%s · orgwise',
  },
  description:
    'orgwise unifies HRIS, ATS, performance, and engagement data into real-time predictive workforce intelligence for HR leaders and executives.',
  applicationName: 'orgwise',
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    siteName: 'orgwise',
    title: 'orgwise — Enterprise Workforce Intelligence Platform',
    description:
      'Unify HRIS, ATS, performance, and engagement data into real-time workforce intelligence for HR leaders and executives.',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#030712' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
