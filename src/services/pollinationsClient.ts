export class AIProviderRateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super('AI_RATE_LIMITED');
    this.name = 'AIProviderRateLimitError';
  }
}

function getRetryAfterSeconds(value: string | null): number {
  if (!value) return 30;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);

  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) return 30;
  return Math.max(1, Math.ceil((retryAt - Date.now()) / 1000));
}

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function requestPollinationsChatCompletion(
  model: string,
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  temperature: number
): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    let response: Response;

    try {
      response = await fetch('https://text.pollinations.ai/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, temperature }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 402 || response.status === 429) {
      const retryAfterSeconds = getRetryAfterSeconds(response.headers.get('Retry-After'));
      if (attempt === 0 && retryAfterSeconds <= 2) {
        await wait(retryAfterSeconds * 1000);
        continue;
      }
      throw new AIProviderRateLimitError(retryAfterSeconds);
    }

    if (!response.ok) {
      return '';
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json() as {
        choices?: Array<{ message?: { content?: unknown } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      return typeof content === 'string' ? content.trim() : '';
    }

    const content = (await response.text()).trim();
    return content.startsWith('<!DOCTYPE') ? '' : content;
  }

  return '';
}
