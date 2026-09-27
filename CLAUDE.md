# Blood on the Clocktower — UCSB Game Companion

A web app for a local UCSB group playing **Blood on the Clocktower (血染钟楼)** face to face. The DM and players join an online room, and the app tracks the game while it's played in person.

## Read first

The plan lives in [`docs/plan/`](docs/plan/), not in this file:

| File | What's in it |
|---|---|
| [roadmap.md](docs/plan/roadmap.md) | **Current status, the phase gate, milestones, what's waiting on the owner, open questions, and the decision log. Read this first every session.** |
| [requirements.md](docs/plan/requirements.md) | What the app does: permissions, rooms, game flow, voting, board, accounts, scripts, pages |
| [architecture.md](docs/plan/architecture.md) | Stack, game-action architecture, data model, repo layout, environments, testing strategy |
| [design.md](docs/plan/design.md) | Visual direction, device targets, themes, mockup link |

Testable behavior is specified as numbered rules in `docs/rules/`.

## Working with the owner

- **Phase gate: never start a milestone or any build work (scaffolding, installing, writing app code) until the owner explicitly says to advance.** Approving a decision isn't approval to proceed. After recording a decision, stop and ask. When a milestone is done, report and stop.
- For design questions, lead with a concrete draft and flagged decision points, each with a recommended default and a one-line reason. The owner often replies "go with the recommendation."
- Record every decision right away in the relevant `docs/plan/` file, and add a dated entry to the decision log in `roadmap.md`. Keep roadmap.md's status current.
- The owner delegates visual and art direction to Claude (see design.md). The frontend must be beautiful, not just functional.

## Conventions

- **All user-facing text is in Simplified Chinese.** Code, identifiers, comments and docs are in English.
- Keep roles secret at the database level (RLS), never only in the UI. Secrets never go in the frontend, commits or chat.
- Tests trace to rule IDs in `docs/rules/`. Never weaken, skip or delete a test to make it pass. If a test seems wrong, ask the owner.
