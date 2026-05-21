import type { Config } from 'tailwindcss';
import {
  colorPrimitives,
  colorSemantic,
  fontFamily,
  fontSize,
  letterSpacing,
  spacing,
  borderRadius,
  boxShadow,
  transitionDuration,
  transitionTimingFunction,
} from '@proteticflow/shared';

/**
 * Tailwind CSS v4 config — ProteticFlow Design System v1.3.0
 * Fonte de verdade: packages/shared/src/tokens/
 * As CSS custom properties em globals.css seguem os mesmos valores.
 */
const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primitivos expostos como classes Tailwind (ex: bg-amber-500)
        amber:  colorPrimitives.amber,
        teal:   colorPrimitives.teal,
        cream:  colorPrimitives.cream,
        stone:  colorPrimitives.stone,
        ink:    colorPrimitives.ink,
        navy:   colorPrimitives.navy,

        // Semânticos — modo light (default; dark via CSS var automático)
        primary:     colorSemantic.light.primary,
        accent:      colorSemantic.light.accent,
        bg:          colorSemantic.light.bg,
        'bg-elevated': colorSemantic.light.bgElevated,
        'bg-subtle': colorSemantic.light.bgSubtle,
        'bg-muted':  colorSemantic.light.bgMuted,
        fg:          colorSemantic.light.fg,
        'fg-strong': colorSemantic.light.fgStrong,
        'fg-muted':  colorSemantic.light.fgMuted,
        'fg-subtle': colorSemantic.light.fgSubtle,
        border:      colorSemantic.light.border,
        ring:        colorSemantic.light.ring,
        destructive: colorSemantic.light.destructive,
        warning:     colorSemantic.light.warning,
        success:     colorSemantic.light.success,
        sidebar:     colorSemantic.light.sidebarBg,
      },
      fontFamily: {
        display: fontFamily.display,
        sans:    fontFamily.sans,
        mono:    fontFamily.mono,
      },
      fontSize,
      letterSpacing: {
        tight:  letterSpacing.tight,
        normal: letterSpacing.normal,
        wide:   letterSpacing.wide,
        caps:   letterSpacing.caps,
      },
      spacing,
      borderRadius: {
        xs:   borderRadius.xs,
        sm:   borderRadius.sm,
        md:   borderRadius.md,
        lg:   borderRadius.lg,
        xl:   borderRadius.xl,
        pill: borderRadius.pill,
        full: borderRadius.full,
      },
      boxShadow: {
        xs:    boxShadow.xs,
        sm:    boxShadow.sm,
        md:    boxShadow.md,
        lg:    boxShadow.lg,
        focus: boxShadow.focus,
      },
      transitionDuration: {
        instant: transitionDuration.instant,
        fast:    transitionDuration.fast,
        base:    transitionDuration.base,
        slow:    transitionDuration.slow,
        route:   transitionDuration.route,
      },
      transitionTimingFunction: {
        'out-expressive': transitionTimingFunction.outExpressive,
        'in-fast':        transitionTimingFunction.inFast,
        standard:         transitionTimingFunction.standard,
      },
    },
  },
  plugins: [],
};

export default config;
