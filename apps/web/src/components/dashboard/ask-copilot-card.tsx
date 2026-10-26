'use client';

import type { DashboardFilters, FilterOptions } from '@orgwise/types';
import { Bot } from 'lucide-react';
import { useMemo } from 'react';
import { useCopilot } from '@/components/copilot/copilot-context';
// "Ask orgwise" card — the copilot's front door on the dashboard. The suggestions are contextual: when a…
// department filter is active the card proposes questions scoped to that department.
export function AskCopilotCard({
  filters,
  options,
}: {
  filters: DashboardFilters;
  options: FilterOptions | null;
}) {
  const { openWithQuestion } = useCopilot();

  const departmentName = useMemo(
    () => options?.departments.find((d) => d.id === filters.departmentId)?.name,
    [options, filters.departmentId],
  );

  const questions = useMemo(() => {
    if (departmentName) {
      return [
        `What is the observed attrition in ${departmentName}?`,
        `Show me employees in ${departmentName} working overtime.`,
        `How does ${departmentName} compare with the rest of the organization?`,
      ];
    }
    return [
      'Which department has the highest observed attrition?',
      'What are the biggest workforce patterns to investigate?',
      'Show me employees working overtime with low job satisfaction.',
    ];
  }, [departmentName]);

  return (
    <section
      aria-label="Ask orgwise"
      className="flex flex-col gap-3 rounded-xl border border-border/60 bg-gradient-to-br from-indigo-500/[0.06] via-background to-cyan-500/[0.06] p-4 sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="flex items-center gap-3 sm:min-w-0">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-sm">
          <Bot className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Ask orgwise</h2>
          <p className="truncate text-xs text-muted-foreground">
            Ask a question about your workforce — answered from live orgwise data.
          </p>
        </div>
      </div>
      <div className="flex flex-1 flex-wrap gap-1.5 sm:justify-end">
        {questions.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => openWithQuestion(question)}
            className="max-w-full truncate rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {question}
          </button>
        ))}
      </div>
    </section>
  );
}
