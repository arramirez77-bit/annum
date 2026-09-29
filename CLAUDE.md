# Annum — instructions for Claude Code

You are building **Annum**, a calm personal-finance **native iPhone app** built with **Expo (React Native + TypeScript)**, for one freelancer and, separately, his wife. Andy designs every screen in Figma; your job is to build exactly what the frames show and make every number real. **Code never designs** (see "Design comes from Figma, always").

Read these before writing code, in order:

1. `docs/01-PRODUCT.md` — who it's for, principles, voice. Non-negotiable rules live here.
2. `docs/02-ARCHITECTURE.md` — how the app works: stack, storage, security, bank data (Plaid Trial via a free Worker), notifications, widgets, costs.
3. `docs/03-DATA-MODEL.md` — types, formulas, rules, and test cases. **The formulas are the product.**
4. `docs/04-DESIGN-SYSTEM.md` + `src-starter/theme.ts` — every color, size, radius, and motion value.
5. `docs/05-SCREENS.md` — routes (Expo Router files), screen-by-screen specs, and states.
6. `docs/06-BUILD-PLAN.md` — milestones. **Build one milestone at a time, in order.**

Visual reference: PNG exports of every screen go in `docs/screens/` (filenames match screen IDs like `01`, `O1`, `E1`). They are git-ignored and stay on Andy's Mac, because the design is private. Figma source: Figma file (private, ask Andy) — screens on the **Screens** page, components on the component pages.

## Design comes from Figma, always

Andy designs in Figma. Code builds what the frames show and never creates a design of its own.

- **No frame, no screen.** Never create a screen, sheet, state (empty, loading, offline, error, success…), layout, or new UI piece that has no Figma frame, not even a "temporary", "simple" or placeholder one. Copy comes from the frames too.
- **When something needs a design, stop and ask for it.** A new feature, a state the frames don't show, a missing step in a flow, a layout that doesn't work on the SE or at large text sizes: tell Andy which screen, which state, and why, in plain words. Leave a `TODO(design): …` comment where it goes and wait for the frame. Don't build a stand-in meanwhile.
- **Build from the frame, with what exists.** Use the existing components and `src/theme` tokens. If a frame needs a component or token that doesn't exist yet, build it to match the frame; if the frame is unclear, ask.
- **Don't design in Figma either** unless Andy asks. Read Figma to build from it (Screens page, node `57:8`).
- **What code still decides without a frame:** logic and every number (from `src/domain/`), accessibility (VoiceOver labels, Dynamic Type, 44pt targets, Reduce Motion), and native iOS UI the system draws (alerts, share sheet, keyboard, the system back button, Face ID prompt).
- **Screens built before this rule without a frame** are listed in `PROGRESS.md` ("Screens without a Figma frame"). They stay as built until Andy designs them; don't add to them or build new ones like them.

## Stack (decided — don't change without asking)

- **Expo** (latest stable SDK), TypeScript strict, **iOS only**, dark mode only
- **Expo Router** with native tabs (Today · Review · Money) and native modal / form-sheet presentations
- **Development builds** (not Expo Go) from day one — we need native modules and, later, a widget extension
- **EAS Build + EAS Submit** → TestFlight for installing on Andy's and the second user's iPhones
- State: **Zustand**. Storage: **expo-sqlite** with **SQLCipher** encryption; key in **expo-secure-store** (Keychain)
- **expo-local-authentication** (Face ID), **expo-notifications** (local only), **expo-haptics**, **expo-symbols** (SF Symbols), **react-native-reanimated** (motion), **react-native-svg** (mark, rings), **expo-sharing** / **expo-file-system** / **expo-print** (exports)
- **react-native-plaid-link-sdk** (Plaid Link; Hosted Link in `expo-web-browser` as the fallback), **expo-document-picker** (CSV/OFX import)
- Background refresh: Expo's background task module
- Widgets (M8): a **WidgetKit** extension (Swift/SwiftUI) added with an Expo config plugin such as `@bacons/apple-targets`, reading a snapshot from a shared **App Group**
- Tests: **Jest (`jest-expo`)** for the domain engine; **Maestro** for flow tests
- **No database server.** One tiny **Cloudflare Worker** (free plan, `worker/`) holds the Plaid client ID and secret as Cloudflare secrets and forwards a short allowlist of read-only Plaid requests. It stores only the connection count (one Workers KV number): no bank names, tokens or account data, and no logs. Each phone gets the Worker access key by scanning a QR code (Keychain, this device only; never bundled, never in backups); `npm run worker:rotate-key` replaces it. Nothing else runs in the cloud.
- **Plaid Trial only (10 bank logins for life, shared by both phones).** Confirm before every new connection and show what's left; repair broken connections with update mode, never a new connection; backups carry the access tokens; never upgrade off the Trial and never add paid products.
- **$0 budget.** Don't add any paid service, API, or subscription. If something would cost money, stop and tell Andy the free alternative.

Before adding any package, check it against the current Expo SDK docs and prefer the Expo-maintained module. Tell Andy when a version or API differs from what's written here.

## Rules

1. **Domain logic is pure TypeScript in `src/domain/`**, no React Native imports, fully unit-tested against `docs/03-DATA-MODEL.md`. UI never computes money itself.
2. **No hardcoded colors, sizes, radii, or durations.** Import from `src/theme`. If a value is missing, propose a token; don't invent one.
3. **Money is integer cents.** Never floats. Format at the edge with `Intl.NumberFormat`.
4. **Dates are local calendar dates** (`YYYY-MM-DD`). Beware off-by-one on "days until" and timezone changes.
5. **Every screen handles its states**: empty, syncing, stale, offline, error, success (see `docs/05-SCREENS.md`), each built from its Figma frame. A state without a frame is a design request for Andy, not something to invent.
6. **Copy follows the voice rules.** Never "error," "failed," "warning," or red for money states. Numbers live inside sentences.
7. **Privacy & security:** no analytics or crash SDKs that send financial data, no network calls except the Annum Worker and Plaid Link, secrets only in the Keychain or the encrypted database (the Plaid secret only in Cloudflare secrets; the Worker access key only in Cloudflare secrets and each phone's Keychain), database encrypted, no logging of balances, transactions, or Plaid tokens.
8. **Accessibility:** system font (SF Pro) with **Dynamic Type**, VoiceOver labels on every control, 44×44pt targets, WCAG AA contrast (tokens already pass), Reduce Motion respected.
9. **Native feel:** system navigation, sheets, and tab bar; safe areas via `react-native-safe-area-context`; haptics only where `docs/04` says.
10. **This is a public repo.** Never commit secrets, real account names, real balances, real transactions, or screenshots taken with real data. SPIKES.md and all notes use placeholders like 'Bank A'. Demo data only in fixtures/.

## Workflow

- Start each milestone by restating its goal and acceptance criteria from `docs/06-BUILD-PLAN.md`, then list the files you'll touch.
- Build in small verified steps. Run tests and check the result on Andy's iPhone (dev build) or the iOS Simulator before moving on.
- Never mark a milestone done without running it and giving evidence (test output, Maestro result, or what you verified on device).
- If the docs conflict or a decision is missing, stop and ask Andy one clear question with your recommended default. If a design is missing, ask for the Figma frame instead of proposing a layout in code.
- Andy designs; he doesn't write code. Explain decisions in plain language and make setup steps copy-pasteable. Tell him exactly when he needs to tap something on his phone or in the Apple Developer site.

## Definition of done (every milestone)

- [ ] Runs on device or simulator; tests pass; output verified, not assumed
- [ ] Every screen and state on screen comes from a Figma frame; nothing was designed in code
- [ ] Unhappy paths handled (empty, error, slow, offline, stale)
- [ ] No hardcoded secrets or values where tokens exist
- [ ] AA contrast, VoiceOver labels, Dynamic Type, ≥44pt targets, Reduce Motion
- [ ] Builds with EAS (from M0 on); TestFlight build verified from M7 on
- [ ] README updated if setup or behavior changed
- [ ] Self-review pass done before handing back
