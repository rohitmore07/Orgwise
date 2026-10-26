import { BadRequestException, Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import type { CsvEmployeeRow, ImportRowError } from '@orgwise/types';

/** Expected CSV header row. */
export const CSV_HEADERS = [
  'employeeCode',
  'firstName',
  'lastName',
  'email',
  'phone',
  'jobTitle',
  'gender',
  'dateOfBirth',
  'hiredAt',
  'status',
  'department',
  'team',
  'managerEmail',
  // Phase 4 analytics & engagement profile (IBM HR-style dimensions).
  'attrition',
  'monthlyIncome',
  'jobSatisfaction',
  'environmentSatisfaction',
  'relationshipSatisfaction',
  'workLifeBalance',
  'overTime',
  'performanceRating',
  'education',
  'educationField',
  'jobLevel',
  'yearsAtCompany',
  'yearsInCurrentRole',
  'yearsSinceLastPromotion',
  'yearsWithCurrManager',
  'totalWorkingYears',
  'distanceFromHome',
  'maritalStatus',
  'businessTravel',
  'numCompaniesWorked',
  'trainingTimesLastYear',
  'percentSalaryHike',
  'stockOptionLevel',
] as const;

export type CsvHeader = (typeof CSV_HEADERS)[number];
// Header aliases for columns that do not round-trip through whitespace/case stripping. `Hire Date` → `hiredate`…
// can never normalize to `hiredAt`, so natural-language variants are mapped explicitly to the canonical key.
const HEADER_ALIASES: Record<string, CsvHeader> = {
  hiredate: 'hiredAt',
  datehired: 'hiredAt',
  hiredon: 'hiredAt',
};

const GENDERS = ['female', 'male', 'non_binary', 'prefer_not_to_say'] as const;
const STATUSES = ['active', 'on_leave', 'probation', 'terminated'] as const;
/** Accepted "yes" values for boolean columns (attrition / overTime). */
const YES_VALUES = new Set(['yes', 'y', 'true', '1']);
/** Accepted "no" values for boolean columns. */
const NO_VALUES = new Set(['no', 'n', 'false', '0', '']);
/** Columns that must be an integer in 1..4 when present. */
const LEVEL_1_4: CsvHeader[] = [
  'jobSatisfaction',
  'environmentSatisfaction',
  'relationshipSatisfaction',
  'workLifeBalance',
  'performanceRating',
];
/** Columns that must be a non-negative integer when present. */
const NON_NEGATIVE_INT: CsvHeader[] = [
  'monthlyIncome',
  'education',
  'jobLevel',
  'yearsAtCompany',
  'yearsInCurrentRole',
  'yearsSinceLastPromotion',
  'yearsWithCurrManager',
  'totalWorkingYears',
  'distanceFromHome',
  'numCompaniesWorked',
  'trainingTimesLastYear',
  'percentSalaryHike',
  'stockOptionLevel',
];

/** One parsed + validated row. */
export interface ParsedRow {
  data: CsvEmployeeRow;
  rowNumber: number;
  errors: string[];
}

/** One parsed + validated hiring-pipeline row. */
export interface ParsedHiringRow {
  data: {
    requisitionId: string;
    jobTitle: string;
    department: string;
    candidateName?: string | null;
    openedAt?: string;
    offerSentAt?: string | null;
    acceptedAt?: string | null;
    startDate?: string | null;
    offerStatus?: string | null;
    status?: string | null;
    sourcingCost?: number | null;
    recruitingCost?: number | null;
  };
  rowNumber: number;
  errors: string[];
}

/** Outcome of parsing a CSV buffer. */
export interface ParseResult {
  rows: ParsedRow[];
  errorReport: ImportRowError[];
}
// Parses and row-validates a CSV buffer into normalized employee rows. Structural rules (header…
// presence/columns) fail the whole import; per-row rules (missing required fields, bad enums, malformed dates)…
@Injectable()
export class CsvService {
  parse(buffer: Buffer, originalName: string): ParseResult {
    let records: Record<string, unknown>[];
    try {
      records = parse(buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
        relax_column_count: true,
      }) as Record<string, unknown>[];
    } catch (error) {
      throw new BadRequestException(
        `Could not parse CSV "${originalName}": ${error instanceof Error ? error.message : 'malformed file'}`,
      );
    }

    if (records.length === 0) {
      throw new BadRequestException('The CSV file contains no data rows');
    }

    // Normalize keys to our canonical header names (case + whitespace tolerant).
    const rows: ParsedRow[] = records.map((raw, index) => {
      const row = this.normalizeRow(raw);
      return {
        data: row,
        rowNumber: index + 2, // 1-based including the header row
        errors: this.validateRow(row),
      };
    });

    const errorReport: ImportRowError[] = rows
      .filter((r) => r.errors.length > 0)
      .map((r) => ({
        row: r.rowNumber,
        employeeCode: r.data.employeeCode ?? null,
        email: r.data.email ?? null,
        errors: r.errors,
      }));

    return { rows, errorReport };
  }

  /** Builds the downloadable CSV template string. */
  buildTemplate(): string {
    const example: Record<CsvHeader, string> = {
      employeeCode: 'EMP-0101',
      firstName: 'Alex',
      lastName: 'Morgan',
      email: 'alex.morgan@company.com',
      phone: '+1 555 010 0101',
      jobTitle: 'Senior Engineer',
      gender: 'female',
      dateOfBirth: '1992-04-12',
      hiredAt: '2023-06-01',
      status: 'active',
      department: 'Engineering',
      team: 'Platform',
      managerEmail: 'taylor.lee@company.com',
      attrition: 'No',
      monthlyIncome: '9800',
      jobSatisfaction: '4',
      environmentSatisfaction: '3',
      relationshipSatisfaction: '4',
      workLifeBalance: '3',
      overTime: 'No',
      performanceRating: '3',
      education: '3',
      educationField: 'Technical Degree',
      jobLevel: '3',
      yearsAtCompany: '5',
      yearsInCurrentRole: '2',
      yearsSinceLastPromotion: '1',
      yearsWithCurrManager: '3',
      totalWorkingYears: '9',
      distanceFromHome: '8',
      maritalStatus: 'Married',
      businessTravel: 'Travel_Rarely',
      numCompaniesWorked: '3',
      trainingTimesLastYear: '2',
      percentSalaryHike: '14',
      stockOptionLevel: '1',
    };
    const escape = (value: string) =>
      value.includes(',') ? `"${value.replace(/"/g, '""')}"` : value;
    const header = CSV_HEADERS.join(',');
    const line = CSV_HEADERS.map((h) => escape(example[h])).join(',');
    return `${header}\n${line}\n`;
  }

  /** Normalizes hiring-CSV headers (case/space/dash tolerant) to canonical keys. */
  private normalizeHiringRow(raw: Record<string, unknown>): ParsedHiringRow['data'] {
    const get = (key: string): string | undefined => {
      const found = Object.entries(raw).find(([k]) => {
        const normalized = k
          .trim()
          .toLowerCase()
          .replace(/[\s_-]/g, '');
        return normalized === key.toLowerCase();
      });
      const value = found?.[1];
      if (value === undefined || value === null) return undefined;
      const str = String(value).trim();
      return str === '' ? undefined : str;
    };
    return {
      requisitionId: get('requisitionId') ?? '',
      jobTitle: get('jobTitle') ?? '',
      department: get('department') ?? '',
      candidateName: get('candidateName') ?? null,
      openedAt: get('openedAt'),
      offerSentAt: get('offerSentAt') ?? null,
      acceptedAt: get('acceptedAt') ?? null,
      startDate: get('startDate') ?? null,
      offerStatus: get('offerStatus')?.toLowerCase() ?? null,
      status: get('status')?.toLowerCase() ?? null,
      sourcingCost: get('sourcingCost') !== undefined ? Number(get('sourcingCost')) : null,
      recruitingCost: get('recruitingCost') !== undefined ? Number(get('recruitingCost')) : null,
    };
  }

  private normalizeRow(raw: Record<string, unknown>): CsvEmployeeRow {
    const get = (key: CsvHeader): string | undefined => {
      const found = Object.entries(raw).find(([k]) => {
        const normalized = k
          .trim()
          .toLowerCase()
          .replace(/[\s_-]/g, '');
        return normalized === key.toLowerCase() || HEADER_ALIASES[normalized] === key;
      });
      const value = found?.[1];
      if (value === undefined || value === null) return undefined;
      const str = String(value).trim();
      return str === '' ? undefined : str;
    };

    return {
      employeeCode: get('employeeCode'),
      firstName: get('firstName'),
      lastName: get('lastName'),
      email: get('email')?.toLowerCase(),
      phone: get('phone'),
      jobTitle: get('jobTitle'),
      gender: get('gender')?.toLowerCase(),
      dateOfBirth: get('dateOfBirth'),
      hiredAt: get('hiredAt'),
      status: get('status')?.toLowerCase(),
      department: get('department'),
      team: get('team'),
      managerEmail: get('managerEmail')?.toLowerCase(),
      // Analytics & engagement profile.
      attrition: get('attrition')?.toLowerCase(),
      monthlyIncome: get('monthlyIncome'),
      jobSatisfaction: get('jobSatisfaction'),
      environmentSatisfaction: get('environmentSatisfaction'),
      relationshipSatisfaction: get('relationshipSatisfaction'),
      workLifeBalance: get('workLifeBalance'),
      overTime: get('overTime')?.toLowerCase(),
      performanceRating: get('performanceRating'),
      education: get('education'),
      educationField: get('educationField'),
      jobLevel: get('jobLevel'),
      yearsAtCompany: get('yearsAtCompany'),
      yearsInCurrentRole: get('yearsInCurrentRole'),
      yearsSinceLastPromotion: get('yearsSinceLastPromotion'),
      yearsWithCurrManager: get('yearsWithCurrManager'),
      totalWorkingYears: get('totalWorkingYears'),
      distanceFromHome: get('distanceFromHome'),
      maritalStatus: get('maritalStatus'),
      businessTravel: get('businessTravel'),
      numCompaniesWorked: get('numCompaniesWorked'),
      trainingTimesLastYear: get('trainingTimesLastYear'),
      percentSalaryHike: get('percentSalaryHike'),
      stockOptionLevel: get('stockOptionLevel'),
    };
  }

  private validateRow(row: CsvEmployeeRow): string[] {
    const errors: string[] = [];

    if (!row.employeeCode) errors.push('employeeCode is required');
    else if (!/^[A-Za-z0-9._-]{2,30}$/.test(row.employeeCode)) {
      errors.push(
        'employeeCode may only contain letters, numbers, dots, dashes and underscores (2–30 chars)',
      );
    }

    if (!row.firstName) errors.push('firstName is required');
    if (!row.lastName) errors.push('lastName is required');

    if (!row.email) {
      errors.push('email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      errors.push(`"${row.email}" is not a valid email`);
    }

    if (!row.jobTitle) errors.push('jobTitle is required');

    if (row.gender && !GENDERS.includes(row.gender as (typeof GENDERS)[number])) {
      errors.push(`gender must be one of: ${GENDERS.join(', ')}`);
    }
    if (row.status && !STATUSES.includes(row.status as (typeof STATUSES)[number])) {
      errors.push(`status must be one of: ${STATUSES.join(', ')}`);
    }

    if (row.dateOfBirth && Number.isNaN(Date.parse(row.dateOfBirth))) {
      errors.push(`dateOfBirth "${row.dateOfBirth}" is not a valid date (expected YYYY-MM-DD)`);
    }
    if (!row.hiredAt) {
      errors.push('hiredAt is required');
    } else if (Number.isNaN(Date.parse(row.hiredAt))) {
      errors.push(`hiredAt "${row.hiredAt}" is not a valid date (expected YYYY-MM-DD)`);
    }

    // Analytics profile validation.
    if (
      row.attrition !== undefined &&
      !YES_VALUES.has(row.attrition) &&
      !NO_VALUES.has(row.attrition)
    ) {
      errors.push(`attrition "${row.attrition}" must be Yes or No`);
    }
    if (
      row.overTime !== undefined &&
      !YES_VALUES.has(row.overTime) &&
      !NO_VALUES.has(row.overTime)
    ) {
      errors.push(`overTime "${row.overTime}" must be Yes or No`);
    }
    for (const field of LEVEL_1_4) {
      const raw = row[field];
      if (raw === undefined) continue;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > 4) {
        errors.push(`${field} "${raw}" must be a whole number from 1 to 4`);
      }
    }
    for (const field of NON_NEGATIVE_INT) {
      const raw = row[field];
      if (raw === undefined) continue;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0) {
        errors.push(`${field} "${raw}" must be a non-negative whole number`);
      }
      if (field === 'education' && n > 5) {
        errors.push(`education "${raw}" must be from 1 to 5`);
      }
      if (field === 'jobLevel' && n > 5) {
        errors.push(`jobLevel "${raw}" must be from 1 to 5`);
      }
      if (field === 'percentSalaryHike' && n > 100) {
        errors.push(`percentSalaryHike "${raw}" must be at most 100`);
      }
    }

    return errors;
  }

  // ── hiring-pipeline CSVs ───────────────────────────────────────────────────
  // A separate lightweight format (requisitionId header) so the same import
  // endpoint feeds both workforce and hiring data. Detection is header-based.

  /** True when the CSV carries hiring-pipeline columns rather than employees. */
  isHiringCsv(buffer: Buffer): boolean {
    try {
      const records = parse(buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      }) as Record<string, unknown>[];
      const headers = Object.keys(records[0] ?? {}).map((h) =>
        h.toLowerCase().replace(/[\s_]+/g, ''),
      );
      return headers.includes('requisitionid');
    } catch {
      return false;
    }
  }

  /**
   * Reports which canonical columns the file's header row matches, which
   * headers were auto-aliased, and which canonical columns are missing.
   */
  analyzeHeaders(buffer: Buffer): {
    matched: number;
    total: number;
    aliased: string[];
    missing: string[];
  } {
    const records = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as Record<string, unknown>[];
    const rawHeaders = Object.keys(records[0] ?? {});
    const matched: string[] = [];
    const aliased: string[] = [];
    for (const header of rawHeaders) {
      const normalized = header
        .trim()
        .toLowerCase()
        .replace(/[\s_-]/g, '');
      const canonical = CSV_HEADERS.find(
        (key) => key.toLowerCase() === normalized || HEADER_ALIASES[normalized] === key,
      );
      if (!canonical) continue;
      matched.push(canonical);
      if (canonical.toLowerCase() !== normalized) aliased.push(header.trim());
    }
    const missing = CSV_HEADERS.filter((key) => !matched.includes(key));
    return { matched: matched.length, total: CSV_HEADERS.length, aliased, missing };
  }

  /** Parses + validates a hiring-pipeline CSV buffer. */
  parseHiring(
    buffer: Buffer,
    originalName: string,
  ): {
    rows: ParsedHiringRow[];
    errorReport: ImportRowError[];
  } {
    let records: Record<string, unknown>[];
    try {
      records = parse(buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
        relax_column_count: true,
      }) as Record<string, unknown>[];
    } catch (error) {
      throw new BadRequestException(
        `Could not parse CSV "${originalName}": ${error instanceof Error ? error.message : 'malformed file'}`,
      );
    }
    if (records.length === 0) {
      throw new BadRequestException('The CSV file contains no data rows');
    }

    const rows: ParsedHiringRow[] = records.map((raw, index) => {
      const row = this.normalizeHiringRow(raw);
      const errors: string[] = [];
      if (!row.requisitionId) errors.push('requisitionId is required');
      if (!row.jobTitle) errors.push('jobTitle is required');
      if (!row.department) errors.push('department is required');
      if (!row.openedAt) errors.push('openedAt is required');
      if (row.openedAt && Number.isNaN(Date.parse(row.openedAt))) {
        errors.push(`openedAt "${row.openedAt}" is not a valid date`);
      }
      for (const [field, label] of [
        ['offerSentAt', 'offerSentAt'],
        ['acceptedAt', 'acceptedAt'],
        ['startDate', 'startDate'],
      ] as const) {
        if (row[field] && Number.isNaN(Date.parse(row[field] as string))) {
          errors.push(`${label} "${row[field]}" is not a valid date`);
        }
      }
      if (
        row.offerStatus &&
        !['pending', 'accepted', 'declined', 'withdrawn'].includes(row.offerStatus)
      ) {
        errors.push(
          `offerStatus "${row.offerStatus}" must be one of pending, accepted, declined, withdrawn`,
        );
      }
      if (
        row.status &&
        !['open', 'in_review', 'offer_sent', 'hired', 'closed'].includes(row.status)
      ) {
        errors.push(
          `status "${row.status}" must be one of open, in_review, offer_sent, hired, closed`,
        );
      }
      for (const field of ['sourcingCost', 'recruitingCost'] as const) {
        const value = row[field];
        if (value !== null && value !== undefined) {
          if (!Number.isInteger(value) || value < 0) {
            errors.push(`${field} "${value}" must be a non-negative whole number`);
          }
        }
      }
      return {
        data: row,
        rowNumber: index + 2,
        errors,
      };
    });

    const errorReport: ImportRowError[] = rows
      .filter((r) => r.errors.length > 0)
      .map((r) => ({
        row: r.rowNumber,
        employeeCode: r.data.requisitionId,
        email: null,
        errors: r.errors,
      }));

    return { rows, errorReport };
  }

  /** Builds the downloadable hiring-pipeline CSV template string. */
  buildHiringTemplate(): string {
    const header =
      'requisitionId,jobTitle,department,candidateName,openedAt,offerSentAt,acceptedAt,startDate,offerStatus,status,sourcingCost,recruitingCost';
    const example =
      'REQ-2026-101,Senior Engineer,Engineering,Aisha Kapoor,2026-07-01,2026-07-22,2026-07-30,2026-08-10,accepted,hired,1800,3200';
    return `${header}\n${example}\n`;
  }

  /** Header-level report for hiring-pipeline CSVs. */
  analyzeHiringHeaders(buffer: Buffer): {
    matched: number;
    total: number;
    aliased: string[];
    missing: string[];
  } {
    const hiringHeaders = [
      'requisitionId',
      'jobTitle',
      'department',
      'candidateName',
      'openedAt',
      'offerSentAt',
      'acceptedAt',
      'startDate',
      'offerStatus',
      'status',
      'sourcingCost',
      'recruitingCost',
    ];
    const records = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as Record<string, unknown>[];
    const matched: string[] = [];
    const aliased: string[] = [];
    for (const header of Object.keys(records[0] ?? {})) {
      const normalized = header
        .trim()
        .toLowerCase()
        .replace(/[\s_-]/g, '');
      const canonical = hiringHeaders.find((key) => key.toLowerCase() === normalized);
      if (!canonical) continue;
      matched.push(canonical);
      if (canonical.toLowerCase() !== normalized) aliased.push(header.trim());
    }
    const missing = hiringHeaders.filter((key) => !matched.includes(key));
    return { matched: matched.length, total: hiringHeaders.length, aliased, missing };
  }
}
