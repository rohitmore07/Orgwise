import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import base from './base.js';

// eslint-config-next@15 ships legacy eslintrc configs (no flat exports yet), so
// we bridge them into the flat system with FlatCompat.
const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const nextConfigs = compat.extends('next/core-web-vitals', 'next/typescript');

/** Flat config for Next.js (App Router) workspaces. */
export default [
  ...base,
  ...nextConfigs,
  {
    settings: {
      next: {
        rootDir: ['apps/web/', './'],
      },
    },
    rules: {
      '@next/next/no-html-link-for-pages': [
        'error',
        ['apps/web/src/app', 'apps/web/app', 'src/app', 'app'],
      ],
    },
  },
];
