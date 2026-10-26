import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@orgwise/ui', '@orgwise/types'],
  // The app renders no <Image> components (all visuals are CSS/SVG), so the native `sharp` optimizer is pure…
  // overhead — and on Windows it can crash the server (STATUS_STACK_BUFFER_OVERRUN) when handed a missing asset.…
  images: { unoptimized: true },
};

export default nextConfig;
