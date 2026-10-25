import { PORT_NAME } from './constants';
import type { ServerMessage, Stage, StartMessage } from './types';

export interface JobHandlers {
  onProgress?: (p: { stage: Stage; refined: string; translation: string }) => void;
  onDone?: (r: { refined: string; translation: string }) => void;
  onError?: (message: string) => void;
}

export interface Job {
  cancel(): void;
}

/** Opens a long-lived port to the background worker and runs one refine+translate job. */
export function runRefineTranslate(req: Omit<StartMessage, 'type'>, handlers: JobHandlers): Job {
  let finished = false;
  let port: chrome.runtime.Port;
  try {
    port = chrome.runtime.connect({ name: PORT_NAME });
  } catch {
    // Happens when the extension was reloaded/updated while this page stayed open.
    queueMicrotask(() => handlers.onError?.('Lucid was updated. Please reload this page.'));
    return { cancel() {} };
  }

  const finish = () => {
    finished = true;
    try {
      port.disconnect();
    } catch {
      /* noop */
    }
  };

  port.onMessage.addListener((msg: ServerMessage) => {
    if (finished) return;
    if (msg.type === 'progress') handlers.onProgress?.(msg);
    else if (msg.type === 'done') {
      finish();
      handlers.onDone?.(msg);
    } else if (msg.type === 'error') {
      finish();
      handlers.onError?.(msg.message);
    }
  });
  port.onDisconnect.addListener(() => {
    if (finished) return;
    finished = true;
    handlers.onError?.(chrome.runtime.lastError?.message ?? 'Connection to the extension was lost.');
  });
  port.postMessage({ type: 'start', ...req } satisfies StartMessage);

  return {
    cancel() {
      if (finished) return;
      try {
        port.postMessage({ type: 'abort' });
      } catch {
        /* noop */
      }
      finish();
    },
  };
}
