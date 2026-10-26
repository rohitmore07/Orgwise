// Dev verification (plain JS): cross-checks the analytics engine's pure math against independent SQL…
// aggregations over the same database. node scripts/verify-analytics.cjs (from repo root; apps/api/.env must…
const path = require('node:path');
const fs = require('node:fs');
const apiDir = path.join(__dirname, '..', 'apps', 'api');
// pnpm hoists per-workspace — resolve @prisma/client through the api package.
const { PrismaClient } = require(path.join(apiDir, 'node_modules', '@prisma', 'client'));
// Minimal .env loader (avoids a dotenv dependency outside the workspaces).
for (const line of fs.readFileSync(path.join(apiDir, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

const prisma = new PrismaClient();
let failures = 0;

function check(label, actual, expected, tolerance = 0.0001) {
  const close =
    typeof actual === 'number' && typeof expected === 'number'
      ? Math.abs(actual - expected) <= tolerance
      : actual === expected;
  if (close) console.log(`  ✓ ${label} = ${actual}`);
  else {
    failures += 1;
    console.error(`  ✗ ${label}: engine=${actual} sql=${expected}`);
  }
}

// Mirror of apps/api/src/common/utils/analytics.util.ts
const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;
const ageYears = (d) =>
  !d ? null : Date.now() - d.getTime() >= 0 ? (Date.now() - d.getTime()) / MS_PER_YEAR : null;
const tenureYears = (d) => ageYears(d);
const ageGroupOf = (d) => {
  const y = ageYears(d);
  if (y === null) return null;
  if (y < 25) return '<25';
  if (y < 35) return '25-34';
  if (y < 45) return '35-44';
  if (y < 55) return '45-54';
  return '55+';
};
const tenureGroupOf = (d) => {
  const y = tenureYears(d);
  if (y === null) return null;
  if (y < 1) return '<1';
  if (y < 3) return '1-2';
  if (y < 6) return '3-5';
  if (y < 10) return '6-10';
  return '10+';
};
const average = (values) => {
  const present = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0) / present.length;
};
const rate = (part, total) => (total <= 0 ? null : Math.min(1, Math.max(0, part / total)));

async function main() {
  const employees = await prisma.employee.findMany({
    where: { deletedAt: null },
    select: {
      status: true,
      attrition: true,
      hiredAt: true,
      dateOfBirth: true,
      monthlyIncome: true,
      overTime: true,
      performanceRating: true,
      jobSatisfaction: true,
      environmentSatisfaction: true,
      relationshipSatisfaction: true,
      workLifeBalance: true,
      departmentId: true,
      education: true,
    },
  });
  const total = employees.length;
  console.log(`Cross-checking ${total} employees…\n`);

  const [s] = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'active')::int AS active,
      COUNT(*) FILTER (WHERE attrition = true)::int AS attrition_count,
      ROUND(AVG(EXTRACT(EPOCH FROM (now() - "hiredAt")) / 31557600)::numeric, 4) AS avg_tenure,
      ROUND(AVG("monthlyIncome")::numeric, 2) AS avg_income,
      COUNT(*) FILTER (WHERE "overTime" = true)::int AS ot_count,
      COUNT(*) FILTER (WHERE "overTime" IS NOT NULL)::int AS ot_known,
      ROUND(AVG("performanceRating")::numeric, 4) AS avg_perf
    FROM "Employee" WHERE "deletedAt" IS NULL
  `);

  check('headcount', total, Number(s.total));
  check('active count', employees.filter((e) => e.status === 'active').length, Number(s.active));
  const attritionCount = employees.filter((e) => e.attrition).length;
  check('attrition count', attritionCount, Number(s.attrition_count));
  check('attrition rate', rate(attritionCount, total), Number(s.attrition_count) / total);
  check(
    'avg tenure',
    average(employees.map((e) => tenureYears(e.hiredAt))),
    Number(s.avg_tenure),
    0.05,
  );
  check('avg income', average(employees.map((e) => e.monthlyIncome)), Number(s.avg_income), 1);
  check(
    'avg performance',
    average(employees.map((e) => e.performanceRating)),
    Number(s.avg_perf),
    0.0002,
  );
  const otKnown = employees.filter((e) => e.overTime !== null && e.overTime !== undefined);
  check(
    'overtime rate (excl unknown)',
    rate(otKnown.filter((e) => e.overTime).length, otKnown.length),
    Number(s.ot_count) / Number(s.ot_known),
  );

  // ── Composition sums must equal total ───────────────────────────────────
  const byAge = new Map();
  const byTenure = new Map();
  for (const e of employees) {
    const a = ageGroupOf(e.dateOfBirth);
    if (a) byAge.set(a, (byAge.get(a) ?? 0) + 1);
    const t = tenureGroupOf(e.hiredAt);
    if (t) byTenure.set(t, (byTenure.get(t) ?? 0) + 1);
  }
  check(
    'age composition sum',
    [...byAge.values()].reduce((a, b) => a + b, 0),
    total,
  );
  check(
    'tenure composition sum',
    [...byTenure.values()].reduce((a, b) => a + b, 0),
    total,
  );

  // ── Largest department vs highest-attrition department ──────────────────
  const sqlDept = await prisma.$queryRawUnsafe(`
    SELECT d.id, d.name, COUNT(e.id)::int AS size,
           COUNT(e.id) FILTER (WHERE e.attrition = true)::int AS att_count
    FROM "Department" d
    JOIN "Employee" e ON e."departmentId" = d.id AND e."deletedAt" IS NULL
    WHERE d."deletedAt" IS NULL
    GROUP BY d.id, d.name
  `);
  const bySize = [...sqlDept].sort((a, b) => Number(b.size) - Number(a.size));
  const byRate = [...sqlDept]
    .map((d) => ({ ...d, r: Number(d.size) > 0 ? Number(d.att_count) / Number(d.size) : 0 }))
    .sort((a, b) => b.r - a.r);
  console.log(`\nLargest department:   ${bySize[0].name} (${bySize[0].size})`);
  console.log(`Highest attrition:    ${byRate[0].name} (${(byRate[0].r * 100).toFixed(1)}%)`);
  // Informational only: the insight engine (AnalyticsService) computes the largest department by headcount…
  // independently of the attrition ranking; that behavior is pinned by analytics.service.spec.ts + the live run.
  console.log(`  → expected insight: "${bySize[0].name} is the largest department"`);

  // ── Per-department attrition rate parity ────────────────────────────────
  const groups = new Map();
  for (const e of employees) {
    const g = groups.get(e.departmentId) ?? { n: 0, att: 0 };
    g.n += 1;
    if (e.attrition) g.att += 1;
    groups.set(e.departmentId, g);
  }
  for (const d of sqlDept) {
    const g = groups.get(d.id);
    const engine = g.att / g.n;
    const sqlR = Number(d.att_count) / Number(d.size);
    check(`attrition rate ${d.name}`, engine, sqlR);
  }

  // ── Engagement bucket sums ──────────────────────────────────────────────
  for (const dim of [
    'jobSatisfaction',
    'environmentSatisfaction',
    'relationshipSatisfaction',
    'workLifeBalance',
  ]) {
    const engine = new Map();
    for (const e of employees) {
      const v = e[dim];
      if (typeof v === 'number') engine.set(v, (engine.get(v) ?? 0) + 1);
    }
    const sqlBuckets = await prisma.$queryRawUnsafe(
      `      SELECT "${dim}" AS level, COUNT(*)::int AS c FROM "Employee" WHERE "deletedAt" IS NULL AND "${dim}" IS NOT NULL GROUP BY "${dim}"`,
    );
    const engineTotal = [...engine.values()].reduce((a, b) => a + b, 0);
    const sqlTotal = sqlBuckets.reduce((a, b) => a + Number(b.c), 0);
    check(`${dim} bucket sum`, engineTotal, sqlTotal);
  }

  // ── Average age parity ──────────────────────────────────────────────────
  const ages = employees.map((e) =>
    ageGroupOf(e.dateOfBirth) === null ? null : ageYears(e.dateOfBirth),
  );
  const [avgAgeSql] = await prisma.$queryRawUnsafe(`
    SELECT ROUND(AVG(EXTRACT(EPOCH FROM (now() - "dateOfBirth")) / 31557600)::numeric, 3) AS avg_age
    FROM "Employee" WHERE "deletedAt" IS NULL AND "dateOfBirth" IS NOT NULL
  `);
  check('avg age', average(ages), Number(avgAgeSql.avg_age), 0.1);

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} FAILURES`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
