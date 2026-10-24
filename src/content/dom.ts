/** DOM helpers for reading/writing page selections and editable fields. */

export type TextField = HTMLInputElement | HTMLTextAreaElement;
export type EditableElement = TextField | HTMLElement;

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'url', 'email', 'tel', '']);

export function isTextField(el: Element | null): el is TextField {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(el.type) && !el.readOnly && !el.disabled;
  return false;
}

/** Returns the outermost contenteditable root containing `el`, if any. */
export function contentEditableRoot(el: Element | null): HTMLElement | null {
  if (!(el instanceof HTMLElement) || !el.isContentEditable) return null;
  let root: HTMLElement = el;
  while (root.parentElement?.isContentEditable) root = root.parentElement;
  return root;
}

/** Resolves the editable element an event originated from (works across open shadow roots). */
export function editableFromEvent(e: Event): EditableElement | null {
  const origin = (e.composedPath()[0] as Element | undefined) ?? (e.target as Element | null);
  if (!origin || !(origin instanceof Element)) return null;
  if (isTextField(origin)) return origin;
  return contentEditableRoot(origin);
}

export function readEditable(el: EditableElement): string {
  return isTextField(el) ? el.value : el.innerText;
}

/**
 * Replaces the entire content of an editable element. Prefers
 * `execCommand('insertText')` because it keeps the browser's native undo
 * stack (Ctrl+Z) and is understood by React/Vue/ProseMirror-style editors.
 */
export function writeEditable(el: EditableElement, text: string): void {
  el.focus();
  if (isTextField(el)) {
    el.select();
    const ok = document.execCommand('insertText', false, text);
    if (!ok || el.value !== text) setNativeValue(el, text);
    return;
  }
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(el);
  sel?.removeAllRanges();
  sel?.addRange(range);
  const ok = document.execCommand('insertText', false, text);
  if (!ok) {
    el.textContent = text;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  }
}

/** Sets a value in a way frameworks with controlled inputs (React) will notice. */
function setNativeValue(el: TextField, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** A captured selection that can be replaced later, after focus has moved to our UI. */
export type SelectionSnapshot =
  | { kind: 'range'; text: string; rect: DOMRect; range: Range; editableRoot: HTMLElement | null }
  | { kind: 'field'; text: string; rect: DOMRect; el: TextField; start: number; end: number };

export function captureSelection(activeHint?: Element | null): SelectionSnapshot | null {
  const active = activeHint ?? deepActiveElement();
  if (isTextField(active) && active.selectionStart != null && active.selectionEnd != null) {
    const { selectionStart: start, selectionEnd: end } = active;
    const text = active.value.slice(start, end);
    if (text.trim()) return { kind: 'field', text, rect: active.getBoundingClientRect(), el: active, start, end };
  }
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const text = sel.toString();
  if (!text.trim()) return null;
  const range = sel.getRangeAt(0).cloneRange();
  const node = range.commonAncestorContainer;
  const el = node instanceof Element ? node : node.parentElement;
  return { kind: 'range', text, rect: range.getBoundingClientRect(), range, editableRoot: contentEditableRoot(el) };
}

export function replaceSelection(snap: SelectionSnapshot, text: string): boolean {
  if (snap.kind === 'field') {
    const { el } = snap;
    if (!el.isConnected) return false;
    el.focus();
    el.setSelectionRange(snap.start, snap.end);
    if (!document.execCommand('insertText', false, text)) {
      el.setRangeText(text, snap.start, snap.end, 'end');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return true;
  }
  const { range } = snap;
  if (!range.startContainer.isConnected) return false;
  if (snap.editableRoot) {
    snap.editableRoot.focus();
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    if (document.execCommand('insertText', false, text)) return true;
  }
  // Static page content: swap the DOM range for a plain text node.
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  return true;
}

function deepActiveElement(): Element | null {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return el;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API can be blocked (non-secure origin, permissions policy). Fallback:
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
