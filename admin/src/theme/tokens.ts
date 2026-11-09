/**
 * The admin portal's design tokens come straight from the customer app's theme
 * (mobile/src/theme/index.ts), so a colour or radius changed there changes here too.
 * They are written onto :root as CSS variables once, at start-up.
 */
import { app, brand, colors, space } from '@customer/theme';

/**
 * Admin system — derived from the customer product palette, but tuned for dense work.
 * HEX reference: canvas #F8FAFC, surface #FFFFFF, ink #0A1C3E, muted #8C93A1,
 * brand navy #013E86, action orange #FFA742, success #12AD2B, warning #B97800,
 * danger #C8102E. Keeping these here makes the operational UI auditable and consistent.
 */
export const CANVAS = '#F8F9FA';
export const CHARCOAL = '#0A1C3E';
export const STONE = '#FFFFFF';
export const STONE_EDGE = '#CBD5E1';

export const tokens: Record<string, string> = {
  '--orange': brand.orange,
  '--orange-pressed': colors.orangePressed,
  '--orange-tint': colors.orangeTint,
  '--navy': brand.navy,
  '--navy-deep': app.navyDeep,
  '--navy-soft': app.navySoft,
  '--red': brand.red,
  '--ink': colors.ink,
  '--ink-soft': colors.inkSoft,
  '--ink-muted': colors.inkMuted,
  '--line': '#E2E8F0',
  '--line-strong': '#CBD5E1',
  '--hairline': '#CBD5E1',
  '--canvas': CANVAS,
  '--card': app.card,
  '--sidebar': '#FFFFFF',
  '--subtle': colors.subtle,
  '--field': colors.fieldFill,
  '--charcoal': CHARCOAL,
  '--stone': STONE,
  '--stone-edge': STONE_EDGE,
  '--success': colors.success,
  '--success-ink': '#0D7A21',
  '--success-tint': colors.successTint,
  '--danger': colors.danger,
  '--danger-tint': colors.dangerTint,
  '--warning': app.warning,
  '--warning-tint': app.warningTint,
  '--disabled': colors.disabled,
  '--disabled-ink': colors.disabledInk,
  /* Container radius matching the hero stat cards and customer app design system */
  '--radius-card': '14px',
  '--radius-tile': '12px',
  '--radius-inner': '10px',
  '--radius-field': '10px',
  '--radius-sheet': '20px',
  '--space-xs': `${space.xs}px`,
  '--space-sm': `${space.sm}px`,
  '--space-md': `${space.md}px`,
  '--space-lg': `${space.lg}px`,
  '--space-xl': `${space.xl}px`,
  '--space-xxl': `${space.xxl}px`,
  '--space-xxxl': `${space.xxxl}px`,
};

export function applyTokens(root: HTMLElement = document.documentElement) {
  Object.entries(tokens).forEach(([k, v]) => root.style.setProperty(k, v));
}

export { brand, colors, app };
