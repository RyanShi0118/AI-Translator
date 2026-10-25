import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { LANGUAGES, TONES } from '../../shared/constants';
import type { Stage } from '../../shared/types';
import { clamp } from '../dom';
import { CopyButton } from './CopyButton';
import { CloseIcon, GearIcon, LogoIcon, RefreshIcon, ReplaceIcon, Spinner } from './icons';

export interface PopoverState {
  status: 'streaming' | 'done' | 'error';
  stage: Stage;
  refined: string;
  translation: string;
  error?: string;
}

interface Props {
  anchor: DOMRect;
  source: string;
  targetLang: string;
  tone: string;
  state: PopoverState;
  onTargetLang(v: string): void;
  onTone(v: string): void;
  onRegenerate(): void;
  onReplace(): boolean;
  onClose(): void;
}

const WIDTH = 440;
const MARGIN = 12;

function initialPosition(anchor: DOMRect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(WIDTH, vw - MARGIN * 2);
  const x = clamp(anchor.left, MARGIN, vw - width - MARGIN);
  // Prefer below the selection; flip above when there is not enough room.
  const below = anchor.bottom + 8;
  const y = below + 260 < vh ? below : Math.max(MARGIN, anchor.top - 8 - Math.min(420, vh * 0.6));
  return { x, y };
}

export function Popover(p: Props) {
  const [pos, setPos] = useState(() => initialPosition(p.anchor));
  const [replaced, setReplaced] = useState(false);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => setPos(initialPosition(p.anchor)), [p.anchor]);
  useEffect(() => setReplaced(false), [p.source]);

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button,select')) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const w = cardRef.current?.offsetWidth ?? WIDTH;
    setPos({
      x: clamp(e.clientX - drag.current.dx, 0, window.innerWidth - w),
      y: clamp(e.clientY - drag.current.dy, 0, window.innerHeight - 40),
    });
  };
  const onPointerUp = () => (drag.current = null);

  const { state } = p;
  const streaming = state.status === 'streaming';

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label="Lucid"
      className="fixed flex animate-rt-fade-in flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
      style={{ left: pos.x, top: pos.y, width: `min(${WIDTH}px, calc(100vw - ${MARGIN * 2}px))`, maxHeight: 'min(560px, calc(100vh - 24px))' }}
    >
      {/* Top bar: drag handle + quick controls */}
      <div
        className="flex cursor-move select-none items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <LogoIcon className="h-4 w-4 shrink-0 text-brand-600" />
        <select className="rt-select min-w-0 flex-1" value={p.targetLang} onChange={(e) => p.onTargetLang(e.target.value)} title="Target language">
          {withCurrent(LANGUAGES, p.targetLang).map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
        <select className="rt-select min-w-0" value={p.tone} onChange={(e) => p.onTone(e.target.value)} title="Tone">
          {withCurrent(TONES, p.tone).map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <button className="rt-btn" onClick={p.onRegenerate} title="Regenerate" aria-label="Regenerate">
          <RefreshIcon className={'h-3.5 w-3.5 ' + (streaming ? 'animate-spin' : '')} />
        </button>
        <button
          className="rt-btn"
          onClick={() => chrome.runtime.sendMessage({ type: 'openOptions' })}
          title="Settings"
          aria-label="Settings"
        >
          <GearIcon className="h-3.5 w-3.5" />
        </button>
        <button className="rt-btn" onClick={p.onClose} title="Close (Esc)" aria-label="Close">
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {state.status === 'error' ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <p className="font-semibold">Something went wrong</p>
            <p className="mt-1 whitespace-pre-wrap break-words">{state.error}</p>
            <div className="mt-2 flex gap-2">
              <button className="rt-btn bg-white" onClick={p.onRegenerate}>
                Retry
              </button>
              <button className="rt-btn bg-white" onClick={() => chrome.runtime.sendMessage({ type: 'openOptions' })}>
                Open settings
              </button>
            </div>
          </div>
        ) : (
          <>
            <Section
              title="Refined Original"
              subtitle="原文润色"
              text={state.refined}
              active={streaming && state.stage === 'refining'}
              pending={streaming && !state.refined}
              actions={<CopyButton text={state.refined} />}
            />
            <Section
              title="Idiomatic Translation"
              subtitle="地道译文"
              text={state.translation}
              emphasis
              active={streaming && state.stage === 'translating'}
              pending={streaming && !state.translation}
              waitingLabel={state.stage === 'refining' ? 'Waiting for refinement…' : undefined}
              actions={
                <>
                  <CopyButton text={state.translation} />
                  <button
                      className="rt-btn"
                      disabled={streaming || !state.translation || replaced}
                      onClick={() => setReplaced(p.onReplace())}
                    >
                      <ReplaceIcon className="h-3.5 w-3.5" />
                      {replaced ? 'Replaced' : 'Replace Selection'}
                    </button>
                </>
              }
            />
          </>
        )}
      </div>
    </div>
  );
}

export function Section(props: {
  title: string;
  subtitle: string;
  text: string;
  active: boolean;
  pending: boolean;
  emphasis?: boolean;
  waitingLabel?: string;
  actions: ReactNode;
}) {
  return (
    <section className={'rounded-lg border p-3 ' + (props.emphasis ? 'border-brand-100 bg-brand-50/60' : 'border-slate-100 bg-white')}>
      <header className="mb-1.5 flex items-center gap-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{props.title}</h3>
        <span className="text-xs text-slate-400">{props.subtitle}</span>
        {props.active && <Spinner className="h-3 w-3 text-brand-500" />}
      </header>
      {props.pending ? (
        <div className="space-y-1.5 py-1" aria-busy="true">
          {props.waitingLabel ? (
            <p className="text-xs text-slate-400">{props.waitingLabel}</p>
          ) : (
            <>
              <div className="h-3 w-11/12 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200" />
            </>
          )}
        </div>
      ) : (
        <p
          className={
            'whitespace-pre-wrap break-words text-sm leading-relaxed ' + (props.emphasis ? 'text-slate-900' : 'text-slate-700')
          }
        >
          {props.text}
          {props.active && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-brand-500 align-middle" />}
        </p>
      )}
      <footer className="-mb-1 mt-1.5 flex justify-end gap-0.5 whitespace-nowrap">{props.actions}</footer>
    </section>
  );
}

export function withCurrent(list: readonly string[], current: string): string[] {
  return list.includes(current) ? [...list] : [current, ...list];
}
