import type {
  CopilotCapabilities,
  CopilotChatRequest,
  CopilotMessageView,
  CopilotResponse,
  CopilotStreamEvent,
} from '@orgwise/types';
import { api, API_BASE_URL } from './api';
// Browser client for the orgwise Copilot API. All calls carry the Neon session via the shared `api` client…
// and unwrap the standard envelope.

export function fetchCopilotCapabilities(): Promise<CopilotCapabilities> {
  return api.get<CopilotCapabilities>('/ai/copilot/capabilities');
}

export function sendCopilotMessage(payload: CopilotChatRequest): Promise<CopilotResponse> {
  return api.post<CopilotResponse>('/ai/copilot/chat', payload);
}

export function fetchCopilotConversation(id: string): Promise<CopilotMessageView[]> {
  return api.get<CopilotMessageView[]>(`/ai/copilot/conversations/${id}`);
}

export function clearCopilotConversation(id: string): Promise<void> {
  return api.delete<unknown>(`/ai/copilot/conversations/${id}`).then(() => undefined);
}

export async function streamCopilotMessage(
  payload: CopilotChatRequest,
  onEvent: (event: CopilotStreamEvent) => void,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/ai/copilot/chat/stream`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    // Fallback to standard chat endpoint if SSE endpoint not available or errors out
    const res = await sendCopilotMessage(payload);
    onEvent({ type: 'done', response: res });
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const res = await sendCopilotMessage(payload);
    onEvent({ type: 'done', response: res });
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;
        try {
          const parsed = JSON.parse(jsonStr) as CopilotStreamEvent;
          onEvent(parsed);
        } catch {
          // ignore parsing error
        }
      }
    }
  }
}
