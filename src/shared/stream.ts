import { TRANSLATION_DELIMITER } from '../constants/prompt';
import type { Stage } from './types';

/**
 * Incremental Server-Sent Events parser. Feed it raw decoded chunks; it emits
 * the payload of every complete `data:` line. Handles lines split across
 * chunk boundaries and CRLF line endings.
 */
export function createSSEParser(onData: (data: string) => void) {
  let buffer = '';
  return {
    push(chunk: string) {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) handleLine(line);
    },
    flush() {
      if (buffer) handleLine(buffer);
      buffer = '';
    },
  };
  function handleLine(line: string) {
    if (!line.startsWith('data:')) return; // ignore comments (": keep-alive"), event:, id:, blank
    onData(line.slice(5).trimStart());
  }
}

/** Extracts the text delta from an OpenAI-compatible chat.completion.chunk payload. */
export function extractDelta(payload: string): string {
  try {
    const json = JSON.parse(payload);
    return json?.choices?.[0]?.delta?.content ?? '';
  } catch {
    return '';
  }
}

export interface SplitResult {
  stage: Stage;
  refined: string;
  translation: string;
}

/**
 * Splits the accumulated model output into its two stages. While streaming,
 * a partially-received delimiter at the tail (e.g. "===TRANS") is hidden so
 * it never flashes in the "Refined" panel.
 *
 * With `final` set and no delimiter present (the model ignored the format),
 * the whole output is treated as the translation so it can still be used.
 */
export function splitOutput(text: string, final = false): SplitResult {
  const idx = text.indexOf(TRANSLATION_DELIMITER);
  if (idx !== -1) {
    return {
      stage: 'translating',
      refined: text.slice(0, idx).trim(),
      translation: text.slice(idx + TRANSLATION_DELIMITER.length).trim(),
    };
  }
  if (final) return { stage: 'translating', refined: '', translation: text.trim() };
  return { stage: 'refining', refined: trimPartialDelimiter(text).trim(), translation: '' };
}

function trimPartialDelimiter(text: string): string {
  for (let len = Math.min(TRANSLATION_DELIMITER.length - 1, text.length); len > 0; len--) {
    if (text.endsWith(TRANSLATION_DELIMITER.slice(0, len))) return text.slice(0, -len);
  }
  return text;
}
