import { createRoot } from 'react-dom/client';
import styles from './content.css?inline';
import { App } from './App';

const HOST_TAG = 'refine-translate-root';

function mount() {
  // Guard against double injection (e.g. extension reload + manual re-inject).
  if (document.querySelector(HOST_TAG)) return;

  const host = document.createElement(HOST_TAG);
  // Inline styles beat any page CSS targeting our element.
  host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;';
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = styles;
  shadow.appendChild(style);

  const container = document.createElement('div');
  container.className = 'rt-root';
  shadow.appendChild(container);

  (document.body ?? document.documentElement).appendChild(host);
  createRoot(container).render(<App host={host} />);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
else mount();
