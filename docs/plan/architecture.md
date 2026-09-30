# Architecture

How the app is built and tested. What it does is in [requirements.md](requirements.md).

## Tech stack

| Layer | Choice |
|---|---|
| Language | TypeScript |
| Frontend | React + Vite + React Router: a multi-page app with client-side routing, installable as a PWA. Next.js isn't needed: there's no SEO, and client-side navigation keeps the room's realtime connection alive. |
| UI | Tailwind CSS + shadcn/ui (Radix primitives, heavily re-themed) + Motion (framer-motion) for animation |
| Backend | Supabase: Postgres, Auth (Google + anonymous), Realtime, Row Level Security |
| LLM | None in the app. Scripts from photos are made by Claude in a Claude Code session, following a project skill (M6, changed 2026-09-28). |
| Hosting | Vercel (auto-deploys `main`) |

Notes:
- Supabase's free tier pauses a project after about 7 days of inactivity.

## Key principles

- **Keep roles secret at the data level, not only in the UI.** Players can read only public state and their own seat's role. The grimoire (all roles, tokens and DM notes) is readable only by that room's DM. Enforce this with Postgres Row Level Security, never by hiding things in the client.
- **Keep secrets server-side.** The service-role key never reaches the frontend. (There is no Anthropic API key: M6 makes scripts in Claude Code, not in the app.)
- **Favor simplicity:** free-tier hosting and low maintenance.

## Game actions

- **Game actions are Postgres functions called via RPC** (e.g. `supabase.rpc('draw_card')`). This includes starting the game, drawing a card, changing phase, nominating, voting, advancing the vote and changing roles.
  - Each function checks permissions and state inside one transaction, so the actions are atomic and cheat-proof.
  - The client reads tables and subscribes to Realtime changes, but never writes game state directly.
- **Edge Functions:** none. The planned photo → script function was dropped when M6 moved to Claude Code (2026-09-28).
- **Vote clock timer:** the DM's client drives it, calling `advance_vote()` every tick, and the database validates each step. If the DM's device sleeps, the vote just pauses.

## Draft data model

- `profiles`: nickname, permission level (admin / dm_eligible / player), is_guest
- `roles`: the role library, official and custom
- `scripts`
- `rooms`: code, current DM seat holder, seat count, current game
- `room_members`: who is in the room and their seat
- `games`: room, script, DM, assignment mode, status, phase, winner
- `game_seats`: seat, player, actual role, shown role, alignment, alive, death cause, ghost vote used. Access to roles is restricted.
- `grimoire_tokens`: DM only
- `dm_log_cells`, `dm_log_notes`, `dm_log_row_marks`: the DM log table (one text and/or colour per cell, note rows, row colours set at the start). DM only until the game ends ([log-spreadsheet.md](log-spreadsheet.md))
- `nominations`: nominator, nominee, phase, vote-circle state, final count
- `votes`: live hand state per seat, locked flag
- `board_posts`

## Repo layout

```
src/pages/            one file per route
src/features/         auth, room, setup, voting, grimoire, board, scripts, stats, admin
src/components/ui/    design-system components (re-themed shadcn/ui + custom)
src/lib/              pure game logic (the strict coverage + mutation gates apply here)
src/services/         Supabase client, generated DB types
src/styles/           design tokens for the day / night / grimoire themes
supabase/migrations/  versioned SQL: tables, RLS, RPC functions
supabase/functions/   Edge Functions (none; M6 moved to Claude Code)
supabase/tests/       pgTAP tests for security rules
supabase/seed.sql     dev data + role library
tests/unit/  tests/integration/  tests/e2e/   Vitest, simulation and Playwright tests
docs/plan/            this plan
docs/rules/           numbered rule catalog (the spec the tests trace to)
tools/                one-off scripts (e.g. generating the role library, checking rule coverage)
```

## Environments

The owner's PC can't run Docker, because Riot Vanguard (the anti-cheat for Riot games) blocks WSL2 virtualization, and the owner games on this PC.

**Until launch, there are two environments:**
- **The Supabase cloud project, serving as the dev database:**
  - The local Vite dev server, local test runs and the Vercel deployment all point at it.
  - Nobody uses the app before it's complete, so it holds only test data. It's safe to wipe and rebuild from the migrations and the seed (`supabase db reset --linked`).
  - Migrations are applied with `supabase db push` after CI passes.
- **CI:** GitHub Actions runs a throwaway **Docker-based local Supabase** on every push, and the full test suite runs against it. This is the authoritative test run.

**At launch** (see roadmap.md, Before launch):
- The project is cleaned: test data is wiped and the service-role key is rotated.
- From then on it's production, and it's **never reset again**.

**After launch** (the owner's decision, 2026-09-29): one database, no separate dev project.
- **CI is the only place the full suite runs**, on its throwaway Docker database, for every push.
- **Locally**, only the database tests (pgTAP) run against the cloud project. Each file runs in a transaction that is rolled back, so they leave no trace. A new migration can be tried the same way before it's merged: prepend it to the test run inside the same rolled-back transaction.
- **Integration and E2E tests refuse to run against the cloud project** (QA-12) unless `ALLOW_LIVE_TEST_DATA=1` is set on purpose. Smoke tests against the deployed site (`BASE_URL=… --grep @smoke`) create no data and still run.
- **Migrations** are applied with `node tools/db.ts push` only after the PR is merged, from a checkout of `main`, because the push applies every migration in the working tree.
- **The owner tests on the live site**, with the bot sandbox switched on under 管理 when needed, and discards test games (放弃本局, END-05) so they never reach stats or history.
- **Scripts from photos (M6)** can be made in a cloud session too: the skill's tools talk HTTPS with a single-purpose import token (SCRIPT-07), because a cloud session's proxy carries only web traffic. The cloud environment holds `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `SCRIPT_IMPORT_TOKEN`, never the database password or the secret key. `node tools/db.ts import-token` (on the PC) makes a new token and revokes the old one.

Other notes:
- Secrets (database passwords, service-role keys, API keys) are never committed or pasted into chat. They go in `.env.local` (gitignored) or in the CI and Vercel secret settings.
- GitHub: `Protocol-X3/Blood_on_the_clocktower_ucsb`.
- Generate DB types with `supabase gen types` after every schema change.

## Testing strategy

The goal is a comprehensive, automated test system so that edge cases don't need to be checked by hand. It also lets Claude build each milestone autonomously, looping until everything passes, once the owner has opened that milestone.

### 1. Spec first: the rule catalog (`docs/rules/`)

- Every behavior is written as a numbered rule before it's implemented, e.g. `VOTE-07: a dead player whose ghost vote is spent cannot raise their hand`.
- The owner reviews the rules, not the code or the tests.
- Every test names the rule IDs it covers. A check script fails if any rule has no test.
- Tests come from the spec, never from the implementation. This stops tests from just confirming the code's own bugs.

### 2. Test layers

| Layer | Tool | What it covers |
|---|---|---|
| Static | `tsc --noEmit`, ESLint | Type errors, obvious mistakes |
| Unit | Vitest (+ Testing Library) | Pure game logic in `src/lib` (vote tally, circle order, team counts, script parsing) and the design-system components |
| Property-based | fast-check (with Vitest) | Random inputs and random action sequences, checked against invariants. This finds edge cases nobody listed. |
| Security | pgTAP | RLS and RPC permissions. An auto-generated **permission matrix** tests every RPC × every actor (admin, DM, seated player, other player, guest, anonymous) × every game state. |
| Integration / simulation | Vitest + supabase-js against Supabase | Full games played by N fake users through the real RPCs. Random-sequence **model-based tests** compare the database against a simple reference model of the game. |
| End-to-end | Playwright (several browser contexts = several players; phone and tablet profiles) | Key flows across real screens with realtime sync, plus screenshots of key screens for visual review |
| Mutation | StrykerJS (Vitest runner) | Deliberately breaks `src/lib` code and checks that the tests catch it. This proves the tests actually assert things. |

### 3. Quality gates

- Coverage (Vitest v8): `src/lib` requires **100% lines and ≥95% branches**. Other unit-tested code has a lower bar (~70%). Pages are covered by E2E tests instead.
- Mutation score on `src/lib`: **≥85%**. It runs at the end of each milestone, not on every commit, because it's slow.
- SQL has no mainstream coverage or mutation tooling. The permission matrix and the model-based simulation are its substitute, and every RPC must be covered by both.

### 4. Commands

- `npm run verify` is the local gate: typecheck, lint, the rule-coverage check, unit tests with coverage, integration tests and E2E tests.
- **CI** runs the same checks on every push, **plus** the database tests (`supabase test db`, pgTAP) against Docker Supabase, which can't run locally.
- A milestone is done only when both are green.
- `npm run mutate`: Stryker, run at the end of each milestone.

### 5. Autonomous milestone loop

This runs only after the owner has explicitly opened the milestone (see [roadmap.md](roadmap.md)).

1. Write or extend the rule catalog → the owner approves it.
2. Write the tests from the rules. They fail at first, and every rule must be covered.
3. Implement until `npm run verify` and CI pass, and the coverage and mutation gates are met.
4. **Never weaken, skip or delete a test to make it pass.** If a test itself seems wrong, stop and ask the owner. Changing a rule means changing the spec first.
5. Report the results, and screenshots of new screens, to the owner. Then **stop** until the owner opens the next milestone.

### Known tooling pitfalls

These come from an earlier, discarded M0 attempt (2026-09-27):
- **Stryker 10 + Vitest 5:** Stryker's Vitest runner doesn't activate mutants under Vitest 5, so every mutant "survives." Use Vitest 4.x until Stryker supports 5.
- **Stryker + Vitest `test.projects`:** Stryker doesn't support `test.projects`, so give it its own flat Vitest config.
- **Playwright on the owner's PC:** the Playwright browser download times out on this network. Locally, use the installed Chrome (`channel: 'chrome'`), and let CI install its own Chromium.
- **Docker on the owner's PC:** it doesn't work, because Riot Vanguard blocks WSL2 (see Environments).
- **PowerShell:** `sc` is an alias for `Set-Content`. Use `sc.exe` for service commands.

### 6. What automation can't cover

Look and feel, wording, and how it plays at a real table. These are covered by:
- mockup approval;
- screenshot review each milestone;
- the bot sandbox, a testing tool the admin switches on under 管理 (off by default), which adds bot players so one person can run a full game;
- a dress rehearsal with 2–3 friends before the first real game night.
