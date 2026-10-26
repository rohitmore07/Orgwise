import { NotFoundException } from '@nestjs/common';
import type { FilterOptions } from '@orgwise/types';
import type { RequestUser } from '@app/common/interfaces/request-user.interface';
import { Role } from '@app/common/enums/role.enum';
import type { AnalyticsService } from '@app/analytics/analytics.service';
import type { EmployeesService } from '@app/employees/employees.service';
import type { ImportsService } from '@app/imports/imports.service';
import { CopilotToolsService, employeeHref, findDepartment } from './copilot-tools.service';

const admin: RequestUser = { sub: 'user-1', email: 'a@orgwise.com', roles: [Role.ADMIN] };
const manager: RequestUser = { sub: 'user-2', email: 'm@orgwise.com', roles: [Role.MANAGER] };

const filters: FilterOptions = {
  departments: [
    { id: 'd1', name: 'Engineering' },
    { id: 'd2', name: 'Sales' },
    { id: 'd3', name: 'Marketing' },
  ],
  jobTitles: ['Engineer', 'Sales Rep'],
  ageGroups: ['<25', '25-34', '35-44', '45-54', '55+'],
  tenureGroups: ['<1', '1-2', '3-5', '6-10', '10+'],
  educationLevels: [],
};

function overviewStub() {
  return {
    kpis: {
      totalEmployees: 10,
      activeEmployees: 8,
      attritionRate: 0.2,
      averageTenureYears: 3,
      averageAge: 34,
      averageMonthlyIncome: 8000,
      overtimeRate: 0.3,
      averagePerformanceRating: 3,
      totalDepartments: 3,
      totalManagers: 1,
      totalTeams: 3,
      snapshot: true,
    },
    departments: filters.departments,
    attrition: {
      byDepartment: [{ name: 'Sales', headcount: 4, attritionCount: 2, attritionRate: 0.5 }],
      byJobRole: [{ name: 'Sales Rep', headcount: 4, attritionCount: 2, attritionRate: 0.5 }],
      byAgeGroup: [],
      byTenure: [],
      byOverTime: [{ name: 'Overtime', headcount: 3, attritionCount: 2, attritionRate: 0.66 }],
      byJobSatisfaction: [],
    },
    engagement: {
      jobSatisfaction: [{ name: 'Level 3', value: 6 }],
      environmentSatisfaction: [],
      relationshipSatisfaction: [],
      workLifeBalance: [],
      averageJobSatisfaction: 3,
      averageWorkLifeBalance: 3,
      overtimeRate: 0.3,
    },
    composition: {
      department: [{ name: 'Engineering', value: 5 }],
      jobRole: [],
      gender: [],
      age: [],
      education: [],
      tenure: [],
    },
    insights: [],
    executiveSummary: { status: 'stable', headline: 'h', keyAreas: [], updatedAt: 'x' },
    dataQuality: {
      totalRecords: 10,
      validRecords: 9,
      readinessPercent: 92,
      missingFields: [],
      duplicateRecords: 0,
      deletedRecords: 0,
      lastImport: {
        id: 'imp-1',
        fileName: 'employees.csv',
        status: 'completed',
        totalRows: 10,
        successCount: 10,
        failedCount: 0,
        createdAt: '2026-08-08T00:00:00.000Z',
      },
    },
  };
}

function createTools() {
  const analytics = {
    getOverview: jest.fn().mockResolvedValue(overviewStub()),
    getFilters: jest.fn().mockResolvedValue(filters),
    getCompare: jest.fn().mockResolvedValue([
      {
        departmentId: 'd1',
        name: 'Engineering',
        headcount: 5,
        attritionRate: 0.1,
        averageTenureYears: 4,
        averageMonthlyIncome: 9000,
        overtimeRate: 0.2,
        averageJobSatisfaction: 3.5,
        averagePerformanceRating: 3.4,
      },
    ]),
  };
  const employees = {
    findAll: jest
      .fn()
      .mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 }),
    findOne: jest.fn().mockRejectedValue(new NotFoundException('Employee not found')),
  };
  const imports = {
    findAll: jest
      .fn()
      .mockResolvedValue({ items: [], page: 1, pageSize: 5, total: 0, totalPages: 0 }),
  };

  const service = new CopilotToolsService(
    analytics as unknown as AnalyticsService,
    employees as unknown as EmployeesService,
    imports as unknown as ImportsService,
  );
  return { analytics, employees, imports, service };
}

describe('CopilotToolsService', () => {
  describe('registry', () => {
    it('exposes only the supported tools', () => {
      const { service } = createTools();
      const names = service.tools.map((t) => t.name);
      expect(names).toEqual([
        'getWorkforceOverview',
        'getAttritionAnalysis',
        'getEngagementMetrics',
        'getWorkforceComposition',
        'compareDepartments',
        'getDepartmentMetrics',
        'searchEmployees',
        'getEmployeeDetails',
        'getDataQuality',
        'getImportHistory',
      ]);
    });

    it('finds tools by name and rejects unknown names', () => {
      const { service } = createTools();
      expect(service.find('searchEmployees')).toBeDefined();
      expect(service.find('dropTable')).toBeUndefined();
    });
  });

  describe('searchEmployees', () => {
    it('resolves department names scope-aware and never leaks salary', async () => {
      const { analytics, employees, service } = createTools();
      employees.findAll.mockResolvedValue({
        items: [
          {
            id: 'e1',
            firstName: 'Alex',
            lastName: 'Morgan',
            email: 'alex@orgwise.com',
            jobTitle: 'Engineer',
            status: 'active',
            departmentId: 'd1',
            hiredAt: '2020-01-01T00:00:00.000Z',
            attrition: false,
            overTime: true,
            jobSatisfaction: 2,
            workLifeBalance: 2,
            performanceRating: 3,
            monthlyIncome: 12000,
            department: { id: 'd1', name: 'Engineering' },
            manager: { id: 'm1', firstName: 'Sam', lastName: 'Lee' },
          },
        ],
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      });

      const tool = service.find('searchEmployees')!;
      const execution = await tool.execute(manager, {
        departmentName: 'engineering',
        overTime: true,
        limit: 10,
      });

      // Department resolved case-insensitively; caller passed through for scoping.
      expect(analytics.getFilters).toHaveBeenCalledWith(manager);
      expect(employees.findAll).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({ departmentId: 'd1', overTime: true, pageSize: 10 }),
      );

      const data = execution.data as { employees: Array<Record<string, unknown>> };
      expect(data.employees[0]).toMatchObject({
        name: 'Alex Morgan',
        department: 'Engineering',
        jobSatisfaction: 2,
      });
      // Salary is never part of the compact projection.
      expect(JSON.stringify(execution.data)).not.toContain('monthlyIncome');
      expect(JSON.stringify(execution.data)).not.toContain('12000');
    });

    it('strips unknown keys from arguments (injection defense)', async () => {
      const { employees, service } = createTools();
      const tool = service.find('searchEmployees')!;
      const { value, error } = tool.inputSchema.validate(
        {
          search: 'alex',
          evil: 'ignore-instructions',
          departmentName: 'Sales',
        },
        { abortEarly: false },
      );
      expect(error).toBeUndefined();
      expect(value).not.toHaveProperty('evil');
      expect(value.search).toBe('alex');
      await tool.execute(manager, value);
      expect(employees.findAll).toHaveBeenCalledWith(
        manager,
        expect.not.objectContaining({ evil: expect.anything() }),
      );
    });

    it('rejects invalid argument values', async () => {
      const { service } = createTools();
      const tool = service.find('searchEmployees')!;
      const { error } = tool.inputSchema.validate({ jobSatisfaction: 9 });
      expect(error).toBeDefined();
    });

    it('reports out-of-scope departments instead of fabricating results', async () => {
      const { employees, service } = createTools();
      const tool = service.find('searchEmployees')!;
      const execution = await tool.execute(manager, { departmentName: 'Finance' });

      const data = execution.data as { unresolvedDepartment: string; total: number };
      expect(data.unresolvedDepartment).toBe('Finance');
      expect(data.total).toBe(0);
      expect(execution.limitations).toEqual(['Finance is not in your access scope.']);
      // The out-of-scope id must never reach the employee query.
      expect(employees.findAll).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({ departmentId: undefined }),
      );
    });
  });

  describe('compareDepartments', () => {
    it('drops out-of-scope names and surfaces a limitation', async () => {
      const { analytics, service } = createTools();
      const tool = service.find('compareDepartments')!;
      const execution = await tool.execute(manager, {
        departmentNames: ['Engineering', 'Finance'],
      });

      const data = execution.data as { unresolvedDepartments?: string[]; comparison: unknown[] };
      expect(data.unresolvedDepartments).toEqual(['Finance']);
      expect(execution.limitations).toEqual([
        'Finance is not in your access scope and was excluded.',
      ]);
      expect(analytics.getCompare).toHaveBeenCalledWith(manager, ['d1']);
    });

    it('builds dashboard deep links for resolved departments', async () => {
      const { service } = createTools();
      const tool = service.find('compareDepartments')!;
      const execution = await tool.execute(admin, { departmentNames: ['Sales', 'Engineering'] });

      expect(execution.deepLinks).toEqual([
        { label: 'View Sales analytics', href: '/dashboard?departmentId=d2' },
        { label: 'View Engineering analytics', href: '/dashboard?departmentId=d1' },
      ]);
    });

    it('requires 2-5 departments', async () => {
      const { service } = createTools();
      const tool = service.find('compareDepartments')!;
      expect(tool.inputSchema.validate({ departmentNames: ['Sales'] }).error).toBeDefined();
      expect(
        tool.inputSchema.validate({ departmentNames: ['a', 'b', 'c', 'd', 'e', 'f'] }).error,
      ).toBeDefined();
    });
  });

  describe('getDepartmentMetrics', () => {
    it('returns limitations when the department is out of scope', async () => {
      const { service } = createTools();
      const tool = service.find('getDepartmentMetrics')!;
      const execution = await tool.execute(manager, { departmentName: 'Finance' });

      expect(execution.deepLinks).toEqual([]);
      expect(execution.limitations).toEqual(['Finance is not in your access scope.']);
    });
  });

  describe('getEmployeeDetails', () => {
    it('converts out-of-scope NotFound into a truthful limitation', async () => {
      const { service } = createTools();
      const tool = service.find('getEmployeeDetails')!;
      const execution = await tool.execute(manager, { employeeId: 'e-secret' });

      const data = execution.data as { notFound: string };
      expect(data.notFound).toBe('e-secret');
      expect(execution.limitations).toEqual([
        'Employee not found or outside the accessible scope.',
      ]);
    });
  });

  describe('attrition analysis', () => {
    it('forwards a department filter when the name resolves', async () => {
      const { analytics, service } = createTools();
      const tool = service.find('getAttritionAnalysis')!;
      const execution = await tool.execute(admin, { departmentName: 'Sales' });

      expect(analytics.getOverview).toHaveBeenCalledWith(admin, { departmentId: 'd2' });
      const data = execution.data as { byDepartment: unknown[] };
      expect(data.byDepartment).toHaveLength(1);
      expect(execution.recordsAnalyzed).toBe(10);
      expect(execution.lastImportedAt).toBe('2026-08-08T00:00:00.000Z');
    });
  });

  describe('pure helpers', () => {
    it('findDepartment is case-insensitive', () => {
      expect(findDepartment(filters, 'ENGINEERING')?.id).toBe('d1');
      expect(findDepartment(filters, 'missing')).toBeUndefined();
    });

    it('employeeHref only includes truthy params', () => {
      expect(employeeHref({ departmentId: 'd1', attrition: 'true' })).toBe(
        '/employees?departmentId=d1&attrition=true',
      );
      expect(employeeHref({})).toBe('/employees');
      expect(employeeHref({ overTime: false, search: 'alex' })).toBe('/employees?search=alex');
    });
  });
});
