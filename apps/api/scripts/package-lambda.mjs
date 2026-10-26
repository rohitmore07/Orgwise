/**
 * Builds a self-contained Lambda deployment zip for the orgwise API.
 *
 * Why this exists: Serverless Framework cannot package pnpm's symlinked
 * node_modules (symlinked packages are silently dropped), and a raw
 * `node_modules/**` package exceeds Lambda's 250MB unzipped limit. This
 * script bundles the entire application (except Prisma, which needs its
 * native engines) into a single file with esbuild, stages only the Prisma
 * runtime pieces, and produces a small deterministic zip.
 */
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(apiRoot, '../..');
const staging = path.join(apiRoot, '.serverless-build', 'orgwise-api');
const zipPath = path.join(apiRoot, '.serverless-build', 'orgwise-api.zip');

function run(cmd) {
  execSync(cmd, { cwd: apiRoot, stdio: 'inherit', env: process.env });
}

// 1. Compile the NestJS app (tsconfig emits dist/lambda.js at the root).
//    Clear the incremental cache first: with `deleteOutDir: true`, a stale
//    tsbuildinfo (kept outside dist) makes tsc skip emit while dist is wiped,
//    silently producing an empty build.
fs.rmSync(path.join(apiRoot, 'tsconfig.build.tsbuildinfo'), { force: true });
fs.rmSync(path.join(apiRoot, 'tsconfig.tsbuildinfo'), { force: true });
fs.rmSync(path.join(apiRoot, 'dist'), { recursive: true, force: true });
run('npx nest build');

// 2. Bundle everything except Prisma into dist/lambda.js with esbuild.
//    Prisma must stay external: it locates its native query engine relative
//    to its package at runtime. @nestjs/microservices/websockets are lazy
//    requires in NestFactory that this app never uses.
const esbuild = requireStorePackage('esbuild@', 'node_modules/esbuild/lib/main.js');
const bundleResult = esbuild.buildSync({
  entryPoints: [path.join(apiRoot, 'dist', 'lambda.js')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: path.join(apiRoot, 'dist', 'lambda.js'),
  external: [
    '@prisma/*',
    '@nestjs/microservices',
    '@nestjs/websockets',
    'class-transformer/storage',
  ],
  allowOverwrite: true,
  logLevel: 'warning',
  metafile: false,
});
for (const warning of bundleResult.warnings ?? []) {
  console.warn(`[esbuild] ${warning.text}`);
}

// 3. Stage the bundle plus the Prisma runtime pieces (real files only).
fs.rmSync(path.join(apiRoot, '.serverless-build'), { recursive: true, force: true });
fs.mkdirSync(path.join(apiRoot, '.serverless-build'), { recursive: true });
fs.mkdirSync(path.join(staging, 'dist'), { recursive: true });
fs.copyFileSync(path.join(apiRoot, 'dist', 'lambda.js'), path.join(staging, 'dist', 'lambda.js'));

const prismaClientStoreDir = findStorePackageDir('@prisma+client@', 'node_modules/@prisma/client');
fs.cpSync(prismaClientStoreDir, path.join(staging, 'node_modules', '@prisma', 'client'), {
  recursive: true,
});
const generatedClientDir = path.join(prismaClientStoreDir, '..', '..', '.prisma', 'client');
fs.cpSync(generatedClientDir, path.join(staging, 'node_modules', '.prisma', 'client'), {
  recursive: true,
});

// 4. Zip the staged tree (plain files — no symlinks, no dereferencing needed).
const archiver = requireStorePackage('archiver@', 'node_modules/archiver/index.js');
await new Promise((resolve, reject) => {
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  output.on('close', resolve);
  archive.on('error', reject);
  archive.pipe(output);
  archive.directory(staging, false);
  archive.finalize();
});

const zipMb = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
console.log(`\nLambda package ready: ${zipPath} (${zipMb} MB zip)`);

function getPackageDir(pkgName) {
  const require = createRequire(import.meta.url);
  try {
    const pkgJsonPath = require.resolve(`${pkgName}/package.json`, { paths: [apiRoot] });
    return path.dirname(pkgJsonPath);
  } catch {
    return null;
  }
}

function findStorePackageDir(prefix, relativePath) {
  if (prefix === '@prisma+client@') {
    const exactDir = getPackageDir('@prisma/client');
    if (exactDir) {
      const rel = relativePath.replace(/^node_modules\/@prisma\/client\/?/, '');
      const target = rel ? path.join(exactDir, rel) : exactDir;
      if (fs.existsSync(target)) return target;
    }
  }

  const pnpmDir = path.join(repoRoot, 'node_modules', '.pnpm');
  const candidates = fs
    .readdirSync(pnpmDir)
    .filter((d) => d.startsWith(prefix))
    .sort();
  if (candidates.length === 0) throw new Error(`No ${prefix} package in the workspace store`);
  const dir = path.join(pnpmDir, candidates[0], relativePath);
  if (!fs.existsSync(dir)) throw new Error(`Missing ${dir} in workspace store`);
  return dir;
}

function requireStorePackage(prefix, relativeEntry) {
  const pkgDir = findStorePackageDir(prefix, '');
  // Forward slashes keep Windows absolute paths require()-safe.
  const entry = path.join(pkgDir, relativeEntry).replaceAll('\\', '/');
  const require = createRequire(import.meta.url);
  return require(entry);
}
