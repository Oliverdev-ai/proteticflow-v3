/**
 * ProteticFlow Design System v1.3.0 — Motion Tokens
 * Sempre respeitar prefers-reduced-motion: reduce
 */

export const transitionDuration = {
  instant: '80ms',
  fast:    '120ms',
  base:    '180ms',
  slow:    '240ms',
  route:   '360ms',
} as const;

export const transitionTimingFunction = {
  outExpressive: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  inFast:        'cubic-bezier(0.4, 0, 1, 1)',
  standard:      'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;
