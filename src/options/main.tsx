import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/tailwind.css';
import { SettingsForm } from './SettingsForm';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-6 flex items-center gap-3">
        <img src="/icons/icon-48.png" alt="" className="h-10 w-10" />
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Lucid</h1>
          <p className="text-sm text-slate-500">Polish your writing first, then translate it idiomatically.</p>
        </div>
      </header>
      <SettingsForm />
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        <h2 className="mb-2 font-semibold text-slate-800">How to use</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Select text on any page, then click the floating icon or press <kbd>Alt</kbd> + <kbd>T</kbd>.
          </li>
          <li>
            While typing in any input, textarea or rich-text editor, click the Lucid button that appears inside the field, or press <kbd>Ctrl/⌘</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd>, or tap{' '}
            <kbd>Space</kbd> three times quickly, to polish &amp; translate what you typed in place.
          </li>
        </ul>
      </section>
    </main>
  </StrictMode>,
);
