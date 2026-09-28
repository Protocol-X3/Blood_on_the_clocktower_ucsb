# Autonomy run M0 → M5: final report

- **Run:** 2026-09-27 → 2026-09-28, per the Run rules in [roadmap.md](../plan/roadmap.md)
- **Result:** all six milestones certified by `npm run check:milestone M<n> --certify`, with every gate G1–G11 and every exit criterion passing. **Claude has stopped here, as M5.5 requires.** M6 (scripts from photos) was not started.
- **Live site:** https://botc-ucsb.vercel.app

## What was built

| Milestone | What you can do now | Tag | Report |
|---|---|---|---|
| M0 · Foundation | The design system (candlelit grimoire, day/night themes), the deploy pipeline, the full test harness | `m0-done` | [M0](M0.md) |
| M1 · Accounts & rooms | Google and guest sign-in, nicknames, permissions and `/admin`, rooms with codes, seats, the DM seat | `m1-done` | [M1](M1.md) |
| M2 · Setup & roles | The 72-role library in Chinese, custom roles, the script editor, the setup wizard with manual assignment or card draw, shown vs. actual roles | `m2-done` | [M2](M2.md) |
| M3 · Live game | Day and night, deaths and revives, ghost votes, nominations and the vote clock, the board, the end of the game and its summary, a dev-only bot sandbox | `m3-done` | [M3](M3.md) |
| M4 · Grimoire | The DM's circle grimoire (a list on phones), reminder tokens, the DM log, mid-game role and alignment changes | `m4-done` | [M4](M4.md) |
| M5 · Stats & history | Profiles with win rates and most-played roles, game history, past-game pages, admin account deletion | `m5-done` | [M5](M5.md) |

## How it is checked

- **144/144 rules** in `docs/rules/` have tests, and all pass.
- **Database:** 1414 pgTAP assertions, including a permission matrix for every action × 7 kinds of user × every game state. Role secrecy is enforced by row level security, not by the UI.
- **Model-based simulation:** 200 random full games per run through the real database functions, compared with a reference model after every action (phases, deaths, nominations, votes, the board, tokens, the log, role changes).
- **E2E:** 171 Playwright tests on a phone (Pixel 7) and a tablet (iPad Pro 11), including full games with a DM and five phones, and network recorders that fail if a player's phone ever receives a secret.
- **Unit/property and mutation:** `src/lib` has 100% coverage and a 100% mutation score.
- **CI** runs everything against a fresh Docker database on every push. `main` is protected.

## For you to review (no rush; nothing is blocked)

1. **The role library wording** in `supabase/data/official-roles.json`: 72 roles (TB, BMR, S&V), with community Chinese names and paraphrased abilities (M2).
2. **The judgment calls tagged `[autonomy]`** in the decision log in [roadmap.md](../plan/roadmap.md), with details in each report. The main ones:
   - M1: taking the DM seat gives up your player seat; seated players can't leave mid-game; idle rooms close after 24 h.
   - M2: one shared script library that any DM-eligible user can edit.
   - M3: self-nomination is allowed; no more nominations after the day's execution is confirmed; the threshold is fixed when the circle starts.
   - M4: tokens and the DM log become visible to the players after the game.
   - M5: onlookers lose access to a game when it ends; profiles show your own games, and other people's stats only.
3. **The rules themselves** (`docs/rules/`), if you want to add or change any.
4. **Look and feel:** the screenshots in `docs/reports/M*/`, or play a game with the bot sandbox. Run `npm run dev`, create a room, and press 填充机器人 in the DM tools.
5. **A full Google sign-in** was not automated (only the redirect to Google is tested). The first time you sign in with Google on the live site, your account becomes **admin** automatically.

## Before the first real game night: launch cleanup

These are also listed in [roadmap.md](../plan/roadmap.md), under "Before launch":

- [ ] **Wipe the test data:** all test users (the `e2e-pool-…@test.botc` accounts, bots and guests), rooms and games. Rebuild the database from the migrations, containing only the role library and your admin account.
- [ ] **Turn off the bot sandbox:** set `private.app_config.bot_sandbox` to `off`, and delete the bot accounts. Its buttons are already absent from the production site.
- [ ] **Rotate the service-role key.** It sat in `.env.local` during development.
- [ ] **Decide the post-launch dev setup:** a separate dev project, or CI's Docker database plus careful migrations. After launch, the cloud project holds real data and must never be reset.
- [ ] **A dress rehearsal** with 2–3 friends on real phones.

## Next

M6 (scripts from a photo via Claude, and JSON import) waits for your go-ahead.
