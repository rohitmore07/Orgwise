import type { CopilotResponse } from '@orgwise/types';
import { NotFoundException } from '@nestjs/common';
import type { RequestUser } from '@app/common/interfaces/request-user.interface';
import { Role } from '@app/common/enums/role.enum';
import type { AnalyticsService } from '@app/analytics/analytics.service';
import type { EmployeesService } from '@app/employees/employees.service';
import type { ImportsService } from '@app/imports/imports.service';
import type { PrismaService } from '@app/database/prisma.service';
import { CopilotConfig } from '../copilot.config';
import { CopilotMetricsService } from '../copilot.metrics.service';
import { CopilotRateLimiter } from '../copilot.rate-limiter';
import { CopilotService } from '../copilot.service';
import { CopilotToolsService } from '../tools/copilot-tools.service';
import type { LLMProvider } from '../llm/llm-provider.interface';
import { COPILOT_EVAL_CASES, type CopilotEvalCase } from './copilot-eval.cases';

const FILTERS = {
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
    kpis: { totalEmployees: 12, attritionRate: 0.2, averageMonthlyIncome: 8000, snapshot: true },
    departments: FILTERS.departments,
    attrition: {
      byDepartment: [{ name: 'Sales', headcount: 4, attritionCount: 2, attritionRate: 0.5 }],
      byJobRole: [],
      byAgeGroup: [],
      byTenure: [],
      byOverTime: [],
      byJobSatisfaction: [],
    },
    engagement: {
      jobSatisfaction: [],
      environmentSatisfaction: [],
      relationshipSatisfaction: [],
      workLifeBalance: [],
      averageJobSatisfaction: null,
      averageWorkLifeBalance: null,
      overtimeRate: null,
    },
    composition: { department: [], jobRole: [], gender: [], age: [], education: [], tenure: [] },
    insights: [],
    executiveSummary: { status: 'stable', headline: 'h', keyAreas: [], updatedAt: 'x' },
    dataQuality: {
      totalRecords: 12,
      validRecords: 11,
      readinessPercent: 90,
      missingFields: [],
      duplicateRecords: 0,
      deletedRecords: 0,
      lastImport: null,
    },
  };
}

/** Grounding answers per tool — the eval asserts they reach the user verbatim. */
const GROUNDING_ANSWERS: Record<string, string> = {
  getAttritionAnalysis: '## Highest observed attrition\n\nSales — 50.0%',
  getWorkforceOverview: '## Workforce overview\n\nThe headcount is 12 employees.',
  compareDepartments: '## Comparison\n\nEngineering vs Sales.',
  searchEmployees: '## Matching employees\n\n2 employees match the filters.',
  getDepartmentMetrics: '## Department metrics',
  getEngagementMetrics: '## Engagement',
  getWorkforceComposition: '## Composition',
  getEmployeeDetails: '## Employee profile',
  getDataQuality: '## Data quality',
  getImportHistory: '## Import history',
};

function actor(role: Role): RequestUser {
  return {
    sub: role === Role.VIEWER ? 'viewer-1' : 'user-1',
    email: 'u@orgwise.com',
    roles: [role],
  };
}

describe('Copilot evaluation dataset', () => {
  for (const testCase of COPILOT_EVAL_CASES) {
    it(`${testCase.id}: "${testCase.question}"`, async () => {
      const { response, toolCalls } = await runEvalCase(testCase);

      if (testCase.expect.tool) {
        // The planned tool executed exactly once against the services.
        expect(toolCalls.filter((t) => t === testCase.expect.tool)).toHaveLength(1);
        expect(response.provenance.toolUsed).toBe(testCase.expect.tool);
      } else {
        expect(response.provenance.toolUsed).toBeUndefined();
      }

      if (testCase.expect.noToolExecuted) {
        expect(toolCalls).toHaveLength(0);
      }

      for (const fragment of testCase.expect.answerContains ?? []) {
        expect(response.answer).toContain(fragment);
      }
      for (const fragment of testCase.expect.limitationsContain ?? []) {
        expect(response.limitations).toContain(fragment);
      }
      expect(response.conversationId).toBe('conv-1');
    });
  }
});

async function runEvalCase(testCase: CopilotEvalCase): Promise<{
  response: CopilotResponse;
  toolCalls: string[];
}> {
  const user = actor(testCase.role);
  const toolCalls: string[] = [];

  const analytics = {
    getOverview: jest.fn().mockResolvedValue(overviewStub()),
    getFilters: jest.fn().mockResolvedValue(FILTERS),
    getCompare: jest.fn().mockResolvedValue([]),
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
  // Record every tool execution by wrapping each tool's execute (single source
  // of truth for what ran — avoids double counting service mocks).
  const toolsService = new CopilotToolsService(
    analytics as unknown as AnalyticsService,
    employees as unknown as EmployeesService,
    imports as unknown as ImportsService,
  );
  for (const tool of toolsService.tools) {
    const original = tool.execute.bind(tool);
    tool.execute = async (actor_, args) => {
      toolCalls.push(tool.name);
      return original(actor_, args);
    };
  }

  // Distinguish planning from grounding by tracking call order.
  let callCount = 0;
  const provider = {
    name: 'fake',
    model: 'fake-model',
    isConfigured: () => true,
    describeProviders: () => [{ name: 'fake', model: 'fake-model', configured: true }],
    complete: jest.fn(async () => {
      callCount += 1;
      // Call 1 = planning: return the scripted decision.
      if (callCount === 1) return { content: JSON.stringify(testCase.scriptedPlan) };
      // Call 2 = grounding: return the tool's canned answer.
      const toolName = testCase.expect.tool ?? '';
      return { content: GROUNDING_ANSWERS[toolName] ?? 'Answer' };
    }),
  } as unknown as LLMProvider;

  const prisma = {
    aiConversation: {
      create: jest.fn().mockResolvedValue({ id: 'conv-1', userId: user.sub }),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    aiMessage: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };

  const config = {
    maxInputChars: 4000,
    requestsPerMinute: 1000,
    provider: 'fake',
    model: 'fake',
  } as unknown as CopilotConfig;

  const service = new CopilotService(
    provider,
    config,
    toolsService,
    prisma as unknown as PrismaService,
    new CopilotRateLimiter(config),
    new CopilotMetricsService(),
  );

  const response = await service.chat(user, { message: testCase.question });
  return { response, toolCalls };
}
