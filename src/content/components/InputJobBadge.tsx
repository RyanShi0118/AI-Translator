import { useEffect, useState } from 'react';
import type { Stage } from '../../shared/types';
import { clamp, type EditableElement } from '../dom';
import { CopyButton } from './CopyButton';
import { CheckIcon, CloseIcon, LogoIcon, Spinner } from './icons';

export interface InputJobState {
  id: number;
  el: EditableElement;
  original: string;
  status: 'running' | 'done' | 'error';
  stage: Stage;
  refined: string;
  translation: string;
  error?: string;
  /** Which text is currently in the field after completion. */
  applied: 'translation' | 'refined' | 'original';
}

interface Props {
  job: InputJobState;
  onCancel(): void;
  onApply(which: InputJobState['applied']): void;
  onDismiss(): void;
}

/** Tracks the element's on-screen rect so the badge follows scrolling/resizing. */
function useElementRect(el: Element) {
  const [rect, setRect] = useState(() => el.getBoundingClientRect());
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setRect(el.getBoundingClientRect()));
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      ro.disconnect();
    };
  }, [el]);
  return rect;
}

export function InputJobBadge({ job, onCancel, onApply, onDismiss }: Props) {
  const rect = useElementRect(job.el);
  const [expanded, setExpanded] = useState(false);

  // Auto-hide the success badge unless the user is interacting with it.
  useEffect(() => {
    if (job.status !== 'done' || expanded) return;
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [job.status, expanded, job.applied, onDismiss]);

  // Sit just above the field's top-right corner (so it never covers the next
  // form control); fall back to below the field near the top of the viewport.
  const width = expanded ? 360 : undefined;
  const vh = window.innerHeight;
  const spaceAbove = rect.top - 14;
  const spaceBelow = vh - rect.bottom - 14;
  const needed = expanded ? 240 : 40;
  const above = spaceAbove >= needed || (spaceAbove > spaceBelow && spaceAbove >= 40);
  const vertical = above
    ? { bottom: clamp(vh - rect.top + 6, 8, vh - 48) }
    : { top: clamp(rect.bottom + 6, 8, vh - 48) };
  const maxHeight = Math.max(above ? spaceAbove : spaceBelow, 120);
  const right = clamp(window.innerWidth - rect.right, 8, window.innerWidth - 200);

  return (
    <div
      className="fixed animate-rt-fade-in overflow-y-auto rounded-lg border border-slate-200 bg-white text-xs text-slate-700 shadow-lg"
      style={{ ...vertical, right, width, maxHeight, maxWidth: 'calc(100vw - 16px)' }}
      role="status"
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        {job.status === 'running' && (
          <>
            <Spinner className="h-3.5 w-3.5 text-brand-600" />
            <span>{job.stage === 'refining' ? 'Refining…' : 'Translating…'}</span>
            <button className="rt-btn ml-1" onClick={onCancel} aria-label="Cancel">
              Cancel
            </button>
          </>
        )}
        {job.status === 'error' && (
          <>
            <span className="max-w-[300px] truncate text-rose-600" title={job.error}>
              {job.error}
            </span>
            <button className="rt-btn" onClick={onDismiss} aria-label="Dismiss">
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        {job.status === 'done' && (
          <>
            {job.applied === 'original' ? (
              <LogoIcon className="h-3.5 w-3.5 text-slate-500" />
            ) : (
              <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
            )}
            <span className="mr-1">
              {job.applied === 'translation' ? 'Translated' : job.applied === 'refined' ? 'Refined original applied' : 'Restored original'}
            </span>
            {job.applied !== 'original' ? (
              <button className="rt-btn" onClick={() => onApply('original')}>
                Undo
              </button>
            ) : (
              <button className="rt-btn" onClick={() => onApply('translation')}>
                Redo
              </button>
            )}
            <button className="rt-btn" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
              {expanded ? 'Hide refined' : 'View refined'}
            </button>
            <button className="rt-btn ml-auto" onClick={onDismiss} aria-label="Dismiss">
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
      {job.status === 'done' && expanded && (
        <div className="border-t border-slate-100 p-2">
          <p className="mb-1 font-semibold uppercase tracking-wide text-slate-500">
            Refined Original <span className="font-normal normal-case tracking-normal text-slate-400">原文润色</span>
          </p>
          <p className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-sm text-slate-800">
            {job.refined || <em className="text-slate-400">(the model returned no refined text)</em>}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            <CopyButton text={job.refined} />
            {job.refined && job.applied !== 'refined' && (
              <button className="rt-btn" onClick={() => onApply('refined')}>
                Use refined instead
              </button>
            )}
            {job.applied !== 'translation' && (
              <button className="rt-btn" onClick={() => onApply('translation')}>
                Use translation
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
