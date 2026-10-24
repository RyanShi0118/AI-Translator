import { useEffect, useRef, useState } from 'react';
import { LANGUAGES, PROVIDER_PRESETS, TONES, type ProviderId } from '../shared/constants';
import { createDefaultSettings, loadSettings, normalizeBaseUrl, saveSettings } from '../shared/settings';
import type { ProviderConfig, RuntimeRequest, Settings, TestConnectionResult } from '../shared/types';

type Toast = { kind: 'success' | 'error' | 'info'; text: string } | null;

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 disabled:text-slate-500';
const labelCls = 'mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500';

export function SettingsForm({ compact = false }: { compact?: boolean }) {
  const [settings, setSettings] = useState<Settings>(createDefaultSettings);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setLoaded(true);
    });
  }, []);

  const notify = (t: NonNullable<Toast>, ms = 4000) => {
    clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  };

  const preset = PROVIDER_PRESETS.find((p) => p.id === settings.provider)!;
  const provider = settings.providers[settings.provider];

  const update = (patch: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    setDirty(true);
  };
  const updateProvider = (patch: Partial<ProviderConfig>) => {
    setSettings((s) => ({
      ...s,
      providers: { ...s.providers, [s.provider]: { ...s.providers[s.provider], ...patch } },
    }));
    setDirty(true);
  };

  const onProviderChange = (id: ProviderId) => {
    const next = PROVIDER_PRESETS.find((p) => p.id === id)!;
    setSettings((s) => {
      const cfg = s.providers[id];
      // Fixed-URL presets always use the official endpoint; others keep user edits.
      const baseUrl = next.editableBaseUrl ? cfg.baseUrl || next.baseUrl : next.baseUrl;
      return { ...s, provider: id, providers: { ...s.providers, [id]: { ...cfg, baseUrl, model: cfg.model || next.model } } };
    });
    setDirty(true);
  };

  const onSave = async () => {
    await saveSettings(settings);
    setSettings(await loadSettings()); // reflect normalisation (trimmed keys, URLs)
    setDirty(false);
    notify({ kind: 'success', text: 'Settings saved.' }, 2500);
  };

  const onTest = async () => {
    setTesting(true);
    try {
      const config = { ...provider, baseUrl: normalizeBaseUrl(provider.baseUrl) };
      const res: TestConnectionResult = await chrome.runtime.sendMessage({ type: 'testConnection', config } satisfies RuntimeRequest);
      if (res.ok) notify({ kind: 'success', text: `Connected to ${res.model} in ${res.latencyMs} ms.` });
      else notify({ kind: 'error', text: `Connection failed — ${res.error}` }, 8000);
    } catch (e) {
      notify({ kind: 'error', text: `Connection failed — ${(e as Error).message}` }, 8000);
    } finally {
      setTesting(false);
    }
  };

  if (!loaded) return <div className="p-6 text-sm text-slate-500">Loading…</div>;

  const card = 'rounded-xl border border-slate-200 bg-white shadow-sm ' + (compact ? 'p-4' : 'p-5');

  return (
    <div className="space-y-4">
      <section className={card}>
        <h2 className="mb-4 text-sm font-semibold text-slate-800">API Provider</h2>
        <div className="space-y-3">
          <div>
            <label className={labelCls} htmlFor="rt-provider">
              Provider preset
            </label>
            <select id="rt-provider" className={inputCls} value={settings.provider} onChange={(e) => onProviderChange(e.target.value as ProviderId)}>
              {PROVIDER_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label className={labelCls} htmlFor="rt-key">
                API key
              </label>
              {preset.keyUrl && (
                <a className="text-xs text-brand-600 hover:underline" href={preset.keyUrl} target="_blank" rel="noreferrer">
                  Get a key ↗
                </a>
              )}
            </div>
            <div className="relative">
              <input
                id="rt-key"
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                placeholder="sk-…"
                className={inputCls + ' pr-16 font-mono'}
                value={provider.apiKey}
                onChange={(e) => updateProvider({ apiKey: e.target.value })}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-2 my-auto h-7 rounded px-2 text-xs text-slate-500 hover:bg-slate-100"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">Stored only in this browser (chrome.storage.local). Sent only to the Base URL below.</p>
          </div>

          <div>
            <label className={labelCls} htmlFor="rt-url">
              Base URL
            </label>
            <input
              id="rt-url"
              className={inputCls + ' font-mono'}
              placeholder="https://example.com/v1"
              disabled={!preset.editableBaseUrl}
              value={provider.baseUrl}
              onChange={(e) => updateProvider({ baseUrl: e.target.value })}
              onBlur={() => updateProvider({ baseUrl: normalizeBaseUrl(provider.baseUrl) })}
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="rt-model">
              Model ID
            </label>
            <input
              id="rt-model"
              className={inputCls + ' font-mono'}
              placeholder={preset.model || 'model-name'}
              value={provider.model}
              onChange={(e) => updateProvider({ model: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className={card}>
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Defaults</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="rt-lang">
              Target language
            </label>
            <select id="rt-lang" className={inputCls} value={settings.defaultTargetLang} onChange={(e) => update({ defaultTargetLang: e.target.value })}>
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="rt-tone">
              Tone
            </label>
            <select id="rt-tone" className={inputCls} value={settings.defaultTone} onChange={(e) => update({ defaultTone: e.target.value })}>
              {TONES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        {!compact && (
          <div className="mt-4 space-y-3">
            <div>
              <label className={labelCls} htmlFor="rt-temp">
                Temperature: {settings.temperature.toFixed(1)}
              </label>
              <input
                id="rt-temp"
                type="range"
                min={0}
                max={1.5}
                step={0.1}
                className="w-full accent-brand-600"
                value={settings.temperature}
                onChange={(e) => update({ temperature: Number(e.target.value) })}
              />
            </div>
            <Toggle
              label="Show floating icon after selecting text"
              checked={settings.selectionTrigger}
              onChange={(v) => update({ selectionTrigger: v })}
            />
            <Toggle
              label="Triple-Space inside inputs triggers polish & translate"
              checked={settings.tripleSpaceTrigger}
              onChange={(v) => update({ tripleSpaceTrigger: v })}
            />
          </div>
        )}
      </section>

      <div className="flex items-center gap-2">
        <button
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
          onClick={onSave}
          disabled={!dirty}
        >
          {dirty ? 'Save' : 'Saved'}
        </button>
        <button
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          onClick={onTest}
          disabled={testing}
        >
          {testing ? 'Testing…' : 'Test Connection'}
        </button>
      </div>

      {toast && (
        <div
          role="status"
          className={
            'fixed bottom-4 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 animate-rt-fade-in rounded-lg px-4 py-2 text-sm text-white shadow-lg ' +
            (toast.kind === 'success' ? 'bg-emerald-600' : toast.kind === 'error' ? 'bg-rose-600' : 'bg-slate-800')
          }
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-slate-700">
      <span>{label}</span>
      <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
