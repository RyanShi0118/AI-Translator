import { PORT_NAME } from '../shared/constants';
import { activeProvider, loadSettings } from '../shared/settings';
import { splitOutput } from '../shared/stream';
import type { ClientMessage, RuntimeRequest, ServerMessage } from '../shared/types';
import { streamRefineTranslate, testConnection } from './llm';

/**
 * Every LLM request runs here, in the service worker, so it is not subject to
 * the host page's CORS / CSP rules. Results stream back over a long-lived Port.
 * One port == one job; disconnecting the port aborts the request.
 */
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== PORT_NAME) return;
  let controller: AbortController | null = null;

  const send = (msg: ServerMessage) => {
    try {
      port.postMessage(msg);
    } catch {
      /* port already closed */
    }
  };

  port.onDisconnect.addListener(() => controller?.abort());

  port.onMessage.addListener(async (msg: ClientMessage) => {
    if (msg.type === 'abort') {
      controller?.abort();
      return;
    }
    if (msg.type !== 'start') return;

    controller?.abort();
    const current = (controller = new AbortController());
    try {
      const settings = await loadSettings();
      // Throttle UI updates to one per animation-ish frame to keep the page smooth.
      let last = 0;
      let pending: string | null = null;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const flush = () => {
        timer = undefined;
        if (pending === null || current.signal.aborted) return;
        last = Date.now();
        send({ type: 'progress', ...splitOutput(pending) });
        pending = null;
      };
      const raw = await streamRefineTranslate({
        config: activeProvider(settings),
        text: msg.text,
        targetLang: msg.targetLang || settings.defaultTargetLang,
        tone: msg.tone || settings.defaultTone,
        temperature: settings.temperature,
        signal: current.signal,
        onDelta: (acc) => {
          pending = acc;
          if (timer) return;
          timer = setTimeout(flush, Math.max(0, 40 - (Date.now() - last)));
        },
      });
      clearTimeout(timer);
      if (current.signal.aborted) return;
      const { refined, translation } = splitOutput(raw, true);
      send({ type: 'done', refined, translation });
    } catch (e) {
      if (current.signal.aborted) return;
      send({ type: 'error', message: (e as Error).message || String(e) });
    }
  });
});

chrome.runtime.onMessage.addListener((msg: RuntimeRequest, _sender, sendResponse) => {
  if (msg.type === 'testConnection') {
    testConnection(msg.config).then(sendResponse);
    return true; // async response
  }
  if (msg.type === 'openOptions') {
    chrome.runtime.openOptionsPage();
  }
  return false;
});

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason !== 'install') return;
  const settings = await loadSettings();
  if (!activeProvider(settings).apiKey) chrome.runtime.openOptionsPage();
});
