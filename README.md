# 血染钟楼 · UCSB Game Companion

A web app for a local UCSB group that plays **Blood on the Clocktower (血染钟楼)** face to face. The storyteller (DM) and the players join the same online room, and the app keeps track of the game while it's played in person.

Live site: <https://botc-ucsb.vercel.app>

The interface is in Simplified Chinese. Code, comments and docs are in English.

## What it does

- **Rooms.** A DM creates a room, and players join with a room code and pick the seat that matches where they're sitting. A room hosts game after game with the same group.
- **Setup.** A step-by-step wizard for the script, the role composition and the assignment. Roles are assigned by the DM or drawn by the players as face-down cards on their phones.
- **Shown and actual roles.** Every seat has both, so roles like the Drunk work. A player only ever sees their own shown role.
- **Live game.** Night and day phases, deaths with public causes, revives, ghost votes, and nominations with a vote clock that sweeps around the seat circle and locks each vote as it passes.
- **Grimoire.** The DM's view of the whole table: reminder tokens and a spreadsheet-style log with a column per night and day.
- **Board.** Players post public notes, tagged with the phase.
- **Summary, history and stats.** When a game ends, everyone sees all the roles and the DM's log. Profiles show win rates, most-played roles and past games.
- **Script library.** The official roles in Chinese, plus the group's custom scripts and homebrew roles.

The app is a record-keeper. It doesn't automate abilities or enforce the rules; the DM does that at the table. Travellers, Fabled and night order are out of scope.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React, Vite, TypeScript, React Router |
| UI | Tailwind CSS, shadcn/ui (re-themed), Motion |
| Backend | Supabase: Postgres, Auth (Google and anonymous), Realtime, Row Level Security |
| Hosting | Vercel, auto-deploying `main` |

Two ideas shape the code:

- **Roles are secret in the database, not only in the UI.** Row Level Security decides what each user can read, so a player's browser never receives another seat's role.
- **Every game action is a Postgres function called by RPC.** The function checks permissions and state in one transaction. The client reads tables and listens for realtime changes, and never writes game state directly.

## Running it locally

You need Node 22 or newer and a Supabase project.

1. Install the dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the values from the Supabase dashboard. `.env.local` is git-ignored. Never commit real values.

3. Start the dev server, which serves the app at <http://localhost:5173>:

   ```bash
   npm run dev
   ```

The Supabase project needs anonymous sign-ins and the Google provider enabled, with `http://localhost:5173/**` among its redirect URLs. The schema is in `supabase/migrations/`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Typecheck and build for production |
| `npm run typecheck` | Typecheck only |
| `npm run lint` | ESLint, plus a check that no test is skipped |
| `npm test` | Unit tests |
| `npm run test:db` | Database tests (pgTAP), each file in a rolled-back transaction |
| `npm run test:integration` | Full games played through the real RPCs |
| `npm run test:e2e` | Playwright, on phone and tablet profiles |
| `npm run check:rules` | Check that every rule in `docs/rules/` has a test |
| `npm run verify` | The full local gate: all of the above, the build and the secret scans |
| `npm run mutate` | Mutation testing on `src/lib` (slow) |
| `npm run db:push` | Apply migrations to the Supabase project |
| `npm run db:types` | Regenerate the database types |

The integration and E2E tests create users, rooms and games. They refuse to run against the cloud project unless `ALLOW_LIVE_TEST_DATA=1` is set, because that project holds the group's real games. CI runs the full suite against its own throwaway database on every push, and that run is the authoritative one.

## Testing

Behavior is written down first, as numbered rules in [`docs/rules/`](docs/rules/) such as `VOTE-07`. Every test names the rules it covers, and `npm run check:rules` fails if a rule has no test.

The layers are unit and property-based tests (Vitest, fast-check), database permission tests (pgTAP), simulated full games against the real RPCs, end-to-end tests (Playwright) and mutation testing (StrykerJS). `src/lib` holds the pure game logic and must keep 100% line coverage and a mutation score of at least 85%.

## Repo layout

```
src/pages/            one file per route
src/features/         auth, room, setup, voting, grimoire, board, scripts, stats, admin
src/components/ui/    design-system components
src/lib/              pure game logic
src/services/         Supabase client and generated database types
src/styles/           design tokens for the day, night and grimoire themes
supabase/migrations/  tables, RLS policies and RPC functions
supabase/tests/       pgTAP tests
tests/                unit, integration and E2E tests
tools/                checks and database scripts
docs/                 plan, rule catalog, milestone reports, privacy
```

## Documentation

| File | What's in it |
|---|---|
| [docs/plan/roadmap.md](docs/plan/roadmap.md) | Status, milestones and the decision log |
| [docs/plan/requirements.md](docs/plan/requirements.md) | What the app does |
| [docs/plan/architecture.md](docs/plan/architecture.md) | Stack, data model, environments and testing strategy |
| [docs/plan/design.md](docs/plan/design.md) | Visual direction: "Candlelit grimoire" (烛光魔典) |
| [docs/rules/](docs/rules/) | The rule catalog the tests trace to |
| [docs/PRIVACY.md](docs/PRIVACY.md) | What data the app keeps |

## About

A solo, non-commercial project built for one group of friends. It isn't affiliated with or endorsed by The Pandemonium Institute, the publisher of Blood on the Clocktower. The app bundles no official role art.
