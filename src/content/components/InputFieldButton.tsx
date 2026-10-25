import type { EditableElement } from '../dom';
import { LogoIcon } from './icons';
import { useElementRect } from './InputJobBadge';

const SIZE = 24;

/**
 * Small Lucid button pinned inside the focused text field. Clicking it runs
 * polish & translate on the field's text in place (same as Ctrl/⌘+Shift+F).
 */
export function InputFieldButton({ el, onTrigger }: { el: EditableElement; onTrigger(): void }) {
  const rect = useElementRect(el);
  // Too small to host a button without covering the text, or scrolled off-screen.
  if (rect.width < 120 || rect.height < 20) return null;
  if (rect.bottom < 0 || rect.top > window.innerHeight) return null;

  // Single-line fields: vertically centred at the right edge. Multi-line: bottom-right corner.
  const singleLine = rect.height < 48;
  const top = singleLine ? rect.top + (rect.height - SIZE) / 2 : rect.bottom - SIZE - 6;
  // Multi-line fields keep clear of the textarea resize handle in the corner.
  const left = rect.right - SIZE - (singleLine ? 6 : 18);

  return (
    <button
      type="button"
      aria-label="Polish & translate this field (Ctrl/⌘+Shift+F)"
      title="Lucid: polish & translate this field (Ctrl/⌘+Shift+F)"
      className="fixed flex animate-rt-fade-in items-center justify-center rounded-full border border-slate-200 bg-white/95 text-brand-600 opacity-70 shadow-sm transition hover:scale-110 hover:opacity-100 hover:shadow-md"
      style={{ top, left, width: SIZE, height: SIZE }}
      // Keep focus (and the caret) in the field while clicking.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onTrigger}
    >
      <LogoIcon className="h-3.5 w-3.5" />
    </button>
  );
}
