# Roadmap

**This is the single source of truth for where the project stands. Read it first.**

## Current status

- **Planning:** complete (2026-09-25).
- **UI mockup:** approved (2026-09-25). See [design.md](design.md).
- **M0 is NOT started.** It's waiting for the owner's explicit go-ahead. The repo contains only the plan (this folder and CLAUDE.md). There's no app code yet.

## Phase gate

**No milestone starts, and no build work begins, until the owner explicitly says to advance.** Approving a decision isn't approval to proceed. When a milestone finishes, report back and stop.

## Milestones

The owner will only use the app with the group once it's fully ready, so the milestones are ordered by technical dependency, not by early table value.

| # | Milestone | Scope | Status |
|---|---|---|---|
| M0 | Foundation | Scaffold, design system (theme, fonts, tokens), dev/prod Supabase, deploy pipeline, **the full test harness** (`npm run verify`, CI, coverage and mutation config, rule-coverage check) | Not started |
| M1 | Accounts & rooms | Google and guest login, profiles, permission levels + `/admin`, create/join room, seats, DM seat | Not started |
| M2 | Setup & roles | Official role library seeded in Chinese (LLM-generated, reviewed by the owner), manual script editor, setup wizard, manual and card-draw assignment, shown/actual roles | Not started |
| M3 | Live game | Phases with the day/night theme, deaths with causes, revives, ghost votes, nominations, vote clock circle, board, end game + summary, bot sandbox (dev only) | Not started |
| M4 | Grimoire | Reminder tokens, per-seat DM log, circle grimoire layout | Not started |
| M5 | Scripts | Photo → Claude → review form, JSON import, custom roles saved into the library | Not started |
| M6 | Stats & history | Profile stats, game history pages | Not started |

## Waiting on the owner

- [ ] Give the go-ahead to start M0.
- [ ] Create the `botc-dev` Supabase project, in the same region as prod.
- [ ] Run `npx supabase login` to link the CLI (needs M0's CLI install).
- [ ] Connect Vercel to the GitHub repo.

Done:
- [x] Create the prod Supabase project.
- [x] Decide the environment setup (see the decision log, 2026-09-27).

## Open questions

None right now.

## Decision log

Newest first. Each entry records what was decided and why.

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
