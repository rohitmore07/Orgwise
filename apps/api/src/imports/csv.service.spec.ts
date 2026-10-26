import { BadRequestException } from '@nestjs/common';
import type { ParsedRow } from './csv.service';
import { CsvService } from './csv.service';

describe('CsvService', () => {
  let service: CsvService;

  beforeEach(() => {
    service = new CsvService();
  });

  const validCsv = [
    'employeeCode,firstName,lastName,email,jobTitle,gender,hiredAt,status,department,team,managerEmail',
    'EMP-0101,Alex,Morgan,alex.morgan@company.com,Senior Engineer,female,2023-06-01,active,Engineering,Platform,taylor.lee@company.com',
    'EMP-0102,Taylor,Lee,taylor.lee@company.com,Staff Engineer,male,2024-01-15,,Engineering,,',
  ].join('\n');

  const firstRow = (rows: ParsedRow[]): ParsedRow => rows[0]!;

  describe('parse', () => {
    it('parses valid rows and assigns 1-based row numbers including the header', () => {
      const { rows, errorReport } = service.parse(Buffer.from(validCsv), 'employees.csv');

      expect(rows).toHaveLength(2);
      expect(firstRow(rows).rowNumber).toBe(2);
      expect(rows[1]!.rowNumber).toBe(3);
      expect(rows.every((row) => row.errors.length === 0)).toBe(true);
      expect(errorReport).toHaveLength(0);
    });

    it('normalizes header casing, whitespace and dashes', () => {
      const csv =
        'Employee Code,First Name,Last-Name,Email,Job Title,Gender,Hire Date,Status,Department,Team,Manager Email\n' +
        'EMP-9,A,B,a@b.co,Engineer,male,2024-01-01,active,Eng,,';
      const { rows } = service.parse(Buffer.from(csv), 'weird-headers.csv');

      expect(firstRow(rows).data.employeeCode).toBe('EMP-9');
      expect(firstRow(rows).data.firstName).toBe('A');
      expect(firstRow(rows).data.lastName).toBe('B');
      expect(firstRow(rows).data.jobTitle).toBe('Engineer');
      expect(firstRow(rows).data.hiredAt).toBe('2024-01-01');
      expect(firstRow(rows).data.email).toBe('a@b.co');
    });

    it('lowercases emails and status/gender values', () => {
      const { rows } = service.parse(Buffer.from(validCsv), 'case.csv');

      expect(firstRow(rows).data.email).toBe('alex.morgan@company.com');
      expect(firstRow(rows).data.gender).toBe('female');
      expect(firstRow(rows).data.status).toBe('active');
    });

    it('collects per-row validation errors without aborting the file', () => {
      const csv = [
        'employeeCode,firstName,lastName,email,jobTitle,gender,hiredAt,status,department,team,managerEmail',
        ',Missing,Fields,,Engineer,,not-a-date,,Engineering,,',
        'EMP-X,Ok,Fine,ok@example.com,Engineer,male,2024-01-01,,Engineering,,',
      ].join('\n');

      const { rows, errorReport } = service.parse(Buffer.from(csv), 'bad-row.csv');

      expect(rows).toHaveLength(2);
      expect(firstRow(rows).errors.length).toBeGreaterThan(0);
      expect(rows[1]!.errors).toHaveLength(0);
      expect(errorReport).toHaveLength(1);
      expect(errorReport[0]!.row).toBe(2);
    });

    it('rejects non-parseable content', () => {
      expect(() => service.parse(Buffer.from('not,really,valid'), 'broken.csv')).toThrow(
        BadRequestException,
      );
    });

    it('rejects a file with no data rows', () => {
      expect(() => service.parse(Buffer.from('a,b,c\n'), 'empty.csv')).toThrow(BadRequestException);
    });

    it('strips a UTF-8 BOM from the first header', () => {
      const csv =
        '\uFEFFemployeeCode,firstName,lastName,email,jobTitle,gender,hiredAt,status,department,team,managerEmail\n' +
        'EMP-1,A,B,a@b.co,Engineer,male,2024-01-01,,Engineering,,';
      const { rows } = service.parse(Buffer.from(csv, 'utf-8'), 'bom.csv');

      expect(firstRow(rows).data.employeeCode).toBe('EMP-1');
    });
  });

  describe('validateRow', () => {
    it('validates employeeCode format', () => {
      const csv =
        'employeeCode,firstName,lastName,email,jobTitle,gender,hiredAt,status,department,team,managerEmail\n' +
        'bad code!,A,B,a@b.co,Engineer,male,2024-01-01,,Engineering,,';
      const { rows } = service.parse(Buffer.from(csv), 'code.csv');

      expect(firstRow(rows).errors.some((e) => e.includes('employeeCode'))).toBe(true);
    });

    it('validates gender and status enums', () => {
      const csv =
        'employeeCode,firstName,lastName,email,jobTitle,gender,hiredAt,status,department,team,managerEmail\n' +
        'EMP-1,A,B,a@b.co,Engineer,alien,2024-01-01,retired,Engineering,,';
      const { rows } = service.parse(Buffer.from(csv), 'enums.csv');

      expect(firstRow(rows).errors.some((e) => e.includes('gender'))).toBe(true);
      expect(firstRow(rows).errors.some((e) => e.includes('status'))).toBe(true);
    });

    it('validates email format and hiredAt presence', () => {
      const csv =
        'employeeCode,firstName,lastName,email,jobTitle,gender,hiredAt,status,department,team,managerEmail\n' +
        'EMP-1,A,B,not-an-email,Engineer,male,,,Engineering,,';
      const { rows } = service.parse(Buffer.from(csv), 'contract.csv');

      expect(firstRow(rows).errors.some((e) => e.includes('email'))).toBe(true);
      expect(firstRow(rows).errors.some((e) => e.includes('hiredAt'))).toBe(true);
    });
  });

  describe('isHiringCsv', () => {
    it('detects hiring CSVs by the requisitionId header', () => {
      const csv =
        'requisitionId,jobTitle,department,openedAt\nREQ-1,Engineer,Engineering,2026-07-01\n';
      expect(service.isHiringCsv(Buffer.from(csv))).toBe(true);
    });

    it('tolerates header casing/spacing and returns false for employee CSVs', () => {
      expect(service.isHiringCsv(Buffer.from(validCsv))).toBe(false);
      expect(service.isHiringCsv(Buffer.from('Requisition Id,Job Title\nREQ-1,Engineer\n'))).toBe(
        true,
      );
    });
  });

  describe('parseHiring', () => {
    it('parses valid hiring rows with normalized values', () => {
      const csv =
        'requisitionId,jobTitle,department,candidateName,openedAt,offerStatus,status,sourcingCost,recruitingCost\n' +
        'REQ-2026-001,Senior Engineer,Engineering,Aisha Kapoor,2026-07-01,accepted,hired,1800,3200\n';
      const { rows, errorReport } = service.parseHiring(Buffer.from(csv), 'hiring.csv');
      expect(errorReport).toEqual([]);
      expect(rows[0]!.data).toMatchObject({
        requisitionId: 'REQ-2026-001',
        department: 'Engineering',
        offerStatus: 'accepted',
        status: 'hired',
        sourcingCost: 1800,
        recruitingCost: 3200,
      });
    });

    it('flags missing required fields and malformed dates/costs', () => {
      const csv =
        'requisitionId,jobTitle,department,openedAt,offerStatus,status,sourcingCost\n' +
        'REQ-2,,Engineering,not-a-date,wat,hired,abc\n';
      const { rows, errorReport } = service.parseHiring(Buffer.from(csv), 'hiring.csv');
      expect(errorReport.length).toBe(1);
      const errors = errorReport[0]!.errors.join(' ');
      expect(errors).toContain('jobTitle is required');
      expect(errors).toContain('not a valid date');
      expect(errors).toContain('offerStatus "wat"');
      expect(errors).toContain('sourcingCost "NaN"');
      expect(rows[0]!.data.requisitionId).toBe('REQ-2');
    });
  });

  describe('buildTemplate', () => {
    it('produces a parseable template with the canonical headers and one example row', () => {
      const template = service.buildTemplate();
      const { rows } = service.parse(Buffer.from(template), 'template.csv');

      expect(rows).toHaveLength(1);
      expect(firstRow(rows).errors).toHaveLength(0);
      expect(firstRow(rows).data.department).toBe('Engineering');
    });
  });
});
