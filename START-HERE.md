# Start here (for Andy)

**Budget: $0 in new costs.** Apple Developer (already paid), Expo (free), Plaid (free Trial plan), Cloudflare Worker (free).

This folder is everything Claude Code needs to build Annum as a native iPhone app with Expo. You won't write code — you'll paste prompts, tap through a few Apple screens, and check results on your phone.

## 1. One-time setup (about 30 minutes)

1. **Apple Developer Program** — you already have it. Nothing to do.
2. **Create an Expo account** at expo.dev (free). Builds run in Expo's cloud (EAS), so you don't need Xcode for builds. A Mac with Xcode is still handy for the iPhone Simulator.
3. Create a GitHub repo called `annum`, unzip this kit into it, and commit. The repo is **public**, so read **Security & privacy** in `README.md` first.
4. **Export the screen PNGs** from Figma into `docs/screens/`: open the file, press **Shift + Cmd + E**, click **Export**, and move the 40 PNGs into that folder. They stay on your Mac only (git-ignored), because the design is private. Don't commit them.
5. Before milestone M7: create a free **Plaid** account on the Trial plan and a free **Cloudflare** account (for the tiny Worker). Both stay at $0. The exact steps are in `PROGRESS.md` ("Before M7").

## 2. Start Claude Code in the repo folder

Open the Claude desktop app → Code tab (or the terminal) in the `annum` folder. Claude Code reads `CLAUDE.md` automatically.

## 3. Build one milestone at a time

Open `docs/06-BUILD-PLAN.md`. For each milestone, paste its **Prompt**, let Claude Code work, then check the "Andy can check" column on your phone before moving on. Start with M0 — by the end of it, Annum is running on your iPhone.

If Claude Code asks something the docs answer, point it to the file. If they don't, decide and tell it.

## 4. Getting it on both phones

At M7, Claude Code sets up **TestFlight**. You add your wife as a tester with her Apple ID; she installs the TestFlight app and gets Annum with her own separate data. TestFlight builds expire after 90 days — Claude Code will note how to push a fresh build.

## 5. What's in here

| File | What it's for |
| --- | --- |
| `CLAUDE.md` | Rules and stack Claude Code must follow |
| `docs/01-PRODUCT.md` | Who it's for, principles, voice |
| `docs/02-ARCHITECTURE.md` | How the app works: Keychain, Face ID, Plaid bank data (free Trial) via a free Worker, notifications, widgets, and the $0 cost table |
| `docs/03-DATA-MODEL.md` | Formulas and the 25 tests that prove the math |
| `docs/04-DESIGN-SYSTEM.md` + `src-starter/theme.ts` | Components and design tokens |
| `docs/05-SCREENS.md` | Every screen and route, with states |
| `docs/06-BUILD-PLAN.md` | Milestones M0–M8 with prompts |
| `fixtures/seed.json`, `fixtures/scenarios.json` | Demo data and the six test scenarios |
| `docs/screens/` | Put the Figma PNG exports here (local only, git-ignored) |
