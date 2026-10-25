import { SYSTEM_PROMPT, buildUserMessage } from '../constants/prompt';
import { normalizeBaseUrl } from '../shared/settings';
import { createSSEParser, extractDelta } from '../shared/stream';
import type { ListModelsResult, ProviderConfig, TestConnectionResult } from '../shared/types';

export class LLMError extends Error {}

function assertConfigured(config: ProviderConfig) {
  if (!config.apiKey) throw new LLMError('API key is not set. Open Lucid settings to add one.');
  if (!config.baseUrl) throw new LLMError('Base URL is not set. Open Lucid settings to add one.');
  if (!config.model) throw new LLMError('Model is not set. Open Lucid settings to add one.');
}

function endpoint(config: ProviderConfig) {
  return `${normalizeBaseUrl(config.baseUrl)}/chat/completions`;
}

function headers(config: ProviderConfig): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey.trim()}`,
    // Optional attribution headers used by OpenRouter; ignored by other providers.
    'HTTP-Referer': 'https://github.com/RyanShi0118/AI-Translator',
    'X-Title': 'Lucid',
  };
}

async function readError(res: Response): Promise<string> {
  const body = await res.text().catch(() => '');
  let detail = body.slice(0, 300);
  try {
    const json = JSON.parse(body);
    detail = json?.error?.message ?? json?.message ?? detail;
  } catch {
    /* not JSON */
  }
  const hint =
    res.status === 401 ? ' (invalid API key?)' : res.status === 404 ? ' (check Base URL and model ID)' : res.status === 429 ? ' (rate limited or out of credit)' : '';
  return `HTTP ${res.status}${hint}${detail ? `: ${detail}` : ''}`;
}

export interface StreamParams {
  config: ProviderConfig;
  text: string;
  targetLang: string;
  tone: string;
  temperature: number;
  signal: AbortSignal;
  onDelta: (accumulated: string) => void;
}

/** Streams a refine-and-translate completion, returning the full raw output. */
export async function streamRefineTranslate(p: StreamParams): Promise<string> {
  assertConfigured(p.config);
  let res: Response;
  try {
    res = await fetch(endpoint(p.config), {
      method: 'POST',
      headers: headers(p.config),
      signal: p.signal,
      body: JSON.stringify({
        model: p.config.model,
        stream: true,
        temperature: p.temperature,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserMessage(p.text, p.targetLang, p.tone) },
        ],
      }),
    });
  } catch (e) {
    if (p.signal.aborted) throw e;
    throw new LLMError(`Network error: ${(e as Error).message}`);
  }
  if (!res.ok) throw new LLMError(await readError(res));
  if (!res.body) throw new LLMError('Empty response body.');

  let accumulated = '';
  let streamError: string | null = null;
  const parser = createSSEParser((data) => {
    if (data === '[DONE]') return;
    const delta = extractDelta(data);
    if (delta) {
      accumulated += delta;
      p.onDelta(accumulated);
      return;
    }
    // Some providers report mid-stream failures as an SSE `error` object.
    try {
      const json = JSON.parse(data);
      if (json?.error) streamError = json.error.message ?? String(json.error);
    } catch {
      /* ignore */
    }
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.push(decoder.decode(value, { stream: true }));
  }
  parser.push(decoder.decode());
  parser.flush();

  if (streamError && !accumulated) throw new LLMError(streamError);
  if (!accumulated) throw new LLMError('The model returned an empty response.');
  return accumulated;
}

/** Minimal non-streaming request used by the "Test Connection" button. */
export async function testConnection(config: ProviderConfig): Promise<TestConnectionResult> {
  try {
    assertConfigured(config);
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    const res = await fetch(endpoint(config), {
      method: 'POST',
      headers: headers(config),
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1,
        stream: false,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return { ok: false, error: await readError(res) };
    const json = await res.json().catch(() => ({}));
    return { ok: true, model: json?.model ?? config.model, latencyMs: Date.now() - started };
  } catch (e) {
    const err = e as Error;
    return { ok: false, error: err.name === 'AbortError' ? 'Request timed out after 20s.' : err.message };
  }
}

/**
 * Lists the models available to this key via the OpenAI-compatible
 * `GET {baseUrl}/models` endpoint (supported by DeepSeek, OpenAI,
 * SiliconFlow, OpenRouter, Ollama, LM Studio, vLLM, …).
 */
export async function listModels(config: Pick<ProviderConfig, 'apiKey' | 'baseUrl'>): Promise<ListModelsResult> {
  if (!config.baseUrl) return { ok: false, error: 'Enter a Base URL first.' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const hdrs: Record<string, string> = {};
    // Local servers often need no key; only send the header when one is set.
    if (config.apiKey.trim()) hdrs.Authorization = `Bearer ${config.apiKey.trim()}`;
    const res = await fetch(`${normalizeBaseUrl(config.baseUrl)}/models`, { headers: hdrs, signal: controller.signal });
    if (!res.ok) return { ok: false, error: await readError(res) };
    const models = parseModelList(await res.json().catch(() => null));
    if (!models.length) return { ok: false, error: 'The provider returned no models.' };
    return { ok: true, models };
  } catch (e) {
    const err = e as Error;
    return { ok: false, error: err.name === 'AbortError' ? 'Request timed out after 20s.' : `Network error: ${err.message}` };
  } finally {
    clearTimeout(timer);
  }
}

/** Accepts `{ data: [{ id }] }` (OpenAI), `{ models: [...] }` or a bare array; returns sorted unique IDs. */
export function parseModelList(json: unknown): string[] {
  const obj = json as { data?: unknown; models?: unknown } | null;
  const list = Array.isArray(json) ? json : Array.isArray(obj?.data) ? obj!.data : Array.isArray(obj?.models) ? obj!.models : [];
  const ids = (list as unknown[])
    .map((m) => (typeof m === 'string' ? m : (m as { id?: unknown; name?: unknown })?.id ?? (m as { name?: unknown })?.name))
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}
