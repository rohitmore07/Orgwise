import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ImportHistory } from '@prisma/client';
import { type AuditService } from '@app/audit/audit.service';
import { type RbacService } from '@app/common/services/rbac.service';
import { type PrismaService } from '@app/database/prisma.service';
import { type CsvService, type ParsedHiringRow, type ParsedRow } from './csv.service';
import { ImportsService } from './imports.service';
// ImportsService pipeline tests — the riskiest CSV logic: file-type gates, RBAC, reference resolution…
// (department/team/manager by name), duplicate detection (database + within-file), row filtering by error…

const ACTOR = { sub: 'user-1', email: 'admin@orgwise.dev', roles: ['admin'] } as never;

const FILE = {
  fieldname: 'file',
  originalname: 'employees.csv',
  mimetype: 'text/csv',
  buffer: Buffer.from('a,b,c\n1,2,3\n'),
  size: 10,
} as Express.Multer.File;

interface Mocks {
  prisma: {
    employee: {
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    department: { findMany: jest.Mock };
    team: { findMany: jest.Mock };
    importHistory: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
    hiringRecord: { create: jest.Mock; deleteMany: jest.Mock };
    $transaction: jest.Mock;
  };
  csv: {
    parse: jest.Mock;
    isHiringCsv: jest.Mock;
    parseHiring: jest.Mock;
    analyzeHeaders: jest.Mock;
    analyzeHiringHeaders: jest.Mock;
  };
  rbac: { canWrite: jest.Mock; departmentScope: jest.Mock; isAdmin: jest.Mock };
  audit: { record: jest.Mock };
}

function createMocks(): Mocks {
  const prisma = {
    employee: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    department: { findMany: jest.fn() },
    team: { findMany: jest.fn() },
    importHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    hiringRecord: { create: jest.fn(), deleteMany: jest.fn() },
    $transaction: jest.fn(),
  };
  return {
    prisma,
    csv: {
      parse: jest.fn(),
      analyzeHeaders: jest
        .fn()
        .mockReturnValue({ matched: 36, total: 36, aliased: [], missing: [] }),
      analyzeHiringHeaders: jest
        .fn()
        .mockReturnValue({ matched: 12, total: 12, aliased: [], missing: [] }),
      isHiringCsv: jest.fn().mockReturnValue(false),
      parseHiring: jest.fn(),
    },
    rbac: {
      canWrite: jest.fn().mockReturnValue(true),
      departmentScope: jest.fn().mockResolvedValue(null),
      isAdmin: jest.fn().mockReturnValue(true),
    },
    audit: { record: jest.fn().mockResolvedValue(undefined) },
  };
}

function hiringRow(
  overrides: Partial<ParsedHiringRow['data']> = {},
  errors: string[] = [],
): ParsedHiringRow {
  return {
    data: {
      requisitionId: 'REQ-101',
      jobTitle: 'Engineer',
      department: 'Engineering',
      candidateName: 'Aisha Kapoor',
      openedAt: '2026-07-01',
      offerSentAt: '2026-07-22',
      acceptedAt: '2026-07-30',
      startDate: '2026-08-10',
      offerStatus: 'accepted',
      status: 'hired',
      sourcingCost: 1800,
      recruitingCost: 3200,
      ...overrides,
    },
    rowNumber: 2,
    errors,
  };
}

function row(overrides: Partial<ParsedRow['data']> = {}, errors: string[] = []): ParsedRow {
  return {
    data: {
      employeeCode: 'EMP-1',
      firstName: 'Alex',
      lastName: 'Morgan',
      email: 'alex@company.com',
      phone: undefined,
      jobTitle: 'Engineer',
      gender: 'female',
      dateOfBirth: undefined,
      hiredAt: '2023-06-01',
      status: 'active',
      department: 'Engineering',
      team: 'Platform',
      managerEmail: 'taylor@company.com',
      ...overrides,
    },
    rowNumber: 2,
    errors,
  };
}

function historyRow(overrides: Partial<ImportHistory> = {}): ImportHistory {
  return {
    id: 'hist-1',
    fileName: 'employees.csv',
    status: 'completed',
    totalRows: 1,
    successCount: 1,
    failedCount: 0,
    duplicateCount: 0,
    errorReport: null,
    importedByUserId: 'user-1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as ImportHistory;
}
// Mock `employee.findMany` for BOTH pipeline calls: - call 1 (resolveReferences) selects `{ id, email }` —…
// manager lookup; - call 2 (detectDuplicates) selects only `{ employeeCode }` or `{ email }`. The two shapes…
/** Creates the ImportHistory row the service reads back after the insert. */
function mockHistoryCreate(mocks: Mocks, overrides: Partial<ImportHistory> = {}): void {
  mocks.prisma.importHistory.create.mockImplementation(
    ({ data }: { data: Partial<ImportHistory> }) =>
      Promise.resolve(
        historyRow({
          fileName: data.fileName,
          status: data.status,
          totalRows: data.totalRows,
          successCount: data.successCount,
          failedCount: data.failedCount,
          duplicateCount: data.duplicateCount,
          // Default to whatever the service wrote (incl. its error report); an
          // explicit override always wins.
          ...overrides,
          errorReport:
            overrides.errorReport === undefined
              ? (data.errorReport as ImportHistory['errorReport'])
              : overrides.errorReport,
        }),
      ),
  );
}

const ENGINEERING_TEAMS = [
  {
    id: 'team-1',
    name: 'Platform',
    departmentId: 'dept-1',
    department: { id: 'dept-1', name: 'Engineering' },
  },
];

/** Row helper without a team reference — for tests that only exercise departments. */
function rowNoTeam(overrides: Partial<ParsedRow['data']> = {}, errors: string[] = []): ParsedRow {
  return row({ team: undefined, managerEmail: undefined, ...overrides }, errors);
}

function mockEmployeeFindMany(
  mocks: Mocks,
  managers: Array<{ id: string; email: string }> = [
    { id: 'manager-1', email: 'taylor@company.com' },
  ],
  dbDupes: Array<{ employeeCode?: string; email?: string }> = [],
): void {
  mocks.prisma.employee.findMany.mockImplementation((args: { select?: unknown; where?: unknown }) =>
    Promise.resolve(
      args.select && 'email' in (args.select as Record<string, unknown>)
        ? managers.filter((m) =>
            (args.where as { email?: { in?: string[] } })?.email?.in?.some(
              (e) => e.toLowerCase() === m.email,
            ),
          )
        : dbDupes,
    ),
  );
}

describe('ImportsService', () => {
  let service: ImportsService;
  let mocks: Mocks;

  beforeEach(() => {
    mocks = createMocks();
    service = new ImportsService(
      mocks.prisma as unknown as PrismaService,
      mocks.csv as unknown as CsvService,
      mocks.rbac as unknown as RbacService,
      mocks.audit as unknown as AuditService,
    );
  });

  describe('importCsv — gates', () => {
    it('rejects a missing file', async () => {
      await expect(service.importCsv(ACTOR, undefined as never)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a non-CSV file type', async () => {
      const exe = { ...FILE, mimetype: 'application/x-msdownload', originalname: 'malware.exe' };
      await expect(service.importCsv(ACTOR, exe)).rejects.toThrow('Only CSV files are supported');
    });

    it('rejects viewers with 403 (not 400)', async () => {
      mocks.rbac.canWrite.mockReturnValue(false);
      await expect(service.importCsv(ACTOR, FILE)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('history reads — scope enforcement', () => {
    it('admins list and read every import', async () => {
      mocks.rbac.isAdmin.mockReturnValue(true);
      mocks.prisma.importHistory.findMany.mockResolvedValue([historyRow()]);
      mocks.prisma.$transaction.mockResolvedValue([[historyRow()], 1]);

      const list = await service.findAll(ACTOR as never, 1, 20);
      expect(list.total).toBe(1);
      // No owner filter for admins — they see the whole feed.
      expect(mocks.prisma.importHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );

      mocks.prisma.importHistory.findUnique.mockResolvedValue(historyRow());
      await expect(service.findOne(ACTOR as never, 'hist-1')).resolves.toMatchObject({
        id: 'hist-1',
      });
    });

    it('managers only list imports they performed', async () => {
      mocks.rbac.isAdmin.mockReturnValue(false);
      mocks.prisma.importHistory.findMany.mockResolvedValue([historyRow()]);
      mocks.prisma.$transaction.mockResolvedValue([[historyRow()], 1]);

      const managerActor = {
        sub: 'user-2',
        email: 'manager@orgwise.dev',
        roles: ['manager'],
      } as never;
      await service.findAll(managerActor, 1, 20);

      expect(mocks.prisma.importHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { importedByUserId: 'user-2' } }),
      );
    });

    it("managers cannot read another user's import (404, opaque)", async () => {
      mocks.rbac.isAdmin.mockReturnValue(false);
      mocks.prisma.importHistory.findUnique.mockResolvedValue(
        historyRow({ id: 'hist-theirs', importedByUserId: 'user-9' }),
      );

      await expect(service.findOne(ACTOR as never, 'hist-theirs')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('managers can read their own import records', async () => {
      mocks.rbac.isAdmin.mockReturnValue(false);
      mocks.prisma.importHistory.findUnique.mockResolvedValue(
        historyRow({ importedByUserId: 'user-1' }),
      );

      await expect(service.findOne(ACTOR as never, 'hist-1')).resolves.toMatchObject({
        id: 'hist-1',
      });
    });

    it('unknown import ids still 404', async () => {
      mocks.prisma.importHistory.findUnique.mockResolvedValue(null);

      await expect(service.findOne(ACTOR as never, 'nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('importCsv — hiring pipeline', () => {
    it('routes hiring CSVs (requisitionId header) to the hiring importer', async () => {
      mocks.csv.isHiringCsv.mockReturnValue(true);
      mocks.csv.parseHiring.mockReturnValue({ rows: [hiringRow()], errorReport: [] });
      mocks.prisma.department.findMany.mockResolvedValue([{ id: 'dept-1', name: 'Engineering' }]);
      mocks.prisma.hiringRecord.create.mockResolvedValue({ id: 'h-1' });
      mocks.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<number>) =>
        fn(mocks.prisma),
      );
      mockHistoryCreate(mocks, { status: 'completed', successCount: 1, totalRows: 1 });

      const result = await service.importCsv(ACTOR, FILE);

      expect(mocks.csv.parse).not.toHaveBeenCalled();
      expect(mocks.prisma.hiringRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requisitionId: 'REQ-101',
            departmentId: 'dept-1',
            status: 'hired',
            offerStatus: 'accepted',
            sourcingCost: 1800,
          }),
        }),
      );
      expect(result.status).toBe('completed');
    });

    it('rejects hiring rows for departments outside the manager scope', async () => {
      mocks.csv.isHiringCsv.mockReturnValue(true);
      mocks.csv.parseHiring.mockReturnValue({ rows: [hiringRow()], errorReport: [] });
      mocks.prisma.department.findMany.mockResolvedValue([{ id: 'dept-1', name: 'Engineering' }]);
      mocks.rbac.departmentScope.mockResolvedValue(['dept-2']); // manager owns Sales only
      mockHistoryCreate(mocks, { status: 'failed', successCount: 0, totalRows: 1 });

      const result = await service.importCsv(ACTOR, FILE);

      expect(mocks.prisma.hiringRecord.create).not.toHaveBeenCalled();
      expect(result.status).toBe('failed');
      expect(result.errorReport?.[0]?.errors.join(' ')).toContain('outside your assigned scope');
    });

    it('flags invalid hiring rows without inserting them', async () => {
      mocks.csv.isHiringCsv.mockReturnValue(true);
      mocks.csv.parseHiring.mockReturnValue({
        rows: [hiringRow({}, ['openedAt "nope" is not a valid date'])],
        errorReport: [
          {
            row: 2,
            employeeCode: 'REQ-101',
            email: null,
            errors: ['openedAt "nope" is not a valid date'],
          },
        ],
      });
      mocks.prisma.department.findMany.mockResolvedValue([{ id: 'dept-1', name: 'Engineering' }]);
      mockHistoryCreate(mocks, { status: 'failed', successCount: 0, totalRows: 1 });

      const result = await service.importCsv(ACTOR, FILE);

      expect(mocks.prisma.hiringRecord.create).not.toHaveBeenCalled();
      expect(result.status).toBe('failed');
    });
  });

  describe('importCsv — pipeline', () => {
    it('inserts valid rows and records import history with zero errors', async () => {
      const rows = [row()];
      mocks.csv.parse.mockReturnValue({ rows, errorReport: [] });
      mocks.prisma.department.findMany.mockResolvedValue([{ id: 'dept-1', name: 'Engineering' }]);
      mocks.prisma.team.findMany.mockResolvedValue([
        { id: 'team-1', name: 'Platform', departmentId: 'dept-1' },
      ]);
      mocks.prisma.team.findMany.mockResolvedValue(ENGINEERING_TEAMS);
      mockEmployeeFindMany(mocks); // manager found + no DB dupes
      mocks.prisma.employee.create.mockResolvedValue({ id: 'emp-1' });
      mocks.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<number>) =>
        fn(mocks.prisma),
      );
      mockHistoryCreate(mocks, { status: 'completed', successCount: 1, totalRows: 1 });

      const result = await service.importCsv(ACTOR, FILE);

      expect(mocks.prisma.employee.create).toHaveBeenCalledTimes(1);
      expect(mocks.prisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            firstName: 'Alex',
            departmentId: 'dept-1',
            teamId: 'team-1',
            managerId: 'manager-1',
          }),
        }),
      );
      expect(mocks.prisma.importHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'completed', successCount: 1, failedCount: 0 }),
        }),
      );
      expect(mocks.audit.record).toHaveBeenCalledWith(
        'user-1',
        'import',
        'import',
        'hist-1',
        expect.any(Object),
        undefined,
      );
      expect(result.status).toBe('completed');
    });

    it('auto-provisions a missing manager so the row still imports', async () => {
      const rows = [row({ managerEmail: 'new.manager@company.com' })];
      mocks.csv.parse.mockReturnValue({ rows, errorReport: [] });
      mocks.prisma.department.findMany.mockResolvedValue([{ id: 'dept-1', name: 'Engineering' }]);
      mocks.prisma.team.findMany.mockResolvedValue(ENGINEERING_TEAMS);
      mockEmployeeFindMany(mocks, []); // manager NOT in the DB
      mocks.prisma.employee.create.mockImplementation(({ data }: { data: { jobTitle?: string } }) =>
        Promise.resolve(data.jobTitle === 'Manager' ? { id: 'mgr-new' } : { id: 'emp-1' }),
      );
      mocks.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<number>) =>
        fn(mocks.prisma),
      );
      mockHistoryCreate(mocks, { status: 'completed', successCount: 1, totalRows: 1 });

      const result = await service.importCsv(ACTOR, FILE);

      // Provisioned manager record + the imported employee itself.
      expect(mocks.prisma.employee.create).toHaveBeenCalledTimes(2);
      expect(mocks.prisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'new.manager@company.com',
            jobTitle: 'Manager',
            departmentId: 'dept-1',
            status: 'active',
          }),
        }),
      );
      // The employee row now points at the provisioned manager.
      expect(mocks.prisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ firstName: 'Alex', managerId: 'mgr-new' }),
        }),
      );
      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(0);
    });

    it('does not provision managers for rows that have other errors', async () => {
      const rows = [row({ managerEmail: 'new.manager@company.com', department: 'UnknownDept' })];
      mocks.csv.parse.mockReturnValue({ rows, errorReport: [] });
      mocks.prisma.department.findMany.mockResolvedValue([]); // department missing
      mocks.prisma.team.findMany.mockResolvedValue([]);
      mockEmployeeFindMany(mocks, []);
      mocks.prisma.employee.create.mockResolvedValue({ id: 'emp-1' });
      mocks.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<number>) =>
        fn(mocks.prisma),
      );
      mockHistoryCreate(mocks, { status: 'completed', successCount: 0, totalRows: 1 });

      const result = await service.importCsv(ACTOR, FILE);

      // Row fails (department + manager errors) — no phantom employee created.
      expect(mocks.prisma.employee.create).not.toHaveBeenCalled();
      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(1);
    });

    it('skips DB duplicates and reports them without inserting', async () => {
      const rows = [rowNoTeam(), rowNoTeam({ employeeCode: 'EMP-2', email: 'b@company.com' })];
      mocks.csv.parse.mockReturnValue({ rows, errorReport: [] });
      mocks.prisma.department.findMany.mockResolvedValue([{ id: 'dept-1', name: 'Engineering' }]);
      mocks.prisma.team.findMany.mockResolvedValue([]);
      // DB already has EMP-1 → row 1 is a duplicate; EMP-2 is clean.
      mockEmployeeFindMany(mocks, [], [{ employeeCode: 'EMP-1' }]);
      mocks.prisma.employee.create.mockResolvedValue({ id: 'emp-2' });
      mocks.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<number>) =>
        fn(mocks.prisma),
      );
      mockHistoryCreate(mocks, {
        status: 'partial',
        successCount: 1,
        failedCount: 1,
        duplicateCount: 1,
      });

      const result = await service.importCsv(ACTOR, FILE);

      expect(mocks.prisma.employee.create).toHaveBeenCalledTimes(1);
      expect(mocks.prisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ employeeCode: 'EMP-2' }) }),
      );
      expect(result.status).toBe('partial');
      expect(result.duplicateCount).toBe(1);
      expect(result.failedCount).toBe(1);
    });

    it('flags within-file duplicate rows and only inserts the first', async () => {
      const rows = [
        rowNoTeam(),
        rowNoTeam({ email: 'b@company.com', employeeCode: 'EMP-2' }),
        rowNoTeam(),
      ];
      mocks.csv.parse.mockReturnValue({ rows, errorReport: [] });
      mocks.prisma.department.findMany.mockResolvedValue([{ id: 'dept-1', name: 'Engineering' }]);
      mocks.prisma.team.findMany.mockResolvedValue([]);
      mockEmployeeFindMany(mocks);
      mocks.prisma.employee.create.mockResolvedValue({ id: 'emp-x' });
      mocks.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<number>) =>
        fn(mocks.prisma),
      );
      mockHistoryCreate(mocks, {
        status: 'partial',
        successCount: 2,
        failedCount: 1,
        duplicateCount: 1,
      });

      const result = await service.importCsv(ACTOR, FILE);

      expect(mocks.prisma.employee.create).toHaveBeenCalledTimes(2);
      expect(result.status).toBe('partial');
      expect(result.duplicateCount).toBe(1);
    });

    it('flags within-file duplicate CODES even when emails differ (no 500 from the unique index)', async () => {
      // Two rows share EMP-1 but have different emails — a naive `email ?? code` key would miss this collision and…
      // the second insert would blow up on the unique employeeCode index, failing the whole file.
      const rows = [rowNoTeam(), rowNoTeam({ email: 'different@company.com' })];
      mocks.csv.parse.mockReturnValue({ rows, errorReport: [] });
      mocks.prisma.department.findMany.mockResolvedValue([{ id: 'dept-1', name: 'Engineering' }]);
      mocks.prisma.team.findMany.mockResolvedValue([]);
      mockEmployeeFindMany(mocks); // no DB dupes
      mocks.prisma.employee.create.mockResolvedValue({ id: 'emp-1' });
      mocks.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<number>) =>
        fn(mocks.prisma),
      );
      mockHistoryCreate(mocks, {
        status: 'partial',
        successCount: 1,
        failedCount: 1,
        duplicateCount: 1,
      });

      const result = await service.importCsv(ACTOR, FILE);

      expect(mocks.prisma.employee.create).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('partial');
      expect(result.duplicateCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.errorReport?.[0]?.errors.join(' ')).toContain('duplicates row 2');
    });

    it('flags within-file duplicate EMAILS even when codes differ', async () => {
      const rows = [rowNoTeam(), rowNoTeam({ employeeCode: 'EMP-2', email: 'alex@company.com' })];
      mocks.csv.parse.mockReturnValue({ rows, errorReport: [] });
      mocks.prisma.department.findMany.mockResolvedValue([{ id: 'dept-1', name: 'Engineering' }]);
      mocks.prisma.team.findMany.mockResolvedValue([]);
      mockEmployeeFindMany(mocks);
      mocks.prisma.employee.create.mockResolvedValue({ id: 'emp-1' });
      mocks.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<number>) =>
        fn(mocks.prisma),
      );
      mockHistoryCreate(mocks, {
        status: 'partial',
        successCount: 1,
        failedCount: 1,
        duplicateCount: 1,
      });

      const result = await service.importCsv(ACTOR, FILE);

      expect(mocks.prisma.employee.create).toHaveBeenCalledTimes(1);
      expect(result.duplicateCount).toBe(1);
    });

    it('keeps a row out when a referenced department is missing', async () => {
      const rows = [rowNoTeam({ department: 'Nope Corp' })];
      mocks.csv.parse.mockReturnValue({ rows, errorReport: [] });
      mocks.prisma.department.findMany.mockResolvedValue([]); // department not found
      mocks.prisma.team.findMany.mockResolvedValue([]);
      mockEmployeeFindMany(mocks);
      mockHistoryCreate(mocks, { status: 'failed', successCount: 0, failedCount: 1 });

      const result = await service.importCsv(ACTOR, FILE);

      expect(mocks.prisma.employee.create).not.toHaveBeenCalled();
      expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
      expect(result.status).toBe('failed');
      expect(result.failedCount).toBe(1);
      expect(result.errorReport?.[0]?.errors.join(' ')).toContain('not found');
    });

    it('rejects rows whose department is outside the manager scope', async () => {
      mocks.rbac.departmentScope.mockResolvedValue(['dept-A']);
      const rows = [rowNoTeam()]; // Engineering → dept-1, outside scope
      mocks.csv.parse.mockReturnValue({ rows, errorReport: [] });
      mocks.prisma.department.findMany.mockResolvedValue([{ id: 'dept-1', name: 'Engineering' }]);
      mocks.prisma.team.findMany.mockResolvedValue([]);
      mockEmployeeFindMany(mocks);
      mockHistoryCreate(mocks, { status: 'failed', successCount: 0, failedCount: 1 });

      const result = await service.importCsv(ACTOR, FILE);

      expect(mocks.prisma.employee.create).not.toHaveBeenCalled();
      expect(result.errorReport?.[0]?.errors.join(' ')).toContain('outside your assigned scope');
    });

    it('carries parse-stage row errors into the report and excludes the row', async () => {
      const good = rowNoTeam();
      const bad = rowNoTeam({ employeeCode: 'X!', email: 'not-an-email' }, [
        'employeeCode may only contain letters, numbers, dots, dashes and underscores',
        '"not-an-email" is not a valid email',
      ]);
      mocks.csv.parse.mockReturnValue({
        rows: [good, bad],
        errorReport: [{ row: 3, employeeCode: 'X!', email: 'not-an-email', errors: bad.errors }],
      });
      mocks.prisma.department.findMany.mockResolvedValue([{ id: 'dept-1', name: 'Engineering' }]);
      mocks.prisma.team.findMany.mockResolvedValue([]);
      mockEmployeeFindMany(mocks);
      mocks.prisma.employee.create.mockResolvedValue({ id: 'emp-1' });
      mocks.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<number>) =>
        fn(mocks.prisma),
      );
      mockHistoryCreate(mocks, { status: 'partial', successCount: 1, failedCount: 1 });

      const result = await service.importCsv(ACTOR, FILE);

      expect(mocks.prisma.employee.create).toHaveBeenCalledTimes(1);
      expect(mocks.prisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email: 'alex@company.com' }) }),
      );
      expect(result.status).toBe('partial');
      expect(result.failedCount).toBe(1);
      expect(result.errorReport).toHaveLength(1);
    });
  });

  describe('previewCsv — dry run', () => {
    it('validates rows and references without writing anything', async () => {
      const rows = [
        { ...row(), rowNumber: 2 },
        {
          ...row({ employeeCode: 'EMP-2', email: 'b@company.com', firstName: 'Bea' }),
          rowNumber: 3,
        },
        {
          ...rowNoTeam({
            employeeCode: 'EMP-3',
            email: 'c@company.com',
            department: 'MissingDept',
          }),
          rowNumber: 4,
        },
      ];
      mocks.csv.parse.mockReturnValue({ rows, errorReport: [] });
      mocks.prisma.department.findMany.mockResolvedValue([{ id: 'dept-1', name: 'Engineering' }]);
      mocks.prisma.team.findMany.mockResolvedValue(ENGINEERING_TEAMS);
      mockEmployeeFindMany(mocks);

      const preview = await service.previewCsv(ACTOR, FILE);

      expect(preview.type).toBe('employees');
      expect(preview.totalRows).toBe(3);
      expect(preview.validRows).toBe(2);
      expect(preview.invalidRows).toBe(1);
      expect(preview.previewRows[0]?.status).toBe('valid');
      expect(preview.previewRows[2]?.status).toBe('invalid');
      expect(preview.previewRows[2]?.errors.join(' ')).toContain('not found');
      // Nothing was created or updated.
      expect(mocks.prisma.employee.create).not.toHaveBeenCalled();
      expect(mocks.prisma.employee.update).not.toHaveBeenCalled();
      expect(mocks.prisma.importHistory.create).not.toHaveBeenCalled();
    });

    it('reports managers that will be auto-provisioned without creating them', async () => {
      const rows = [{ ...row({ managerEmail: 'new.manager@company.com' }), rowNumber: 2 }];
      mocks.csv.parse.mockReturnValue({ rows, errorReport: [] });
      mocks.prisma.department.findMany.mockResolvedValue([{ id: 'dept-1', name: 'Engineering' }]);
      mocks.prisma.team.findMany.mockResolvedValue(ENGINEERING_TEAMS);
      mockEmployeeFindMany(mocks, []); // manager missing

      const preview = await service.previewCsv(ACTOR, FILE);

      expect(preview.managersProvisioned).toBe(1);
      expect(preview.invalidRows).toBe(0);
      expect(mocks.prisma.employee.create).not.toHaveBeenCalled();
    });
  });

  describe('duplicate strategy', () => {
    const dupRow = () => rowNoTeam({ employeeCode: 'EMP-1', email: 'alex@company.com' });

    it('fail rejects the whole file when any row collides', async () => {
      mocks.csv.parse.mockReturnValue({ rows: [dupRow()], errorReport: [] });
      mocks.prisma.department.findMany.mockResolvedValue([{ id: 'dept-1', name: 'Engineering' }]);
      mocks.prisma.team.findMany.mockResolvedValue([]);
      mockEmployeeFindMany(mocks, [], [{ employeeCode: 'EMP-1' }]);
      mocks.prisma.employee.create.mockResolvedValue({ id: 'emp-1' });
      mockHistoryCreate(mocks, { status: 'failed', successCount: 0, totalRows: 1 });

      const result = await service.importCsv(ACTOR, FILE, undefined, {
        duplicateStrategy: 'fail',
      });

      expect(result.status).toBe('failed');
      expect(result.successCount).toBe(0);
      expect(result.errorReport?.[0]?.errors.join(' ')).toContain('already exists');
      expect(mocks.prisma.employee.create).not.toHaveBeenCalled();
    });

    it('update upserts rows whose employeeCode already exists', async () => {
      mocks.csv.parse.mockReturnValue({ rows: [dupRow()], errorReport: [] });
      mocks.prisma.department.findMany.mockResolvedValue([{ id: 'dept-1', name: 'Engineering' }]);
      mocks.prisma.team.findMany.mockResolvedValue([]);
      // Update mode selects { employeeCode, id, email } — route by select shape.
      mocks.prisma.employee.findMany.mockImplementation((args: { select?: unknown }) => {
        const select = (args.select ?? {}) as Record<string, unknown>;
        if ('employeeCode' in select) {
          return Promise.resolve([
            { employeeCode: 'EMP-1', id: 'emp-99', email: 'old@company.com' },
          ]);
        }
        return Promise.resolve([]);
      });
      mocks.prisma.employee.update.mockResolvedValue({ id: 'emp-99' });
      mocks.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(mocks.prisma),
      );
      mockHistoryCreate(mocks, {
        status: 'completed',
        successCount: 0,
        totalRows: 1,
        updatedCount: 1,
      });

      const result = await service.importCsv(ACTOR, FILE, undefined, {
        duplicateStrategy: 'update',
      });

      expect(mocks.prisma.employee.create).not.toHaveBeenCalled();
      expect(mocks.prisma.employee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'emp-99' },
          data: expect.objectContaining({ employeeCode: 'EMP-1', email: 'alex@company.com' }),
        }),
      );
      expect(result.updatedCount).toBe(1);
      expect(result.status).toBe('completed');
    });
  });

  describe('labels', () => {
    it('stores the batch label on the history row', async () => {
      const rows = [row()];
      mocks.csv.parse.mockReturnValue({ rows, errorReport: [] });
      mocks.prisma.department.findMany.mockResolvedValue([{ id: 'dept-1', name: 'Engineering' }]);
      mocks.prisma.team.findMany.mockResolvedValue(ENGINEERING_TEAMS);
      mockEmployeeFindMany(mocks);
      mocks.prisma.employee.create.mockResolvedValue({ id: 'emp-1' });
      mocks.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<number>) =>
        fn(mocks.prisma),
      );
      mockHistoryCreate(mocks, { status: 'completed', successCount: 1, totalRows: 1 });

      await service.importCsv(ACTOR, FILE, undefined, { label: 'Q3 New Hires' });

      expect(mocks.prisma.importHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ label: 'Q3 New Hires', type: 'employees' }),
        }),
      );
    });

    it('rejects labels longer than 80 characters', async () => {
      await expect(
        service.importCsv(ACTOR, FILE, undefined, { label: 'x'.repeat(81) }),
      ).rejects.toThrow('Label must be 80 characters or fewer');
    });
  });

  describe('rollback', () => {
    const historyWithIds = (overrides: Partial<ImportHistory> = {}) =>
      historyRow({
        type: 'employees',
        status: 'completed',
        importedRecordIds: ['emp-a', 'emp-b'],
        ...overrides,
      });

    beforeEach(() => {
      mocks.rbac.isAdmin.mockReturnValue(true);
    });

    it('soft-deletes the imported employees and marks the history rolled back', async () => {
      mocks.prisma.importHistory.findUnique.mockResolvedValue(historyWithIds());
      mocks.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(mocks.prisma),
      );

      const result = await service.rollback(ACTOR, 'hist-1');

      expect(mocks.prisma.employee.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['emp-a', 'emp-b'] } },
          data: expect.objectContaining({ isActive: false, deletedAt: expect.any(Date) }),
        }),
      );
      expect(mocks.prisma.importHistory.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'rolled_back' }) }),
      );
      expect(result.status).toBe('rolled_back');
    });

    it('hard-deletes hiring records for hiring imports', async () => {
      mocks.prisma.importHistory.findUnique.mockResolvedValue(
        historyWithIds({ type: 'hiring', importedRecordIds: ['req-1'] }),
      );
      mocks.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(mocks.prisma),
      );

      await service.rollback(ACTOR, 'hist-1');

      expect(mocks.prisma.hiringRecord.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ['req-1'] } } }),
      );
    });

    it('managers cannot roll back imports they did not perform (404, opaque)', async () => {
      mocks.rbac.isAdmin.mockReturnValue(false);
      mocks.prisma.importHistory.findUnique.mockResolvedValue(
        historyWithIds({ importedByUserId: 'someone-else' }),
      );
      await expect(service.rollback(ACTOR, 'hist-1')).rejects.toThrow(NotFoundException);
      expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an already-rolled-back import', async () => {
      mocks.prisma.importHistory.findUnique.mockResolvedValue(
        historyWithIds({ status: 'rolled_back' }),
      );
      await expect(service.rollback(ACTOR, 'hist-1')).rejects.toThrow('already been rolled back');
    });
  });
});
