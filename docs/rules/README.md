# Rule catalog

This is the specification the tests trace to (see architecture.md, Testing strategy). Every behavior of the app is a numbered rule. **Each phase has its own rule file, and a phase is done correctly only when every rule in its file has at least one passing test** (see roadmap.md, Exit criteria).

**Status: Approved by the owner, 2026-09-27.** The judgment calls flagged in the draft were accepted as written, and are marked *Decided*. New rules need the owner's approval before they count.

## Files by phase

| Phase | File | Areas |
|---|---|---|
| M0 · Foundation | [m0-foundation.md](m0-foundation.md) | SEC (security baseline), UI (cross-cutting UI), QA (test harness), DEP (deployment) |
| M1 · Accounts & rooms | [m1-accounts-rooms.md](m1-accounts-rooms.md) | AUTH (sign-in), PERM (permission levels), ROOM (rooms, seats, DM seat) |
| M2 · Setup & roles | [m2-setup-roles.md](m2-setup-roles.md) | LIB (role library), SCRIPT (script editor), SETUP (setup wizard), DRAW (card draw), SECRET (role secrecy) |
| M3 · Live game | [m3-live-game.md](m3-live-game.md) | PHASE, DEATH, NOM (nominations), VOTE (vote circle), BOARD, END, RECON (reconnect), BOT (bot sandbox) |
| M4 · Grimoire | [m4-grimoire.md](m4-grimoire.md) | TOKEN (reminder tokens), LOG (DM log), GRIM (grimoire layout) |
| M5 · Stats & history | [m5-stats-history.md](m5-stats-history.md) | STATS, HIST |

Rules of an earlier phase stay in force in every later phase. For example, SEC-01 is checked on every run, forever.

## Format

Each rule is one bullet whose ID is in bold, followed by how it's verified:

```md
- **VOTE-07** A dead player whose ghost vote is spent cannot raise their hand. · *pgTAP, E2E*
```

- IDs are `AREA-NN`, and an ID is never reused or renumbered.
- A rule states **observable behavior** in plain language, checkable against how the game is played. It doesn't describe implementation details.
- The verification tags say which test layer proves it: *Unit*, *Property*, *pgTAP*, *Integration*, *E2E*, *CI*, or *Script* (a repo check).
- Changing a rule's meaning means editing it here first. The tests follow after.
- A retired rule stays in the file, struck through (`- ~~**VOTE-07**~~ …`), so its ID isn't reused. Struck-through rules aren't checked.

## Traceability

- Every test that verifies a rule names the rule ID in its title, e.g. `it('SETUP-01: 7 players → 5/0/1/1', …)`. The same goes for pgTAP test descriptions.
- `npm run check:rules` fails when an active rule has no test mentioning its ID, or when a test mentions an ID that isn't defined here, which catches typos.
