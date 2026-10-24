import { useCallback, useEffect, useRef, useState } from 'react';
import { runRefineTranslate, type Job } from '../shared/client';
import { loadSettings, onSettingsChanged } from '../shared/settings';
import type { Settings } from '../shared/types';
import { InputJobBadge, type InputJobState } from './components/InputJobBadge';
import { LogoIcon } from './components/icons';
import { Popover, type PopoverState } from './components/Popover';
import { captureSelection, editableFromEvent, readEditable, replaceSelection, writeEditable, type SelectionSnapshot } from './dom';

const TRIPLE_SPACE_WINDOW_MS = 600;
const MAX_SOURCE_CHARS = 12_000;

interface PopoverSession {
  snap: SelectionSnapshot;
  targetLang: string;
  tone: string;
  state: PopoverState;
}

const emptyState = (): PopoverState => ({ status: 'streaming', stage: 'refining', refined: '', translation: '' });

export function App({ host }: { host: HTMLElement }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [trigger, setTrigger] = useState<{ x: number; y: number; snap: SelectionSnapshot } | null>(null);
  const [popover, setPopover] = useState<PopoverSession | null>(null);
  const [inputJob, setInputJob] = useState<InputJobState | null>(null);

  const popoverJob = useRef<Job | null>(null);
  const inputJobRef = useRef<Job | null>(null);
  const settingsRef = useRef<Settings | null>(null);
  const inputJobState = useRef<InputJobState | null>(null);
  settingsRef.current = settings;
  inputJobState.current = inputJob;

  useEffect(() => {
    loadSettings().then(setSettings);
    return onSettingsChanged(setSettings);
  }, []);

  const isFromUs = useCallback((e: Event) => e.composedPath().includes(host), [host]);

  // ───────────────────────── Selection popover ─────────────────────────

  const startPopoverJob = useCallback((snap: SelectionSnapshot, targetLang: string, tone: string) => {
    popoverJob.current?.cancel();
    setPopover({ snap, targetLang, tone, state: emptyState() });
    const update = (patch: Partial<PopoverState>) =>
      setPopover((prev) => (prev && prev.snap === snap ? { ...prev, state: { ...prev.state, ...patch } } : prev));
    popoverJob.current = runRefineTranslate(
      { text: snap.text.slice(0, MAX_SOURCE_CHARS), targetLang, tone },
      {
        onProgress: (p) => update({ ...p, status: 'streaming' }),
        onDone: (r) => update({ ...r, status: 'done' }),
        onError: (message) => update({ status: 'error', error: message }),
      },
    );
  }, []);

  const openPopover = useCallback(
    (snap: SelectionSnapshot) => {
      const s = settingsRef.current;
      setTrigger(null);
      startPopoverJob(snap, s?.defaultTargetLang ?? 'English', s?.defaultTone ?? 'Professional');
    },
    [startPopoverJob],
  );

  const closePopover = useCallback(() => {
    popoverJob.current?.cancel();
    popoverJob.current = null;
    setPopover(null);
  }, []);

  // ───────────────────────── Input polish & translate ─────────────────────────

  const startInputJob = useCallback((el: InputJobState['el']) => {
    if (inputJobState.current?.status === 'running' && inputJobState.current.el === el) return;
    inputJobRef.current?.cancel();
    const original = readEditable(el);
    const text = original.replace(/\s+$/, '');
    const id = Date.now();
    const base: InputJobState = { id, el, original, status: 'running', stage: 'refining', refined: '', translation: '', applied: 'original' };
    if (!text.trim()) {
      setInputJob({ ...base, status: 'error', error: 'Type something first, then trigger RefineTranslate.' });
      return;
    }
    setInputJob(base);
    const s = settingsRef.current;
    const update = (patch: Partial<InputJobState>) => setInputJob((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
    inputJobRef.current = runRefineTranslate(
      { text: text.slice(0, MAX_SOURCE_CHARS), targetLang: s?.defaultTargetLang ?? 'English', tone: s?.defaultTone ?? 'Professional' },
      {
        onProgress: (p) => update({ stage: p.stage }),
        onDone: (r) => {
          if (!el.isConnected) return update({ status: 'error', error: 'The input field disappeared before the translation finished.' });
          if (!r.translation) return update({ status: 'error', error: 'The model returned an empty translation.' });
          writeEditable(el, r.translation);
          update({ ...r, status: 'done', applied: 'translation' });
        },
        onError: (message) => update({ status: 'error', error: message }),
      },
    );
  }, []);

  const applyInputVersion = useCallback((which: InputJobState['applied']) => {
    const job = inputJobState.current;
    if (!job || !job.el.isConnected) return;
    const text = which === 'original' ? job.original : which === 'refined' ? job.refined : job.translation;
    writeEditable(job.el, text);
    setInputJob({ ...job, applied: which });
  }, []);

  const cancelInputJob = useCallback(() => {
    inputJobRef.current?.cancel();
    setInputJob(null);
  }, []);
  const dismissInputJob = useCallback(() => setInputJob(null), []);

  // ───────────────────────── Global listeners ─────────────────────────

  useEffect(() => {
    const spaceTimes: number[] = [];

    const onMouseUp = (e: MouseEvent) => {
      if (isFromUs(e) || e.button !== 0) return;
      // composedPath() is only available during dispatch, so capture the origin now.
      const origin = e.composedPath()[0] as Element;
      // Let the browser finalise the selection first.
      setTimeout(() => {
        if (!settingsRef.current?.selectionTrigger) return;
        const snap = captureSelection(origin);
        if (!snap) return setTrigger(null);
        setTrigger({ x: e.clientX, y: e.clientY, snap });
      }, 0);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (!isFromUs(e)) setTrigger(null);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isFromUs(e)) {
        if (e.key === 'Escape') closePopover();
        return;
      }
      if (e.isComposing) return; // never interfere with IME input

      // Alt+T: open popover for the current selection (e.code is layout-independent; Option+T on macOS types "†").
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyT') {
        const snap = captureSelection(e.composedPath()[0] as Element);
        if (snap) {
          e.preventDefault();
          e.stopPropagation();
          openPopover(snap);
        }
        return;
      }

      if (e.key === 'Escape') {
        setTrigger(null);
        closePopover();
        if (inputJobState.current?.status === 'running') cancelInputJob();
        return;
      }

      // Ctrl/Cmd+Shift+F inside an editable: polish & translate in place.
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.code === 'KeyF') {
        const el = editableFromEvent(e);
        if (el) {
          e.preventDefault();
          e.stopPropagation();
          startInputJob(el);
        }
        return;
      }

      // Space ×3 quickly inside an editable.
      if (e.key === ' ' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (!settingsRef.current?.tripleSpaceTrigger) return;
        const el = editableFromEvent(e);
        if (!el) return;
        const now = performance.now();
        spaceTimes.push(now);
        while (spaceTimes.length && now - spaceTimes[0] > TRIPLE_SPACE_WINDOW_MS) spaceTimes.shift();
        if (spaceTimes.length >= 3) {
          spaceTimes.length = 0;
          e.preventDefault(); // swallow the 3rd space; trailing whitespace is trimmed from the source anyway
          startInputJob(el);
        }
      } else if (e.key !== 'Shift') {
        spaceTimes.length = 0;
      }
    };

    const onScroll = () => setTrigger(null);

    document.addEventListener('mouseup', onMouseUp, true);
    document.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mouseup', onMouseUp, true);
      document.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [isFromUs, openPopover, closePopover, startInputJob, cancelInputJob]);

  // Cancel in-flight jobs if the content script is torn down.
  useEffect(
    () => () => {
      popoverJob.current?.cancel();
      inputJobRef.current?.cancel();
    },
    [],
  );

  return (
    <>
      {trigger && (
        <button
          type="button"
          aria-label="Refine & translate selection (Alt+T)"
          title="Refine & translate (Alt+T)"
          className="fixed flex h-7 w-7 animate-rt-fade-in items-center justify-center rounded-full border border-slate-200 bg-white text-brand-600 shadow-md transition hover:scale-110 hover:shadow-lg"
          style={{ left: Math.min(trigger.x + 10, window.innerWidth - 36), top: Math.min(trigger.y + 12, window.innerHeight - 36) }}
          onMouseDown={(e) => e.preventDefault() /* keep the page selection intact */}
          onClick={() => openPopover(trigger.snap)}
        >
          <LogoIcon className="h-4 w-4" />
        </button>
      )}

      {popover && (
        <Popover
          anchor={popover.snap.rect}
          source={popover.snap.text}
          targetLang={popover.targetLang}
          tone={popover.tone}
          state={popover.state}
          onTargetLang={(v) => startPopoverJob(popover.snap, v, popover.tone)}
          onTone={(v) => startPopoverJob(popover.snap, popover.targetLang, v)}
          onRegenerate={() => startPopoverJob(popover.snap, popover.targetLang, popover.tone)}
          onReplace={() => replaceSelection(popover.snap, popover.state.translation)}
          onClose={closePopover}
        />
      )}

      {inputJob && <InputJobBadge job={inputJob} onCancel={cancelInputJob} onApply={applyInputVersion} onDismiss={dismissInputJob} />}
    </>
  );
}
