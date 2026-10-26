import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import Joi from 'joi';
import type {
  CopilotCapabilities,
  CopilotChatRequest,
  CopilotMessageView,
  CopilotProvenance,
  CopilotResponse,
} from '@orgwise/types';
import { PrismaService } from '@app/database/prisma.service';
import type { RequestUser } from '@app/common/interfaces/request-user.interface';
import { CopilotConfig } from './copilot.config';
import { CopilotMetricsService } from './copilot.metrics.service';
import { CopilotRateLimiter } from './copilot.rate-limiter';
import type { CopilotPlan, CopilotToolExecution } from './copilot.types';
import { CopilotToolsService } from './tools/copilot-tools.service';
import { LLM_PROVIDER, type LLMProvider, LLMProviderError } from './llm/llm-provider.token';
import { buildGroundingPrompt, buildPlanningPrompt } from './prompts/system.prompt';

/** How many prior turns the planning call sees (lightweight context only). */
const HISTORY_MESSAGES = 6;
/** Hard cap on any single stored/returned message. */
const MAX_ANSWER_CHARS = 4000;
/** Fallback answer when the plan cannot be parsed or the tool is invalid. */
const FALLBACK_ANSWER =
  "I couldn't map that to a workforce query. Try asking about headcount, attrition, departments, engagement, or specific employees — or tap a suggested question below.";
/** Fallback suggestions when a plan is unusable. */
const FALLBACK_SUGGESTIONS = [
  'Which department has the highest observed attrition?',
  'How many employees are working overtime?',
  'Compare Engineering and Sales.',
  'Show me employees in Sales working overtime.',
];

const planSchema = Joi.object({
  intent: Joi.string().valid('tool', 'answer', 'refuse').required(),
  tool: Joi.string().allow(''),
  arguments: Joi.object().unknown(true),
  answer: Joi.string().max(MAX_ANSWER_CHARS).allow(''),
  refusal: Joi.string().max(MAX_ANSWER_CHARS).allow(''),
}).options({ stripUnknown: true });
// orgwise Workforce Copilot — the orchestration layer. Flow per turn (deterministic, bounded — no agent…
// loops): 1. authenticate + authorize (global guards) → user 2. rate limit + input-size checks → cost controls…
@Injectable()
export class CopilotService {
  private readonly logger = new Logger(CopilotService.name);

  constructor(
    // LLMProvider is an interface (type-only import is fine): the @Inject
    // token drives DI — the runtime value comes from CopilotModule's factory.
    @Inject(LLM_PROVIDER) private readonly provider: LLMProvider,
    private readonly config: CopilotConfig,
    private readonly tools: CopilotToolsService,
    private readonly prisma: PrismaService,
    private readonly rateLimiter: CopilotRateLimiter,
    private readonly metrics: CopilotMetricsService,
  ) {
    this.metrics.markConfigured(this.provider.describeProviders());
  }

  /** One chat turn: question in, grounded structured answer out. */
  async chat(user: RequestUser, dto: CopilotChatRequest): Promise<CopilotResponse> {
    const started = Date.now();
    this.metrics.recordRequestStarted();

    if (!this.provider.isConfigured()) {
      throw this.fail('unconfigured', started);
    }

    const message = dto.message?.trim() ?? '';
    if (!message) {
      throw new BadRequestException('Please enter a question for the copilot.');
    }
    if (message.length > this.config.maxInputChars) {
      throw new BadRequestException(
        `Questions are limited to ${this.config.maxInputChars} characters. Please shorten your question.`,
      );
    }

    const decision = this.rateLimiter.check(user.sub);
    if (!decision.allowed) {
      this.metrics.recordRateLimited();
      throw new HttpException(
        `You have reached the copilot request limit. Please try again in ${decision.retryAfterSeconds}s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    try {
      const response = await this.runTurn(user, dto, message);
      this.metrics.recordSuccess(
        Date.now() - started,
        response.provenance.toolUsed,
        response.provenance.provider,
      );
      return response;
    } catch (error) {
      throw this.toHttpError(error, started);
    }
  }

  private async runTurn(
    user: RequestUser,
    dto: CopilotChatRequest,
    message: string,
  ): Promise<CopilotResponse> {
    const conversation = await this.resolveConversation(user, dto.conversationId);
    const history = await this.loadHistory(conversation.id);

    // ── 1. Planning ─────────────────────────────────────────────────────────
    const available = this.tools.availableFor(user);
    const context = await this.tools.buildPlanningContext(user);
    const { plan, provider, model } = await this.plan(
      available,
      context.departments,
      history,
      message,
    );

    // ── 2. Branch on the plan ───────────────────────────────────────────────
    if (plan.intent === 'refuse') {
      const answer = plan.refusal?.trim() || FALLBACK_ANSWER;
      await this.saveTurn(conversation.id, message, answer);
      return this.responseFor(
        conversation.id,
        answer,
        [],
        this.provenance(undefined, undefined, { provider, model }),
        [],
      );
    }

    if (plan.intent === 'answer') {
      const answer = plan.answer?.trim() || FALLBACK_ANSWER;
      await this.saveTurn(conversation.id, message, answer);
      return this.responseFor(
        conversation.id,
        answer,
        [],
        this.provenance(undefined, undefined, { provider, model }),
        FALLBACK_SUGGESTIONS,
      );
    }

    // ── 3. Validate + execute the tool ──────────────────────────────────────
    const tool = plan.tool ? this.tools.find(plan.tool) : undefined;
    if (!tool) {
      await this.saveTurn(conversation.id, message, FALLBACK_ANSWER);
      return this.responseFor(
        conversation.id,
        FALLBACK_ANSWER,
        [],
        this.provenance(undefined, undefined, { provider, model }),
        FALLBACK_SUGGESTIONS,
      );
    }

    const { value: args, error } = tool.inputSchema.validate(plan.arguments ?? {}, {
      abortEarly: false,
    });
    if (error) {
      await this.saveTurn(conversation.id, message, FALLBACK_ANSWER);
      return this.responseFor(
        conversation.id,
        FALLBACK_ANSWER,
        [],
        this.provenance(tool.name, undefined, { provider, model }),
        FALLBACK_SUGGESTIONS,
      );
    }

    const execution = await tool.execute(user, args);

    // ── 4. Grounding ────────────────────────────────────────────────────────
    const grounded = await this.ground(message, tool.name, execution);

    await this.saveTurn(conversation.id, message, grounded.answer, tool.name);
    return this.responseFor(
      conversation.id,
      grounded.answer,
      execution.deepLinks,
      this.provenance(tool.name, execution, {
        provider: grounded.provider ?? provider,
        model: grounded.model ?? model,
      }),
      execution.suggestions,
      execution.limitations ?? [],
      execution.data,
    );
  }

  /** Real-time event streaming turn over Server-Sent Events (SSE). */
  chatStream(
    user: RequestUser,
    dto: CopilotChatRequest,
  ): Observable<{ data: Record<string, unknown> }> {
    const subject = new Subject<{ data: Record<string, unknown> }>();

    (async () => {
      try {
        const started = Date.now();
        this.metrics.recordRequestStarted();

        if (!this.provider.isConfigured()) {
          throw this.fail('unconfigured', started);
        }

        const message = dto.message?.trim() ?? '';
        if (!message) {
          throw new BadRequestException('Please enter a question for the copilot.');
        }

        const decision = this.rateLimiter.check(user.sub);
        if (!decision.allowed) {
          this.metrics.recordRateLimited();
          throw new HttpException(
            `You have reached the copilot request limit. Please try again in ${decision.retryAfterSeconds}s.`,
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        const conversation = await this.resolveConversation(user, dto.conversationId);
        const history = await this.loadHistory(conversation.id);
        const available = this.tools.availableFor(user);
        const context = await this.tools.buildPlanningContext(user);

        const { plan, provider, model } = await this.plan(
          available,
          context.departments,
          history,
          message,
        );

        if (plan.intent === 'tool' && plan.tool) {
          subject.next({ data: { type: 'tool_start', toolName: plan.tool } });
        }

        let response: CopilotResponse;
        const tool = plan.tool ? this.tools.find(plan.tool) : undefined;
        if (tool && plan.intent === 'tool') {
          const { value: args } = tool.inputSchema.validate(plan.arguments ?? {}, {
            abortEarly: false,
          });
          const execution = await tool.execute(user, args ?? {});
          subject.next({
            data: {
              type: 'tool_result',
              toolName: tool.name,
              data: execution.data,
              deepLinks: execution.deepLinks,
              suggestions: execution.suggestions,
            },
          });

          const grounded = await this.ground(message, tool.name, execution);
          await this.saveTurn(conversation.id, message, grounded.answer, tool.name);

          response = this.responseFor(
            conversation.id,
            grounded.answer,
            execution.deepLinks,
            this.provenance(tool.name, execution, {
              provider: grounded.provider ?? provider,
              model: grounded.model ?? model,
            }),
            execution.suggestions,
            execution.limitations ?? [],
            execution.data,
          );
        } else {
          const answer =
            plan.intent === 'refuse'
              ? plan.refusal?.trim() || FALLBACK_ANSWER
              : plan.answer?.trim() || FALLBACK_ANSWER;

          await this.saveTurn(conversation.id, message, answer);
          response = this.responseFor(
            conversation.id,
            answer,
            [],
            this.provenance(undefined, undefined, { provider, model }),
            FALLBACK_SUGGESTIONS,
          );
        }

        // Stream answer token by token
        const words = response.answer.split(' ');
        for (let i = 0; i < words.length; i++) {
          const chunk = words[i] + (i < words.length - 1 ? ' ' : '');
          subject.next({ data: { type: 'token', content: chunk } });
          await new Promise((r) => setTimeout(r, 15));
        }

        subject.next({ data: { type: 'done', response } });
        this.metrics.recordSuccess(
          Date.now() - started,
          response.provenance.toolUsed,
          response.provenance.provider,
        );
        subject.complete();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        subject.next({ data: { type: 'error', error: errorMsg } });
        subject.complete();
      }
    })();

    return subject.asObservable();
  }

  // ── LLM calls ──────────────────────────────────────────────────────────────

  /** Planning: map the question to ONE tool + arguments (or answer/refuse). */
  private async plan(
    available: CopilotToolsService['tools'],
    departments: string[],
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    question: string,
  ): Promise<{ plan: CopilotPlan; provider?: string; model?: string }> {
    const system = buildPlanningPrompt(available, { departments });
    const messages = [...history, { role: 'user' as const, content: question }];

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const completion = await this.provider.complete({
        system,
        messages,
        jsonMode: true,
        temperature: 0,
        maxTokens: 500,
      });
      const parsed = parsePlan(completion.content);
      if (parsed) {
        return { plan: parsed, provider: completion.provider, model: completion.model };
      }
      // Repair turn: tell the model its output was not usable JSON, once.
      messages.push(
        { role: 'assistant', content: completion.content },
        {
          role: 'user',
          content:
            'Your previous response was not valid JSON matching the required plan schema. Respond with valid JSON only: {"intent": "tool"|"answer"|"refuse", "tool": "<name>", "arguments": {...}}.',
        },
      );
    }

    throw new LLMProviderError('response', 'Planning output was not parseable JSON');
  }

  /** Grounding: format the final answer from ONLY the tool's structured result. */
  private async ground(
    question: string,
    toolName: string,
    execution: CopilotToolExecution,
  ): Promise<{ answer: string; provider?: string; model?: string }> {
    const completion = await this.provider.complete({
      system: buildGroundingPrompt(),
      messages: [
        {
          role: 'user',
          content: [
            `Question: ${question}`,
            `Tool used: ${toolName}`,
            `Tool result (JSON): ${JSON.stringify(execution.data)}`,
            `Available deep links: ${JSON.stringify(execution.deepLinks)}`,
          ].join('\n\n'),
        },
      ],
      temperature: 0.2,
      maxTokens: 900,
    });
    const answer = completion.content.trim();
    if (!answer) {
      throw new LLMProviderError('response', 'Grounding output was empty');
    }
    return {
      answer: answer.slice(0, MAX_ANSWER_CHARS),
      provider: completion.provider,
      model: completion.model,
    };
  }

  // ── persistence ────────────────────────────────────────────────────────────

  private async resolveConversation(
    user: RequestUser,
    conversationId?: string,
  ): Promise<{ id: string; userId: string }> {
    if (!conversationId) {
      return this.prisma.aiConversation.create({ data: { userId: user.sub } });
    }
    const conversation = await this.prisma.aiConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, userId: true },
    });
    // Opaque NotFound: an unknown or foreign conversation is indistinguishable.
    if (!conversation || conversation.userId !== user.sub) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  private async loadHistory(
    conversationId: string,
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const rows = await this.prisma.aiMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_MESSAGES,
      select: { role: true, content: true },
    });
    return rows
      .reverse()
      .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }));
  }

  private async saveTurn(
    conversationId: string,
    userMessage: string,
    answer: string,
    toolName?: string,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.aiMessage.create({
        data: { conversationId, role: 'user', content: userMessage },
      }),
      this.prisma.aiMessage.create({
        data: {
          conversationId,
          role: 'assistant',
          content: answer,
          toolName: toolName ?? null,
        },
      }),
      this.prisma.aiConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);
  }

  // ── history endpoints ──────────────────────────────────────────────────────

  async getConversation(user: RequestUser, id: string): Promise<CopilotMessageView[]> {
    const conversation = await this.resolveConversation(user, id);
    const rows = await this.prisma.aiMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, content: true, toolName: true, createdAt: true },
    });
    return rows.map((r) => ({
      id: r.id,
      role: r.role as 'user' | 'assistant',
      content: r.content,
      toolName: r.toolName,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async clearConversation(user: RequestUser, id: string): Promise<void> {
    const conversation = await this.resolveConversation(user, id);
    await this.prisma.aiMessage.deleteMany({ where: { conversationId: conversation.id } });
  }

  // ── capabilities + observability ───────────────────────────────────────────

  capabilities(): CopilotCapabilities {
    return {
      configured: this.provider.isConfigured(),
      providers: this.provider.describeProviders(),
      suggestedQuestions: [
        'Which department has the highest observed attrition?',
        'How many employees are working overtime?',
        'Compare Engineering and Sales.',
        'What are the biggest workforce patterns to investigate?',
        'Show me employees in Sales working overtime.',
      ],
    };
  }

  metricsSnapshot() {
    return this.metrics.snapshot();
  }

  // ── response shaping ───────────────────────────────────────────────────────

  private responseFor(
    conversationId: string,
    answer: string,
    deepLinks: CopilotResponse['deepLinks'],
    provenance: CopilotProvenance,
    suggestions: string[],
    limitations: string[] = [],
    toolData?: unknown,
  ): CopilotResponse {
    return {
      conversationId,
      answer,
      deepLinks,
      provenance,
      limitations,
      suggestions,
      toolData,
      createdAt: new Date().toISOString(),
    };
  }

  private provenance(
    toolName: string | undefined,
    execution?: CopilotToolExecution,
    aiSource?: { provider?: string; model?: string },
  ): CopilotProvenance {
    return {
      source: 'orgwise workforce dataset',
      toolUsed: toolName,
      recordsAnalyzed: execution?.recordsAnalyzed,
      lastImportedAt: execution?.lastImportedAt,
      provider: aiSource?.provider,
      model: aiSource?.model,
    };
  }

  // ── error mapping ──────────────────────────────────────────────────────────

  private fail(kind: string, started: number): never {
    this.metrics.recordError(Date.now() - started, kind);
    throw new ServiceUnavailableException(friendlyProviderMessage(kind));
  }

  private toHttpError(error: unknown, started: number): never {
    if (error instanceof LLMProviderError) {
      return this.fail(error.kind, started);
    }
    if (error instanceof HttpException) {
      throw error;
    }
    this.logger.error(
      `Copilot turn failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return this.fail('internal', started);
  }
}

/** Defensive JSON plan parsing — tolerant of markdown fences and whitespace. */
export function parsePlan(raw: string): CopilotPlan | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  const { value, error } = planSchema.validate(parsed, { abortEarly: false });
  if (error) return null;
  if (value.intent === 'tool' && !value.tool) return null;
  return value as CopilotPlan;
}

export function friendlyProviderMessage(kind: string): string {
  switch (kind) {
    case 'unconfigured':
      return 'orgwise Copilot is not configured yet — an AI provider key is required.';
    case 'auth':
      return 'The AI provider rejected the configured credentials. Please contact your administrator.';
    case 'rate':
      return 'The AI provider is busy right now — please try again in a moment.';
    case 'timeout':
      return 'The AI provider took too long to respond. Please try again.';
    case 'response':
      return 'The AI provider returned an unexpected response. Please try again.';
    default:
      return 'orgwise Copilot is temporarily unavailable — please try again.';
  }
}
