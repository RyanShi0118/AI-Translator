import { useCallback, useEffect, useRef, useState } from 'react';
import { CopyButton } from '../content/components/CopyButton';
import { CloseIcon, GearIcon } from '../content/components/icons';
import { Section, withCurrent } from '../content/components/Popover';
import { runRefineTranslate, type Job } from '../shared/client';
import { LANGUAGES, TONES } from '../shared/constants';
import { activeProvider, loadSettings } from '../shared/settings';
import type { RuntimeRequest, Settings, Stage } from '../shared/types';

const DRAFT_KEY = 'popupDraft';
const MAX_SOURCE_CHARS = 12_000;

interface Draft {
  text: string;
  targetLang: string;
  tone: string;
  refined: string;
  translation: string;
}

type Status = 'idle' | 'streaming' | 'done' | 'error';

const isMac = navigator.platform.toUpperCase().includes('MAC');

/** Text currently selected in the active tab, or '' (e.g. on chrome:// pages where content scripts can't run). */
async function getPageSelection(): Promise<string> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id == null) return '';
    const text: string = await chrome.tabs.sendMessage(tab.id, { type: 'getSelection' } satisfies RuntimeRequest);
    return typeof text === 'string' ? text.trim() : '';
  } catch {
    return '';
  }
}

export function Translator() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [text, setText] = useState('');
  const [targetLang, setTargetLang] = useState('English');
  const [tone, setTone] = useState('Professional');
  const [status, setStatus] = useState<Status>('idle');
  const [stage, setStage] = useState<Stage>('refining');
  const [refined, setRefined] = useState('');
  const [translation, setTranslation] = useState('');
  const [error, setError] = useState('');
  const job = useRef<Job | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const restored = useRef(false);

  const translate = useCallback((source: string, lang: string, t: string) => {
    const trimmed = source.trim();
    if (!trimmed) return;
    job.current?.cancel();
    setStatus('streaming');
    setStage('refining');
    setRefined('');
    setTranslation('');
    setError('');
    job.current = runRefineTranslate(
      { text: trimmed.slice(0, MAX_SOURCE_CHARS), targetLang: lang, tone: t },
      {
        onProgress: (p) => {
          setStage(p.stage);
          setRefined(p.refined);
          setTranslation(p.translation);
        },
        onDone: (r) => {
          setRefined(r.refined);
          setTranslation(r.translation);
          setStatus('done');
        },
        onError: (message) => {
          setError(message);
          setStatus('error');
        },
      },
    );
  }, []);

  // Restore the last draft, then prefer the page selection (translated immediately) if there is one.
  useEffect(() => {
    (async () => {
      const [s, data, selection] = await Promise.all([loadSettings(), chrome.storage.local.get(DRAFT_KEY), getPageSelection()]);
      setSettings(s);
      const draft = data[DRAFT_KEY] as Draft | undefined;
      const lang = draft?.targetLang ?? s.defaultTargetLang;
      const t = draft?.tone ?? s.defaultTone;
      setTargetLang(lang);
      setTone(t);
      if (selection && selection !== draft?.text && activeProvider(s).apiKey) {
        setText(selection);
        translate(selection, lang, t);
      } else if (draft) {
        setText(draft.text);
        setRefined(draft.refined);
        setTranslation(draft.translation);
        if (draft.translation) setStatus('done');
      } else if (selection) {
        setText(selection);
      }
      restored.current = true;
      inputRef.current?.focus();
      inputRef.current?.select();
    })();
    return () => job.current?.cancel();
  }, [translate]);

  // Persist the draft so closing the popup never loses work.
  useEffect(() => {
    if (!restored.current || status === 'streaming') return;
    const draft: Draft = { text, targetLang, tone, refined, translation };
    chrome.storage.local.set({ [DRAFT_KEY]: draft });
  }, [text, targetLang, tone, refined, translation, status]);

  const run = () => translate(text, targetLang, tone);
  const streaming = status === 'streaming';
  const configured = settings ? !!activeProvider(settings).apiKey : true;

  return (
    <div className="flex max-h-[580px] flex-col">
      <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <img src="/icons/icon-32.png" alt="" className="h-5 w-5" />
        <h1 className="mr-auto text-sm font-semibold text-slate-900">Lucid</h1>
        <select
          className="rt-select max-w-[150px]"
          value={targetLang}
          title="Target language"
          onChange={(e) => {
            setTargetLang(e.target.value);
            if (text.trim() && status !== 'idle') translate(text, e.target.value, tone);
          }}
        >
          {withCurrent(LANGUAGES, targetLang).map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
        <select
          className="rt-select"
          value={tone}
          title="Tone"
          onChange={(e) => {
            setTone(e.target.value);
            if (text.trim() && status !== 'idle') translate(text, targetLang, e.target.value);
          }}
        >
          {withCurrent(TONES, tone).map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <button className="rt-btn" title="Settings" aria-label="Settings" onClick={() => chrome.runtime.openOptionsPage()}>
          <GearIcon className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {!configured && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <span>Add your API key to start translating.</span>
            <button className="rt-btn bg-white" onClick={() => chrome.runtime.openOptionsPage()}>
              Open settings
            </button>
          </div>
        )}

        <div className="rounded-lg border border-slate-300 bg-white transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
          <textarea
            ref={inputRef}
            rows={5}
            className="block max-h-56 min-h-[96px] w-full resize-y rounded-t-lg bg-transparent px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            placeholder="Type or paste text to polish & translate…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                run();
              }
            }}
          />
          <div className="flex items-center gap-2 border-t border-slate-100 px-2 py-1.5">
            <span className="text-xs text-slate-400">
              {text.length > 0 ? `${text.length.toLocaleString()} chars` : `${isMac ? '⌘' : 'Ctrl'}+Enter to translate`}
            </span>
            {text && (
              <button
                className="rt-btn"
                onClick={() => {
                  job.current?.cancel();
                  setText('');
                  setRefined('');
                  setTranslation('');
                  setError('');
                  setStatus('idle');
                  inputRef.current?.focus();
                }}
              >
                <CloseIcon className="h-3.5 w-3.5" /> Clear
              </button>
            )}
            <button
              className="ml-auto rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
              disabled={!text.trim() || !configured}
              onClick={streaming ? () => { job.current?.cancel(); setStatus('done'); } : run}
            >
              {streaming ? 'Stop' : status === 'idle' ? 'Translate' : 'Retranslate'}
            </button>
          </div>
        </div>

        {status === 'error' && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <p className="font-semibold">Something went wrong</p>
            <p className="mt-1 whitespace-pre-wrap break-words">{error}</p>
            <div className="mt-2 flex gap-2">
              <button className="rt-btn bg-white" onClick={run}>
                Retry
              </button>
              <button className="rt-btn bg-white" onClick={() => chrome.runtime.openOptionsPage()}>
                Open settings
              </button>
            </div>
          </div>
        )}

        {(status === 'streaming' || status === 'done') && (
          <>
            <Section
              title="Refined Original"
              subtitle="原文润色"
              text={refined}
              active={streaming && stage === 'refining'}
              pending={streaming && !refined}
              actions={<CopyButton text={refined} />}
            />
            <Section
              title="Idiomatic Translation"
              subtitle="地道译文"
              text={translation}
              emphasis
              active={streaming && stage === 'translating'}
              pending={streaming && !translation}
              waitingLabel={stage === 'refining' ? 'Waiting for refinement…' : undefined}
              actions={
                <>
                  <CopyButton text={translation} />
                  <button className="rt-btn" disabled={streaming || !refined} onClick={() => setText(refined)} title="Put the refined text in the input box">
                    Edit refined
                  </button>
                </>
              }
            />
          </>
        )}

        {status === 'idle' && !text && (
          <p className="px-1 text-center text-xs leading-relaxed text-slate-400">
            Tip: select text on a page and press <kbd>Alt+T</kbd>, or click the Lucid button inside any text field.
          </p>
        )}
      </div>
    </div>
  );
}
