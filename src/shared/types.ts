import type { ProviderId } from './constants';

export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface Settings {
  provider: ProviderId;
  /** Each provider keeps its own key / URL / model so switching presets never loses data. */
  providers: Record<ProviderId, ProviderConfig>;
  defaultTargetLang: string;
  defaultTone: string;
  temperature: number;
  /** Show the floating trigger icon after selecting text. */
  selectionTrigger: boolean;
  /** Press Space three times quickly inside an input to trigger polish & translate. */
  tripleSpaceTrigger: boolean;
}

/** Request sent from a content script / extension page to the background over a Port. */
export interface StartMessage {
  type: 'start';
  text: string;
  targetLang: string;
  tone: string;
}

export interface AbortMessage {
  type: 'abort';
}

export type ClientMessage = StartMessage | AbortMessage;

export type Stage = 'refining' | 'translating';

export type ServerMessage =
  | { type: 'progress'; stage: Stage; refined: string; translation: string }
  | { type: 'done'; refined: string; translation: string }
  | { type: 'error'; message: string };

/** One-shot runtime messages (chrome.runtime.sendMessage). */
export type RuntimeRequest =
  | { type: 'testConnection'; config: ProviderConfig }
  | { type: 'openOptions' };

export type TestConnectionResult = { ok: true; model: string; latencyMs: number } | { ok: false; error: string };
