// orgwise database seed. Wipes all tables (FK order) then provisions a
// complete demo workspace so every feature has data to test against: RBAC
// users, org hierarchy, 150 employees with full analytics profiles, import
// history and audit logs. Deterministic (seeded PRNG) — reruns are identical.
import { PrismaClient, type Role, type Gender } from '@prisma/client';

if (!process.env.DATABASE_URL) {
  console.error('[seed] DATABASE_URL is required to seed the database.');
  process.exit(1);
}

const prisma = new PrismaClient();

// ── deterministic PRNG (mulberry32) ─────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260811);

function pick<T>(items: T[]): T {
  return items[Math.floor(rand() * items.length)]!;
}
function weighted<T>(pairs: Array<[T, number]>): T {
  const total = pairs.reduce((sum, [, w]) => sum + w, 0);
  let roll = rand() * total;
  for (const [value, w] of pairs) {
    roll -= w;
    if (roll <= 0) return value;
  }
  return pairs[pairs.length - 1]![0];
}
function intBetween(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

// ── identity data ───────────────────────────────────────────────────────────
const FIRST_NAMES = [
  'Alex',
  'Jordan',
  'Taylor',
  'Casey',
  'Morgan',
  'Riley',
  'Sam',
  'Jamie',
  'Avery',
  'Quinn',
  'Skyler',
  'Drew',
  'Reese',
  'Emery',
  'Rowan',
  'Finley',
  'Harper',
  'Blake',
  'Parker',
  'Elliot',
  'Nora',
  'Liam',
  'Maya',
  'Ethan',
  'Zoe',
  'Noah',
  'Aria',
  'Lucas',
  'Isla',
  'Miles',
  'Priya',
  'Aarav',
  'Meera',
  'Kabir',
  'Ananya',
  'Rohan',
  'Sofia',
  'Mateo',
  'Elena',
  'Lukas',
  'Freya',
  'Oscar',
  'Ingrid',
  'Nadia',
  'Omar',
];
const LAST_NAMES = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Hernandez',
  'Lopez',
  'Gonzalez',
  'Wilson',
  'Anderson',
  'Thomas',
  'Taylor',
  'Moore',
  'Jackson',
  'Martin',
  'Lee',
  'Patel',
  'Sharma',
  'Gupta',
  'Khan',
  'Chen',
  'Kim',
  'Novak',
  'Rossi',
  'Silva',
  'Okafor',
];
const JOB_TITLES = [
  'Software Engineer',
  'Senior Engineer',
  'Staff Engineer',
  'Engineering Manager',
  'QA Engineer',
  'Platform Engineer',
  'Data Analyst',
  'Data Scientist',
  'Data Engineer',
  'Product Manager',
  'Senior Product Manager',
  'Product Designer',
  'UX Researcher',
  'Sales Executive',
  'Account Executive',
  'Sales Manager',
  'Marketing Manager',
  'Content Strategist',
  'Growth Marketer',
  'Brand Manager',
  'People Partner',
  'Finance Analyst',
  'Finance Manager',
  'Operations Lead',
  'Office Manager',
  'Technical Writer',
  'Solutions Architect',
  'Customer Success Manager',
];

// ── organization definition ─────────────────────────────────────────────────
const DEPT_DEFS: Array<{ name: string; parent?: string; description: string }> = [
  { name: 'Engineering', description: 'Builds the core product platform' },
  {
    name: 'Platform Engineering',
    parent: 'Engineering',
    description: 'Infrastructure and developer platform',
  },
  {
    name: 'Data & Analytics',
    parent: 'Engineering',
    description: 'Data platform, analytics and ML',
  },
  { name: 'Product', description: 'Product strategy and design' },
  { name: 'Design', description: 'Product and brand design' },
  { name: 'Sales', description: 'Revenue and account growth' },
  { name: 'Marketing', description: 'Brand, demand and comms' },
  { name: 'Operations', description: 'Workplace and business operations' },
  { name: 'Finance', description: 'Financial planning and analysis' },
  { name: 'People', description: 'People operations and culture' },
];

const TEAM_DEFS: Array<{ name: string; department: string }> = [
  { name: 'Backend', department: 'Engineering' },
  { name: 'Frontend', department: 'Engineering' },
  { name: 'QA', department: 'Engineering' },
  { name: 'Platform', department: 'Platform Engineering' },
  { name: 'Data Platform', department: 'Data & Analytics' },
  { name: 'Analytics & BI', department: 'Data & Analytics' },
  { name: 'Product Strategy', department: 'Product' },
  { name: 'Product Design', department: 'Design' },
  { name: 'Enterprise Sales', department: 'Sales' },
  { name: 'SMB Sales', department: 'Sales' },
  { name: 'Brand & Content', department: 'Marketing' },
  { name: 'Growth', department: 'Marketing' },
  { name: 'Operations', department: 'Operations' },
  { name: 'Finance', department: 'Finance' },
  { name: 'People Ops', department: 'People' },
];

// Per-department employee counts + base attrition rates (Sales deliberately
// highest so the executive summary + insights have a clear signal).
const DEPT_PLAN: Array<{
  name: string;
  count: number;
  attritionRate: number;
  overtimeRate: number;
  incomeMult: number;
}> = [
  { name: 'Engineering', count: 52, attritionRate: 0.08, overtimeRate: 0.38, incomeMult: 1.15 },
  {
    name: 'Platform Engineering',
    count: 16,
    attritionRate: 0.1,
    overtimeRate: 0.34,
    incomeMult: 1.12,
  },
  { name: 'Data & Analytics', count: 12, attritionRate: 0.09, overtimeRate: 0.3, incomeMult: 1.1 },
  { name: 'Product', count: 12, attritionRate: 0.11, overtimeRate: 0.18, incomeMult: 1.05 },
  { name: 'Design', count: 8, attritionRate: 0.12, overtimeRate: 0.12, incomeMult: 1.0 },
  { name: 'Sales', count: 22, attritionRate: 0.26, overtimeRate: 0.32, incomeMult: 0.95 },
  { name: 'Marketing', count: 12, attritionRate: 0.14, overtimeRate: 0.15, incomeMult: 0.98 },
  { name: 'Operations', count: 6, attritionRate: 0.12, overtimeRate: 0.15, incomeMult: 0.9 },
  { name: 'Finance', count: 5, attritionRate: 0.07, overtimeRate: 0.1, incomeMult: 1.1 },
  { name: 'People', count: 5, attritionRate: 0.08, overtimeRate: 0.1, incomeMult: 0.9 },
];

// ── users ───────────────────────────────────────────────────────────────────
const USER_DEFS: Array<{
  email: string;
  name: string;
  role: Role;
  manages?: string[];
  employee?: number;
}> = [
  { email: 'devhimanshuu@gmail.com', name: 'Himanshu Gupta', role: 'admin', employee: 0 },
  {
    email: 'manager.engineering@orgwise.com',
    name: 'Aarav Mehta',
    role: 'manager',
    manages: ['Engineering', 'Platform Engineering', 'Data & Analytics'],
    employee: 1,
  },
  {
    email: 'manager.sales@orgwise.com',
    name: 'Priya Sharma',
    role: 'manager',
    manages: ['Sales'],
    employee: 2,
  },
  { email: 'viewer.demo@orgwise.com', name: 'Demo Viewer', role: 'viewer', employee: 3 },
];

// ── import history ──────────────────────────────────────────────────────────
interface ImportDef {
  fileName: string;
  status: 'completed' | 'partial';
  totalRows: number;
  successCount: number;
  failedCount: number;
  duplicateCount: number;
  daysAgo: number;
  durationMs: number;
  errorReport?: Array<{
    row: number;
    employeeCode?: string | null;
    email?: string | null;
    errors: string[];
  }>;
}
const IMPORT_DEFS: ImportDef[] = [
  {
    fileName: 'orgwise_workforce_full_2026.csv',
    status: 'completed',
    totalRows: 150,
    successCount: 150,
    failedCount: 0,
    duplicateCount: 0,
    daysAgo: 2,
    durationMs: 2410,
  },
  {
    fileName: 'q2_attrition_snapshot.csv',
    status: 'partial',
    totalRows: 32,
    successCount: 30,
    failedCount: 2,
    duplicateCount: 1,
    daysAgo: 9,
    durationMs: 890,
    errorReport: [
      { row: 12, employeeCode: 'EMP-0212', errors: ['Duplicate employee code (already imported)'] },
      { row: 27, email: null, errors: ['Missing firstName'] },
    ],
  },
  {
    fileName: 'sales_team_july.csv',
    status: 'completed',
    totalRows: 18,
    successCount: 18,
    failedCount: 0,
    duplicateCount: 0,
    daysAgo: 16,
    durationMs: 540,
  },
  {
    fileName: 'legacy_export_2023.csv',
    status: 'completed',
    totalRows: 122,
    successCount: 119,
    failedCount: 3,
    duplicateCount: 2,
    daysAgo: 40,
    durationMs: 1730,
    errorReport: [
      { row: 9, employeeCode: 'EMP-0909', errors: ['Invalid email address'] },
      { row: 44, employeeCode: 'EMP-0944', errors: ['Duplicate employee code (already imported)'] },
      { row: 78, employeeCode: 'EMP-0978', errors: ['Unknown department: "Corp Dev"'] },
    ],
  },
];

async function main(): Promise<void> {
  console.log('[seed] Wiping existing data…');

  // ── wipe in FK order (children first) ─────────────────────────────────────
  await prisma.$executeRawUnsafe('DELETE FROM "AiMessage";');
  await prisma.$executeRawUnsafe('DELETE FROM "AiConversation";');
  await prisma.$executeRawUnsafe('DELETE FROM "ImportHistory";');
  await prisma.$executeRawUnsafe('DELETE FROM "AuditLog";');
  await prisma.$executeRawUnsafe('DELETE FROM "Employee";');
  await prisma.$executeRawUnsafe('DELETE FROM "Team";');
  await prisma.$executeRawUnsafe('DELETE FROM "Department";');
  await prisma.$executeRawUnsafe('DELETE FROM "User";');
  console.log('[seed] Wipe complete.');

  // ── users (admin email preserved so existing Neon login keeps working) ────
  console.log('[seed] Creating users…');
  const userIds: Record<string, string> = {};
  for (const u of USER_DEFS) {
    const user = await prisma.user.create({
      data: { email: u.email, name: u.name, role: u.role },
    });
    userIds[u.email] = user.id;
    console.log(`  user: ${u.email} (${u.role})`);
  }

  // ── departments ───────────────────────────────────────────────────────────
  console.log('[seed] Creating departments…');
  const deptIds: Record<string, string> = {};
  for (const d of DEPT_DEFS) {
    const department = await prisma.department.create({
      data: {
        name: d.name,
        description: d.description,
        parentId: d.parent ? deptIds[d.parent] : undefined,
      },
    });
    deptIds[d.name] = department.id;
  }

  // ── teams ─────────────────────────────────────────────────────────────────
  console.log('[seed] Creating teams…');
  const teamIds: Record<string, string> = {};
  for (const t of TEAM_DEFS) {
    const team = await prisma.team.create({
      data: { name: t.name, departmentId: deptIds[t.department]! },
    });
    teamIds[t.name] = team.id;
  }
  const teamsByDept = new Map<string, string[]>();
  for (const t of TEAM_DEFS) {
    const list = teamsByDept.get(t.department) ?? [];
    list.push(teamIds[t.name]!);
    teamsByDept.set(t.department, list);
  }

  // ── employees ─────────────────────────────────────────────────────────────
  console.log('[seed] Creating 150 employees with full analytics profiles…');
  const now = new Date();
  const employeeIds: string[] = [];
  const employeeCodeToId = new Map<string, string>();
  const deptEmployeeIds = new Map<string, string[]>(); // dept name -> employee ids
  let codeIndex = 0;
  let missingCoreSlots = 0;

  const makeDate = (yearsAgo: number, monthOffset = 0): Date =>
    new Date(now.getFullYear() - yearsAgo, now.getMonth() + monthOffset, intBetween(1, 28));

  for (const plan of DEPT_PLAN) {
    const departmentId = deptIds[plan.name]!;
    const deptTeams = teamsByDept.get(plan.name) ?? [];
    for (let k = 0; k < plan.count; k += 1) {
      codeIndex += 1;
      const employeeCode = `EMP-${String(codeIndex).padStart(4, '0')}`;
      const firstName = pick(FIRST_NAMES);
      const lastName = pick(LAST_NAMES);
      const gender = weighted<Gender>([
        ['female', 40],
        ['male', 40],
        ['non_binary', 12],
        ['prefer_not_to_say', 8],
      ]);
      const age = intBetween(22, 60);
      const dateOfBirth = makeDate(age);

      // Tenure: weighted toward newer hires (IBM-style distribution).
      const yearsAtCompany = weighted<number>([
        [0, 10],
        [1, 12],
        [2, 14],
        [3, 12],
        [4, 10],
        [5, 8],
        [6, 7],
        [7, 6],
        [8, 5],
        [9, 4],
        [10, 4],
        [12, 3],
        [15, 3],
        [18, 1],
        [22, 1],
      ]);
      const hiredAt = makeDate(yearsAtCompany, -intBetween(0, 11));
      const totalWorkingYears =
        yearsAtCompany + intBetween(0, Math.max(0, age - 18 - yearsAtCompany - 2));
      const yearsInCurrentRole = Math.min(yearsAtCompany, intBetween(0, 8));
      const yearsSinceLastPromotion = Math.min(Math.max(0, yearsAtCompany - 1), intBetween(0, 10));
      const yearsWithCurrManager = Math.min(yearsAtCompany, intBetween(1, 6));

      const jobLevel = weighted<number>([
        [1, 15],
        [2, 25],
        [3, 30],
        [4, 20],
        [5, 10],
      ]);
      const jobSatisfaction = weighted<number>([
        [1, 15],
        [2, 30],
        [3, 35],
        [4, 20],
      ]);
      const environmentSatisfaction = weighted<number>([
        [1, 12],
        [2, 28],
        [3, 38],
        [4, 22],
      ]);
      const relationshipSatisfaction = weighted<number>([
        [1, 10],
        [2, 26],
        [3, 40],
        [4, 24],
      ]);
      // Overtime workers report worse work-life balance.
      const overTime = rand() < plan.overtimeRate;
      const workLifeBalance = weighted<number>([
        [1, overTime ? 20 : 8],
        [2, overTime ? 34 : 24],
        [3, overTime ? 32 : 40],
        [4, overTime ? 14 : 28],
      ]);
      const performanceRating = weighted<number>([
        [1, 3],
        [2, 7],
        [3, 65],
        [4, 25],
      ]);
      const education = weighted<number>([
        [1, 10],
        [2, 20],
        [3, 38],
        [4, 22],
        [5, 10],
      ]);
      const educationField = weighted<string>([
        ['Life Sciences', 34],
        ['Medical', 10],
        ['Marketing', 12],
        ['Technical Degree', 22],
        ['Human Resources', 6],
        ['Other', 16],
      ]);
      const monthlyIncome =
        Math.round(
          ((2800 + jobLevel * 2300 + totalWorkingYears * 140 + (education - 3) * 150) *
            plan.incomeMult) /
            50,
        ) * 50;

      // Attrition: base dept rate + overtime/satisfaction modifiers.
      let attritionChance = plan.attritionRate;
      if (overTime) attritionChance += 0.12;
      if (jobSatisfaction === 1) attritionChance += 0.1;
      else if (jobSatisfaction === 2) attritionChance += 0.04;
      else if (jobSatisfaction === 4) attritionChance -= 0.03;
      attritionChance = Math.min(0.55, Math.max(0.02, attritionChance));
      const attrition = rand() < attritionChance;

      const status = attrition
        ? 'terminated'
        : weighted<'active' | 'on_leave' | 'probation' | 'terminated'>([
            ['active', 90],
            ['on_leave', 6],
            ['probation', 4],
          ]);
      const attritionDate = attrition
        ? new Date(hiredAt.getTime() + (yearsAtCompany - 0.5) * 365.25 * 24 * 3600 * 1000)
        : null;

      // Small deliberate gaps so the data-quality indicator reads realistically.
      const core = {
        jobSatisfaction,
        environmentSatisfaction,
        relationshipSatisfaction,
        workLifeBalance,
        performanceRating,
        monthlyIncome,
        education,
        totalWorkingYears,
      };
      const coreData: Record<string, number | null> = { ...core };
      for (const key of Object.keys(coreData)) {
        if (rand() < 0.04) {
          coreData[key] = null;
          missingCoreSlots += 1;
        }
      }

      const teamId = deptTeams.length > 0 && rand() < 0.75 ? pick(deptTeams) : null;

      const employee = await prisma.employee.create({
        data: {
          employeeCode,
          firstName,
          lastName,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${codeIndex}@orgwise.com`,
          phone:
            rand() < 0.94
              ? `+1-${intBetween(200, 989)}-${intBetween(200, 989)}-${String(intBetween(0, 9999)).padStart(4, '0')}`
              : null,
          jobTitle: pick(JOB_TITLES),
          gender,
          dateOfBirth,
          hiredAt,
          status,
          isActive: !attrition,
          departmentId,
          teamId,
          attrition,
          attritionDate,
          monthlyIncome: coreData.monthlyIncome,
          jobSatisfaction: coreData.jobSatisfaction,
          environmentSatisfaction: coreData.environmentSatisfaction,
          relationshipSatisfaction: coreData.relationshipSatisfaction,
          workLifeBalance: coreData.workLifeBalance,
          overTime,
          performanceRating: coreData.performanceRating,
          education: coreData.education,
          educationField,
          jobLevel,
          yearsAtCompany,
          yearsInCurrentRole,
          yearsSinceLastPromotion,
          yearsWithCurrManager,
          totalWorkingYears: coreData.totalWorkingYears,
          distanceFromHome: intBetween(1, 29),
          maritalStatus: weighted<string>([
            ['Single', 35],
            ['Married', 48],
            ['Divorced', 17],
          ]),
          businessTravel: weighted<string>([
            ['Non-Travel', 28],
            ['Travel_Rarely', 52],
            ['Travel_Frequently', 20],
          ]),
          numCompaniesWorked: weighted<number>([
            [1, 35],
            [2, 25],
            [3, 18],
            [4, 10],
            [5, 6],
            [6, 3],
            [7, 2],
            [8, 1],
          ]),
          trainingTimesLastYear: intBetween(0, 6),
          percentSalaryHike: intBetween(11, 25),
          stockOptionLevel: weighted<number>([
            [0, 55],
            [1, 22],
            [2, 15],
            [3, 8],
          ]),
        },
      });
      employeeIds.push(employee.id);
      employeeCodeToId.set(employeeCode, employee.id);
      const deptList = deptEmployeeIds.get(plan.name) ?? [];
      deptList.push(employee.id);
      deptEmployeeIds.set(plan.name, deptList);
    }
  }

  // ── reporting lines: ~15% of each department are managers (jobLevel ≥ 4) ──
  console.log('[seed] Assigning reporting lines…');
  for (const plan of DEPT_PLAN) {
    const ids = deptEmployeeIds.get(plan.name) ?? [];
    if (ids.length === 0) continue;
    const managers = ids.filter((_, i) => i % 7 === 0 || i % 9 === 0);
    if (managers.length === 0) managers.push(ids[0]!);
    let m = 0;
    for (const id of ids) {
      if (managers.includes(id)) continue;
      await prisma.employee.update({
        where: { id },
        data: { managerId: managers[m % managers.length]! },
      });
      m += 1;
    }
  }

  // ── team leads ────────────────────────────────────────────────────────────
  console.log('[seed] Assigning team leads…');
  for (const t of TEAM_DEFS) {
    const deptIds_ = deptEmployeeIds.get(t.department) ?? [];
    const lead = deptIds_[intBetween(0, Math.max(0, deptIds_.length - 1))];
    if (lead) {
      await prisma.team.update({
        where: { id: teamIds[t.name]! },
        data: { leadEmployeeId: lead },
      });
    }
  }

  // ── link platform users to employee profiles + department scope ───────────
  console.log('[seed] Linking users to employees and departments…');
  for (const u of USER_DEFS) {
    const empIndex = u.employee ?? 0;
    const employeeId = employeeIds[empIndex];
    if (employeeId) {
      await prisma.employee.update({
        where: { id: employeeId },
        data: { userId: userIds[u.email]! },
      });
    }
    if (u.manages) {
      for (const deptName of u.manages) {
        await prisma.department.update({
          where: { id: deptIds[deptName]! },
          data: { managerUserId: userIds[u.email]! },
        });
      }
    }
  }

  // ── hiring pipeline (real TA metrics) ─────────────────────────────────────
  console.log('[seed] Creating hiring-pipeline records…');
  const adminId = userIds['devhimanshuu@gmail.com']!;
  const HIRING_DEPT_CHOICES: Array<[string, number]> = [
    ['Engineering', 20],
    ['Platform Engineering', 8],
    ['Data & Analytics', 6],
    ['Product', 6],
    ['Design', 4],
    ['Sales', 12],
    ['Marketing', 6],
    ['Finance', 3],
    ['People', 3],
    ['Operations', 2],
  ];
  const HIRING_TITLES: Record<string, string[]> = {
    Engineering: ['Software Engineer', 'Senior Engineer', 'QA Engineer', 'Platform Engineer'],
    'Platform Engineering': ['Platform Engineer', 'DevOps Engineer', 'SRE'],
    'Data & Analytics': ['Data Analyst', 'Data Scientist', 'Data Engineer'],
    Product: ['Product Manager', 'Senior Product Manager'],
    Design: ['Product Designer', 'UX Researcher'],
    Sales: ['Sales Executive', 'Account Executive', 'Customer Success Manager'],
    Marketing: ['Marketing Manager', 'Growth Marketer', 'Content Strategist'],
    Finance: ['Finance Analyst', 'Finance Manager'],
    People: ['People Partner'],
    Operations: ['Operations Lead', 'Office Manager'],
  };
  const CANDIDATE_NAMES = [
    'Aisha Kapoor',
    'Ben Carter',
    'Chloe Nguyen',
    'Daniel Osei',
    'Emma Laurent',
    'Felix Wagner',
    'Grace Kim',
    'Hugo Silva',
    'Ivy Chen',
    'Jack Porter',
    'Kiran Patel',
    'Lena Fischer',
    'Marco Rossi',
    'Nina Petrova',
    'Omar Haddad',
  ];

  const hiringRows: Array<{
    requisitionId: string;
    jobTitle: string;
    departmentId: string;
    candidateName: string | null;
    openedAt: Date;
    offerSentAt: Date | null;
    acceptedAt: Date | null;
    startDate: Date | null;
    offerStatus: string | null;
    status: string;
    sourcingCost: number | null;
    recruitingCost: number | null;
  }> = [];

  const hiringTotal = 48;
  for (let i = 0; i < hiringTotal; i += 1) {
    const dept = weighted(HIRING_DEPT_CHOICES);
    const jobTitle = pick(HIRING_TITLES[dept] ?? ['General Hire']);
    const daysAgo = weighted<number>([
      [15, 10],
      [30, 15],
      [60, 20],
      [90, 15],
      [150, 15],
      [240, 15],
      [330, 10],
    ]);
    const openedAt = new Date(now.getTime() - daysAgo * 24 * 3600 * 1000);
    const outcome = weighted<'hired' | 'declined' | 'open' | 'in_review' | 'withdrawn'>([
      ['hired', 58],
      ['declined', 18],
      ['open', 12],
      ['in_review', 7],
      ['withdrawn', 5],
    ]);

    const timeToHireDays = intBetween(15, 75);
    const offerSentAt =
      outcome === 'hired' || outcome === 'declined' || outcome === 'withdrawn'
        ? new Date(openedAt.getTime() + Math.round(timeToHireDays * 0.7) * 24 * 3600 * 1000)
        : null;
    const acceptedAt =
      outcome === 'hired' ? new Date(openedAt.getTime() + timeToHireDays * 24 * 3600 * 1000) : null;
    const startDate = acceptedAt
      ? new Date(acceptedAt.getTime() + intBetween(7, 21) * 24 * 3600 * 1000)
      : null;

    const offerStatus =
      outcome === 'hired'
        ? 'accepted'
        : outcome === 'declined'
          ? 'declined'
          : outcome === 'withdrawn'
            ? 'withdrawn'
            : null;
    const status =
      outcome === 'hired'
        ? 'hired'
        : outcome === 'declined' || outcome === 'withdrawn'
          ? 'closed'
          : outcome; // open | in_review

    const sourcingCost = rand() < 0.85 ? intBetween(600, 3400) : null;
    const recruitingCost = rand() < 0.9 ? intBetween(1200, 5000) : null;

    hiringRows.push({
      requisitionId: `REQ-2026-${String(i + 1).padStart(3, '0')}`,
      jobTitle,
      departmentId: deptIds[dept]!,
      candidateName: rand() < 0.92 ? pick(CANDIDATE_NAMES) : null,
      openedAt,
      offerSentAt,
      acceptedAt,
      startDate,
      offerStatus,
      status,
      sourcingCost,
      recruitingCost,
    });
  }
  let hiringCreated = 0;
  for (const row of hiringRows) {
    await prisma.hiringRecord.create({ data: row });
    hiringCreated += 1;
  }
  await prisma.importHistory.create({
    data: {
      fileName: 'orgwise_hiring_pipeline_2026.csv',
      status: 'completed',
      totalRows: hiringCreated,
      successCount: hiringCreated,
      failedCount: 0,
      duplicateCount: 0,
      importedByUserId: adminId,
      durationMs: 1150,
      createdAt: new Date(now.getTime() - 1 * 24 * 3600 * 1000),
    },
  });

  // ── import history ────────────────────────────────────────────────────────
  console.log('[seed] Creating import history…');
  const importIds: string[] = [];
  for (const imp of IMPORT_DEFS) {
    const row = await prisma.importHistory.create({
      data: {
        fileName: imp.fileName,
        status: imp.status,
        totalRows: imp.totalRows,
        successCount: imp.successCount,
        failedCount: imp.failedCount,
        duplicateCount: imp.duplicateCount,
        errorReport: imp.errorReport ? (imp.errorReport as object) : undefined,
        importedByUserId: adminId,
        durationMs: imp.durationMs,
        createdAt: new Date(now.getTime() - imp.daysAgo * 24 * 3600 * 1000),
      },
    });
    importIds.push(row.id);
  }

  // ── audit logs (imports + a few state changes, actor = admin) ─────────────
  console.log('[seed] Creating audit logs…');
  const auditEntries: Array<{
    action: 'create' | 'update' | 'delete' | 'restore' | 'role_change' | 'import';
    entityType: 'user' | 'department' | 'team' | 'employee' | 'import';
    entityId?: string;
    details?: object;
    daysAgo: number;
  }> = [
    {
      action: 'import',
      entityType: 'import',
      entityId: importIds[0],
      details: { fileName: IMPORT_DEFS[0]!.fileName, totalRows: 150, successCount: 150 },
      daysAgo: 2,
    },
    {
      action: 'import',
      entityType: 'import',
      entityId: importIds[1],
      details: {
        fileName: IMPORT_DEFS[1]!.fileName,
        totalRows: 32,
        successCount: 30,
        failedCount: 2,
      },
      daysAgo: 9,
    },
    {
      action: 'update',
      entityType: 'employee',
      entityId: employeeIds[5],
      details: { field: 'jobTitle', from: 'Software Engineer', to: 'Senior Engineer' },
      daysAgo: 11,
    },
    {
      action: 'role_change',
      entityType: 'user',
      entityId: userIds['viewer.demo@orgwise.com'],
      details: { from: 'viewer', to: 'viewer' },
      daysAgo: 13,
    },
    {
      action: 'create',
      entityType: 'team',
      entityId: teamIds['Growth'],
      details: { name: 'Growth' },
      daysAgo: 20,
    },
    {
      action: 'import',
      entityType: 'import',
      entityId: importIds[2],
      details: { fileName: IMPORT_DEFS[2]!.fileName, totalRows: 18, successCount: 18 },
      daysAgo: 16,
    },
    {
      action: 'update',
      entityType: 'department',
      entityId: deptIds['Marketing'],
      details: { field: 'description' },
      daysAgo: 25,
    },
  ];
  for (const entry of auditEntries) {
    await prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        details: entry.details,
        createdAt: new Date(now.getTime() - entry.daysAgo * 24 * 3600 * 1000),
      },
    });
  }

  // ── summary ───────────────────────────────────────────────────────────────
  const [users, departments, teams, employees, imports, audits, hiring] = await Promise.all([
    prisma.user.count(),
    prisma.department.count(),
    prisma.team.count(),
    prisma.employee.count(),
    prisma.importHistory.count(),
    prisma.auditLog.count(),
    prisma.hiringRecord.count(),
  ]);
  const attrited = await prisma.employee.count({ where: { attrition: true } });
  const overtime = await prisma.employee.count({ where: { overTime: true } });
  console.log('[seed] Done. Counts:', {
    users,
    departments,
    teams,
    employees,
    attrited,
    overtime,
    hiringRecords: hiring,
    imports,
    audits,
  });
  console.log(
    `[seed] Data quality: ~${Math.round(((employees * 8 - missingCoreSlots) / (employees * 8)) * 100)}% core-field readiness`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('[seed] Failed:', error);
    process.exit(1);
  });
