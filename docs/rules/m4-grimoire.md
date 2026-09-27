# M4 · Grimoire rules

Status: **Approved** by the owner, 2026-09-27.

## TOKEN · Reminder tokens

- **TOKEN-01** The DM can add reminder tokens to any seat and remove them. A token is 中毒, 醉酒, one of the script's role reminders, or custom text of up to 8 characters. · *pgTAP, E2E*
- **TOKEN-02** Until the game ends, only the DM can see tokens. · *pgTAP, SECRET-style network check (E2E)*

## LOG · DM log (说书人日志)

- **LOG-01** The DM can add a log entry to any seat. Each entry is tagged automatically with the current phase. The DM can edit or delete their entries. · *pgTAP, E2E*
- **LOG-02** Until the game ends, only the DM can see the log. After it ends, the log appears in the summary and history. · *pgTAP*
- **LOG-03** The DM can filter the log by seat and by phase. · *E2E*

## GRIM · Grimoire layout

- **GRIM-01** On screens 1024 px wide or more, the grimoire shows the seats in a circle, clockwise from the top in seat order. On narrower screens, it shows a list with no horizontal scroll. · *E2E (tablet + phone, with screenshots)*
- **GRIM-02** Each seat in the grimoire shows its number, nickname, actual role, shown role (if different), alignment (if it differs from the team default), alive or dead, ghost-vote status and tokens. · *E2E*
- **GRIM-03** Selecting a seat opens its detail panel, with every DM action for that seat: change roles or alignment, mark dead or revive, set ghost vote, tokens and log. · *E2E*
- **GRIM-04** The grimoire always uses the dark grimoire theme, whatever the phase. · *E2E*
- **GRIM-05** The grimoire shows the current nomination and vote-circle progress, with the same counts that players see. · *E2E*
