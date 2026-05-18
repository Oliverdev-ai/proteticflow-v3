/**
 * ProteticFlow Design System v1.3.0 — Typography Tokens
 */

export const fontFamily = {
  display: ['Instrument Serif', 'Iowan Old Style', 'Times New Roman', 'serif'] as string[],
  sans:    ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'] as string[],
  mono:    ['JetBrains Mono', 'SF Mono', 'Menlo', 'Consolas', 'monospace'] as string[],
} as const;

export const fontSize = {
  '12': ['0.75rem',    { lineHeight: '1rem' }],
  '13': ['0.8125rem',  { lineHeight: '1.125rem' }],
  '14': ['0.875rem',   { lineHeight: '1.25rem' }],
  '16': ['1rem',       { lineHeight: '1.5rem' }],
  '18': ['1.125rem',   { lineHeight: '1.625rem' }],
  '22': ['1.375rem',   { lineHeight: '1.875rem' }],
  '28': ['1.75rem',    { lineHeight: '2.125rem' }],
  '36': ['2.25rem',    { lineHeight: '2.5rem' }],
  '48': ['3rem',       { lineHeight: '3.25rem' }],
  '64': ['4rem',       { lineHeight: '4.25rem' }],
} as const;

export const letterSpacing = {
  tight:  '-0.022em',
  normal: '0',
  wide:   '0.04em',
  caps:   '0.08em',
} as const;
