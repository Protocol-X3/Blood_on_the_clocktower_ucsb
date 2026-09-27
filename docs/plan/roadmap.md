# Roadmap

**This is the single source of truth for where the project stands. Read it first.**

## Current status

- **Planning:** complete (2026-09-25).
- **UI mockup:** approved (2026-09-25). See [design.md](design.md).
- **M0 is NOT started.** It's waiting for the owner's explicit go-ahead. The repo contains only the plan (this folder and CLAUDE.md). There's no app code yet.

## Phase gate

**No milestone starts, and no build work begins, until the owner explicitly says to advance.** Approving a decision isn't approval to proceed. When a milestone finishes, report back and stop.

**Planned autonomy run (decided 2026-09-27):**
- First, the owner provides all the inputs: rules, API access, Vercel, the dev database and so on. See "Waiting on the owner."
- Then the owner gives an explicit start signal.
- After that, Claude works **autonomously through M0 → M5 without stopping between milestones**. At each milestone boundary it posts a progress report but doesn't wait.
- Claude stops at the end of M5, or earlier if it hits a blocker only the owner can resolve. The final report reminds the owner of the **launch cleanup** (see Before launch).
- The run hasn't started yet.

## Milestones

The owner will only use the app with the group once it's fully ready, so the milestones are ordered by technical dependency, not by early table value.

| # | Milestone | Scope | Status |
|---|---|---|---|
| M0 | Foundation | Scaffold, design system (theme, fonts, tokens), Supabase project + CLI link, deploy pipeline, **the full test harness** (`npm run verify`, CI, coverage and mutation config, rule-coverage check) | Not started |
| M1 | Accounts & rooms | Google and guest login, profiles, permission levels + `/admin`, create/join room, seats, DM seat | Not started |
| M2 | Setup & roles | Official role library seeded in Chinese (LLM-generated, reviewed by the owner), manual script editor, setup wizard, manual and card-draw assignment, shown/actual roles | Not started |
| M3 | Live game | Phases with the day/night theme, deaths with causes, revives, ghost votes, nominations, vote clock circle, board, end game + summary, bot sandbox (dev only) | Not started |
| M4 | Grimoire | Reminder tokens, per-seat DM log, circle grimoire layout | Not started |
| M5 | Stats & history | Profile stats, game history pages | Not started |
| M6 | Scripts | Photo → Claude → review form, JSON import, custom roles saved into the library. Until then, scripts are entered with M2's manual editor. | Not started |

## Waiting on the owner

This is the checklist for the M0–M5 autonomy run. **Secrets go in `.env.local` or the dashboards, never in chat or commits.**

**Supabase** (the one existing project, used as the dev database until launch)
- [ ] Go to Authentication → Sign In / Providers and enable **Anonymous sign-ins** (for guest login).
- [ ] Enable the **Google** provider, using an OAuth client from Google Cloud Console (see Google below).
- [ ] Go to Authentication → URL Configuration and add the redirect URLs: `http://localhost:5173/**` (local dev) and the Vercel URL.
- [ ] Put the project's values in `.env.local` at the repo root: URL, publishable key, service-role key (for test setup only), and the database connection string.
- [ ] Run `npx supabase login` in a terminal once M0 has installed the CLI. It signs in through your browser, so no token is pasted anywhere. This is the one mid-run step; Claude will ask when it gets there.

**Google**
- [ ] In Google Cloud Console, create an OAuth client (type "Web application") with the Supabase project's callback URL as an authorized redirect URI.

**Vercel**
- [ ] Import the GitHub repo in Vercel (framework: Vite).
- [ ] Set the env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the project's values.

**Content and decisions**
- [ ] The owner's rules, to seed `docs/rules/`.
- [ ] Which Google account becomes **Admin**.
- [ ] Answers to the autonomy questions below.
- [ ] The start signal.

Done:
- [x] Create the Supabase project.
- [x] Decide the environment setup (see the decision log, 2026-09-27).

## Before launch

Do this before the group's first real game night. Claude reminds the owner at the end of the autonomy run.
- [ ] **Launch cleanup:** wipe all test users, rooms and games. Rebuild the database from the migrations, containing only the role library and the admin account.
- [ ] **Rotate the service-role key.** It sat in `.env.local` during development.
- [ ] **Decide the post-launch dev setup:** either create a separate dev project, or rely on CI's Docker database plus careful migrations. After launch, the cloud project holds real data and must never be reset.
- [ ] Dress rehearsal with 2–3 friends (see architecture.md, Testing strategy).

## Open questions

These are for the autonomy run. Each one would otherwise force a stop mid-run.

1. **Rule approval:** the testing process has the owner approving each milestone's rules before tests are written. During the run, should Claude draft rules from requirements.md plus the owner's rules and proceed, with the owner reviewing them all afterwards? (Recommended.) Or should the owner pre-approve everything up front?
2. **Prod deploys:** may Claude merge to `main` (Vercel auto-deploys) and push migrations to the Supabase project whenever CI is green? (Recommended: yes, since nobody uses the app before launch.) Or should it work only on branches until the owner says otherwise?
3. **Role library (M2):** should Claude write the Chinese names and **paraphrased** abilities for the official roles itself, for owner review after the run? (Recommended. Paraphrasing avoids copying the publisher's text.) Or will the owner provide a role data file?
4. **Judgment calls mid-run** (UX details, small scope questions): should Claude decide, follow the plan's spirit and log each call in the decision log for later review? (Recommended.) Or stop and ask?

## Decision log

Newest first. Each entry records what was decided and why.

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
