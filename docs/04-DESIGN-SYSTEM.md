# 04 — Design system (React Native)

Tokens: `src-starter/theme.ts` → copy to `src/theme/index.ts`. Components import from `@/theme`; never use raw hex, numbers for spacing/radius, or durations outside the theme. Figma component pages are the visual truth.

## Foundations

- **Type:** iOS system font (SF Pro) — no font files. Eight sizes (Hero 72, Display 56, Title 1 34, Title 2 28, Sentence 24, Body/Headline 17, Callout/Subhead 15, Footnote/Caption 13), plus **Sentence Compact 20/26** for the hero sentences on small screens (01c, Figma `Annum/Sentence Compact`). Support **Dynamic Type** with the caps in `theme.ts`; money uses `tabular-nums`.
- **Hero numbers** always sit inside a sentence ("You can spend … $1,000 … until your next invoice…").
- **Space:** 4pt scale. Screen margin 24, Today field margin 28, 20 between a title and its content. Respect safe areas.
- **Radius:** cards 16, inputs 14, sheets 28, buttons/pills/chips full.
- **Icons:** **SF Symbols** via `expo-symbols` (names in `theme.symbols`), weight regular, sized to the adjacent text, colored with text tokens.
- **Mark:** five-arc ring (Tax, Bills, Runway, Invest, Free — clockwise from 12, fixed proportions 14/15/40/12/11%) with a Today dot. Build with `react-native-svg`; min 16pt. App icon: layered for iOS 26 (default, dark, tinted, clear) — export layers from the Figma **Brand — Logo** page into Icon Composer.
- **Navigation chrome:** use the **native** tab bar (Expo Router native tabs) with SF Symbols `sun.max` (Today), `list.bullet` (Review), `tray.2` (Money) — filled when selected where a fill exists — and native sheets, so iOS 26 Liquid Glass comes for free. Don't build a custom glass tab bar. Nav buttons (Back, Cancel, Finish later, Skip) are 17pt, native header metrics. Where custom glass is needed, use Expo's glass-effect module; never put glass on content.
- **Haptics:** light impact on confirmations; selection on chips/segments; none on heads-up.
- **Compact screens (height < 700pt, e.g. iPhone SE):** Today hero drops from Hero (72) to Display (56), the sentence becomes one line ("until Oct 13 · about $50 a day"), and the field top padding shrinks to 44. See Figma frame `01c`.

## Components (build in this order — atoms first)

| Component | Variants / props | Key specs |
| --- | --- | --- |
| **BucketDot** | bucket: tax · bills · runway · invest · free · none | 12pt circle; `none` is an invisible spacer so titles align in mixed lists |
| **BucketBar** | segments `{bucket, amount}[]` | 16pt tall, 3pt gaps, radius sm; proportional widths; zero buckets hidden; widths animate (Reanimated, 250ms) |
| **Button** | primary · field · caution · secondary · destructive · quiet · quietDestructive; disabled | 50pt, full width, radius full, Body Medium. Primary on dark, Field on the light sheet, Caution on heads-up Today. One per screen. Destructive (Figma 66:1713) = bgRaised fill, `statusDestructive` text (4.9:1); quietDestructive = the same text, no fill (S10). Pressed 0.8 opacity, disabled 0.4. |
| **Chip** | category · tax; selected | 36pt visual with `hitSlop` to 44pt. Tax: outline `bucket.tax`; selected = filled + `checkmark` symbol. Selection haptic. |
| **Toggle** | on | Native `Switch` with `trackColor` on = `statusOk` |
| **StatusPill** | on-track · heads-up · estimate | overlaySubtle fill, 7pt dot, Caption. Long-press opens the scenario switcher (demo mode) |
| **ProfileButton** | — | Figma 117:1581. 40pt circle (`size.profileButton`), overlaySubtle fill, SF Symbol `person.fill` 18pt Medium (`size.profileGlyph`), textPrimary; 44pt tap area (hitSlop 2); VoiceOver "Settings". In every Today header; opens Settings |
| **StepIndicator** | step, total | 22×4 segments; filled textPrimary, rest overlayMuted; `accessibilityLabel="Step N of M"` |
| **GuardrailNote** | tone: info · heads-up; surface: dark · light | radius md, 12/16 padding, 8pt dot; dark text on light surfaces |
| **BucketRow** | card · split; onPress (card) | Figma 54:587. Dot + Body Medium name + Footnote note + Headline amount. Card: bgSurface, radius lg, 16 padding (Money; the Invest card opens S6 when it holds money). Split: a flat 60pt row with the amount in a raised chip (radius md, 12/4 padding): plain (tap to start changing the split) or editable with a 1pt statusOk outline and the numeric keypad (09b); Free is never editable |
| **LedgerRow** | light · dark; bucket?; chevron | Figma 56:21. Hairline bottom border, 16pt vertical padding, items centered; Body Medium title + Footnote subtitle left, Headline value right; optional BucketDot. Tappable rows show a chevron unless the screen leaves it out (S1) |
| **TransactionCard** | untagged · tagged · tax | merchant, date · card, amount; chips (2 suggestions + Tax last) |
| **AmountInput** | empty · focused · filled | label above, "$" + Title 2 value, `keyboardType="number-pad"`, formats with separators, live helper sentence |
| **OptionCard** | selected | whole card pressable; radio on the right |
| **SegmentedControl** | 2–3 options | Figma 61:41. Raised track (radius md, 4pt inset and gap), 44pt segments (radius sm, Subhead, textPrimary), selected = actionPrimary fill |
| **SettingsRow** | toggle · value · chevron · destructive | Figma 61:493. 12/16 padding, 8pt gap, full-width hairline between rows, inside a SettingsGroup (bgSurface, radius lg). The group's Footnote title sits 20pt above it, at the screen margin (S3) |
| **AccountSourceCard** | bank · files · by hand; action | Figma 117:1729. bgSurface, radius lg. Source row: 32pt tile (`size.sourceTile`, overlaySelected, radius sm) + Subhead title + Footnote line, min 60pt (`layout.sourceRow`); becomes a button with a Reconnect value when the bank asks to sign in again. Account rows indented under the text (tile width + 12), top hairline, Body name + Footnote line, Body Medium value, chevron |
| **AddAccountCard** | — | Figma 117:1769. Same card, `tintOk` tile with `plus` in statusOk, Body Medium "Add an account"; opens S12 |
| **OptionRow** | first | Figma 117:1870. For the light S12 sheet: 40pt tile (`size.optionTile`, overlaySelectedOnLight, `radius.tile` 10) with a 20pt glyph, Body Medium + Footnote (onLight tones), chevron; 14pt padding and gap; hairline `borderOnLight` above every row but the first |
| **CloseButton** | light · dark | Figma 117:1954. 32pt circle (`size.closeButton`) in a 44pt tap area, `xmark` 15pt Medium; VoiceOver "Close" |
| **TextField** | large | label above, Body text in a raised 50pt field; `large` = Title 2 text with 16pt padding (S8 "Type DELETE to confirm") |
| **TopBar** | pushed · flow · modal | Prefer native header: pushed = back chevron + parent title; flow = Back · StepIndicator · Skip/Finish later; modal = Cancel |
| **Sheet** | — | Native form sheet (Expo Router `presentation: 'formSheet'`) with grabber and detents |

## Screen shells

- **TodayShell:** full-bleed field color that cross-fades (600ms) between `bgField` and `bgFieldCaution`; header (date · Updated time in Callout, or only the time on small screens · StatusPill · ProfileButton, 12pt apart); the field takes the spare height so the sheet sits at the bottom, its bottom padding clearing the floating tab bar (`layout.todaySheetBottom` 112, compact 100); sentence hero with count-up; light sheet with LedgerRows + one Button; native tab bar.
- **DarkShell:** `bgBase`, safe areas, header, scroll content, bottom-pinned action area above the home indicator.
- **FormSheet:** native sheet over `bgDeep` dimming.

## Accessibility

Contrast is pre-verified (lowest AA pair 5.9:1). Never place textPrimary on light surfaces or light text on `tint*OnLight`. Every control gets `accessibilityRole` and `accessibilityLabel`; money reads naturally ("one thousand two hundred forty dollars"). Test the Today screen and Weekly Review with VoiceOver and the largest non-accessibility Dynamic Type size.
