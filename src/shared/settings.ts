import { PROVIDER_PRESETS, type ProviderId } from './constants';
import type { ProviderConfig, Settings } from './types';

const STORAGE_KEY = 'settings';

export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function createDefaultSettings(): Settings {
  const providers = {} as Record<ProviderId, ProviderConfig>;
  for (const p of PROVIDER_PRESETS) providers[p.id] = { apiKey: '', baseUrl: p.baseUrl, model: p.model };
  return {
    provider: 'deepseek',
    providers,
    defaultTargetLang: 'English',
    defaultTone: 'Professional',
    temperature: 0.3,
    selectionTrigger: true,
    tripleSpaceTrigger: true,
  };
}

/** Deep-merges stored data over defaults so new fields added in updates get sane values. */
export function mergeSettings(stored: Partial<Settings> | undefined): Settings {
  const defaults = createDefaultSettings();
  if (!stored) return defaults;
  const providers = { ...defaults.providers };
  for (const id of Object.keys(providers) as ProviderId[]) {
    providers[id] = { ...providers[id], ...(stored.providers?.[id] ?? {}) };
  }
  return { ...defaults, ...stored, providers };
}

export async function loadSettings(): Promise<Settings> {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return mergeSettings(data[STORAGE_KEY] as Partial<Settings> | undefined);
}

export async function saveSettings(settings: Settings): Promise<void> {
  const providers = { ...settings.providers };
  for (const id of Object.keys(providers) as ProviderId[]) {
    const p = providers[id];
    providers[id] = { apiKey: p.apiKey.trim(), baseUrl: normalizeBaseUrl(p.baseUrl), model: p.model.trim() };
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: { ...settings, providers } });
}

export function onSettingsChanged(cb: (s: Settings) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && changes[STORAGE_KEY]) cb(mergeSettings(changes[STORAGE_KEY].newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export function activeProvider(settings: Settings): ProviderConfig {
  return settings.providers[settings.provider];
}

const MODEL_CACHE_KEY = 'modelCache';

/** Model lists are cached per Base URL so the picker works instantly on reopen. */
export async function loadCachedModels(baseUrl: string): Promise<string[]> {
  const data = await chrome.storage.local.get(MODEL_CACHE_KEY);
  const cache = (data[MODEL_CACHE_KEY] ?? {}) as Record<string, string[]>;
  return cache[normalizeBaseUrl(baseUrl)] ?? [];
}

export async function saveCachedModels(baseUrl: string, models: string[]): Promise<void> {
  const data = await chrome.storage.local.get(MODEL_CACHE_KEY);
  const cache = (data[MODEL_CACHE_KEY] ?? {}) as Record<string, string[]>;
  cache[normalizeBaseUrl(baseUrl)] = models;
  await chrome.storage.local.set({ [MODEL_CACHE_KEY]: cache });
}
