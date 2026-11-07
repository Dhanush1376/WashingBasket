/** Brand palette sampled directly from WashingBasket-logo.png. */
export const brand = {
  orange: '#FE8701',
  red: '#D30D24',
  navy: '#013E86',
} as const;

/**
 * Washing Basket's modern, soft brand shades (inspired by the logo without being harsh):
 * - softBlue: '#54B6F8' (logo towel & sparkles)
 * - softOrange: '#FFA742' (logo basket & warmth)
 * - softGreen: '#62D487' (fresh clean & delivered)
 * - softRed: '#F87C87' (logo cloth red & cancelled)
 * - softGold: '#FED843' (warm clean yellow)
 */
export const brandShades = {
  blue: '#54B6F8',
  blueTint: '#EBF6FE',
  orange: '#FFA742',
  orangeTint: '#FFF4E8',
  green: '#62D487',
  greenTint: '#EBF9F0',
  red: '#F87C87',
  redTint: '#FEF0F2',
  gold: '#FED843',
  goldTint: '#FFFBEA',
} as const;

export const colors = {
  ...brand,
  background: '#FFFFFF',
  subtle: '#F4F5F7',
  surface: '#FFFFFF',
  ink: '#0A1C3E',
  inkSoft: '#5B6475',
  inkMuted: '#667085',
  line: '#E3E6EB',
  lineStrong: '#CBD5E1',
  navyPressed: '#002F68',
  navyTint: '#EEF3FB',
  orangePressed: '#E67A00',
  /** Primary buttons: matches the rich brand orange from the logo. */
  cta: brand.orange,
  ctaPressed: '#E67A00',
  ctaTint: '#FFF1E0',
  orangeTint: '#FFF1E0',
  danger: '#C8102E',
  dangerTint: brandShades.redTint,
  /** Parrot green: bright and unmistakably positive. */
  success: '#12AD2B',
  successTint: brandShades.greenTint,
  /** Resting fill of text fields; focus turns them white with a navy edge. */
  fieldFill: '#F4F2EB',
  disabled: '#ECEEF2',
  disabledInk: '#717A8A',
} as const;

export const fonts = {
  // Inter: crisp, precise and highly legible at every size.
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  /** Plus Jakarta Sans: bold geometric display font */
  display: 'PlusJakartaSans_800ExtraBold',
  displayBold: 'PlusJakartaSans_700Bold',
  /** Rounded, heavy: echoes the logo's rounded cloth ends. Brand wordmark only. */
  wordmark: 'Nunito_900Black',
} as const;

/** Fields and buttons share one soft corner; the sign-in sheet is rounder. */
export const radius = { sm: 0, md: 0, lg: 0, field: 12, sheet: 24, pill: 0, button: 12 } as const;

/** One type scale for the whole sign-in and onboarding flow. */
export const type = {
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.6, color: colors.ink },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  label: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, letterSpacing: 0.1, color: colors.inkSoft },
  input: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  helper: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.inkMuted },
  button: { fontFamily: fonts.semibold, fontSize: 15, letterSpacing: 0.2 },
  legal: { fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 17, color: colors.inkMuted },
} as const;

/** Height shared by every text field and button in the sign-in flow. */
export const CONTROL_HEIGHT = 52;

/* ───────────────────────── Customer app (dashboard and its screens) ─────────────────────────
 * Soft warm canvas, rounded modular cards, pill filters and round icon buttons. Colours stay
 * within the brand: navy for structure, orange for actions, warm yellow for highlights.
 */
export const app = {
  canvas: '#FFFFFF', // clean pure white behind everything, no cream
  card: '#FFFFFF',
  cream: '#F4F5F7', // clean neutral secondary surfaces
  creamDeep: '#E5E7EB',
  yellow: brandShades.orange, // soft warm brand orange (#FFA742)
  yellowSoft: brandShades.orangeTint,
  navyDeep: '#012A5C', // drawer and dark cards: the brand navy, deepened
  navySoft: brandShades.blueTint,
  warning: '#B97800',
  warningTint: '#FFF4D9',
  hairline: '#E5E7EB',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const shape = { card: 26, tile: 20, inner: 16, chip: 999, round: 999 } as const;

export const text = {
  display: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.6, color: colors.ink },
  h1: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.4, color: colors.ink },
  h2: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, letterSpacing: -0.2, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  bodyStrong: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.ink },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.inkMuted },
  label: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.2, color: colors.inkSoft },
  amount: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, letterSpacing: -0.3, color: colors.ink, fontVariant: ['tabular-nums' as const] },
} as const;

/** One soft elevation level for floating cards; most surfaces rely on colour, not shadow. */
export const elevation = {
  card: {
    shadowColor: '#14213D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
} as const;
