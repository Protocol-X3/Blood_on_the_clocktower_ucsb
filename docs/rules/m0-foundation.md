# M0 · Foundation rules

Status: **Approved** by the owner, 2026-09-27.

These rules make sure the base is sound before any feature exists. They stay in force for the whole project.

## SEC · Security baseline

- **SEC-01** Every table in the `public` database schema has Row Level Security enabled. A table without RLS would be readable and writable by any signed-in user, so this check runs on every build and fails the moment a table is added without RLS. · *pgTAP*
- **SEC-02** The built website never contains a secret: no service-role key, database password or API key, and no `service_role` credential of any kind. · *Script (scans the production build)*
- **SEC-03** No committed file contains a secret or the admin email. `.env.local` and other `.env*` files (except `.env.example`) are git-ignored. · *Script*

## UI · Cross-cutting UI

- **UI-01** Player-facing pages never scroll horizontally on a phone-sized screen (360–430 px wide). · *E2E (phone)*
- **UI-02** Every button, link and input on player-facing pages is at least 44 px tall. · *E2E (phone)*
- **UI-03** All user-facing text is Simplified Chinese: the page language is `zh-CN`, and every page has a Chinese title. · *E2E*
- **UI-04** The app has three visual themes: day (parchment), night (midnight) and grimoire (dark candlelit). Every design-system component renders correctly in all three. · *E2E (design gallery + screenshots)*
- **UI-05** Text meets WCAG AA contrast (4.5:1 for body text, 3:1 for large text) in all three themes. · *E2E (automated accessibility check)*
- **UI-06** When the device asks for reduced motion, decorative animations (star twinkle, card flip, clock-hand sweep, death fade) are turned off or replaced with an instant change. · *E2E*
- **UI-07** An unknown address shows a Chinese "page not found" page with a link back to the home page. · *E2E*

## QA · Test harness

- **QA-01** `npm run verify` runs typecheck, lint, the rule check, unit tests with coverage, integration tests and E2E tests, and fails if any of them fails. · *Script*
- **QA-02** CI runs on every push. It runs everything in `npm run verify` plus the database tests against a fresh Docker database, and reports failure if anything fails. · *CI*
- **QA-03** Coverage gates are enforced: `src/lib` must reach 100% lines and ≥95% branches, and other unit-tested code ≥70%. Falling below fails the build. · *Script*
- **QA-04** No test is skipped or focused: `.skip`, `.only`, `fixme` and `todo` fail the lint step. · *Script*
- **QA-05** Every active rule has at least one test, and no test names an unknown rule ID. · *Script (the rule checker, with its own tests)*
- **QA-06** Mutation testing on `src/lib` scores at least 85%, or `npm run mutate` fails. · *Script*
- **QA-07** `npm run preflight` reports pass or fail for each phase entry requirement and never prints a secret value. · *Unit*
- **QA-08** A committed test ledger records how many tests name each rule ID and exit-criterion ID. CI fails if any count goes down; counts may only grow, and the ledger is updated in the same commit. *(Safeguard D.)* · *Script, CI*
- **QA-09** Each exit criterion (e.g. `M1.3`) is named in the test that proves it. `npm run check:milestone M<n>` runs the gates plus every tagged test, and exits 0 only if every criterion of M<n> has a passing test. *(Safeguard A.)* · *Script (with its own tests)*
- **QA-10** `main` is protected on GitHub: merging requires both CI jobs to pass. *(Safeguard B.)* · *Script (checks the branch protection via `gh api`)*
- **QA-11** Every finished milestone has a saved report, `docs/reports/M<n>.md`, with the evidence for each criterion, and a git tag `m<n>-done` on the certified commit. *(Safeguard E.)* · *Script*

## DEP · Deployment

- **DEP-01** Every push to `main` deploys to Vercel, and the deployed home page loads. · *E2E (smoke, against the deployed URL)*
- **DEP-02** Deep links work on the deployed site: opening `/room/K7QX` or any other app route directly loads the app instead of a server 404. · *E2E (smoke)*
