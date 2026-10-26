#!/usr/bin/env node
// orgwise bootstrap script. - Verifies the Node version satisfies the project engines. - Materializes .env…
// files from their .env.example templates (idempotent). Usage: pnpm bootstrap Note: named "bootstrap" rather…
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REQUIRED_NODE_MAJOR = 20;

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < REQUIRED_NODE_MAJOR) {
  console.error(`✖ Node.js ${REQUIRED_NODE_MAJOR}+ is required (found ${process.versions.node}).`);
  process.exit(1);
}

/** [workspaceDir, exampleFile, targetFile] */
const envPairs = [
  ['apps/api', '.env.example', '.env'],
  ['apps/web', '.env.example', '.env.local'],
];

let created = 0;
for (const [dir, example, target] of envPairs) {
  const examplePath = join(root, dir, example);
  const targetPath = join(root, dir, target);

  if (!existsSync(examplePath)) {
    continue;
  }
  if (existsSync(targetPath)) {
    console.log(`• ${dir}/${target} already exists — skipped.`);
    continue;
  }

  copyFileSync(examplePath, targetPath);
  created += 1;
  console.log(`✓ Created ${dir}/${target} from ${example}.`);
}

console.log(
  created > 0
    ? `\nEnvironment ready — ${created} env file(s) created from templates.`
    : '\nEnvironment ready.',
);
console.log('Next: pnpm dev  (or pnpm dev:web / pnpm dev:api)');
