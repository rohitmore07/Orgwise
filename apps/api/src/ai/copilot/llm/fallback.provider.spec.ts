import { FallbackProvider } from './fallback.provider';
import {
  LLMProviderError,
  type LLMCompletion,
  type LLMCompletionRequest,
  type LLMProvider,
} from './llm-provider.interface';

function stubProvider(
  name: string,
  opts: {
    configured?: boolean;
    /** Errors to throw in order (undefined = succeed). */
    errors?: LLMProviderError[];
  } = {},
): LLMProvider & { complete: jest.Mock } {
  const { configured = true, errors = [] } = opts;
  const complete = jest.fn(async (): Promise<LLMCompletion> => {
    const error = errors.shift();
    if (error) throw error;
    return { content: `answer-from-${name}` };
  });
  return {
    name,
    model: `${name}-model`,
    isConfigured: () => configured,
    describeProviders: () => [{ name, model: `${name}-model`, configured }],
    complete,
  };
}

const request: LLMCompletionRequest = { system: 's', messages: [{ role: 'user', content: 'hi' }] };

describe('FallbackProvider', () => {
  it('is configured when at least one provider is configured', () => {
    expect(new FallbackProvider([stubProvider('a', { configured: false })]).isConfigured()).toBe(
      false,
    );
    expect(
      new FallbackProvider([
        stubProvider('a', { configured: false }),
        stubProvider('b'),
      ]).isConfigured(),
    ).toBe(true);
  });

  it('uses the first configured provider on success', async () => {
    const a = stubProvider('a');
    const b = stubProvider('b');
    const chain = new FallbackProvider([a, b]);

    const completion = await chain.complete(request);
    expect(completion.content).toBe('answer-from-a');
    expect(completion.provider).toBe('a');
    expect(b.complete).not.toHaveBeenCalled();
  });

  it('falls back to the next provider on a rate limit', async () => {
    const a = stubProvider('a', { errors: [new LLMProviderError('rate', 'rate limited')] });
    const b = stubProvider('b');
    const chain = new FallbackProvider([a, b]);

    const completion = await chain.complete(request);
    expect(completion.content).toBe('answer-from-b');
    expect(completion.provider).toBe('b');
  });

  it('falls back on timeout, network, auth and response errors', async () => {
    for (const kind of ['timeout', 'network', 'auth', 'response'] as const) {
      const a = stubProvider('a', { errors: [new LLMProviderError(kind, `${kind} failure`)] });
      const b = stubProvider('b');
      const completion = await new FallbackProvider([a, b]).complete(request);
      expect(completion.provider).toBe('b');
    }
  });

  it('skips unconfigured providers entirely', async () => {
    const a = stubProvider('a', { configured: false });
    const b = stubProvider('b');
    const chain = new FallbackProvider([a, b]);

    const completion = await chain.complete(request);
    expect(completion.provider).toBe('b');
    expect(a.complete).not.toHaveBeenCalled();
  });

  it('throws the last error when every provider fails', async () => {
    const a = stubProvider('a', { errors: [new LLMProviderError('rate', 'a limit')] });
    const b = stubProvider('b', { errors: [new LLMProviderError('network', 'b down')] });
    const chain = new FallbackProvider([a, b]);

    await expect(chain.complete(request)).rejects.toMatchObject({
      kind: 'network',
      message: 'b down',
    });
  });

  it('throws unconfigured when no provider has a key', async () => {
    const chain = new FallbackProvider([stubProvider('a', { configured: false })]);
    await expect(chain.complete(request)).rejects.toMatchObject({ kind: 'unconfigured' });
  });

  it('describes the full chain for capabilities/metrics', () => {
    const chain = new FallbackProvider([
      stubProvider('groq'),
      stubProvider('openrouter', { configured: false }),
    ]);
    expect(chain.describeProviders()).toEqual([
      { name: 'groq', model: 'groq-model', configured: true },
      { name: 'openrouter', model: 'openrouter-model', configured: false },
    ]);
  });
});
