# Roadmap

**This is the single source of truth for where the project stands. Read it first.**

## Current status

- **Planning:** complete (2026-09-25).
- **UI mockup:** approved (2026-09-25). See [design.md](design.md).
- **Autonomy run** M0 → M5: started 2026-09-27 (the owner's start signal), finished 2026-09-28.
- **M0 · Foundation: DONE** (certified 2026-09-27, tag `m0-done`, [report](../reports/M0.md)).
- **M1 · Accounts & rooms: DONE** (certified 2026-09-27, tag `m1-done`, [report](../reports/M1.md)).
- **M2 · Setup & roles: DONE** (certified 2026-09-27, tag `m2-done`, [report](../reports/M2.md)).
- **M3 · Live game: DONE** (certified 2026-09-27, tag `m3-done`, [report](../reports/M3.md)).
- **M4 · Grimoire: DONE** (certified 2026-09-28, tag `m4-done`, [report](../reports/M4.md)).
- **M5 · Stats & history: DONE** (certified 2026-09-28, tag `m5-done`, [report](../reports/M5.md)).
- **Autonomy run COMPLETE (2026-09-28).** See [the final report](../reports/RUN.md). **M6 opened by the owner (2026-09-28), redefined:** scripts from photos are made by Claude in a Claude Code session, not by an in-app feature. **M6 DONE (2026-09-28):** after a guided walkthrough of three scripts, the workflow lives in the project skill [`.claude/skills/script-from-photo`](../../.claude/skills/script-from-photo/SKILL.md). All milestones M0–M6 are complete.
- **DM log table: DONE 2026-09-28** (the owner's go-ahead the same day; PR #21 merged with every CI check green; migration `20260928000800_log_sheet.sql` applied to the live database): the DM log is a spreadsheet with colour marks and note rows ([log-spreadsheet.md](log-spreadsheet.md); rules LOG-01 … LOG-06 and GRIM-03 revised).
- **Script 特殊规则 (SCRIPT-08): built 2026-10-02** at the owner's request, PR pending: an optional text kept with each script, shown in 剧本库, set in the editor or by the script-from-photo skill.
- **Rules in force through: M5.** `npm run check:rules` reads this line: every rule of these phases must have a test. Each milestone's PR bumps it along with that milestone's tests.

## Phase gate

**No milestone starts, and no build work begins, until the owner explicitly says to advance.** Approving a decision isn't approval to proceed. When a milestone finishes, report back and stop.

**Planned autonomy run (decided 2026-09-27):**
- First, the owner provides all the inputs: rules, API access, Vercel, the dev database and so on. See "Waiting on the owner."
- Then the owner gives an explicit start signal.
- After that, Claude works **autonomously through M0 → M5 without stopping between milestones**. At each milestone boundary it posts a progress report but doesn't wait.
- Claude stops at the end of M5, or earlier on a **stop condition** (below). The final report reminds the owner of the **launch cleanup** (see Before launch).
- The run started 2026-09-27.

**Run rules** (the owner's answers, 2026-09-27):
1. **Rules:** Claude drafts each milestone's rules from requirements.md plus the owner's rules, then proceeds. The owner reviews all rules after the run. Drafted rules are marked `Status: Draft (autonomy run)`.
2. **Deploys:** Claude merges to `main` (Vercel auto-deploys) and pushes migrations to the Supabase project whenever CI is green.
3. **Role library:** Claude writes the official roles' Chinese names and **paraphrased** abilities. The owner reviews them after the run.
4. **Judgment calls:** Claude decides within the plan's spirit and logs each call in the decision log, tagged `[autonomy]`, for review.

**Stop conditions:** Claude stops and reports when any of these happens, and doesn't work around it.
- **S1.** A step needs the owner: a dashboard setting, a credential, a browser login, or an account.
- **S2.** A test seems wrong, or two rules or requirements contradict each other in a way that changes behavior the owner would notice.
- **S3.** A requirement is ambiguous, and the choice changes scope, the data model, or something the owner would have to relearn.
- **S4.** An action would touch anything outside the repo, the Supabase project, Vercel or GitHub, or would cost money.
- **S5.** The same failure survives three genuinely different fix attempts.
- **S6.** A milestone's exit criteria can't be met as written.

## Milestones

The owner will only use the app with the group once it's fully ready, so the milestones are ordered by technical dependency, not by early table value.

| # | Milestone | Scope | Status |
|---|---|---|---|
| M0 | Foundation | Scaffold, design system (theme, fonts, tokens), Supabase project + CLI link, deploy pipeline, **the full test harness** (`npm run verify`, CI, coverage and mutation config, rule-coverage check) | **Done** ([report](../reports/M0.md)) |
| M1 | Accounts & rooms | Google and guest login, profiles, permission levels + `/admin`, create/join room, seats, DM seat | **Done** ([report](../reports/M1.md)) |
| M2 | Setup & roles | Official role library seeded in Chinese (LLM-generated, reviewed by the owner), manual script editor, setup wizard, manual and card-draw assignment, shown/actual roles | **Done** ([report](../reports/M2.md)) |
| M3 | Live game | Phases with the day/night theme, deaths with causes, revives, ghost votes, nominations, vote clock circle, board, end game + summary, bot sandbox (dev only) | **Done** ([report](../reports/M3.md)) |
| M4 | Grimoire | Reminder tokens, per-seat DM log, circle grimoire layout | **Done** ([report](../reports/M4.md)) |
| M5 | Stats & history | Profile stats, game history pages | **Done** ([report](../reports/M5.md)) |
| M6 | Scripts | The owner sends Claude (in Claude Code) a photo of a script; Claude reads it, maps the roles to the library, adds any homebrew roles as custom roles, and saves the script to the database. The workflow is captured in a project skill. No in-app photo upload. | **Done** (2026-09-28) |

## Exit criteria (Definition of Done)

A milestone is done **only when every criterion below can be verified**: by a command's exit code, a named test passing, or an artifact that exists. Claude checks each one, and the milestone report lists every criterion with its evidence (the command output, the test name, a screenshot path). Items marked **(owner)** can't be verified automatically. They're listed in the report for the owner's review after the run, but they don't block progress.

### Every milestone (G = gate)

| # | Criterion | How it's verified |
|---|---|---|
| G1 | The local gate passes | `npm run verify` exits 0 |
| G2 | CI is green on the milestone's final commit on `main` | `gh run list --branch main --limit 1` shows the CI workflow with both jobs `success` |
| G3 | **Every rule in the phase's rule file (`docs/rules/m<n>-*.md`) and all earlier phases' files has a passing test** | `npm run check:rules` exits 0, and the tests naming those rule IDs pass (both included in G1/G2) |
| G4 | Coverage gates met | `src/lib` has 100% lines and ≥95% branches; the rest ≥70% (included in G1) |
| G5 | Mutation score ≥85% on `src/lib` | `npm run mutate` exits 0 |
| G6 | The database matches the migrations | `npx supabase migration list` shows every local migration applied remotely |
| G7 | The live site serves the milestone's commit | The Vercel production deployment of the commit is `READY`, and the smoke tests pass against it: `BASE_URL=<vercel url> npx playwright test --grep @smoke` |
| G8 | New screens are captured | Screenshots of each new screen exist, phone-sized for player screens and tablet-sized for DM screens, and are attached to the report |
| G9 | The plan is up to date | This file's status table is updated, and every `[autonomy]` judgment call is logged |
| G10 | Every exit criterion is proven by a tagged test | `npm run check:milestone M<n>` exits 0 (QA-09, safeguard A) |
| G11 | The milestone is certified | `docs/reports/M<n>.md` exists with evidence per criterion, and the tag `m<n>-done` points to the certified commit (QA-11, safeguard E) |

### M0 · Foundation

| # | Criterion | How it's verified |
|---|---|---|
| M0.1 | The app builds and deploys | G7: the home page on the Vercel URL renders 血染钟楼 |
| M0.2 | All three themes exist, with the design-system components | E2E: `/dev/design` shows every component under `data-theme` = day, night and grimoire, with screenshots |
| M0.3 | Every test layer runs at least one real test | A unit test, a fast-check property test, E2E on the `phone` and `tablet` profiles, pgTAP in the CI `database` job, an integration test against the Supabase project, and Stryker producing a score |
| M0.4 | The app can reach the Supabase project | Integration test: anonymous sign-in and sign-out succeed against the project (this also checks the owner enabled anonymous sign-ins) |
| M0.5 | The rule checker catches gaps | The checker's own test: an uncovered rule and an unknown ID each fail it |
| M0.6 | M0 rules hold | All rules in `docs/rules/m0-foundation.md` are covered and pass (G3) |
| M0.7 | The CLI can reach the project | `npx supabase migration list --db-url "$SUPABASE_DB_URL"` runs without error. No `supabase login` is needed. |
| M0.8 | The readiness check exists | `npm run preflight` checks every automatable entry requirement in "Phase transitions" below and prints pass/fail per item without printing secret values. Its logic has its own unit tests. |
| M0.9 | The safeguards are in place | The test ledger (QA-08), `check:milestone` (QA-09), branch protection on `main` (QA-10) and the no-skip lint rule (QA-04) all exist and pass |

### M1 · Accounts & rooms

| # | Criterion | How it's verified |
|---|---|---|
| M1.1 | M1 rules hold | All rules in `docs/rules/m1-accounts-rooms.md` are covered and pass (G3) |
| M1.2 | Every M1 action is permission-checked | pgTAP permission matrix: every M1 RPC × {admin, DM-eligible, player, guest, anonymous} × {room open, game running} has an expected allow or deny, and all pass |
| M1.3 | Guests can play | E2E (phone): guest login with a nickname → join a room by code → take a seat. A second browser sees the seat taken within 3 s (realtime). |
| M1.4 | DM-eligible users run rooms | E2E (tablet): a DM-eligible test user creates a room, takes the DM seat and leaves it. A player can't take the DM seat. |
| M1.5 | The admin manages permissions | E2E: admin grants and revokes DM-eligible on `/admin`. pgTAP: a non-admin can't. |
| M1.6 | The admin can force-reassign the DM | pgTAP: the admin reassigns the DM seat mid-game, and nobody else can |
| M1.7 | The owner's account becomes admin | pgTAP: the first sign-in of the configured admin email gets admin, and any other email doesn't |
| M1.8 | Google login is wired | E2E: "使用 Google 登录" redirects to `accounts.google.com`. A full Google sign-in is **(owner)**. |

### M2 · Setup & roles

| # | Criterion | How it's verified |
|---|---|---|
| M2.1 | M2 rules hold | All rules in `docs/rules/m2-setup-roles.md` are covered and pass (G3) |
| M2.2 | The role library is complete for the base editions | A test checks that every character of Trouble Brewing, Bad Moon Rising and Sects & Violets (no Travellers or Fabled) exists with an ID, Chinese name, team and a Chinese ability. The wording is **(owner)**. |
| M2.3 | Scripts can be built by hand | E2E: create a script from library roles plus one custom role, save it, reopen it |
| M2.4 | Setup works in both modes | E2E (tablet DM + phone players): manual assignment and card draw, each at 5 and 15 players, through to 开始游戏 |
| M2.5 | Card draw is race-safe | Integration: 50 rounds of two players drawing the same card at once, with exactly one winner each time |
| M2.6 | Role secrecy holds | pgTAP: a player reads only their own **shown** role, never any actual role, and never another seat's role, in every game state before `ended` |
| M2.7 | Team-count hints match the official table | Unit and property tests (SETUP rules) |

### M3 · Live game

| # | Criterion | How it's verified |
|---|---|---|
| M3.1 | M3 rules hold | All rules in `docs/rules/m3-live-game.md` are covered and pass (G3) |
| M3.2 | Vote logic is proven | Property tests in `src/lib`: circle order (starts after the nominee, ends on the nominee), threshold, ties, ghost votes spent once |
| M3.3 | The whole game model holds | Model-based simulation in CI: ≥200 random full games through the real RPCs with zero invariant violations |
| M3.4 | A full game works end to end | E2E: 1 DM (tablet) + 5 players (phone), from lobby → setup → nights and days with a nomination, the vote circle, a death, a revive, a ghost vote and a board post → end → summary |
| M3.5 | Day and night change the player theme | E2E: a player page's `data-theme` switches when the DM advances the phase |
| M3.6 | The bot sandbox works | E2E: the DM adds 9 bots, and a vote circle completes with bot votes. The sandbox doesn't exist in production builds. |
| M3.7 | Reconnect restores state | E2E: a player reloads mid-vote and sees the same state |

### M4 · Grimoire

| # | Criterion | How it's verified |
|---|---|---|
| M4.1 | M4 rules hold | All rules in `docs/rules/m4-grimoire.md` are covered and pass (G3) |
| M4.2 | Grimoire data is DM-only | pgTAP: only the room's DM can read or write tokens and log entries until the game ends, and then participants can read them |
| M4.3 | Grimoire layout fits the devices | E2E and screenshots: the circle layout at 1024×768 and 1366×1024. On a phone, the list layout with no horizontal scroll. |
| M4.4 | The summary shows everything | E2E: after the game ends, the summary shows actual and shown roles, alignments, deaths and the DM log |

### M5 · Stats & history

| # | Criterion | How it's verified |
|---|---|---|
| M5.1 | M5 rules hold | All rules in `docs/rules/m5-stats-history.md` are covered and pass (G3) |
| M5.2 | Stats are computed correctly | Unit and property tests: win rate overall and by team, games played, most-played roles, games as DM. Guests are excluded, and the **final** alignment is used. |
| M5.3 | History is visible to the right people | pgTAP: a past game is readable by its participants |
| M5.4 | The pages show the right numbers | E2E: with a seeded fixture of known games, the profile and game-history pages show the exact expected numbers |
| M5.5 | **End of run** | The final report covers all milestones' criteria with evidence, the **(owner)** review items, the `[autonomy]` decisions, the rules to review, the role library to review, and the **launch-cleanup reminder**. Then Claude stops. |

### M6 · Scripts

Redefined by the owner on 2026-09-28: there is no photo-upload feature in the app. Instead:
1. The owner walks Claude through creating a few scripts from photos, one at a time, correcting the workflow as they go.
2. Claude then writes a project skill (`.claude/skills/`) that captures the workflow: read the photo, map each role to the library, create custom roles for homebrew ones, save the script to the database, and verify it.
3. In later sessions, the owner sends a photo and asks for a new script, and Claude follows the skill.

| # | Criterion | How it's checked |
|---|---|---|
| M6.1 | The walkthrough scripts are in the database and match their photos | The owner checks each script in the app. **Met 2026-09-28:** 梦殒春宵, 夜半狂欢 (Zets) and 钟声来了 (Bruce C., with the 自制角色 卡牌大师) saved; the owner checked them. |
| M6.2 | The skill exists and captures the workflow | The owner reviews the skill; a fresh session can follow it. **Met 2026-09-28:** `.claude/skills/script-from-photo/SKILL.md`, backed by `tools/compare-script.ts` and `tools/save-script.ts`; the matcher's tests (`tests/tools/scriptPhoto.test.ts`) replay the walkthrough's cases. |

## Phase transitions

**Advance rule:** Claude moves from phase N to phase N+1 **only when both of these hold**:
1. **Phase N is done:** every G1–G11 gate and every one of its own exit criteria is verified, with evidence in the report.
2. **Phase N+1 is ready:** every entry requirement in the table below is verified.

If (1) fails, Claude keeps working on phase N, or stops under S5/S6. If (2) fails because something needs the owner, Claude stops under **S1** and says exactly which requirement is missing. It never starts the next phase partially.

From M0 on, `npm run preflight` checks the automatable entry requirements. Before M0 exists, Claude checks them with the listed commands.

| Transition | Entry requirements for the next phase | How each is verified |
|---|---|---|
| **Start → M0** | E0.1 The owner has given the explicit start signal | The owner's message in chat |
| | E0.2 The owner has approved the rule catalog | ✅ Approved 2026-09-27 (each rule file's status line says `Approved`) |
| | E0.3 `.env.local` exists with `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` and `ADMIN_EMAIL`, all non-empty | A script checks that each key is present and non-empty, **without printing any value** |
| | E0.4 The Supabase project is reachable | `GET <url>/auth/v1/settings` with the publishable key returns HTTP 200 |
| | E0.5 The Vercel project is connected to the repo | `gh api repos/Protocol-X3/Blood_on_the_clocktower_ucsb/deployments` lists a Vercel deployment, after the first push. If none appears within 10 minutes of the first push to `main` → **S1**. |
| **M0 → M1** | E1.1 M0 is done | M0 report: G1–G11 and M0.1–M0.9 verified |
| | E1.2 Anonymous sign-ins are enabled | `auth/v1/settings` shows `external.anonymous_users: true`, and the M0.4 integration test passes |
| | E1.3 The Google provider is enabled | `auth/v1/settings` shows `external.google: true` |
| | E1.4 Redirect URLs include local dev and the Vercel URL | The E2E test for M1.8 gets a Google redirect instead of a Supabase redirect error. A full sign-in is **(owner)**. |
| | E1.5 The admin email is configured | `ADMIN_EMAIL` is present (E0.3). The value never appears in the repo. |
| **M1 → M2** | E2.1 M1 is done | M1 report: G1–G11 and M1.1–M1.8 verified |
| | E2.2 Test accounts can be created | The integration test setup creates and deletes a throwaway user with the service-role key |
| **M2 → M3** | E3.1 M2 is done | M2 report: G1–G11 and M2.1–M2.7 verified |
| | E3.2 A playable setup exists for tests | A seeded fixture script (Trouble Brewing) loads, and setup can reach 开始游戏 in the test environment |
| **M3 → M4** | E4.1 M3 is done | M3 report: G1–G11 and M3.1–M3.7 verified |
| **M4 → M5** | E5.1 M4 is done | M4 report: G1–G11 and M4.1–M4.4 verified |
| **M5 → end of run** | M5 is done | M5 report: G1–G11 and M5.1–M5.4 verified, then M5.5 (final report) → **stop** |
| **→ M6** (outside the run) | The owner explicitly opens M6, and M6's exit criteria have been written | The owner's message (2026-09-28). No API key is needed, since Claude reads the photos in Claude Code. |

## Waiting on the owner

This is the checklist for the M0–M5 autonomy run. **Secrets go in `.env.local` or the dashboards, never in chat or commits.**

**Supabase** (the one existing project, used as the dev database until launch)
- [x] Go to Authentication → Sign In / Providers and enable **Anonymous sign-ins** (for guest login).
- [x] Enable the **Google** provider, using an OAuth client from Google Cloud Console (see Google below).
- [x] Go to Authentication → URL Configuration and add the redirect URLs: `http://localhost:5173/**` (local dev) and the Vercel URL.
- [x] Create `.env.local` at the repo root with `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (for test setup only), `SUPABASE_DB_URL` (the database connection string) and `ADMIN_EMAIL` (the owner's Google account). Claude creates `.gitignore` covering it in M0. **Don't commit or stage the file before then.**

**Google**
- [x] In Google Cloud Console, create an OAuth client (type "Web application") with the Supabase project's callback URL as an authorized redirect URI.

**Vercel**
- [x] Import the GitHub repo in Vercel (framework: Vite).
- [x] Set the env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the project's values.

**Content and decisions**
- [x] The start signal.

Done:
- [x] Create the Supabase project.
- [x] Decide the environment setup (see the decision log, 2026-09-27).
- [x] Answer the autonomy questions (see Run rules).
- [x] Approve the rule catalog (2026-09-27).
- [x] Approve the "done" safeguards A–E (2026-09-27).
- [x] Name the admin Google account. It goes in `.env.local` as `ADMIN_EMAIL`, never in the repo, because the repo is **public**.

## Before launch

Do this before the group's first real game night. Claude reminds the owner at the end of the autonomy run.
- [x] **Launch cleanup:** wipe all test users, rooms and games. Rebuild the database from the migrations, containing only the role library and the admin account. *(Done 2026-09-28 by targeted deletes rather than a reset, so the admin account survived: 229 test accounts, 3278 rooms with their games, 1030 scripts and 29 custom roles removed; 72 official roles and the admin remain. Any local E2E or integration run against the cloud project refills it with test data, so repeat this after the last one.)*
- [x] **Bot sandbox off for real games:** make sure the 机器人沙盒 switch under 管理 is off (it starts off, BOT-01), and remove leftover bots (the lobby's 移除机器人 while it's on, or delete profiles with `is_bot`). *(Done 2026-09-29 at the owner's request: the switch was on and is now off; 23 bots, the guest "111", the test account Whisper-mini, and all 4 rooms and 6 games (the owner's test games) were deleted. Only the admin account, the 4 scripts and the role library remain.)*
- [x] **Rotate the service-role key.** It sat in `.env.local` during development. *(Done 2026-09-29 by the owner in the Supabase dashboard; Claude checked that the new key and the database URL in `.env.local` both work.)*
- [x] **Decide the post-launch dev setup:** either create a separate dev project, or rely on CI's Docker database plus careful migrations. After launch, the cloud project holds real data and must never be reset. *(Decided 2026-09-29: CI only, plus a guard (QA-12). See architecture.md, Environments.)*
- [ ] Dress rehearsal with 2–3 friends (see architecture.md, Testing strategy).

## Open questions

None right now.

## Decision log

Newest first. Each entry records what was decided and why.

- **2026-10-02:** **Script 特殊规则 (SCRIPT-08).** The owner asked for a place to record the extra rules some scripts come with. They're optional, display only (nothing in a game reads them), shown in 剧本库, and set in the editor or by the script-from-photo skill. Claude's defaults: free text up to 2000 characters with line breaks kept; shown as a parchment panel above the roles on the script's page, with a 特殊规则 chip on the 剧本库 card; `save_script` takes a new optional `p_special_rules` (the old four-argument version is replaced, not overloaded) and `import_script` reads the spec's `special_rules`. Replacing a script (editor or `"replace": true`) replaces its 特殊规则 too. The skill copies a sheet's 特殊规则 section verbatim; 相克规则 (jinxes) stay left out unless the owner says otherwise.
- **2026-09-30:** **Script imports record only special decisions** (owner request): a routine import from a photo (every role follows the skill's rules, the owner just approves the plan) adds no notes to the skill or the roadmap and no commit. Notes are kept for decisions the owner makes when asked (version choice, unsure wording, name clash, replace) or new rules. 黯月初升 (25 official roles) was saved that way, so its earlier notes were removed.
- **2026-09-29:** **Scripts from photos in cloud sessions (SCRIPT-07).** A cloud session's proxy carries only HTTPS, so the skill's direct database connection hung until it timed out. The owner chose a **single-purpose import token** over the other options (logging in as the owner with a password, which would have meant turning on password sign-in for the project and giving the admin account a password; or the secret key, which can read and write every table). The database functions `script_import_library` and `import_script` accept only that token, then read the library or save the script as the admin through `create_custom_role` and `save_script`; the database keeps only the token's SHA-256. If it leaked, someone could add scripts to the library and nothing else; `node tools/db.ts import-token` replaces it.
- **2026-09-29:** **Pre-launch.** (1) Cleanup at the owner's request: the bot switch off, and the bots, the guest "111", the test account Whisper-mini, and every room and game deleted; only the admin, the 4 scripts and the role library remain. (2) **Post-launch dev setup: one database, CI only, plus a guard** (the owner chose it over a separate dev project): integration and E2E tests refuse to create data on the cloud project unless `ALLOW_LIVE_TEST_DATA=1` (QA-12); pgTAP still runs locally in rolled-back transactions; the owner tests on the live site with bots and discards test games. (3) **Service-role key rotation, for the owner:** the key is a new-style `sb_secret_…` key, used only by local tooling (never by the site or CI). In the Supabase dashboard, open Project Settings → API Keys, create a new secret key, put it in `.env.local` as `SUPABASE_SERVICE_ROLE_KEY`, then delete the old one. Optionally reset the database password the same way (Database settings), then update `SUPABASE_DB_URL`. (4) No run sheet for the dress rehearsal: the owner will play a normal game and report problems.
- **2026-09-28:** **Discarding a game (END-05)**, at the owner's request: 结束游戏 gets a 放弃本局 option. `[autonomy]` calls: the game is deleted outright (every game table cascades) rather than kept and hidden, so it truly leaves no record; it needs a second confirmation; it works only on a running game (a game in setup already has 取消); players land back in the lobby with a notice instead of a summary.
- **2026-09-28:** **The DM log table is built.** New tables `dm_log_cells` (one text and/or colour per cell), `dm_log_notes` and `dm_log_row_marks` replace `dm_log`, which had no entries in the live database. The owner's preview decisions (starting columns min(5, ⌊players / 2⌋), pinned 座位/玩家/初始角色, whole-row auto colours, grey shroud for dead, the near-white divider, no automatic death marks) are in [log-spreadsheet.md](log-spreadsheet.md). `[autonomy]` calls: the DM may write in phases still to come that the table shows, but not past them; 撤销 undoes the last paint stroke only, in this browser; a note row label has at most 12 characters and a game at most 20 note rows; one paint stroke covers at most 500 cells.
- **2026-09-28:** **The DM log becomes a spreadsheet** (planned, not yet built): one row per player plus note rows the DM adds, and one column per night and day after 座位 / 玩家 / 初始角色 / 角色设置. The owner chose: the full table sits at the bottom of the DM's page (the round table stays); one text per cell; 角色设置 is free text only; any phase up to the current one stays editable. Claude's defaults and the proposed rules are in [log-spreadsheet.md](log-spreadsheet.md).
- **2026-09-28:** **Bot sandbox on the live site (BOT-01, BOT-02).** It now ships with the app instead of development builds only, switched by the admin under 管理 (机器人沙盒), and starts off. While on, any room's DM can fill empty seats with bots; while off, nobody sees the tools and the database refuses every bot action. The production-build scan is retired, and E2E runs against the real production build. *Why:* owner request, to test with bots on the deployed site; the owner chose every DM (not only the admin's rooms) and off by default.
- **2026-09-28:** **AUTH-09:** users (Google or guest) can rename themselves on their 个人主页 at any time, under AUTH-03's rules; the new name shows everywhere at once, since nothing stores a copy of a nickname. Renaming isn't blocked during a game. *Why:* owner request; a mid-game rename just updates the name others see.
- **2026-09-28:** **M6 done.** The owner checked the three walkthrough scripts, and Claude wrote the `script-from-photo` skill with two tools: `compare-script` (matches a transcription against the live library, 自制角色 included, with a character diff and other versions) and `save-script` (creates 自制角色 and saves the script as the owner, with a dry run). Edge-case rules from the owner: Travellers are left out like Fabled; a homebrew name clash gets 名字（改）/（改2）/… after asking; an existing script name → ask (replace / new name / stop); new 自制角色 get reminder tokens only if the sheet shows them.
- **2026-09-28:** The original 气球驾驶员 joins 实验性角色 as **气球驾驶员（旧版）** (`balloonist_old`, the ability text from the 夜半狂欢 sheet): 188 official roles. When a role has more than one version in the library, Claude asks the owner which one a new script uses. *Why:* both versions are official roles from different times, and older sheets still use the original.
- **2026-09-28:** **自制角色 collection.** Every non-official role now sits in one library collection, 自制角色 (edition `homebrew`), whether made in the script editor or by Claude from a photo; the editor's 自定义 label becomes 自制角色, and the database enforces it. M6 role matching: a photo's role reuses the library role when the ability means the same thing, even if worded differently; any change in meaning (e.g. "a player" vs "a living player") makes it a new 自制角色; Claude asks the owner when unsure. *Why:* owner's rules for the photo workflow.
- **2026-09-28:** **M6 redefined.** Scripts from photos are no longer an in-app feature (photo upload → Edge Function → Claude API → review form). Instead the owner gives Claude a photo in a Claude Code session, and Claude creates the script in the database, following a project skill written after a guided walkthrough of a few scripts. JSON import is dropped for now. *Why:* owner's choice: no API key, Edge Function or review UI to build and maintain, and scripts are added rarely, by the owner.
- **2026-09-28:** The 72 base-edition roles (暗流涌动, 黯月初升, 梦殒春宵) now use the official Chinese wiki's text: 70 abilities reworded to the wiki's exact wording (several paraphrases had dropped rules detail, e.g. 调查员's "or no Minion in play", 主谋's extra night, 侍臣's "if in play"), 32 roles' reminder tokens aligned (e.g. 红鲱鱼→干扰项), and 圣女→贞洁者, 杀手→猎手. *Why:* the owner checked the library against the wiki and chose to match it exactly, like the 115 roles added earlier.
- **2026-09-28:** Owner-requested changes to setup and the player's screen (rules SETUP-06, SETUP-10, SETUP-11, DRAW-04, SECRET-05, SECRET-06, DEATH-03):
  - Setup opens only once every seat has a player; the server refuses too. *Why:* owner request; seats can't change during setup, so it can't start half-empty.
  - Each wizard step has one 返回 that goes back a step (replacing 返回基础设置 / 修改角色配置 / 取消修改). Going back keeps the choices: switching the mode keeps the composition, and only switching the script clears it. *Why:* owner request; a mode change shouldn't cost the DM their composition.
  - The role card no longer shows an alignment; the DM tells a player in person when theirs changes. The DM's alignment controls stay as they are. *Why:* the owner's decision, instead of showing a separate "shown alignment", since roles like the 提线木偶 and the Lunatic don't know their real team.
  - The player's role card and role info are face down until tapped, and turn back over on a second tap or when the app goes to the background. *Why:* owner request, so neighbours can't read the screen.
  - Dead players' seat tokens are crossed out with a red X on every screen, and their names are struck through in the town list. *Why:* owner request, to make deaths obvious.

- **2026-09-28:** The role library grows from 72 to 187 roles: all 66 实验性角色 and 49 华灯初上 roles (47 from 华灯初上 and 山雨欲来, plus 戏子（改） and 禁卫军（改） next to their originals), with ability text and reminders from the official Chinese wiki (clocktower-wiki.gstonegames.com). The TB Recluse is renamed 隐士 → 陌客 (the current translation; 隐士 is now the experimental Hermit). Travellers, Fabled and Lorics stay out for now (19 roles). *Why:* owner request; supporting the other role types is a feature of its own.
- **2026-09-28:** **M5 certified** (`m5-done` on `4cea352`). All M5.1–M5.5 and G1–G11 passed. **The M0–M5 autonomy run is complete**, and Claude has stopped per M5.5. [Final report](../reports/RUN.md).
- **2026-09-28:** `[autonomy]` M5 judgment calls: an ended game is readable only by its participants and the admin (onlookers lose access at the end); anyone sees a profile's stats, but the game list shows only the games the viewer may open; history rows show the starting role; the admin can't delete their own account or one sitting in a running game. Details in [the M5 report](../reports/M5.md).
- **2026-09-28:** **M4 certified** (`m4-done` on `d11acb0`). All M4.1–M4.4 and G1–G11 passed. M5 entry requirements are met.
- **2026-09-28:** `[autonomy]` M4 judgment calls: tokens are 中毒, 醉酒, any script reminder or custom text (≤ 8 characters); tokens and the DM log become visible to the game's participants after it ends; log entries (≤ 500 characters) belong to a seat or the whole game and keep their phase when edited; the DM may give two seats the same role mid-game; local E2E runs use 3 workers. Details in [the M4 report](../reports/M4.md).
- **2026-09-27:** **M3 certified** (`m3-done` on `2743ba7`). All M3.1–M3.7 and G1–G11 passed. M4 entry requirements are met.
- **2026-09-27:** `[autonomy]` M3 judgment calls: a nomination goes 提名中 → 计票中 → 计票完成 → closed, with corrections until it closes; the threshold is fixed when the circle starts; self-nomination is allowed and cancelled nominations don't trigger NOM-02 warnings; no phase change during a nomination and no nominations after the day's execution is confirmed; the DM's screen drives the clock with idempotent ticks; posts only while the game runs; the summary lives at `/room/<code>/summary`; the bot sandbox's database functions are guarded by `app_config.bot_sandbox`, which the launch cleanup turns off; local E2E runs use 4 workers so the free-tier project keeps up. Details in [the M3 report](../reports/M3.md).
- **2026-09-27:** **M2 certified** (`m2-done` on `966ab19`). All M2.1–M2.7 and G1–G11 passed. M3 entry requirements are met.
- **2026-09-27:** `[autonomy]` M2 judgment calls: one shared script library that any DM-eligible user can edit (games keep their own copy of the roles); default alignment follows the team; the shown role comes from the same script; going back to the basics step discards the setup; clearing a seat's role is manual-mode only (draw mode reshuffles); the 15-seat E2E tests get a longer time limit. Details in [the M2 report](../reports/M2.md).
- **2026-09-27:** **M1 certified** (`m1-done` on `c7e85ad`). All M1.1–M1.8 and G1–G11 passed, including the Google redirect against the live site. M2 entry requirements are met.
- **2026-09-27:** `[autonomy]` M1 judgment calls: public 404 and design gallery; taking the DM seat gives up the player seat; seated players and the DM can't leave mid-game; a pg_cron job closes idle rooms; sign-out is per device; a test-account pool with cached sessions stays under Supabase's sign-in limits, and admin tests borrow the admin role with guaranteed restore. Details in [the M1 report](../reports/M1.md).
- **2026-09-27:** **M0 certified** (`m0-done` on `c8b4ffb`). All M0.1–M0.9 criteria and gates G1–G11 passed. M1 entry requirements verified by `npm run preflight`. `[autonomy]` Day-theme colors were darkened slightly for WCAG AA, and the secret scanner ignores placeholder passwords.
- **2026-09-27:** **Autonomy run started** (the owner's start signal). The setup checklist is complete: env, Vercel (`botc-ucsb.vercel.app`), redirect URLs, the Google OAuth client (published), and Google + anonymous sign-in, all verified end to end.
- **2026-09-27:** Rule HIST-06 was added and approved (account deletion and anonymization), matching the promise in `docs/PRIVACY.md`.
- **2026-09-27:** `[autonomy]` The Supabase CLI connects with `--db-url "$SUPABASE_DB_URL"` instead of `supabase login` and linking. *Why:* it needs no interactive login, which removes the planned mid-run stop. M0.7 was reworded to match.
- **2026-09-27:** The owner approved the rule catalog, with all eight flagged judgment calls accepted as drafted. They also approved safeguards A–E, which became rules QA-08..QA-11 plus QA-04 and gates G10–G11. Safeguard F (an independent reviewer agent) wasn't chosen.
- **2026-09-27:** Rule catalog Draft v1 written by Claude at the owner's request: one rule file per phase (139 rules, 8 flagged for review). A phase is done only when every rule in its file, and in earlier phases' files, has a passing test.
- **2026-09-27:** Phase transitions: advance only when the current phase is done **and** the next phase's entry requirements are verified. `npm run preflight` (an M0 deliverable) checks them.
- **2026-09-27:** The admin is the owner's Google account. Its email stays out of the repo, which is public, and is configured as `ADMIN_EMAIL` in `.env.local`, then applied to the database at setup.
- **2026-09-27:** Every milestone has verifiable exit criteria (the G1–G9 gates, plus per-milestone criteria), and the autonomy run has stop conditions S1–S6. *Why:* the owner wants clear, checkable stopping points for an unattended run.
- **2026-09-27:** Autonomy-run rules, all the recommended options: Claude drafts rules and proceeds (the owner reviews them after the run); merges to `main` and pushes migrations when CI is green; writes the paraphrased Chinese role library (reviewed after the run); and logs judgment calls tagged `[autonomy]`.
- **2026-09-27:** A single Supabase project serves as the dev database until launch, with no separate `botc-dev` (this replaces the `botc-dev` entry below). *Why:* nobody uses the app before it's complete, so there's no real data to protect. There's a launch-cleanup step before the first real game. CI still uses its own Docker database.
- **2026-09-27:** Once the owner has provided all inputs and given the start signal, Claude runs autonomously through M0–M5.
- **2026-09-27:** Swapped the last two milestones. M5 is now Stats & history, and M6 is Scripts (photo import, JSON import). Owner's choice. The M2 manual editor covers scripts until M6.
- **2026-09-27:** The `m0-foundation` branch was deleted (it replaces the "keep" decision below). M0 will start fresh once the owner gives the go-ahead. Lessons from that attempt are kept under "Known tooling pitfalls" in architecture.md.
- **2026-09-27:** The plan moves from CLAUDE.md into `docs/plan/` (four files). CLAUDE.md keeps only the working rules and pointers.
- **2026-09-27:** Phase gate: nothing starts without the owner's explicit go-ahead. *Why:* Claude started M0 after the owner had only approved a decision.
- **2026-09-27:** Keep the `m0-foundation` branch, unmerged, for review when M0 starts.
- **2026-09-27:** Dev database is a cloud Supabase project (`botc-dev`), not local Docker. *Why:* Riot Vanguard blocks WSL2 on the owner's PC, and the owner plays Riot games there. CI still runs Docker Supabase.
- **2026-09-25:** Devices: players are phone-first, and the DM is laptop/iPad-first. The DM grimoire stays dark, and player screens follow day and night.
- **2026-09-25:** Visual direction "Candlelit grimoire" approved from the mockup.
- **2026-09-25:** Testing: a spec-first rule catalog, property- and model-based tests, a permission matrix, coverage and mutation gates, and an autonomous loop per milestone.
- **2026-09-25:** Milestones M0–M6 are ordered by dependency, since the owner uses the app only once it's complete.
- **2026-09-25:** Dev workflow: a GitHub repo, Vercel auto-deploys, and game actions are Postgres RPC functions. The DM's client drives the vote timer.
- **2026-09-25:** Guests sign in themselves (anonymous auth) and are excluded from stats. Only DM-eligible users create rooms. The admin can force-reassign the DM mid-game.
- **2026-09-25:** Permission levels: admin (the owner only) / DM-eligible / player. DM is a per-game seat, and a room hosts consecutive games.
- **2026-09-25:** Game flow: a setup wizard with manual or card-draw assignment, shown vs. actual role on every seat, a vote circle following the clockwise rule, and public death causes.
- **2026-09-25:** Scripts are added mainly by photo → Claude → review, and the role library is seeded by an LLM and reviewed by the owner. No night order, no Travellers or Fabled.
- **2026-09-25:** Stack: React + Vite + TypeScript, Tailwind + shadcn/ui, Supabase, Vercel, and Claude Opus 5 for photo import. Google sign-in.
- **2026-09-25:** Purpose: an in-person game companion for one UCSB group. Chinese UI, solo, non-commercial.
