# M4 · Grimoire rules

Status: **Approved** by the owner, 2026-09-27. LOG-01 … LOG-06 and GRIM-03 revised for the log table, approved 2026-09-28 ([plan](../plan/log-spreadsheet.md)).

## TOKEN · Reminder tokens

- **TOKEN-01** The DM can add reminder tokens to any seat and remove them. A token is 中毒, 醉酒, one of the script's role reminders, or custom text of up to 8 characters. · *pgTAP, E2E*
- **TOKEN-02** Until the game ends, only the DM can see tokens. · *pgTAP, SECRET-style network check (E2E)*

## LOG · DM log (说书人日志), a table

- **LOG-01** The DM's log is a table with a row for every seat. Its columns are 座位, 玩家, 初始角色, 角色设置, then one per phase: at least min(5, ⌊players / 2⌋) nights and days, more once the game goes on longer. Each cell of 角色设置 and the phases holds one text of up to 500 characters that the DM can write, change or clear. · *pgTAP, E2E*
- **LOG-02** Until the game ends, only the DM can see the log. After it ends, the log appears in the summary and history, as the full table. · *pgTAP, E2E*
- **LOG-03** The 日志 tab shows one phase at a time, the current one by default, with a cell for every row. The DM can switch to any other phase the table shows and edit it. · *E2E*
- **LOG-04** The full table is at the bottom of the DM's page, below the console. Its 座位, 玩家 and 初始角色 columns stay in place while it scrolls sideways, and the page itself never scrolls sideways. · *E2E (tablet + phone)*
- **LOG-05** The DM can add note rows at the bottom of the table, below a divider, with an optional label of up to 12 characters, and can rename and delete them. · *pgTAP, E2E*
- **LOG-06** The DM can colour cells red, yellow, violet, green or grey (dead), or clear them, one cell or a dragged rectangle at a time, and undo the last stroke. When the game starts, each evil player's whole row is red and each outsider's whole row is yellow; a cell's own colour or 清除 overrides that. Deaths are never marked automatically. · *pgTAP, E2E*

## GRIM · Grimoire layout

- **GRIM-01** On screens 1024 px wide or more, the grimoire shows the seats in a circle, clockwise from the top in seat order. On narrower screens, it shows a list with no horizontal scroll. · *E2E (tablet + phone, with screenshots)*
- **GRIM-02** Each seat in the grimoire shows its number, nickname, actual role, shown role (if different), alignment (if it differs from the team default), alive or dead, ghost-vote status and tokens. · *E2E*
- **GRIM-03** Selecting a seat opens its detail panel, with every DM action for that seat: change roles or alignment, mark dead or revive, set ghost vote, tokens, and that seat's row of the log (角色设置 and each phase), editable. · *E2E*
- **GRIM-04** The grimoire always uses the dark grimoire theme, whatever the phase. · *E2E*
- **GRIM-05** The grimoire shows the current nomination and vote-circle progress, with the same counts that players see. · *E2E*
