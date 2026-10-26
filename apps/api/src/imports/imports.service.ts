import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CsvEmployeeRow,
  DuplicateStrategy,
  Gender,
  ImportHistoryView,
  ImportPreview,
  ImportPreviewRow,
  ImportRowError,
  Paginated,
} from '@orgwise/types';
import { Prisma, type EmployeeStatus, type ImportHistory } from '@prisma/client';
import { AuditService } from '@app/audit/audit.service';
import type { RequestUser } from '@app/common/interfaces/request-user.interface';
import { RbacService } from '@app/common/services/rbac.service';
import { PrismaService } from '@app/database/prisma.service';
import { CsvService, type ParsedHiringRow, type ParsedRow } from './csv.service';

/** Analytics-profile columns accepted by the CSV pipeline — all nullable. */
type AnalyticsProfileInput = {
  attrition?: boolean;
  attritionDate?: Date;
  monthlyIncome?: number | null;
  jobSatisfaction?: number | null;
  environmentSatisfaction?: number | null;
  relationshipSatisfaction?: number | null;
  workLifeBalance?: number | null;
  // Non-nullable in the schema — empty cells fall back to the default.
  overTime?: boolean;
  performanceRating?: number | null;
  education?: number | null;
  educationField?: string | null;
  jobLevel?: number | null;
  yearsAtCompany?: number | null;
  yearsInCurrentRole?: number | null;
  yearsSinceLastPromotion?: number | null;
  yearsWithCurrManager?: number | null;
  totalWorkingYears?: number | null;
  distanceFromHome?: number | null;
  maritalStatus?: string | null;
  businessTravel?: string | null;
  numCompaniesWorked?: number | null;
  trainingTimesLastYear?: number | null;
  percentSalaryHike?: number | null;
  stockOptionLevel?: number | null;
};
// Bulk employee import from CSV. Pipeline: parse → structural validation → resolve references (department /…
// team / manager by name or email) → duplicate detection (file + database) → transactional insert of the valid…
@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly csv: CsvService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
  ) {}

  async importCsv(
    actor: RequestUser,
    file: Express.Multer.File,
    ip?: string,
    options?: { duplicateStrategy?: DuplicateStrategy; label?: string },
  ): Promise<ImportHistoryView> {
    if (!file) throw new BadRequestException('No file uploaded');
    if (file.mimetype !== 'text/csv' && !file.originalname.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException('Only CSV files are supported');
    }
    const { duplicateStrategy = 'skip', label = null } = options ?? {};
    if (!['skip', 'fail', 'update'].includes(duplicateStrategy)) {
      throw new BadRequestException('duplicateStrategy must be one of: skip, fail, update');
    }
    if (label !== null && label !== undefined && label.trim().length > 80) {
      throw new BadRequestException('Label must be 80 characters or fewer');
    }
    const normalizedLabel = label?.trim() || null;
    // Hiring-pipeline CSVs carry a `requisitionId` column — route to the
    // hiring importer instead of the employee pipeline.
    if (this.csv.isHiringCsv(file.buffer)) {
      return this.importHiringCsv(actor, file, ip, { label: normalizedLabel });
    }
    if (!this.rbac.canWrite(actor)) {
      // Forbidden, not BadRequest — viewers hitting this (the @Roles guard normally intercepts first) must get the…
      // same 403 semantics as every other RBAC denial so the client treats it as a permissions failure.
      throw new ForbiddenException('Read-only access — your role cannot import employees');
    }

    const startedAt = Date.now();
    const { rows, errorReport } = this.csv.parse(file.buffer, file.originalname);
    const references = await this.resolveReferences(actor, rows);
    const duplicateCheck = await this.detectDuplicates(rows, {
      allowDbUpdates: duplicateStrategy === 'update',
    });
    // A row is insertable only when it passes ALL three stages: row-level validation, reference resolution…
    // (department/team/manager + scope) and duplicate detection. We carry the ORIGINAL index through so resolved…
    const insertableRows = rows
      .map((row, originalIndex) => ({ row, originalIndex }))
      .filter(
        ({ row, originalIndex }) =>
          row.errors.length === 0 &&
          !references.errorRows[originalIndex] &&
          duplicateCheck.errorRows[originalIndex] === undefined,
      );

    // Build one error report: row validation + reference + duplicate failures.
    const fullReport: ImportRowError[] = [
      ...errorReport,
      ...references.referenceErrors,
      ...duplicateCheck.duplicateErrors,
    ].sort((a, b) => a.row - b.row);

    // `fail` is the strict mode: a single invalid row rejects the whole file.
    const rejectedAsWhole = duplicateStrategy === 'fail' && fullReport.length > 0;
    let successCount = 0;
    let updatedCount = 0;
    const importedRecordIds: string[] = [];
    if (insertableRows.length > 0 && !rejectedAsWhole) {
      // duplicateStrategy = update: DB code-collisions update the existing
      // record in place instead of being skipped as duplicates.
      const updateTargets = new Map(duplicateCheck.dbUpdates.map((u) => [u.index, u.id]));
      const data: Array<{
        originalIndex: number;
        data: Prisma.EmployeeUncheckedCreateInput;
      }> = insertableRows.map(({ row, originalIndex }) => {
        const refs = references.resolved[originalIndex]!;
        const profile = this.parseAnalyticsProfile(row.data);
        // Attrition is a lifecycle event — a flagged leaver is terminated
        // unless the row carries an explicit status.
        const attritionFlag = ['yes', 'y', 'true', '1'].includes(
          (row.data.attrition ?? '').trim().toLowerCase(),
        );
        return {
          originalIndex,
          data: {
            employeeCode: row.data.employeeCode!,
            firstName: row.data.firstName!,
            lastName: row.data.lastName!,
            email: row.data.email!,
            phone: row.data.phone ?? null,
            jobTitle: row.data.jobTitle!,
            gender: (row.data.gender as Gender) ?? 'prefer_not_to_say',
            dateOfBirth: row.data.dateOfBirth ? new Date(row.data.dateOfBirth) : null,
            hiredAt: new Date(row.data.hiredAt!),
            status:
              (row.data.status as EmployeeStatus) ?? (attritionFlag ? 'terminated' : 'active'),
            departmentId: refs.departmentId,
            teamId: refs.teamId,
            managerId: refs.managerId,
            ...profile,
          } satisfies Prisma.EmployeeUncheckedCreateInput,
        };
      });

      // Sequential creates can outlast Prisma's 5s interactive-transaction
      // default on slow networks (e.g. cross-region Neon) — raise it so large
      // files never abort mid-import.
      const result = await this.prisma.$transaction(
        async (tx) => {
          // createMany cannot return rows; create sequentially for reporting.
          let created = 0;
          let updated = 0;
          const ids: string[] = [];
          for (const { originalIndex, data: record } of data) {
            const targetId = updateTargets.get(originalIndex);
            if (targetId) {
              await tx.employee.update({ where: { id: targetId }, data: record });
              updated += 1;
              ids.push(targetId);
            } else {
              const createdRecord = await tx.employee.create({ data: record });
              created += 1;
              ids.push(createdRecord.id);
            }
          }
          return { created, updated, ids };
        },
        { timeout: 120_000 },
      );
      successCount = result.created;
      updatedCount = result.updated;
      importedRecordIds.push(...result.ids);
    }

    const status =
      rejectedAsWhole || successCount === 0
        ? 'failed'
        : fullReport.length === 0
          ? 'completed'
          : 'partial';

    const history = await this.prisma.importHistory.create({
      data: {
        fileName: file.originalname,
        type: 'employees',
        label: normalizedLabel,
        status,
        totalRows: rows.length,
        successCount,
        updatedCount,
        failedCount: rows.length - successCount,
        duplicateCount: duplicateCheck.duplicateCount,
        importedRecordIds,
        errorReport:
          fullReport.length > 0
            ? (fullReport as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        importedByUserId: actor.sub,
        durationMs: Date.now() - startedAt,
      },
      include: { importedByUser: { select: { id: true, name: true, email: true } } },
    });

    await this.audit.record(
      actor.sub,
      'import',
      'import',
      history.id,
      {
        fileName: file.originalname,
        type: 'employees',
        label: normalizedLabel,
        created: successCount,
        updated: updatedCount,
        failed: rows.length - successCount,
      },
      ip,
    );

    return this.toView(history);
  }

  /** Imports a hiring-pipeline CSV (requisitionId header) into HiringRecord rows. */
  private async importHiringCsv(
    actor: RequestUser,
    file: Express.Multer.File,
    ip?: string,
    options?: { label?: string | null },
  ): Promise<ImportHistoryView> {
    const label = options?.label?.trim() || null;
    if (!this.rbac.canWrite(actor)) {
      throw new ForbiddenException('Read-only access — your role cannot import hiring data');
    }
    const startedAt = Date.now();
    const { rows, errorReport } = this.csv.parseHiring(file.buffer, file.originalname);
    const scope = await this.rbac.departmentScope(actor);

    // Resolve departments by name, enforcing the caller's RBAC scope.
    const departmentNames = new Set(rows.map((r) => r.data.department.trim()).filter(Boolean));
    const departments =
      departmentNames.size > 0
        ? await this.prisma.department.findMany({
            where: { deletedAt: null, name: { in: [...departmentNames] } },
          })
        : [];
    const deptByName = new Map(departments.map((d) => [d.name.trim().toLowerCase(), d.id]));

    const resolved: Array<{ departmentId: string; row: ParsedHiringRow }> = [];
    const fullReport: ImportRowError[] = [...errorReport];
    for (const row of rows) {
      const name = row.data.department.trim().toLowerCase();
      const departmentId = deptByName.get(name);
      const rowErrors = [...row.errors];
      if (!departmentId) rowErrors.push(`Department "${row.data.department}" not found`);
      else if (scope && !scope.includes(departmentId)) {
        rowErrors.push(`Department "${row.data.department}" is outside your assigned scope`);
      }
      if (rowErrors.length > 0) {
        fullReport.push({
          row: row.rowNumber,
          employeeCode: row.data.requisitionId,
          email: null,
          errors: rowErrors,
        });
        continue;
      }
      resolved.push({ departmentId: departmentId!, row });
    }

    let successCount = 0;
    const importedRecordIds: string[] = [];
    if (resolved.length > 0) {
      const result = await this.prisma.$transaction(
        async (tx) => {
          let created = 0;
          const ids: string[] = [];
          for (const { departmentId, row } of resolved) {
            const d = row.data;
            const status = d.status ?? (d.offerStatus === 'accepted' ? 'hired' : 'open');
            const record = await tx.hiringRecord.create({
              data: {
                requisitionId: d.requisitionId,
                jobTitle: d.jobTitle,
                departmentId,
                candidateName: d.candidateName ?? null,
                openedAt: new Date(d.openedAt!),
                offerSentAt: d.offerSentAt ? new Date(d.offerSentAt) : null,
                acceptedAt: d.acceptedAt ? new Date(d.acceptedAt) : null,
                startDate: d.startDate ? new Date(d.startDate) : null,
                offerStatus: d.offerStatus ?? null,
                status,
                sourcingCost: d.sourcingCost ?? null,
                recruitingCost: d.recruitingCost ?? null,
              },
            });
            created += 1;
            ids.push(record.id);
          }
          return { created, ids };
        },
        { timeout: 120_000 },
      );
      successCount = result.created;
      importedRecordIds.push(...result.ids);
    }

    const status =
      successCount === 0 ? 'failed' : fullReport.length === 0 ? 'completed' : 'partial';
    const history = await this.prisma.importHistory.create({
      data: {
        fileName: file.originalname,
        type: 'hiring',
        label,
        status,
        totalRows: rows.length,
        successCount,
        failedCount: rows.length - successCount,
        duplicateCount: 0,
        importedRecordIds,
        errorReport:
          fullReport.length > 0
            ? (fullReport as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        importedByUserId: actor.sub,
        durationMs: Date.now() - startedAt,
      },
      include: { importedByUser: { select: { id: true, name: true, email: true } } },
    });

    await this.audit.record(
      actor.sub,
      'import',
      'import',
      history.id,
      {
        fileName: file.originalname,
        type: 'hiring',
        label,
        created: successCount,
        updated: 0,
        failed: rows.length - successCount,
      },
      ip,
    );
    return this.toView(history);
  }

  async findAll(
    actor: RequestUser,
    page: number,
    pageSize: number,
  ): Promise<Paginated<ImportHistoryView>> {
    // Scope: admins see the whole feed; managers and viewers only see imports they performed. Import history…
    // carries org data (filenames, counts, per-row error reports with employee emails/codes), so letting a manager…
    const where: Prisma.ImportHistoryWhereInput = this.rbac.isAdmin(actor)
      ? {}
      : { importedByUserId: actor.sub };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.importHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { importedByUser: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.importHistory.count({ where }),
    ]);
    return {
      items: items.map((h) => this.toView(h)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(actor: RequestUser, id: string): Promise<ImportHistoryView> {
    const history = await this.prisma.importHistory.findUnique({
      where: { id },
      include: { importedByUser: { select: { id: true, name: true, email: true } } },
    });
    if (!history) throw new NotFoundException('Import record not found');
    // Same scope rule as findAll — a non-admin may only read imports they performed. A NotFound (not Forbidden)…
    // keeps the resource opaque: an out-of-scope import id is indistinguishable from a nonexistent one.
    if (!this.rbac.isAdmin(actor) && history.importedByUserId !== actor.sub) {
      throw new NotFoundException('Import record not found');
    }
    return this.toView(history);
  }

  /** Dry-run a CSV — parse + validate + resolve, write NOTHING to the DB. */
  async previewCsv(actor: RequestUser, file: Express.Multer.File): Promise<ImportPreview> {
    if (!file) throw new BadRequestException('No file uploaded');
    if (file.mimetype !== 'text/csv' && !file.originalname.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException('Only CSV files are supported');
    }
    if (this.csv.isHiringCsv(file.buffer)) return this.previewHiringCsv(actor, file);

    const { rows, errorReport } = this.csv.parse(file.buffer, file.originalname);
    const references = await this.resolveReferences(actor, rows, { provision: false });
    const duplicateCheck = await this.detectDuplicates(rows);

    const errorRows = new Map<number, string[]>();
    for (const entry of [
      ...errorReport,
      ...references.referenceErrors,
      ...duplicateCheck.duplicateErrors,
    ]) {
      errorRows.set(entry.row, entry.errors);
    }

    const previewRows: ImportPreviewRow[] = rows.slice(0, 25).map((row) => {
      const errors = errorRows.get(row.rowNumber) ?? [];
      return {
        row: row.rowNumber,
        employeeCode: row.data.employeeCode ?? null,
        email: row.data.email ?? null,
        name:
          row.data.firstName && row.data.lastName
            ? `${row.data.firstName} ${row.data.lastName}`
            : null,
        department: row.data.department ?? null,
        team: row.data.team ?? null,
        status: errors.length > 0 ? 'invalid' : 'valid',
        errors,
      };
    });

    return {
      type: 'employees',
      fileName: file.originalname,
      totalRows: rows.length,
      validRows: rows.length - errorRows.size,
      invalidRows: errorRows.size,
      duplicateCount: duplicateCheck.duplicateCount,
      managersProvisioned: references.managersProvisioned,
      columnMatch: this.csv.analyzeHeaders(file.buffer),
      previewRows,
    };
  }

  /** Dry-run a hiring-pipeline CSV — resolve departments + scope, write nothing. */
  private async previewHiringCsv(
    actor: RequestUser,
    file: Express.Multer.File,
  ): Promise<ImportPreview> {
    const { rows, errorReport } = this.csv.parseHiring(file.buffer, file.originalname);
    const scope = await this.rbac.departmentScope(actor);
    const departmentNames = new Set(rows.map((r) => r.data.department.trim()).filter(Boolean));
    const departments =
      departmentNames.size > 0
        ? await this.prisma.department.findMany({
            where: { deletedAt: null, name: { in: [...departmentNames] } },
          })
        : [];
    const deptByName = new Map(departments.map((d) => [d.name.trim().toLowerCase(), d.id]));

    const errorByRow = new Map<number, string[]>();
    for (const entry of errorReport) errorByRow.set(entry.row, entry.errors);
    for (const row of rows) {
      const name = row.data.department.trim().toLowerCase();
      const departmentId = deptByName.get(name);
      const errors = [...row.errors];
      if (!departmentId) errors.push(`Department "${row.data.department}" not found`);
      else if (scope && !scope.includes(departmentId)) {
        errors.push(`Department "${row.data.department}" is outside your assigned scope`);
      }
      if (errors.length > 0) errorByRow.set(row.rowNumber, errors);
    }

    const previewRows: ImportPreviewRow[] = rows.slice(0, 25).map((row) => ({
      row: row.rowNumber,
      employeeCode: row.data.requisitionId ?? null,
      email: null,
      name: row.data.candidateName ?? null,
      department: row.data.department ?? null,
      team: null,
      status: errorByRow.has(row.rowNumber) ? 'invalid' : 'valid',
      errors: errorByRow.get(row.rowNumber) ?? [],
    }));

    return {
      type: 'hiring',
      fileName: file.originalname,
      totalRows: rows.length,
      validRows: rows.length - errorByRow.size,
      invalidRows: errorByRow.size,
      duplicateCount: 0,
      managersProvisioned: 0,
      columnMatch: this.csv.analyzeHiringHeaders(file.buffer),
      previewRows,
    };
  }

  /**
   * Rolls back an import: soft-deletes the employees (or removes the hiring
   * records) it created and marks the history row as rolled back.
   */
  async rollback(actor: RequestUser, id: string, ip?: string): Promise<ImportHistoryView> {
    const history = await this.prisma.importHistory.findUnique({
      where: { id },
      include: { importedByUser: { select: { id: true, name: true, email: true } } },
    });
    if (!history) throw new NotFoundException('Import record not found');
    // Same scope rule as the rest of the module — a non-admin may only roll
    // back imports they performed, reported opaquely as a 404.
    if (!this.rbac.isAdmin(actor) && history.importedByUserId !== actor.sub) {
      throw new NotFoundException('Import record not found');
    }
    if (history.status === 'rolled_back') {
      throw new BadRequestException('This import has already been rolled back');
    }
    if (history.importedRecordIds.length === 0) {
      throw new BadRequestException('This import has no records to roll back');
    }

    await this.prisma.$transaction(
      async (tx) => {
        if (history.type === 'hiring') {
          await tx.hiringRecord.deleteMany({ where: { id: { in: history.importedRecordIds } } });
        } else {
          // A rollback removes the records from the active workforce without
          // turning them into attrition events.
          await tx.employee.updateMany({
            where: { id: { in: history.importedRecordIds } },
            data: { deletedAt: new Date(), isActive: false },
          });
        }
        await tx.importHistory.update({ where: { id }, data: { status: 'rolled_back' } });
      },
      { timeout: 120_000 },
    );

    await this.audit.record(
      actor.sub,
      'delete',
      'import',
      id,
      { fileName: history.fileName, rolledBack: history.importedRecordIds.length },
      ip,
    );
    return this.toView({ ...history, status: 'rolled_back' });
  }

  buildTemplate(): string {
    return this.csv.buildTemplate();
  }

  /** Downloadable hiring-pipeline CSV template (one example requisition). */
  buildHiringTemplate(): string {
    return this.csv.buildHiringTemplate();
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  // Converts the CSV string profile columns into typed values for the insert. Values are nullable by design: an…
  // optional column left blank stays null so analytics report "not available" instead of a fabricated number.…
  private parseAnalyticsProfile(row: CsvEmployeeRow): AnalyticsProfileInput {
    const toInt = (value: string | undefined): number | null => {
      if (value === undefined || value === '') return null;
      const n = Number(value);
      return Number.isInteger(n) ? n : null;
    };
    const toBool = (value: string | undefined): boolean | null => {
      if (value === undefined || value === '') return null;
      const v = value.toLowerCase();
      return ['yes', 'y', 'true', '1'].includes(v);
    };

    const attrition = toBool(row.attrition);
    return {
      attrition: attrition ?? false,
      ...(attrition && row.attritionDate && !Number.isNaN(Date.parse(row.attritionDate))
        ? { attritionDate: new Date(row.attritionDate) }
        : attrition
          ? { attritionDate: new Date() }
          : {}),
      monthlyIncome: toInt(row.monthlyIncome),
      jobSatisfaction: toInt(row.jobSatisfaction),
      environmentSatisfaction: toInt(row.environmentSatisfaction),
      relationshipSatisfaction: toInt(row.relationshipSatisfaction),
      workLifeBalance: toInt(row.workLifeBalance),
      // Non-nullable schema columns — an empty cell falls back to the default.
      overTime: toBool(row.overTime) ?? false,
      performanceRating: toInt(row.performanceRating),
      education: toInt(row.education),
      educationField: row.educationField || null,
      jobLevel: toInt(row.jobLevel),
      yearsAtCompany: toInt(row.yearsAtCompany),
      yearsInCurrentRole: toInt(row.yearsInCurrentRole),
      yearsSinceLastPromotion: toInt(row.yearsSinceLastPromotion),
      yearsWithCurrManager: toInt(row.yearsWithCurrManager),
      totalWorkingYears: toInt(row.totalWorkingYears),
      distanceFromHome: toInt(row.distanceFromHome),
      maritalStatus: row.maritalStatus || null,
      businessTravel: row.businessTravel || null,
      numCompaniesWorked: toInt(row.numCompaniesWorked),
      trainingTimesLastYear: toInt(row.trainingTimesLastYear),
      percentSalaryHike: toInt(row.percentSalaryHike),
      stockOptionLevel: toInt(row.stockOptionLevel),
    };
  }

  private async resolveReferences(
    actor: RequestUser,
    rows: ParsedRow[],
    opts?: { provision?: boolean },
  ) {
    const provision = opts?.provision !== false;
    // Query with the ORIGINAL (trimmed) names/emails — Postgres `IN` is case-sensitive, so lowercasing the lookup…
    // values would miss rows that are stored with capitals (e.g. "Engineering"). Matching against the results is…
    const nonEmpty = (value: string | undefined): value is string => Boolean(value);
    const departmentNames = new Set(rows.map((r) => r.data.department?.trim()).filter(nonEmpty));
    const teamNames = new Set(rows.map((r) => r.data.team?.trim()).filter(nonEmpty));
    const managerEmails = new Set(rows.map((r) => r.data.managerEmail?.trim()).filter(nonEmpty));

    const [departments, teams, managers, scope] = await Promise.all([
      departmentNames.size > 0
        ? this.prisma.department.findMany({
            where: { deletedAt: null, name: { in: [...departmentNames] } },
          })
        : Promise.resolve([]),
      teamNames.size > 0
        ? this.prisma.team.findMany({
            where: {
              deletedAt: null,
              name: { in: [...teamNames] },
              department: { deletedAt: null },
            },
            include: { department: { select: { id: true, name: true } } },
          })
        : Promise.resolve([]),
      managerEmails.size > 0
        ? this.prisma.employee.findMany({
            where: { deletedAt: null, email: { in: [...managerEmails] } },
            select: { id: true, email: true },
          })
        : Promise.resolve([]),
      this.rbac.departmentScope(actor),
    ]);

    const byName = (name: string | undefined) => name?.trim().toLowerCase() ?? '';

    const resolved: Array<{
      departmentId: string;
      teamId: string | null;
      managerId: string | null;
    }> = [];
    const referenceErrors: ImportRowError[] = [];
    const errorRows: Record<number, boolean> = {};
    // Rows whose manager email does not exist yet — resolved by auto-provisioning
    // after the loop (only when the row itself is otherwise valid).
    const deferredManagers: Array<{
      index: number;
      row: number;
      email: string;
      error: string;
      errors: string[];
    }> = [];

    rows.forEach((row, index) => {
      const errors: string[] = [];
      const departmentName = byName(row.data.department);
      const department = departmentName
        ? departments.find((d) => d.name.toLowerCase() === departmentName)
        : undefined;
      // An employee must belong to a department (NOT NULL FK), so a row without one cannot be imported — surface it…
      // as a row error instead of letting the insert throw and abort the whole file.
      if (!departmentName) {
        errors.push('department is required to place this employee');
      } else if (!department) {
        errors.push(`Department "${row.data.department}" not found`);
      }
      if (department && scope && !scope.includes(department.id)) {
        errors.push(`Department "${row.data.department}" is outside your assigned scope`);
      }

      let teamId: string | null = null;
      const teamName = byName(row.data.team);
      if (teamName) {
        const team = teams.find((t) => t.name.toLowerCase() === teamName);
        if (!team) {
          errors.push(`Team "${row.data.team}" not found`);
        } else if (department && team.departmentId !== department.id) {
          errors.push(
            `Team "${row.data.team}" does not belong to department "${row.data.department}"`,
          );
        } else {
          teamId = team.id;
        }
      }

      let managerId: string | null = null;
      const managerEmail = byName(row.data.managerEmail);
      if (managerEmail) {
        const manager = managers.find((m) => m.email.toLowerCase() === managerEmail);
        if (!manager) {
          const error = `Manager with email "${row.data.managerEmail}" not found`;
          errors.push(error);
          deferredManagers.push({ index, row: row.rowNumber, email: managerEmail, error, errors });
        } else {
          managerId = manager.id;
        }
      }

      resolved.push({ departmentId: department?.id ?? '', teamId, managerId });
      if (errors.length > 0) {
        errorRows[index] = true;
        referenceErrors.push({
          row: row.rowNumber,
          employeeCode: row.data.employeeCode ?? null,
          email: row.data.email ?? null,
          errors,
        });
      }
    });

    // Auto-provisioning: a manager reference is an EMPLOYEE record. When the
    // email is missing (e.g. after a DB reset) and the row is otherwise valid,
    // create a minimal manager profile so the row imports instead of failing.
    // Only rows that resolved a department AND have no other errors qualify,
    // so out-of-scope or malformed rows never fabricate employees.
    const toProvision = new Map<string, string>(); // email → departmentId
    for (const d of deferredManagers) {
      // The row qualifies only when the missing manager is its ONLY problem.
      const departmentId = resolved[d.index]?.departmentId;
      if (departmentId && d.errors.length === 1 && d.errors[0] === d.error) {
        toProvision.set(d.email, departmentId);
      }
    }
    // Preview mode resolves missing managers without writing anything; the
    // confirmed import provisions them at commit time.
    const clearDeferredErrors = (email: string, createdId: string | null): void => {
      for (const d of deferredManagers) {
        if (d.email !== email) continue;
        if (createdId) {
          const target = resolved[d.index];
          if (target) target.managerId = createdId;
        }
        const at = d.errors.indexOf(d.error);
        if (at !== -1) d.errors.splice(at, 1);
        if (d.errors.length === 0) {
          const pos = referenceErrors.findIndex((e) => e.row === d.row);
          if (pos !== -1) referenceErrors.splice(pos, 1);
          delete errorRows[d.index];
        }
      }
    };

    let managersProvisioned = 0;
    for (const [email, departmentId] of toProvision) {
      if (!provision) {
        // Preview: report the managers that WILL be created at commit time.
        managersProvisioned += 1;
        clearDeferredErrors(email, null);
        continue;
      }
      let createdId: string | null = null;
      try {
        const created = await this.prisma.employee.create({
          data: {
            employeeCode: this.managerCode(email),
            firstName: this.nameFromEmail(email).first,
            lastName: this.nameFromEmail(email).last,
            email,
            jobTitle: 'Manager',
            gender: 'prefer_not_to_say',
            hiredAt: new Date(),
            status: 'active',
            departmentId,
          },
          select: { id: true },
        });
        createdId = created?.id ?? null;
      } catch {
        createdId = null; // leave the row error intact
      }
      if (!createdId) continue;
      managersProvisioned += 1;
      clearDeferredErrors(email, createdId);
    }

    return { resolved, referenceErrors, errorRows, managersProvisioned };
  }

  /** Deterministic employee code for an auto-provisioned manager record. */
  private managerCode(email: string): string {
    const stem = (email.split('@')[0] ?? 'manager').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return `MGR-${stem.slice(0, 24) || 'MANAGER'}`;
  }

  /** Best-effort name split from the email local part (e.g. reese.khan.8 → Reese Khan). */
  private nameFromEmail(email: string): { first: string; last: string } {
    const local = (email.split('@')[0] ?? '').replace(/[._-]+/g, ' ').trim();
    const tokens = local.split(/\s+/).filter((t) => t && !/^\d+$/.test(t));
    const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
    if (tokens.length === 0) return { first: 'Team', last: 'Manager' };
    return {
      first: cap(tokens[0]!),
      last: tokens.length > 1 ? tokens.slice(1).map(cap).join(' ') : 'Manager',
    };
  }

  private async detectDuplicates(rows: ParsedRow[], opts?: { allowDbUpdates?: boolean }) {
    const allowDbUpdates = opts?.allowDbUpdates ?? false;
    const duplicateErrors: ImportRowError[] = [];
    // employeeCode and email are tracked INDEPENDENTLY — a single "email ?? code" key would miss two rows sharing a…
    // code with different emails, letting both through to the insert where the second hits the unique index and…
    const seenCodes = new Map<string, number>(); // normalized code → first row number
    const seenEmails = new Map<string, number>(); // normalized email → first row number
    const errorRows: Record<number, boolean> = {};
    const dbUpdates: Array<{ index: number; id: string }> = [];
    let duplicateCount = 0;

    const allCodes = rows.map((r) => r.data.employeeCode).filter(Boolean) as string[];
    const allEmails = rows.map((r) => r.data.email).filter(Boolean) as string[];
    // NOTE: soft-deleted employees are included. The unique indexes on employeeCode/email are global (not partial),…
    // so a deleted employee still occupies its identifiers — excluding them here would let a row pass duplicate…
    const [dbByCode, dbByEmail] = await Promise.all([
      allCodes.length > 0
        ? this.prisma.employee.findMany({
            where: { employeeCode: { in: allCodes } },
            select: allowDbUpdates
              ? { employeeCode: true, id: true, email: true }
              : { employeeCode: true },
          })
        : Promise.resolve([]),
      allEmails.length > 0
        ? this.prisma.employee.findMany({
            where: { email: { in: allEmails } },
            select: allowDbUpdates ? { email: true, id: true } : { email: true },
          })
        : Promise.resolve([]),
    ]);
    const dbByCodeMap = new Map(dbByCode.map((e) => [e.employeeCode.toLowerCase(), e]));
    const dbEmailMap = new Map(dbByEmail.map((e) => [e.email.toLowerCase(), e]));

    rows.forEach((row, index) => {
      const errors: string[] = [];
      const code = row.data.employeeCode?.toLowerCase();
      const email = row.data.email?.toLowerCase();
      const existingByCode = code ? dbByCodeMap.get(code) : undefined;

      if (allowDbUpdates && existingByCode) {
        // update strategy: a code collision updates in place — but an email
        // collision on a DIFFERENT record still blocks the row.
        const existingId = (existingByCode as { id?: string }).id;
        const collidingEmail =
          email && dbEmailMap.has(email)
            ? (dbEmailMap.get(email) as { id?: string }).id
            : undefined;
        if (
          email &&
          existingId !== undefined &&
          collidingEmail !== undefined &&
          collidingEmail !== existingId
        ) {
          errors.push(`Email "${row.data.email}" already exists in the database`);
        } else if (existingId !== undefined) {
          dbUpdates.push({ index, id: existingId });
        } else {
          if (code && dbByCodeMap.has(code)) {
            errors.push(`Employee code "${row.data.employeeCode}" already exists in the database`);
          }
          if (email && dbEmailMap.has(email)) {
            errors.push(`Email "${row.data.email}" already exists in the database`);
          }
        }
      } else {
        // DB duplicates apply to every row (an insertable row would collide).
        if (code && dbByCodeMap.has(code)) {
          errors.push(`Employee code "${row.data.employeeCode}" already exists in the database`);
        }
        if (email && dbEmailMap.has(email)) {
          errors.push(`Email "${row.data.email}" already exists in the database`);
        }
      }
      // Within-file duplicates — only among rows that passed row-level validation (an invalid row never occupies its…
      // identifiers), and checked per field so code-collisions and email-collisions are both caught no matter how the…
      if (row.errors.length === 0) {
        if (code && !dbByCodeMap.has(code)) {
          const first = seenCodes.get(code);
          if (first !== undefined) {
            errors.push(
              `Employee code "${row.data.employeeCode}" duplicates row ${first} within the file`,
            );
            duplicateCount += 1;
          } else {
            seenCodes.set(code, row.rowNumber);
          }
        }
        if (email && !dbEmailMap.has(email)) {
          const first = seenEmails.get(email);
          if (first !== undefined) {
            errors.push(`Email "${row.data.email}" duplicates row ${first} within the file`);
            duplicateCount += 1;
          } else {
            seenEmails.set(email, row.rowNumber);
          }
        }
      }

      if (errors.length > 0) {
        errorRows[index] = true;
        duplicateErrors.push({
          row: row.rowNumber,
          employeeCode: row.data.employeeCode ?? null,
          email: row.data.email ?? null,
          errors,
        });
      }
    });

    return { errorRows, duplicateErrors, duplicateCount, dbUpdates };
  }

  private toView(
    h: ImportHistory & { importedByUser?: { id: string; name: string; email: string } | null },
  ): ImportHistoryView {
    return {
      id: h.id,
      fileName: h.fileName,
      type: (h.type as 'employees' | 'hiring' | null) ?? null,
      label: h.label ?? null,
      status: h.status,
      totalRows: h.totalRows,
      successCount: h.successCount,
      updatedCount: h.updatedCount,
      failedCount: h.failedCount,
      duplicateCount: h.duplicateCount,
      errorReport: (h.errorReport as ImportRowError[] | null) ?? null,
      importedByUserId: h.importedByUserId,
      createdAt: h.createdAt.toISOString(),
      durationMs: h.durationMs ?? null,
      importedBy: h.importedByUser
        ? { id: h.importedByUser.id, name: h.importedByUser.name, email: h.importedByUser.email }
        : null,
    };
  }
}
