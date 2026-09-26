# 04 — Design system (React Native)

Tokens: `src-starter/theme.ts` → copy to `src/theme/index.ts`. Components import from `@/theme`; never use raw hex, numbers for spacing/radius, or durations outside the theme. Figma component pages are the visual truth.

## Foundations

- **Type:** iOS system font (SF Pro) — no font files. Eight sizes (Hero 72, Display 56, Title 1 34, Title 2 28, Sentence 24, Body/Headline 17, Callout/Subhead 15, Footnote/Caption 13). Support **Dynamic Type** with the caps in `theme.ts`; money uses `tabular-nums`.
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
| **Button** | primary · field · caution · secondary · destructive · quiet; disabled | 50pt, full width, radius full, Body Medium. Primary on dark, Field on the light sheet, Caution on heads-up Today. One per screen. Pressed state = 0.8 opacity. |
| **Chip** | category · tax; selected | 36pt visual with `hitSlop` to 44pt. Tax: outline `bucket.tax`; selected = filled + `checkmark` symbol. Selection haptic. |
| **Toggle** | on | Native `Switch` with `trackColor` on = `statusOk` |
| **StatusPill** | on-track · heads-up · estimate | overlaySubtle fill, 7pt dot, Caption. Long-press opens the scenario switcher (demo mode) |
| **StepIndicator** | step, total | 22×4 segments; filled textPrimary, rest overlayMuted; `accessibilityLabel="Step N of M"` |
| **GuardrailNote** | tone: info · heads-up; surface: dark · light | radius md, 12/16 padding, 8pt dot; dark text on light surfaces |
| **BucketRow** | card · split | dot + name + one-line note + amount; split puts the amount in an editable chip (numeric keypad) |
| **LedgerRow** | light · dark; bucket? | hairline bottom border; title + subtitle left, value right; optional BucketDot |
| **TransactionCard** | untagged · tagged · tax | merchant, date · card, amount; chips (2 suggestions + Tax last) |
| **AmountInput** | empty · focused · filled | label above, "$" + Title 2 value, `keyboardType="number-pad"`, formats with separators, live helper sentence |
| **OptionCard** | selected | whole card pressable; radio on the right |
| **SegmentedControl** | 3 options | 44pt, raised track, selected = actionPrimary fill (or native segmented control if it matches) |
| **SettingsRow** | toggle · value · chevron · destructive | inside a grouped container (bgSurface, radius lg) |
| **TopBar** | pushed · flow · modal | Prefer native header: pushed = back chevron + parent title; flow = Back · StepIndicator · Skip/Finish later; modal = Cancel |
| **Sheet** | — | Native form sheet (Expo Router `presentation: 'formSheet'`) with grabber and detents |

## Screen shells

- **TodayShell:** full-bleed field color that cross-fades (600ms) between `bgField` and `bgFieldCaution`; header (date · StatusPill · settings symbol); sentence hero with count-up; light sheet with LedgerRows + one Button; native tab bar.
- **DarkShell:** `bgBase`, safe areas, header, scroll content, bottom-pinned action area above the home indicator.
- **FormSheet:** native sheet over `bgDeep` dimming.

## Accessibility

Contrast is pre-verified (lowest AA pair 5.9:1). Never place textPrimary on light surfaces or light text on `tint*OnLight`. Every control gets `accessibilityRole` and `accessibilityLabel`; money reads naturally ("one thousand two hundred forty dollars"). Test the Today screen and Weekly Review with VoiceOver and the largest non-accessibility Dynamic Type size.
