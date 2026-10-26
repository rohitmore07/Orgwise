import type { ProviderSettings } from '../copilot.config';
import { OpenAiProvider } from './openai.provider';

function settings(overrides: Partial<ProviderSettings> = {}): ProviderSettings {
  return {
    name: 'groq',
    apiKey: 'test-key',
    model: 'test-model',
    baseUrl: 'https://llm.test/v1',
    timeoutMs: 5000,
    maxRetries: 2,
    maxTokens: 2000,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('OpenAiProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('reports not configured when the API key is empty', () => {
    const provider = new OpenAiProvider(settings({ apiKey: '' }));
    expect(provider.isConfigured()).toBe(false);
    void expect(provider.complete({ system: 's', messages: [] })).rejects.toMatchObject({
      kind: 'unconfigured',
    });
  });

  it('sends the system + messages payload and returns content + usage', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: '{"intent":"tool"}' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    ) as unknown as typeof fetch;

    const provider = new OpenAiProvider(settings());
    const completion = await provider.complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'hello' }],
      jsonMode: true,
    });

    expect(completion.content).toBe('{"intent":"tool"}');
    expect(completion.usage?.totalTokens).toBe(15);

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(url).toBe('https://llm.test/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    const payload = JSON.parse(init.body);
    expect(payload.messages).toHaveLength(2);
    expect(payload.messages[0]).toMatchObject({ role: 'system', content: 'sys' });
    expect(payload.response_format).toEqual({ type: 'json_object' });
  });

  it('maps 401/403 to an auth error without retrying', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, 401)) as unknown as typeof fetch;

    const provider = new OpenAiProvider(settings());
    await expect(provider.complete({ system: 's', messages: [] })).rejects.toMatchObject({
      kind: 'auth',
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('maps 429 to a rate error', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, 429)) as unknown as typeof fetch;

    const provider = new OpenAiProvider(settings());
    await expect(provider.complete({ system: 's', messages: [] })).rejects.toMatchObject({
      kind: 'rate',
    });
  });

  it('retries transient 5xx failures then succeeds', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(
        jsonResponse({ choices: [{ message: { content: 'ok' } }] }),
      ) as unknown as typeof fetch;
    global.fetch = fetchMock;

    const provider = new OpenAiProvider(settings({ maxRetries: 2 }));
    const completion = await provider.complete({ system: 's', messages: [] });
    expect(completion.content).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after exhausting retries with a network error', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, 503)) as unknown as typeof fetch;

    const provider = new OpenAiProvider(settings({ maxRetries: 1 }));
    await expect(provider.complete({ system: 's', messages: [] })).rejects.toMatchObject({
      kind: 'network',
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('surfaces a timeout when the request aborts', async () => {
    global.fetch = jest.fn(
      () =>
        new Promise<Response>((_, reject) => {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        }),
    ) as unknown as typeof fetch;

    const provider = new OpenAiProvider(settings({ maxRetries: 0 }));
    await expect(provider.complete({ system: 's', messages: [] })).rejects.toMatchObject({
      kind: 'timeout',
    });
  });

  it('treats an empty completion as a response error', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ choices: [{ message: { content: '   ' } }] }),
      ) as unknown as typeof fetch;

    const provider = new OpenAiProvider(settings({ maxRetries: 0 }));
    await expect(provider.complete({ system: 's', messages: [] })).rejects.toMatchObject({
      kind: 'response',
    });
  });

  it('treats transport failures as network errors', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    const provider = new OpenAiProvider(settings({ maxRetries: 0 }));
    await expect(provider.complete({ system: 's', messages: [] })).rejects.toMatchObject({
      kind: 'network',
    });
  });

  it('propagates a provider-reported error message', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ error: { message: 'model overloaded' } }, 200),
      ) as unknown as typeof fetch;

    const provider = new OpenAiProvider(settings({ maxRetries: 0 }));
    await expect(provider.complete({ system: 's', messages: [] })).rejects.toMatchObject({
      kind: 'response',
      message: expect.stringContaining('model overloaded'),
    });
  });

  it('tags completions with the provider name and model', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ choices: [{ message: { content: 'ok' } }] }),
      ) as unknown as typeof fetch;

    const provider = new OpenAiProvider(
      settings({ name: 'groq', model: 'llama-3.3-70b-versatile' }),
    );
    const completion = await provider.complete({ system: 's', messages: [] });
    expect(completion.provider).toBe('groq');
    expect(completion.model).toBe('llama-3.3-70b-versatile');
    expect(provider.describeProviders()).toEqual([
      { name: 'groq', model: 'llama-3.3-70b-versatile', configured: true },
    ]);
  });

  it('retries once without strict JSON mode when a free model rejects response_format', async () => {
    global.fetch = jest
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve(
          jsonResponse(
            { error: { message: "'response_format' is not supported for this model" } },
            400,
          ),
        ),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ choices: [{ message: { content: 'ok' } }] })),
      ) as unknown as typeof fetch;

    const provider = new OpenAiProvider(settings({ name: 'groq' }));
    const completion = await provider.complete({ system: 's', messages: [], jsonMode: true });
    expect(completion.content).toBe('ok');
    // Second call must NOT include response_format.
    const secondBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1]![1]!.body as string);
    expect(secondBody.response_format).toBeUndefined();
  });

  it('preserves categorized provider errors through the retry loop', async () => {
    // A provider-reported error inside callOnce must surface with its original category (not be re-wrapped as a…
    // generic network error). The fetch mock builds a FRESH Response per call — bodies are single-use.
    global.fetch = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(jsonResponse({ error: { message: 'already categorized' } }, 200)),
      ) as unknown as typeof fetch;

    const provider = new OpenAiProvider(settings({ maxRetries: 2 }));
    await expect(provider.complete({ system: 's', messages: [] })).rejects.toMatchObject({
      kind: 'response',
      message: expect.stringContaining('already categorized'),
    });
  });
});
