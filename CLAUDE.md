# Blood on the Clocktower — UCSB Game Companion

A web app that tracks game information for a local UCSB college group playing **Blood on the Clocktower (血染钟楼)** face to face. The DM (Storyteller) and the players join the same online room. The app handles tracking and announcements, and the game itself happens in person.

- Owner: solo developer. Non-commercial and informal, built for one local group.
- **The UI is in Chinese (简体中文).** All user-facing text is in Chinese. Code, identifiers and comments are in English.

## Project status

**Planning phase.** We're still deciding the stack, structure and details. Don't scaffold, install dependencies or write app code until the owner explicitly says to move to the next stage.

## Working with the owner
- For design questions, lead with a concrete draft and flagged decision points, each with a recommended default and a one-line reason. The owner often replies "go with the recommendation."
- Record every decision in this file right away.
- The owner delegates visual and art direction to Claude (see Visual design).
- When the owner says to move to the build stage, remind them of the "To do when the build starts" list, starting with the UI mockup.

## Requirements

### User permission levels
These are account-level permissions, separate from in-game roles.
- **Admin:** exactly one account, the owner's. Can grant or revoke DM-eligible for any user. Is implicitly DM-eligible.
- **DM-eligible (可担任说书人):** may take the DM seat of a room.
- **Player (玩家):** the default for everyone.

Enforce these in the database (RLS / security-definer functions), not only in the UI.

### Rooms vs. games
- **DM is a per-game role, not a user attribute.** A user can be the DM in one game and a player in another.
- A **room** is persistent and hosts **multiple consecutive games** with the same group. Players join it with a room code, and state syncs in real time.
- A room has one **DM seat**:
  - Only DM-eligible users can take it.
  - The DM can leave the DM seat only while no game is in progress. Then another DM-eligible user in the room can take it, e.g. a different DM for the next game after the current one ends.
  - **Exception:** the admin can force-reassign the DM seat to another DM-eligible user even mid-game, e.g. if the DM's phone dies.
- **Only DM-eligible users (and the admin) can create rooms.** Players only join.
- A room lives until its creator or the admin closes it, or it auto-closes after about 24 hours of inactivity. Its games stay in history.
- **Guests can never be DM-eligible.** They must upgrade to Google sign-in first.

### Game flow
Game states: `lobby 大厅` → `setup 配置` → `in_progress 进行中` → `ended 已结束` → the room returns to the lobby for the next game.

**1. Lobby.** Players join the room with the code and pick a seat number matching their physical position (neighbors matter). The DM can move or kick players.

**2. Setup.** The DM has a dedicated step-by-step setup wizard:
1. **Basics:** seat count, script, and assignment mode.
   - **Manual:** the DM assigns roles to seats.
   - **Card draw (抽卡):** roles are shuffled into face-down cards, and each player picks one on their phone.
2. **Role composition:**
   - How many Demons, Minions, Outsiders and Townsfolk. The recommended counts for the player count are shown as a hint.
   - Which specific roles are used.
   - The shown role for each role, if it differs from the actual role.
   - In manual mode, which seat gets each role.
3. **Draw / confirm:** in card-draw mode, players draw their cards.
   - Players draw freely, in any order.
   - A player sees their shown role immediately after drawing, like pulling a token from the bag. The DM sees the results live.
   - Two players can tap the same card at once. The first tap wins, enforced atomically in the database, and the other player sees "已被抽走，请重选" and picks again.
4. **Start (开始游戏).**

**Shown role vs. actual role:**
- Every seat always has both an **actual role** (真实角色) and a **shown role** (展示角色). They're identical by default and differ for roles like the Drunk or the Lunatic.
- A player only ever sees their own **shown role**. Actual roles are DM-only until the summary.

**3. In progress.**
- **Phases:** 第1夜 → 第1天 → 第2夜 … The DM advances the phase with one button. Log entries and board posts are tagged with the phase.
- **The DM can at any time:**
  - mark a player dead with a public **cause** (e.g. 处决 executed, 夜间死亡 died at night), or revive them;
  - manage reminder tokens (中毒, 醉酒, custom);
  - write DM log entries per seat;
  - change a seat's shown role, actual role or alignment.
- **Mid-game role changes:** the DM updates the shown and/or actual role. The player's screen just shows the new shown role, with no notification. The DM tells them in person.
- **Nominations and voting (days only):**
  1. The DM opens a nomination (nominator → nominee). The app warns about rule breaks (each player nominates once and is nominated once per day) but doesn't block them.
  2. Players freely raise (举手) or lower their hand. Hand states are visible live.
  3. The DM starts the **vote circle (计票)**. Following the rules, the "clock hand" moves seat by seat clockwise, starting from the seat after the nominee and ending with the nominee. As it passes each seat, that seat's vote is **locked**.
     - The clock hand advances **automatically** at an adjustable speed (about 1–2 seconds per seat).
     - The DM can **pause** it or **step** it manually, and can correct a locked vote.
     - Dead players can only vote with their unused ghost vote, and using it spends it.
  4. When the full circle is done, the app shows the final count and the DM closes the vote. The threshold is half of living players, rounded up. The highest count at or above the threshold puts that player on the block (上处决台). A tie means nobody is on the block.
  5. At the end of the day, the DM confirms the execution, or no execution. The DM can always mark deaths manually for special cases.
- **Board (公告板):** players can post at any time. Posts are:
  - signed with seat and name;
  - tagged with the phase;
  - deletable by the author or the DM;
  - kept in the game history.

**4. Ended.** The DM picks the winning team. Everyone sees the **summary page**: actual and shown roles, alignments, deaths and the DM log. Stats are recorded, with guests excluded.

**Reconnecting:** all state lives in the database, so a player who refreshes or re-opens the page rejoins where they were.

### Out of scope for now
- Direct messages.
- Role-specific interfaces or ability automation. Abilities and info are handled in person. Role assignment is the only role-aware feature.
- Rules enforcement. The app is a smart record-keeper, and the DM applies the rules.
- **Travellers and Fabled** aren't supported.

### Accounts and history
- **Google sign-in** (Supabase Auth). Each profile has a unique nickname shown in the app.
- **Guest login (游客登录):** guests sign in themselves on their own phone with just a nickname, using Supabase anonymous sign-in. They get the full player experience, but their games are excluded from stats. A guest can later upgrade to Google sign-in and keep their history.
- Every game is stored. Store each player's **final** alignment, since alignment can change mid-game.
- v1 stats: overall win rate, win rate by team (good/evil), games played, most-played roles, and games run as DM. More will be added later.

### Scripts
The group switches between many custom scripts, and it usually has **only a photo** of the script, not a file. Custom scripts may contain **homebrew roles that aren't in the official library**.

Ways to add a script, from most to least important:
1. **Photo → LLM → script (primary).** The DM uploads a photo. A server-side function sends it to Claude (vision + structured output) and gets back a script in our format. The DM then **reviews and edits the result in a form before saving**, since LLM output can't be trusted blindly.
2. **Manual editor:** pick roles from the library, or add custom roles by hand.
3. **JSON import:** the standard BotC script JSON, supported as a cheap bonus.

Internal script format: compatible with the standard BotC script JSON.
- A `{"id":"_meta", "name", "author"}` entry.
- Official roles as ID strings.
- Custom roles as full objects: `id`, `name`, `team`, `ability`, and optionally `reminders`.

The **app does not handle night order.** Night-order fields in imported JSON (`firstNight`, `otherNight`, etc.) are ignored.

The **role library** holds the official roles (with Chinese names and abilities) plus custom roles saved from imported scripts, so they're reusable.
- The LLM prompt includes the library's role list, so it maps recognized roles to library IDs and only outputs full objects for unknown or homebrew roles.
- **Seeding the library:** generate the official roles' Chinese names and abilities once with an LLM script, and have the owner review them. Reviewed photo imports then add to the library over time.

## Key design principles

- **Keep roles secret at the data level, not only in the UI.** Players can read only public state and their own seat's role. The grimoire (all roles, tokens and DM notes) is readable only by that room's DM. Enforce this with Postgres Row Level Security, never by hiding things in the client.
- **Keep secrets server-side.** The Anthropic API key lives only in the Supabase Edge Function, never in the frontend.
- **Favor simplicity:** free-tier hosting, low maintenance and a mobile-first layout, since players use their phones at the table.

## Tech stack (agreed)

| Layer | Choice |
|---|---|
| Language | TypeScript |
| Frontend | React + Vite + React Router: a multi-page app with client-side routing, installable as a PWA. Next.js isn't needed: there's no SEO, and client-side navigation keeps the room's realtime connection alive. |
| UI | Tailwind CSS + shadcn/ui (Radix primitives, heavily re-themed) + Motion (framer-motion) for animation |
| Backend | Supabase: Postgres, Auth (Google), Realtime, Row Level Security, Storage (script photos), Edge Functions |
| LLM | Claude API (`claude-opus-5`) from a Supabase Edge Function using the `@anthropic-ai/sdk`. It takes an image input and returns structured JSON output (`output_config.format`). |
| Hosting | Vercel or Cloudflare Pages |

Notes:
- Supabase's free tier pauses a project after about 7 days of inactivity.
- Anthropic API usage is pay-as-you-go. The estimate is roughly $0.10–0.25 per script photo on Opus 5.

### Architecture
- **Game actions are Postgres functions called via RPC** (e.g. `supabase.rpc('draw_card')`). This includes starting the game, drawing a card, changing phase, nominating, voting, advancing the vote and changing roles.
  - Each function checks permissions and state inside one transaction, so the actions are atomic and cheat-proof.
  - The client reads tables and subscribes to Realtime changes, but never writes game state directly.
- **Edge Functions** are only for things that need secrets or outside APIs: the Claude photo → script call.
- **Vote clock timer:** the DM's client drives it, calling `advance_vote()` every tick, and the database validates each step. If the DM's device sleeps, the vote just pauses.

### Repo layout
```
src/pages/          one file per route
src/features/       auth, room, setup, voting, grimoire, board, scripts, stats, admin
src/components/ui/  shadcn/ui components (re-themed)
src/lib/            supabase client, generated DB types, pure game logic
supabase/migrations/  versioned SQL: tables, RLS, RPC functions
supabase/functions/   Edge Functions (parse-script)
supabase/tests/       pgTAP tests for security rules
supabase/seed.sql     dev data + role library
tests/unit/  tests/integration/  tests/e2e/   Vitest, simulation and Playwright tests
docs/rules/         numbered rule catalog (the spec that the tests trace to)
tools/              one-off scripts (e.g. generating the role library, checking rule coverage)
```

### Dev workflow
- **Local dev runs a full Supabase stack in Docker** (via the Supabase CLI) with fake data. `supabase db reset` rebuilds it from the migrations and the seed. Production is the Supabase cloud project plus Vercel, and it only receives tested migrations via `supabase db push`.
- GitHub: `Protocol-X3/Blood_on_the_clocktower_ucsb`. Vercel auto-deploys `main`, and database migrations are pushed with the Supabase CLI.
- Generate DB types with `supabase gen types` after every schema change.
- Testing: see the Testing strategy section.

### Testing strategy
The goal is a comprehensive, automated test system so that edge cases don't need to be checked by hand. It also lets Claude build each milestone autonomously, looping until everything passes.

**1. Spec first: the rule catalog (`docs/rules/`)**
- Every behavior is written as a numbered rule before it's implemented, e.g. `VOTE-07: a dead player whose ghost vote is spent cannot raise their hand`.
- The owner reviews the rules, not the code or the tests.
- Every test names the rule IDs it covers. A check script fails if any rule has no test.
- Tests come from the spec, never from the implementation. This stops tests from just confirming the code's own bugs.

**2. Test layers**
| Layer | Tool | What it covers |
|---|---|---|
| Static | `tsc --noEmit`, ESLint | Type errors, obvious mistakes |
| Unit | Vitest | Pure game logic in `src/lib` (vote tally, circle order, team counts, script parsing) |
| Property-based | fast-check (with Vitest) | Random inputs and random action sequences, checked against invariants. This finds edge cases nobody listed. |
| Security | pgTAP | RLS and RPC permissions. An auto-generated **permission matrix** tests every RPC × every actor (admin, DM, seated player, other player, guest, anonymous) × every game state. |
| Integration / simulation | Vitest + supabase-js against local Supabase | Full games played by N fake users through the real RPCs. Random-sequence **model-based tests** compare the database against a simple reference model of the game. |
| End-to-end | Playwright (several browser contexts = several players) | Key flows across real screens with realtime sync, plus screenshots of key screens for visual review |
| Mutation | StrykerJS (Vitest runner) | Deliberately breaks `src/lib` code and checks that the tests catch it. This proves the tests actually assert things. |

**3. Quality gates**
- Coverage (Vitest v8): `src/lib` requires **100% lines and ≥95% branches**. Other frontend code has a lower bar (~70%), since the UI is also covered by E2E tests.
- Mutation score on `src/lib`: **≥85%**. It runs at the end of each milestone, not on every commit, because it's slow.
- SQL has no mainstream coverage or mutation tooling. The permission matrix and the model-based simulation are its substitute, and every RPC must be covered by both.

**4. Commands**
- `npm run verify`: the single gate. It runs typecheck, lint, unit tests with coverage thresholds, `supabase test db` (pgTAP), integration tests and E2E tests. It must pass before a milestone is done. CI (GitHub Actions) runs the same checks on every push.
- `npm run mutate`: Stryker, run at each milestone.

**5. Autonomous milestone loop**
1. Write or extend the rule catalog → the owner approves it.
2. Write the tests from the rules. They fail at first, and every rule must be covered.
3. Implement until `npm run verify` passes and the coverage and mutation gates are met.
4. **Never weaken, skip or delete a test to make it pass.** If a test itself seems wrong, stop and ask the owner. Changing a rule means changing the spec first.
5. Report the results, and screenshots of new screens, to the owner.

**6. What automation can't cover**
Look and feel, wording, and how it plays at a real table. These are covered by:
- mockup approval;
- screenshot review each milestone;
- the bot sandbox, a dev-only tool that adds N bot players so the owner can run a full game solo;
- a dress rehearsal with 2–3 friends before the first real game night.

### Visual design
**The frontend must be beautiful, not just functional.** Claude owns the art direction. It's a first-class requirement, so never ship default-looking shadcn/Tailwind screens.

Direction (draft): **"Candlelit grimoire" (烛光魔典)**

**Mood:**
- Dark ink/midnight backgrounds, parchment-textured cards, antique gold accents, blood crimson for evil and death.
- **Day and night change the ambient theme.** Night is deep blue with faint stars. Day is warm dusk and parchment tones.

**Team colors:** these follow BotC convention, blue for good and red for evil.
- Townsfolk: blue
- Outsider: teal
- Minion: orange-red
- Demon: crimson

**Typography:** Noto Serif SC (思源宋体) for headings and role names, and Noto Sans SC for body text.

**Signature motion moments:**
- the card-draw flip;
- the vote clock hand sweeping around the seat circle as votes lock;
- a death transition (portrait fades to grey, and a shroud marker appears).

**Grimoire layout:** a circle of seats on tablet and desktop, falling back to a compact list or grid on phones.

**Role art:** don't bundle official role icons, which are the publisher's copyright. Use per-role image URLs when a script provides them, and otherwise a styled token showing the role's first character.

### Pages
| Route | Page |
|---|---|
| `/` | 首页: create a room, join by code, recent games |
| `/login` | 登录: Google or 游客 (guest) |
| `/room/:code` | 房间: lobby, then the game. One URL for everyone: the view (DM console or player view) depends on the user's role in that room, and database rules control what data they get. |
| `/room/:code/summary` | 对局结算: end-of-game reveal of all roles and the grimoire |
| `/profile/:id` | 个人主页: stats and game history |
| `/games/:id` | 历史对局详情 |
| `/scripts` | 剧本库: photo upload, manual editor, JSON import, browse |
| `/scripts/:id` | 剧本详情: role list by team, editable |
| `/admin` | 管理: grant or revoke DM-eligible (admin only) |

### Draft data model
- `profiles`: nickname, permission level (admin / dm_eligible / player), is_guest
- `roles`: the role library, official and custom
- `scripts`
- `rooms`: code, current DM seat holder, seat count, current game
- `room_members`: who is in the room and their seat
- `games`: room, script, DM, assignment mode, status, phase, winner
- `game_seats`: seat, player, actual role, shown role, alignment, alive, death cause, ghost vote used. Access to roles is restricted.
- `grimoire_tokens`: DM only
- `dm_log`: DM only
- `nominations`: nominator, nominee, phase, vote-circle state, final count
- `votes`: live hand state per seat, locked flag
- `board_posts`

## Build milestones
The owner will only use the app with the group once it's fully ready, so the milestones are ordered by technical dependency, not by early table value.

| # | Milestone | Scope |
|---|---|---|
| M0 | Foundation | Mockup approved, scaffold, design system (theme, fonts, tokens), local and cloud Supabase, deploy pipeline, **the full test harness** (`npm run verify`, CI, coverage and mutation config, rule-coverage check) |
| M1 | Accounts & rooms | Google and guest login, profiles, permission levels + `/admin`, create/join room, seats, DM seat |
| M2 | Setup & roles | Official role library seeded in Chinese (LLM-generated, reviewed by the owner), manual script editor, setup wizard, manual and card-draw assignment, shown/actual roles |
| M3 | Live game | Phases with the day/night theme, deaths with causes, revives, ghost votes, nominations, vote clock circle, board, end game + summary, bot sandbox (dev only) |
| M4 | Grimoire | Reminder tokens, per-seat DM log, circle grimoire layout |
| M5 | Scripts | Photo → Claude → review form, JSON import, custom roles saved into the library |
| M6 | Stats & history | Profile stats, game history pages |

## To do when the build starts
- **UI mockup first:** before building screens, make a visual mockup of a key screen (e.g. the player room view) in the "candlelit grimoire" style for the owner to react to. Remind the owner of this when moving to the build stage.

- **Environment setup:** install Docker Desktop (with WSL2) and the Supabase CLI, and create the Supabase cloud project (production).

## Open questions
None right now.
