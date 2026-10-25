# Lucid: Polish & Translate

<img src="public/icons/icon-128.png" width="64" align="right" alt="Lucid icon">

A Chrome / Edge extension (Manifest V3) that translates in two stages. It works like a prism: raw text goes in, gets clarified, and comes out in another language.

1. **Refine:** the source text is first rewritten in its *original* language to fix grammar, filler words, fragmented phrasing and logical gaps.
2. **Translate:** the refined text is then translated idiomatically into your target language, in the tone you pick.

Both stages come back in a single streamed completion, separated by `===TRANSLATION===`. You see them fill in live.

## Features

- **Popup translator:** click the toolbar icon or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd>, then type or paste text and press <kbd>Ctrl/⌘</kbd>+<kbd>Enter</kbd>. If text is selected on the page, the popup opens pre-filled with it and translates right away. Your last text and result are kept between openings.
- **Selection popover:** select text on any page, then click the floating icon or press <kbd>Alt</kbd>+<kbd>T</kbd>. A draggable card streams the **Refined Original (原文润色)** and the **Idiomatic Translation (地道译文)**. It has Copy and Replace Selection buttons, a target-language picker, a tone picker and a Regenerate button.
- **In-place input polish:** while typing in any `<input>`, `<textarea>` or `contenteditable` editor, click the small Lucid button that appears inside the field, or press <kbd>Ctrl/⌘</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> or tap <kbd>Space</kbd> three times quickly. Your text is replaced with the translation, and a small badge offers **Undo**, **View refined** and **Use refined instead**. The native Ctrl+Z undo stack is preserved.
- **Bring your own key:** works with any OpenAI-compatible API. There are presets for DeepSeek, OpenAI, SiliconFlow, OpenRouter and Custom. Each provider keeps its own key, URL and model, and a **Test Connection** button checks them. **Fetch models** loads the available models from `{Base URL}/models` into a searchable picker. You can still type any model ID by hand.
- **Isolated UI:** everything on the page renders in a Shadow DOM, so page CSS can't break the extension and its Tailwind styles never leak into the page.

## Architecture

```
src/
  constants/prompt.ts     Static system prompt + delimiter + user-message builder
  background/             Service worker: all LLM fetches (no page CORS/CSP), SSE parsing
  content/                Content script: Shadow DOM host, selection popover, input badge
  popup/                  Toolbar popup translator (input box → streamed result)
  options/                Settings page (React + Tailwind)
  shared/                 Settings storage, port protocol types, stream parsing
```

- **Network:** content scripts open a `chrome.runtime.connect` port per job. The background worker streams the request, splits the accumulated output on the delimiter and posts throttled `progress` messages, then a `done` or `error` message. Closing the port aborts the request.
- **Prompt caching:** the system prompt is byte-for-byte static, and the target language, tone and source text all go in the user message. Providers such as DeepSeek can then cache the shared prefix automatically.
- **Prompt-injection hardening:** the source text is wrapped in `<source_text>`, and any `</source_text>` tag inside it is neutralised.
- **Storage:** settings and API keys live in `chrome.storage.local`. Keys are only read by the background worker and are only sent to the Base URL you configure.

## Development

```bash
npm install
npm run build     # typecheck + build to dist/
npm test          # unit tests (stream parsing, prompt, settings)
npm run dev       # rebuild pages/background on change (run `vite build -c vite.content.config.ts --watch` for the content script)
```

To load the extension, open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**, click **Load unpacked** and select `dist/`.

The content script is built separately as a single IIFE (`vite.content.config.ts`) because MV3 content scripts can't be ES modules. Its Tailwind CSS is inlined and injected into the shadow root, with `rem` units converted to `px` so pages that change the root font size don't distort the UI.

## Releases

The **Release** workflow (`.github/workflows/release.yml`) tests, builds and zips the extension, then publishes a GitHub release with `lucid-vX.Y.Z.zip` attached. Bump `version` in `public/manifest.json`, then either push a `vX.Y.Z` tag or run the workflow from the Actions tab with that version.

Icons are rendered from `public/icons/icon.svg` with `node scripts/render-icons.mjs` (requires Playwright).
