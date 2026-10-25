type P = { className?: string };
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Prism: raw text in, refined + translated spectrum out. Matches the extension icon. */
export const LogoIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 14.5l7-2.5" stroke="currentColor" strokeWidth="2" />
    <path d="M14.5 10.5l7.5-3.5" stroke="#f59e0b" strokeWidth="2" />
    <path d="M15 12.5l7-.5" stroke="#10b981" strokeWidth="2" />
    <path d="M15 14.5l7 2" stroke="#0ea5e9" strokeWidth="2" />
    <path d="M12 4l6 13H6z" stroke="currentColor" strokeWidth="2" fill="#fff" />
  </svg>
);
export const CopyIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h8" />
  </svg>
);
export const CheckIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M5 12l5 5L20 7" />
  </svg>
);
export const CloseIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const RefreshIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
  </svg>
);
export const ReplaceIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M4 7h11l-3-3M20 17H9l3 3" />
  </svg>
);
export const GearIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);
export const Spinner = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={'animate-spin ' + (className ?? '')} fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);
