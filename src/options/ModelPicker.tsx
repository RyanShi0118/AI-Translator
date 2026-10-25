import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { loadCachedModels, saveCachedModels } from '../shared/settings';
import type { ListModelsResult, RuntimeRequest } from '../shared/types';

interface Props {
  id: string;
  value: string;
  placeholder: string;
  apiKey: string;
  baseUrl: string;
  inputClassName: string;
  onChange(model: string): void;
  onNotify(kind: 'success' | 'error', text: string): void;
}

const MAX_VISIBLE = 200;

/**
 * Free-text model field with a searchable dropdown filled from the
 * provider's `GET /models` endpoint. Typing a custom ID always works.
 */
export function ModelPicker(p: Props) {
  const [models, setModels] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Show the cached list for this Base URL straight away.
  useEffect(() => {
    let cancelled = false;
    loadCachedModels(p.baseUrl).then((m) => !cancelled && setModels(m));
    return () => {
      cancelled = true;
    };
  }, [p.baseUrl]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? models.filter((m) => m.toLowerCase().includes(q)) : models;
  }, [models, query]);

  useEffect(() => setActive(0), [query, open]);
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const res: ListModelsResult = await chrome.runtime.sendMessage({
        type: 'listModels',
        config: { apiKey: p.apiKey, baseUrl: p.baseUrl },
      } satisfies RuntimeRequest);
      if (!res.ok) {
        p.onNotify('error', `Couldn't load models — ${res.error}`);
        return;
      }
      setModels(res.models);
      await saveCachedModels(p.baseUrl, res.models);
      setQuery('');
      setOpen(true);
      p.onNotify('success', `Loaded ${res.models.length} model${res.models.length === 1 ? '' : 's'}.`);
    } catch (e) {
      p.onNotify('error', `Couldn't load models — ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const choose = (m: string) => {
    p.onChange(m);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && models.length) {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((i) => Math.min(i + 1, Math.min(filtered.length, MAX_VISIBLE) - 1));
    } else if (e.key === 'ArrowUp' && open) {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open && filtered[active]) {
      e.preventDefault();
      choose(filtered[active]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            id={p.id}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${p.id}-list`}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            className={p.inputClassName + ' font-mono' + (models.length ? ' pr-8' : '')}
            placeholder={p.placeholder}
            value={p.value}
            onChange={(e) => {
              p.onChange(e.target.value);
              setQuery(e.target.value);
              if (models.length) setOpen(true);
            }}
            onFocus={() => models.length && setOpen(true)}
            onKeyDown={onKeyDown}
          />
          {models.length > 0 && (
            <button
              type="button"
              tabIndex={-1}
              aria-label="Show models"
              className="absolute inset-y-0 right-1 my-auto flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              onClick={() => {
                setQuery('');
                setOpen((v) => !v);
              }}
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
              </svg>
            </button>
          )}
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          onClick={fetchModels}
          disabled={loading || !p.baseUrl}
          title="Fetch available models from {Base URL}/models"
        >
          {loading ? 'Loading…' : models.length ? 'Refresh' : 'Fetch models'}
        </button>
      </div>

      {open && models.length > 0 && (
        <ul
          id={`${p.id}-list`}
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {filtered.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">No matching models — the typed ID will be used as is.</li>}
          {filtered.slice(0, MAX_VISIBLE).map((m, i) => (
            <li
              key={m}
              role="option"
              aria-selected={m === p.value}
              className={
                'cursor-pointer truncate px-3 py-1.5 font-mono text-sm ' +
                (i === active ? 'bg-brand-50 text-brand-700 ' : 'text-slate-700 ') +
                (m === p.value ? 'font-semibold' : '')
              }
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(m);
              }}
              title={m}
            >
              {m}
            </li>
          ))}
          {filtered.length > MAX_VISIBLE && (
            <li className="px-3 py-1.5 text-xs text-slate-400">
              {filtered.length - MAX_VISIBLE} more — type to filter…
            </li>
          )}
        </ul>
      )}
      {models.length > 0 && !open && (
        <p className="mt-1 text-xs text-slate-400">{models.length} models available · type to search or pick from the list</p>
      )}
    </div>
  );
}
