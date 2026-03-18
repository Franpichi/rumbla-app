// Design System Tokens — Rumbla
// Source of truth: CLAUDE.md section 4
// Never hardcode these values elsewhere in the codebase.

// ---------------------------------------------------------------------------
// Colors — Dark Mode (primary)
// ---------------------------------------------------------------------------
export const colors = {
  bgBase:     '#0D0F14',
  bgSurface:  '#141720',
  bgElevated: '#1C2030',
  bgOverlay:  '#252A3A',

  textPrimary:   '#F0F2F8',
  textSecondary: '#8B93A8',
  textDisabled:  '#4A5168',

  accent:     '#FF5C35',
  accentDim:  'rgba(255, 92, 53, 0.12)',
  accentGlow: 'rgba(255, 92, 53, 0.25)',

  teal:    '#00E5CC',
  tealDim: 'rgba(0, 229, 204, 0.1)',

  blue: '#4D8EFF',

  hexOwn:     '#FF5C35',
  hexFriend:  '#4D8EFF',
  hexEnemy:   '#FF3B6E',
  hexNeutral: '#1C2030',

  borderSubtle: '#1F2435',
  borderStrong: '#2D3350',
} as const;

// ---------------------------------------------------------------------------
// Colors — Light Mode
// ---------------------------------------------------------------------------
export const colorsLight = {
  bgBase:     '#F2F3F7',
  bgSurface:  '#FFFFFF',
  bgElevated: '#ECEEF4',
  bgOverlay:  '#E2E5ED',

  textPrimary:   '#0D0F14',
  textSecondary: '#4A5168',
  textDisabled:  '#8B93A8',

  accent: '#FF4D1F',
  teal:   '#00CCBA',
  blue:   '#3D7FFF',

  borderSubtle: '#DDE0EA',
  borderStrong: '#C2C8D8',
} as const;

// ---------------------------------------------------------------------------
// Typography — Inter (Barlow Condensed Black for logo on web only)
// ---------------------------------------------------------------------------
export const typography = {
  fontFamily: 'Inter',

  // Font sizes
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  xxl:  32,

  // Font weights
  light:    '300',
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
} as const;

// ---------------------------------------------------------------------------
// Spacing — 8px grid
// ---------------------------------------------------------------------------
export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
} as const;

// ---------------------------------------------------------------------------
// Border Radius
// ---------------------------------------------------------------------------
export const radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  pill: 999,
} as const;

// ---------------------------------------------------------------------------
// H3 / Map Constants
// ---------------------------------------------------------------------------
export const H3_RESOLUTION = 10; // ~50m hex radius. Validate with GPS testing (candidate: 11).
export const MAX_HEX_RENDER_COUNT = 2000; // Viewport-based loading — never render more than this.
