import type { CopilotDeepLink, CopilotMessageView, CopilotStreamEvent } from '@orgwise/types';
import { Bot, Copy, Loader2, Send, Trash2, TriangleAlert, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ApiClientError } from '@/lib/api';
import {
  clearCopilotConversation,
  fetchCopilotCapabilities,
  fetchCopilotConversation,
  streamCopilotMessage,
} from '@/lib/copilot-api';
import { cn } from '@/lib/utils';
import { useCopilot } from './copilot-context';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolName?: string | null;
  toolData?: unknown;
  provider?: string;
  model?: string;
  deepLinks?: CopilotDeepLink[];
  suggestions?: string[];
  createdAt?: string;
}

const CONVERSATION_KEY = 'orgwise_copilot_conversation';

const COMMANDS = [
  { prefix: 'compare', label: 'Compare departments', prompt: 'Compare ' },
  {
    prefix: 'risk',
    label: 'Attrition risk',
    prompt: 'Which groups have the highest observed attrition?',
  },
  { prefix: 'employees', label: 'Find employees', prompt: 'Show me employees with ' },
  { prefix: 'overtime', label: 'Overtime', prompt: 'How many employees are working overtime?' },
  {
    prefix: 'patterns',
    label: 'Workforce patterns',
    prompt: 'What are the biggest workforce patterns I should investigate?',
  },
  {
    prefix: 'health',
    label: 'Workforce health',
    prompt: 'How is overall workforce health right now?',
  },
] as const;

const DEFAULT_SUGGESTIONS = [
  'Which department has the highest observed attrition?',
  'How many employees are working overtime?',
  'Compare Engineering and Sales.',
  'Show me employees in Sales working overtime.',
];

export function CopilotDrawer() {
  const { open, setOpen, consumeQueuedQuestion } = useCopilot();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [commandIndex, setCommandIndex] = useState(0);
  // Id of the assistant message currently streaming — used to render the
  // thinking bubble only until the real bubble has content to show.
  const [streamingId, setStreamingId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false);

  // Capabilities + resume an existing thread from localStorage.
  useEffect(() => {
    let cancelled = false;
    fetchCopilotCapabilities()
      .then((caps) => {
        if (cancelled) return;
        setConfigured(caps.configured);
        if (!caps.configured) setSuggestions([]);
      })
      .catch(() => {
        if (!cancelled) setConfigured(false);
      });

    const stored = window.localStorage.getItem(CONVERSATION_KEY);
    if (stored) {
      setLoadingHistory(true);
      fetchCopilotConversation(stored)
        .then((history) => {
          if (cancelled) return;
          setConversationId(stored);
          setMessages(history.map(toChatMessage));
        })
        .catch(() => window.localStorage.removeItem(CONVERSATION_KEY))
        .finally(() => {
          if (!cancelled) setLoadingHistory(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-scroll to the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy, loadingHistory]);

  // Focus the input when the drawer opens.
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
      const queued = consumeQueuedQuestion();
      if (queued) void send(queued);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const send = useCallback(
    async (rawQuestion?: string) => {
      const question = (rawQuestion ?? input).trim();
      if (!question || busy || sendingRef.current) return;
      sendingRef.current = true;
      setBusy(true);
      setError(null);
      setActiveTool(null);

      const userMessage: ChatMessage = {
        id: `local-${Date.now()}`,
        role: 'user',
        content: question,
        createdAt: new Date().toISOString(),
      };

      const assistantMsgId = `resp-${Date.now()}`;
      setStreamingId(assistantMsgId);
      // The assistant bubble is NOT pre-created: it is upserted as stream
      // events arrive, so an empty bubble never renders next to the thinking
      // state.
      const upsertAssistant = (
        patch: (existing: ChatMessage | undefined) => Partial<ChatMessage>,
      ) => {
        setMessages((prev) => {
          const index = prev.findIndex((m) => m.id === assistantMsgId);
          if (index === -1) {
            return [
              ...prev,
              {
                id: assistantMsgId,
                role: 'assistant',
                content: '',
                createdAt: new Date().toISOString(),
                ...patch(undefined),
              },
            ];
          }
          const copy = [...prev];
          copy[index] = { ...copy[index]!, ...patch(copy[index]) };
          return copy;
        });
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');

      try {
        await streamCopilotMessage(
          {
            message: question,
            conversationId: conversationId ?? undefined,
          },
          (event: CopilotStreamEvent) => {
            if (event.type === 'tool_start') {
              setActiveTool(event.toolName);
            } else if (event.type === 'tool_result') {
              upsertAssistant(() => ({
                toolName: event.toolName,
                toolData: event.data,
                deepLinks: event.deepLinks,
                suggestions: event.suggestions,
              }));
              if (event.suggestions?.length) {
                setSuggestions(event.suggestions);
              }
            } else if (event.type === 'token') {
              upsertAssistant((existing) => ({
                content: (existing?.content ?? '') + event.content,
              }));
            } else if (event.type === 'done') {
              setConversationId(event.response.conversationId);
              window.localStorage.setItem(CONVERSATION_KEY, event.response.conversationId);
              upsertAssistant(() => ({
                content: event.response.answer,
                toolName: event.response.provenance.toolUsed,
                provider: event.response.provenance.provider,
                model: event.response.provenance.model,
                deepLinks: event.response.deepLinks,
                suggestions: event.response.suggestions,
                toolData: event.response.toolData,
              }));
              if (event.response.suggestions?.length) {
                setSuggestions(event.response.suggestions);
              }
              setActiveTool(null);
            } else if (event.type === 'error') {
              setError(event.error);
            }
          },
        );
      } catch (err) {
        const message =
          err instanceof ApiClientError
            ? err.message
            : 'orgwise Copilot is temporarily unavailable.';
        setError(message);
        setMessages((prev) =>
          prev.filter((m) => m.id !== userMessage.id && m.id !== assistantMsgId),
        );
      } finally {
        sendingRef.current = false;
        setBusy(false);
        setActiveTool(null);
        setStreamingId(null);
      }
    },
    [busy, conversationId, input],
  );

  const handleClear = useCallback(async () => {
    if (conversationId) {
      try {
        await clearCopilotConversation(conversationId);
      } catch {
        // Clearing is best-effort — the thread resets locally regardless.
      }
      window.localStorage.removeItem(CONVERSATION_KEY);
    }
    setConversationId(null);
    setMessages([]);
    setError(null);
    setSuggestions(configured ? DEFAULT_SUGGESTIONS : []);
  }, [conversationId, configured]);

  const copyMessage = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // Clipboard may be unavailable — copying is a convenience, not critical.
    }
  }, []);

  const commandQuery = input.startsWith('/') ? input.slice(1).trim().toLowerCase() : null;
  const visibleCommands =
    commandQuery !== null
      ? COMMANDS.filter(
          (command) =>
            command.label.toLowerCase().includes(commandQuery) ||
            command.prefix.includes(commandQuery),
        )
      : [];

  const selectCommand = (command: (typeof COMMANDS)[number]) => {
    setInput(command.prompt);
    setCommandIndex(0);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (visibleCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCommandIndex((index) => (index + 1) % visibleCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCommandIndex((index) => (index - 1 + visibleCommands.length) % visibleCommands.length);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        selectCommand(visibleCommands[commandIndex]!);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setInput('');
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90]"
      role="dialog"
      aria-modal="true"
      aria-label="orgwise Copilot"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />

      {/* Panel */}
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[26rem] flex-col border-l border-border/60 bg-background shadow-2xl">
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/60 px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-sm">
              <Bot className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">orgwise Copilot</p>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <StatusDot configured={configured} />
                {configured === false ? 'Not configured' : 'Workforce intelligence'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 ? (
              <button
                type="button"
                onClick={() => void handleClear()}
                aria-label="Clear conversation"
                title="Clear conversation"
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close copilot"
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loadingHistory ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Resuming conversation…
            </div>
          ) : messages.length === 0 ? (
            <EmptyState
              configured={configured}
              suggestions={suggestions}
              onAsk={(q) => void send(q)}
            />
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onCopy={() => void copyMessage(message.content)}
                />
              ))}
              {busy && streamingId && !messages.some((m) => m.id === streamingId) ? (
                <ThinkingBubble activeTool={activeTool} />
              ) : null}
            </div>
          )}

          {error ? (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-300">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="font-medium">Copilot unavailable</p>
                <p className="mt-0.5 text-[13px] leading-relaxed">{error}</p>
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        {/* Suggestion chips (after the first answer) */}
        {messages.length > 0 && suggestions.length > 0 && !busy ? (
          <div className="shrink-0 space-y-1.5 border-t border-border/60 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Follow-up questions
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => void send(question)}
                  className="max-w-full truncate rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Input */}
        <div className="relative shrink-0 border-t border-border/60 p-3">
          {visibleCommands.length > 0 ? (
            <div className="absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
              <ul className="max-h-64 overflow-y-auto p-1">
                {visibleCommands.map((command, index) => (
                  <li key={command.prefix}>
                    <button
                      type="button"
                      onClick={() => selectCommand(command)}
                      onMouseEnter={() => setCommandIndex(index)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none',
                        index === commandIndex
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground',
                      )}
                    >
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                        /{command.prefix}
                      </span>
                      {command.label}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="border-t border-border/50 px-3 py-1.5 text-[10px] text-muted-foreground/70">
                ↑↓ to navigate · Enter to insert · Esc to cancel
              </p>
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setCommandIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                configured === false ? 'Copilot is not configured' : 'Ask about your workforce…'
              }
              disabled={busy || configured === false || loadingHistory}
              rows={2}
              className="min-h-[44px] max-h-32 resize-none"
              aria-label="Ask the copilot a question"
            />
            <Button
              type="button"
              size="icon"
              onClick={() => void send()}
              disabled={busy || configured === false || loadingHistory || !input.trim()}
              aria-label="Send question"
              className="h-[44px] w-[44px] shrink-0 rounded-lg"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
            </Button>
          </div>
          <p className="mt-2 flex items-center justify-between gap-2 px-1 text-[11px] text-muted-foreground/70">
            <span>
              Answers are grounded in your current orgwise dataset and respect your access scope.
            </span>
            <span className="shrink-0">Type / for commands</span>
          </p>
        </div>
      </aside>
    </div>
  );
}

function StatusDot({ configured }: { configured: boolean | null }) {
  return (
    <span
      className={cn(
        'size-1.5 rounded-full',
        configured === null
          ? 'bg-muted-foreground/40'
          : configured
            ? 'bg-emerald-500'
            : 'bg-amber-500',
      )}
      aria-hidden
    />
  );
}

function EmptyState({
  configured,
  suggestions,
  onAsk,
}: {
  configured: boolean | null;
  suggestions: string[];
  onAsk: (question: string) => void;
}) {
  if (configured === false) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Bot className="size-6" aria-hidden />
        </span>
        <p className="text-sm font-medium text-foreground">Copilot is not configured</p>
        <p className="max-w-xs text-[13px] leading-relaxed text-muted-foreground">
          An AI provider key (AI_API_KEY) is required to enable the Workforce Copilot. The rest of
          orgwise keeps working normally.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <div className="text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-sm">
          <Bot className="size-6" aria-hidden />
        </span>
        <h2 className="mt-3 text-sm font-semibold text-foreground">Ask about your workforce</h2>
        <p className="mx-auto mt-1 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
          Ask about headcount, attrition, engagement, departments or employees — answers are
          computed from your live orgwise data.
        </p>
      </div>
      <div className="space-y-1.5">
        {suggestions.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => onAsk(question)}
            className="block w-full rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-left text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            “{question}”
          </button>
        ))}
      </div>
    </div>
  );
}

function ThinkingBubble({ activeTool }: { activeTool?: string | null }) {
  return (
    <div className="flex items-end gap-2">
      <BotAvatar />
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-border/60 bg-muted/40 px-3 py-2.5">
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />
        <span className="text-[13px] text-muted-foreground">
          {activeTool ? `Executing tool: ${activeTool}…` : 'Analyzing workforce data…'}
        </span>
      </div>
    </div>
  );
}

function BotAvatar() {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-sm">
      <Bot className="size-3.5" aria-hidden />
    </span>
  );
}

function GenerativeUIWidget({
  toolName,
  toolData,
}: {
  toolName?: string | null;
  toolData?: unknown;
}) {
  if (!toolData || !toolName) return null;

  const dataObj = toolData as Record<string, unknown>;

  if (toolName === 'compareDepartments' && Array.isArray(dataObj.comparison)) {
    const list = dataObj.comparison as Array<{
      department: string;
      headcount: number;
      attritionRate: number;
      overtimeRate: number;
    }>;
    return (
      <div className="mt-3 rounded-xl border border-indigo-500/25 bg-indigo-950/20 p-3 shadow-sm">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-400">
          <Bot className="size-3" /> Visual Department Comparison
        </p>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={list} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <XAxis dataKey="department" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#f8fafc',
                }}
              />
              <Bar dataKey="headcount" name="Headcount" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar
                dataKey="attritionRate"
                name="Attrition %"
                fill="#f43f5e"
                radius={[4, 4, 0, 0]}
              />
              <Bar dataKey="overtimeRate" name="Overtime %" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  if (toolName === 'getWorkforceOverview' && dataObj.overview) {
    const overview = dataObj.overview as {
      headcount: number;
      active: number;
      attritionRate: number;
      overtimeRate: number;
    };
    return (
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/80 bg-background/80 p-2.5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Total Headcount
          </p>
          <p className="text-lg font-bold text-foreground">{overview.headcount ?? 0}</p>
        </div>
        <div className="rounded-lg border border-border/80 bg-background/80 p-2.5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Active Employees
          </p>
          <p className="text-lg font-bold text-emerald-500">{overview.active ?? 0}</p>
        </div>
        <div className="rounded-lg border border-border/80 bg-background/80 p-2.5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Attrition Rate
          </p>
          <p className="text-lg font-bold text-rose-500">{overview.attritionRate ?? 0}%</p>
        </div>
        <div className="rounded-lg border border-border/80 bg-background/80 p-2.5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Overtime Rate
          </p>
          <p className="text-lg font-bold text-cyan-500">{overview.overtimeRate ?? 0}%</p>
        </div>
      </div>
    );
  }

  if (toolName === 'searchEmployees' && Array.isArray(dataObj.employees)) {
    const employees = (
      dataObj.employees as Array<{ id: string; name: string; title: string; department: string }>
    ).slice(0, 4);
    return (
      <div className="mt-3 space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Matching Employee Cohort ({employees.length})
        </p>
        <div className="grid grid-cols-1 gap-1.5">
          {employees.map((emp) => (
            <Link
              key={emp.id}
              href={`/employees/${emp.id}`}
              className="flex items-center justify-between rounded-lg border border-border/70 bg-background/80 px-3 py-2 text-xs transition-colors hover:border-primary/50"
            >
              <div>
                <p className="font-semibold text-foreground">{emp.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {emp.title} · {emp.department}
                </p>
              </div>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                View
              </span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

function MessageBubble({ message, onCopy }: { message: ChatMessage; onCopy: () => void }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground shadow-sm">
          <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-2">
      <BotAvatar />
      <div className="min-w-0 max-w-[88%] flex-1">
        <div className="rounded-2xl rounded-bl-sm border border-border/60 bg-muted/40 px-3.5 py-3">
          <div className="copilot-markdown text-sm leading-relaxed text-foreground">
            <Markdown text={message.content} />
          </div>

          <GenerativeUIWidget toolName={message.toolName} toolData={message.toolData} />

          {message.deepLinks && message.deepLinks.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/50 pt-2.5">
              {message.deepLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-1 flex items-center gap-2 px-1">
          {message.toolName || message.provider ? (
            <span className="truncate text-[10px] uppercase tracking-wider text-muted-foreground/60">
              Source: {message.toolName ?? 'Copilot'}
              {message.provider ? ` · via ${message.provider}` : ''}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onCopy}
            aria-label="Copy answer"
            title="Copy answer"
            className="rounded p-1 text-muted-foreground/50 opacity-100 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:opacity-0 sm:group-hover:opacity-100"
          >
            <Copy className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

function toChatMessage(view: CopilotMessageView): ChatMessage {
  return {
    id: view.id,
    role: view.role,
    content: view.content,
    toolName: view.toolName,
    createdAt: view.createdAt,
  };
}
// Tiny markdown renderer — headings, bullets, numbered lists, bold, inline code and internal links. No…
// dangerouslySetInnerHTML, no new dependency.
function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let listKind: 'bullet' | 'number' | null = null;

  const flushList = () => {
    if (listBuffer.length === 0 || listKind === null) return;
    blocks.push(
      listKind === 'bullet' ? (
        <ul key={`ul-${blocks.length}`} className="my-1.5 list-disc space-y-1 pl-5">
          {listBuffer.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </ul>
      ) : (
        <ol key={`ol-${blocks.length}`} className="my-1.5 list-decimal space-y-1 pl-5">
          {listBuffer.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </ol>
      ),
    );
    listBuffer = [];
    listKind = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      flushList();
      listKind = 'bullet';
      listBuffer.push(bullet[1]!);
      continue;
    }
    if (numbered) {
      flushList();
      listKind = 'number';
      listBuffer.push(numbered[1]!);
      continue;
    }
    flushList();
    if (trimmed.startsWith('### ')) {
      blocks.push(
        <h4 key={blocks.length} className="mt-3 mb-1 text-[13px] font-semibold">
          {inline(trimmed.slice(4))}
        </h4>,
      );
    } else if (trimmed.startsWith('## ')) {
      blocks.push(
        <h3 key={blocks.length} className="mt-3 mb-1 text-sm font-semibold">
          {inline(trimmed.slice(3))}
        </h3>,
      );
    } else if (trimmed.startsWith('# ')) {
      blocks.push(
        <h2 key={blocks.length} className="mt-3 mb-1 text-base font-semibold">
          {inline(trimmed.slice(2))}
        </h2>,
      );
    } else {
      blocks.push(
        <p key={blocks.length} className="my-1.5">
          {inline(trimmed)}
        </p>,
      );
    }
  }
  flushList();

  return <>{blocks}</>;
}

/** Inline styles: **bold**, `code`, [label](href) → Link (internal only). */
function inline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={key++} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('`')) {
      parts.push(
        <code key={key++} className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch && linkMatch[2]!.startsWith('/')) {
        parts.push(
          <Link
            key={key++}
            href={linkMatch[2]!}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            {linkMatch[1]}
          </Link>,
        );
      } else {
        parts.push(token);
      }
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}
