# The DM log as a spreadsheet (planned)

Status: **planned 2026-09-28, waiting for the owner's go-ahead to build.** When it is built, this plan's rules replace LOG-01 to LOG-03 in [m4-grimoire.md](../rules/m4-grimoire.md), and this file becomes a record.

## What changes

The DM log (说书人日志) stops being a list of entries and becomes a table. It has **one row per player**, plus note rows the DM adds at the bottom. It has **one column per night and day**.

| 座位 | 玩家 | 初始角色 | 角色设置 | 第1夜 | 第1天 | 第2夜 | 第2天 | … |
|---|---|---|---|---|---|---|---|---|
| 1 | nickname | starting role (automatic) | free text | text | text | text | text | |
| … | | | | | | | | |
| *note row label* | | | | text | text | … | | |

## Owner's decisions (2026-09-28)

| Question | Decision |
|---|---|
| Where the full table lives | **At the bottom of the DM's page**, below the whole console, full width and always shown (no toggle). The round table stays where it is. |
| What a cell holds | **One text per cell**, like a spreadsheet. Several notes for one player in one phase are lines in the same cell. |
| 角色设置 column | **Free text only**, written by the DM (e.g. 红鲱鱼, 酒鬼以为自己是洗衣妇). Nothing is filled in automatically. |
| Editing earlier phases | **Allowed for any phase up to the current one.** Future phases are not shown and can't be written. |

## Defaults Claude chose (open to change)

- **Columns:**
  - 初始角色 is the role each seat had when the game started (`seat_roles.starting_role_id`). It is read-only.
  - The phase columns run from 第1夜 to the current phase.
- **The 日志 tab** becomes the per-phase view. The DM picks a night or day (the current one by default) and gets one cell for every player and note row in that phase. The seat and phase filters (old LOG-03) go away.
- **The seat panel** (GRIM-03) shows that seat's row as a vertical list: 角色设置, then each phase. It replaces today's per-seat composer and entries.
- **Note rows:**
  - Each has an optional label of up to 12 characters (e.g. 整局, 恶魔伪装), shown across the seat, name and role columns.
  - The DM adds rows with + 添加备注行, renames them, and deletes them. A row that still has text asks for confirmation first.
- **Saving:**
  - A cell saves when the DM leaves it or presses Ctrl/⌘+Enter, then shows 已保存.
  - Saving an empty cell removes it.
  - A live update never overwrites the cell being edited.
- **Limits:** up to 500 characters per cell, the same as today's entries.
- **Layout:**
  - The table scrolls sideways inside its own box, and the seat and name columns stay pinned. The page itself never scrolls sideways.
  - Dead players get the same X as on the seat circle.
- **After the game:** the summary and history page show the full table, read-only (LOG-02 is unchanged apart from that).
- **Secrecy:** unchanged. Only the DM can read the table during the game, and the game's participants can read it after it ends, enforced by RLS.

## Database

A new migration replaces `dm_log`. The live database has no log entries (checked 2026-09-28: 4 ended games, 0 entries), so nothing needs moving. The migration still converts any rows it finds, to be safe.

- `dm_log_notes (id, game_id, label, position, created_at)`: the note rows.
- `dm_log_cells (id, game_id, seat | note_id, column_kind 'setup' | 'night' | 'day', phase_number, body, updated_at)`:
  - Exactly one of seat or note_id is set.
  - Setup cells have no phase number.
  - There is one cell per row and column (`unique nulls not distinct`).
- Both tables use the same `can_see_secrets` read policy as today. They are added to realtime.
- The RPCs, all DM-only while the game is running:
  - `set_log_cell(game, seat, note, column, phase, body)`: upsert; an empty body deletes the cell. Fails `LOG_FUTURE_PHASE` beyond the current phase and `LOG_LENGTH` over 500 characters.
  - `add_log_note(game, label)`, `rename_log_note(note, label)`, `delete_log_note(note)`.
- `add_log`, `edit_log` and `delete_log` are dropped.

## Proposed rules (replace LOG-01 to LOG-03)

- **LOG-01** The DM's log is a table with a row for every seat. It has the columns 座位, 玩家, 初始角色, 角色设置, and one column per phase from 第1夜 to the current one. Each cell holds one text of up to 500 characters that the DM can write, change or clear. · *pgTAP, E2E*
- **LOG-02** *(unchanged)* Until the game ends, only the DM can see the log. After it ends, the log appears in the summary and history, as the full table. · *pgTAP, E2E*
- **LOG-03** The 日志 tab shows one phase at a time, the current one by default, with a cell for every row. The DM can switch to any earlier phase and edit it. · *E2E*
- **LOG-04** The full table is at the bottom of the DM's page, below the console. Its seat and name columns stay in place while it scrolls sideways, and the page itself never scrolls sideways. · *E2E (tablet + phone)*
- **LOG-05** The DM can add note rows at the bottom of the table, with an optional label, and can rename and delete them. · *pgTAP, E2E*
- **LOG-06** No cell can be written for a phase after the current one. · *pgTAP*
- **GRIM-03** *(reworded)* The seat panel's log section shows that seat's row (角色设置 and each phase), editable.

## Tests

- **pgTAP:**
  - Rewrite the LOG part of `m4_grimoire`: cells, upsert or clear, the future-phase block, note rows, secrecy before and after the end.
  - Swap the three old functions in `m4_matrix` for the four new ones.
- **Model-based simulation** (`tests/support/gameModel.ts`, `tests/integration/game-sim.test.ts`): random cell writes, clears and note rows instead of entries.
- **E2E** (`grimoire.spec.ts`): the per-phase view, editing an earlier phase, the full table with its columns and pinned columns on the phone and tablet, and note rows. Players never receive the log, and the summary shows the table.
- **Test ledger:** counts for LOG-01 to LOG-03 and GRIM-03 stay at least as high, and LOG-04 to LOG-06 are new.

## Docs to update when built

- `requirements.md`, §3 In progress and §4 Ended.
- `architecture.md`, the data model.
- `m4-grimoire.md`, the rules.
- The roadmap's status and decision log.
