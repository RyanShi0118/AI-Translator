import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/tailwind.css';
import { SettingsForm } from '../options/SettingsForm';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="p-4">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/icons/icon-32.png" alt="" className="h-6 w-6" />
          <h1 className="text-base font-semibold text-slate-900">RefineTranslate</h1>
        </div>
        <button className="text-xs text-brand-600 hover:underline" onClick={() => chrome.runtime.openOptionsPage()}>
          Full settings ↗
        </button>
      </header>
      <SettingsForm compact />
      <p className="mt-3 text-center text-xs text-slate-500">
        Select text → <kbd>Alt+T</kbd> · In inputs → <kbd>Ctrl/⌘+Shift+F</kbd> or Space×3
      </p>
    </main>
  </StrictMode>,
);
