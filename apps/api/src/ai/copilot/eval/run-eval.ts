// Live copilot evaluation — runs the eval dataset against the REAL database. The LLM is replaced with a…
// scripted provider (no network), so this verifies the trusted pipeline end-to-end: planning → argument…
import { Test } from '@nestjs/testing';
import type { CopilotResponse } from '@orgwise/types';
import { AppConfigModule } from '@app/config/config.module';
import { AuditModule } from '@app/audit/audit.module';
import { DatabaseModule } from '@app/database/database.module';
import { RbacModule } from '@app/common/services/rbac.module';
import { CopilotModule } from '../copilot.module';
import { CopilotService } from '../copilot.service';
import type { LLMProvider } from '../llm/llm-provider.interface';
import { LLM_PROVIDER } from '../llm/llm-provider.token';
import type { CopilotPlan } from '../copilot.types';
import { COPILOT_EVAL_CASES, type CopilotEvalCase } from './copilot-eval.cases';
import { PrismaService } from '@app/database/prisma.service';
import { Role } from '@app/common/enums/role.enum';
import type { RequestUser } from '@app/common/interfaces/request-user.interface';

const GROUNDING_ANSWER: Record<string, string> = {
  getWorkforceOverview: '## Workforce overview (live data)',
  getAttritionAnalysis: '## Highest observed attrition (live data)',
  getEngagementMetrics: '## Engagement (live data)',
  getWorkforceComposition: '## Composition (live data)',
  compareDepartments: '## Comparison (live data)',
  getDepartmentMetrics: '## Department metrics (live data)',
  searchEmployees: '## Matching employees (live data)',
  getEmployeeDetails: '## Employee profile (live data)',
  getDataQuality: '## Data quality (live data)',
  getImportHistory: '## Import history (live data)',
};

/** Mutable queue the eval loop writes before each case; the provider reads it. */
const queue = { plan: null as CopilotPlan | null, answer: '' };

function buildScriptedProvider(): LLMProvider {
  return {
    name: 'eval-scripted',
    model: 'scripted-model',
    isConfigured: () => true,
    describeProviders: () => [{ name: 'eval-scripted', model: 'scripted-model', configured: true }],
    complete: async () => {
      if (queue.plan) {
        const plan = queue.plan;
        queue.plan = null;
        return { content: JSON.stringify(plan) };
      }
      return { content: queue.answer };
    },
  };
}

async function main(): Promise<void> {
  // Global modules are not auto-included in a standalone testing module —
  // import them explicitly (the real app.module wires them the same way).
  const moduleRef = await Test.createTestingModule({
    imports: [AppConfigModule, DatabaseModule, RbacModule, AuditModule, CopilotModule],
  })
    .overrideProvider(LLM_PROVIDER)
    .useValue(buildScriptedProvider())
    .compile();

  const copilot = moduleRef.get(CopilotService);
  const prisma = moduleRef.get(PrismaService);

  const adminUser = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
    orderBy: { createdAt: 'asc' },
  });
  const managerUser = await prisma.user.findFirst({
    where: { role: Role.MANAGER },
    orderBy: { createdAt: 'asc' },
  });

  if (!adminUser) {
    console.error('✗ No admin user in the database — cannot run evaluation.');
    process.exit(1);
  }

  const actorFor = (role: Role): RequestUser => {
    const user = role === Role.MANAGER ? managerUser : adminUser;
    if (!user) throw new Error(`No ${role} user in the database`);
    return { sub: user.id, email: user.email, roles: [role] };
  };

  let passed = 0;
  let failed = 0;

  for (const testCase of COPILOT_EVAL_CASES) {
    try {
      queue.plan = testCase.scriptedPlan;
      queue.answer = GROUNDING_ANSWER[testCase.expect.tool ?? ''] ?? 'Grounded answer';

      const response = await copilot.chat(actorFor(testCase.role), {
        message: testCase.question,
      });
      const problems = verify(testCase, response);

      if (problems.length === 0) {
        passed += 1;
        console.log(`✓ ${testCase.id} — "${testCase.question}"`);
        console.log(
          `    tool: ${response.provenance.toolUsed ?? '(none)'} · records: ${response.provenance.recordsAnalyzed ?? '-'}`,
        );
      } else {
        failed += 1;
        console.log(`✗ ${testCase.id} — "${testCase.question}"`);
        for (const problem of problems) console.log(`    ${problem}`);
        console.log(`    answer: ${response.answer.slice(0, 160).replace(/\n/g, ' ')}`);
      }
    } catch (error) {
      failed += 1;
      console.log(
        `✗ ${testCase.id} — errored: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  console.log(`\n${passed} passed, ${failed} failed (${COPILOT_EVAL_CASES.length} cases)`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

function verify(testCase: CopilotEvalCase, response: CopilotResponse): string[] {
  const problems: string[] = [];

  if (testCase.expect.tool) {
    if (response.provenance.toolUsed !== testCase.expect.tool) {
      problems.push(
        `expected tool ${testCase.expect.tool}, got ${response.provenance.toolUsed ?? '(none)'}`,
      );
    }
    if (
      testCase.expect.tool !== 'getImportHistory' &&
      (response.provenance.recordsAnalyzed === undefined || response.provenance.recordsAnalyzed < 0)
    ) {
      problems.push('expected recordsAnalyzed >= 0');
    }
  } else if (response.provenance.toolUsed) {
    problems.push(`expected no tool execution, got ${response.provenance.toolUsed}`);
  }

  for (const fragment of testCase.expect.limitationsContain ?? []) {
    if (!response.limitations.some((l) => l.includes(fragment))) {
      problems.push(
        `expected limitation containing "${fragment}", got ${JSON.stringify(response.limitations)}`,
      );
    }
  }
  return problems;
}

main().catch((error) => {
  console.error('Evaluation crashed:', error);
  process.exit(1);
});
