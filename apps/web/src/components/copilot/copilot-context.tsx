'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

interface CopilotContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Opens the drawer and optionally queues a question to send immediately. */
  openWithQuestion: (question?: string) => void;
  /** Question queued for the drawer to consume on open (cleared after use). */
  consumeQueuedQuestion: () => string | null;
}

const CopilotContext = createContext<CopilotContextValue | null>(null);
// Lightweight global handle to the copilot drawer — lets any page (e.g. the dashboard's "Ask orgwise" card)…
// open the assistant and prefill a question without prop-drilling through the app shell.
export function CopilotProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const queuedQuestion = useRef<string | null>(null);

  const openWithQuestion = useCallback((question?: string) => {
    queuedQuestion.current = question?.trim() ? question.trim() : null;
    setOpen(true);
  }, []);

  const consumeQueuedQuestion = useCallback(() => {
    const question = queuedQuestion.current;
    queuedQuestion.current = null;
    return question;
  }, []);

  const value = useMemo(
    () => ({ open, setOpen, openWithQuestion, consumeQueuedQuestion }),
    [open, openWithQuestion, consumeQueuedQuestion],
  );

  return <CopilotContext.Provider value={value}>{children}</CopilotContext.Provider>;
}

export function useCopilot(): CopilotContextValue {
  const ctx = useContext(CopilotContext);
  if (!ctx) {
    throw new Error('useCopilot must be used within a CopilotProvider');
  }
  return ctx;
}
