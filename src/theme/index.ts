/**
 * Annum theme — generated from the Figma variables (Annum / Primitives, Color, Dimension).
 * Copy to src/theme/index.ts. Import ONLY from here in components. Dark mode only in v1.
 */

export const color = {
  // Surfaces
  bgBase: '#111E19',            // app background
  bgDeep: '#070C0A',            // behind sheets
  bgSurface: '#1C2A25',         // cards, sheets, grouped lists
  bgRaised: '#273731',          // chips, inputs, secondary buttons
  bgField: '#144134',           // Today — on track
  bgFieldCaution: '#633E16',    // Today — heads up
  bgSheet: '#F4F8F6',           // light sheet on Today

  // Text
  textPrimary: '#EEF8F4',
  textSecondary: '#B2CBC1',
  textOnLight: '#111E19',
  textOnLightSecondary: '#505F59',
  textOnCautionSecondary: '#DDCAB6',
  textInverse: '#111E19',

  // Borders
  borderSubtle: '#273731',
  borderStrong: '#354740',
  borderOnLight: '#D9E0DD',

  // Actions
  actionPrimary: '#EEF8F4',
  actionOnPrimary: '#111E19',
  actionField: '#144134',
  actionOnField: '#EEF8F4',
  actionCaution: '#633E16',

  // Buckets — reserved meanings, never decorative
  bucket: {
    tax: '#E1B75C',
    bills: '#6DB3E4',
    runway: '#69D6AA',
    invest: '#BE95EC',
    free: '#FFB08B',
  },

  // Status
  statusOk: '#69D6AA',
  statusHeadsUp: '#FFB340',
  statusDestructive: '#FF7A6B', // delete/reset only — never for money states

  // Overlays & tints
  overlaySubtle: 'rgba(238,248,244,0.12)',     // status pill
  overlaySelected: 'rgba(238,248,244,0.14)',   // selected segment
  overlayMuted: 'rgba(238,248,244,0.30)',      // inactive steps, grabber
  overlaySelectedOnLight: 'rgba(17,30,25,0.08)',
  tintOk: 'rgba(105,214,170,0.12)',
  tintHeadsUp: 'rgba(99,62,22,0.55)',
  tintOkOnLight: 'rgba(105,214,170,0.20)',
  tintHeadsUpOnLight: 'rgba(99,62,22,0.14)',
} as const;

export type BucketKey = keyof typeof color.bucket;

export const space = { 2: 2, 4: 4, 8: 8, 12: 12, 16: 16, 20: 20, 24: 24, 28: 28, 32: 32, 40: 40, 48: 48, 72: 72 } as const;

export const layout = {
  screenMargin: 24,
  todayMargin: 28,
  titleGap: 20,
  buttonHeight: 50,
  chipHeight: 36,
  touchTarget: 44,
  tabBarBottomOffset: 28,
} as const;

export const radius = { sm: 8, md: 14, lg: 16, sheet: 28, full: 999 } as const;

/**
 * Type uses the iOS system font (SF Pro). Sizes are the defaults at the standard
 * Dynamic Type setting; enable allowFontScaling and cap with maxFontSizeMultiplier
 * (Hero/Display: 1.3, everything else: 2.0) so layouts don't break.
 * All money uses fontVariant: ['tabular-nums'].
 */
export const type = {
  hero:       { fontSize: 72, lineHeight: 78, fontWeight: '600', letterSpacing: -2 },
  display:    { fontSize: 56, lineHeight: 60, fontWeight: '600', letterSpacing: -1.4 },
  title1:     { fontSize: 34, lineHeight: 40, fontWeight: '600', letterSpacing: -0.4 },
  title2:     { fontSize: 28, lineHeight: 34, fontWeight: '600', letterSpacing: -0.3 },
  sentence:   { fontSize: 24, lineHeight: 32, fontWeight: '400' },
  headline:   { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body:       { fontSize: 17, lineHeight: 24, fontWeight: '400' },
  bodyMedium: { fontSize: 17, lineHeight: 24, fontWeight: '500' },
  callout:    { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  subhead:    { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  footnote:   { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption:    { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  tabLabel:   { fontSize: 10, lineHeight: 12, fontWeight: '500' }, // native tab bar only (extension)
} as const;

export const money = { fontVariant: ['tabular-nums'] as const };

/** Motion — use with react-native-reanimated. Reduce Motion: skip count-ups, crossfade 150ms. */
export const motion = {
  tap: 100,
  fade: 150,
  resize: 250,
  push: 300,
  count: 400,
  field: 600,
  easeOutExpo: [0.16, 1, 0.3, 1] as const, // Easing.bezier(...)
} as const;

/** SF Symbols (expo-symbols) used in the app. */
export const symbols = {
  back: 'chevron.left',
  forward: 'chevron.right',
  check: 'checkmark',
  close: 'xmark',
  lock: 'lock.fill',
  faceId: 'faceid',
  settings: 'person.crop.circle',
  share: 'square.and.arrow.up',
  headsUp: 'exclamationmark.triangle',
  tabToday: 'sun.max',
  tabTodaySelected: 'sun.max.fill',
  tabReview: 'list.bullet',
  tabMoney: 'tray.2',
  tabMoneySelected: 'tray.2.fill',
} as const;

/** Haptics (expo-haptics). Never on heads-up states. */
export const haptics = {
  confirm: 'impactLight',   // split confirmed, week reviewed, transfer moved
  select: 'selection',      // chip taps, segmented control
} as const;

export const theme = { color, space, layout, radius, type, money, motion, symbols, haptics };
export default theme;
