# Requirements

What the app does. The architecture is in [architecture.md](architecture.md), the look in [design.md](design.md), and the status in [roadmap.md](roadmap.md). Detailed, testable behavior is in the rule catalog, [`docs/rules/`](../rules/).

## Purpose

A web app that tracks game information for a local UCSB college group playing **Blood on the Clocktower (血染钟楼)** face to face. The DM (Storyteller) and the players join the same online room. The app handles tracking and announcements, and the game itself happens in person.

- Owner: solo developer. Non-commercial and informal, built for one local group.
- **The UI is in Chinese (简体中文).**

## User permission levels

These are account-level permissions, separate from in-game roles.

- **Admin:** exactly one account, the owner's. Can grant or revoke DM-eligible for any user. Is implicitly DM-eligible.
- **DM-eligible (可担任说书人):** may take the DM seat of a room.
- **Player (玩家):** the default for everyone.

These are enforced in the database (RLS / security-definer functions), not only in the UI.

## Rooms vs. games

- **DM is a per-game role, not a user attribute.** A user can be the DM in one game and a player in another.
- A **room** is persistent and hosts **multiple consecutive games** with the same group. Players join it with a room code, and state syncs in real time.
- A room has one **DM seat**:
  - Only DM-eligible users can take it.
  - The DM can leave the DM seat only while no game is in progress. Then another DM-eligible user in the room can take it, e.g. a different DM for the next game after the current one ends.
  - **Exception:** the admin can force-reassign the DM seat to another DM-eligible user even mid-game, e.g. if the DM's phone dies.
- **Only DM-eligible users (and the admin) can create rooms.** Players only join.
- A room lives until its creator or the admin closes it, or it auto-closes after about 24 hours of inactivity. Its games stay in history.
- **Guests can never be DM-eligible.** They must upgrade to Google sign-in first.

## Game flow

Game states: `lobby 大厅` → `setup 配置` → `in_progress 进行中` → `ended 已结束` → the room returns to the lobby for the next game.

### 1. Lobby

Players join the room with the code and pick a seat number matching their physical position (neighbors matter). The DM can move or kick players.

### 2. Setup

The DM has a dedicated step-by-step setup wizard. It opens only once every seat has a player. Every step has a **返回** button that goes back one step, keeping what was already chosen; 返回 on the basics step returns to the lobby and discards the setup. Changing the script clears the composition, and changing the assignment mode clears the assignments or draws.

1. **Basics:** seat count (5–15), script, and assignment mode.
   - **Manual:** the DM assigns roles to seats.
   - **Card draw (抽卡):** roles are shuffled into face-down cards, and each player picks one on their phone.
2. **Role composition:**
   - How many Demons, Minions, Outsiders and Townsfolk. The recommended counts for the player count are shown as a hint.
   - Which specific roles are used.
   - The shown role for each role, if it differs from the actual role.
   - In manual mode, which seat gets each role.
3. **Draw / confirm:** in card-draw mode, players draw their cards.
   - Players draw freely, in any order.
   - A player can see their shown role immediately after drawing, like pulling a token from the bag. The DM sees the results live.
   - Two players can tap the same card at once. The first tap wins, enforced atomically in the database, and the other player sees "已被抽走，请重选" and picks again.
4. **Start (开始游戏).**

**Shown role vs. actual role:**
- Every seat always has both an **actual role** (真实角色) and a **shown role** (展示角色). They're identical by default and differ for roles like the Drunk or the Lunatic.
- A player only ever sees their own **shown role**. Actual roles are DM-only until the summary.
- On the player's own screen, the role card is **face down by default**, so people nearby can't read it. The player taps to see it, taps again to hide it, and it turns back over when the app goes to the background.
- The role card shows the role's name, type and ability, but **no alignment** (善良/邪恶). Alignment is DM-only; if a player's alignment changes, the DM tells them in person.

### 3. In progress

- **Phases:** 第1夜 → 第1天 → 第2夜 … The DM advances the phase with one button. Board posts are tagged with the phase; the DM log has a column per phase.
- **The DM can at any time:**
  - mark a player dead with a public **cause** (e.g. 处决 executed, 夜间死亡 died at night), or revive them;
  - manage reminder tokens (中毒, 醉酒, custom);
  - keep the **DM log table** (说书人日志): a row per seat plus note rows, and columns 座位 / 玩家 / 初始角色 / 角色设置 / 第1夜 / 第1天 … (min(5, ⌊players / 2⌋) nights and days to start). The 日志 tab shows one phase at a time; the full table sits at the bottom of the DM's page with the first three columns pinned. The DM colours cells (red evil or wrong, yellow outsider, violet drunk or poisoned, green correct, grey dead) by painting single cells or dragged rectangles; evil and outsider rows start red and yellow. See [log-spreadsheet.md](log-spreadsheet.md);
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

### 4. Ended

The DM picks the winning team. Everyone sees the **summary page**: actual and shown roles, alignments, deaths and the DM log table (read-only). Stats are recorded, with guests excluded.

**Reconnecting:** all state lives in the database, so a player who refreshes or re-opens the page rejoins where they were.

## Out of scope (for now)

- Direct messages.
- Role-specific interfaces or ability automation. Abilities and info are handled in person. Role assignment is the only role-aware feature.
- Rules enforcement. The app is a smart record-keeper, and the DM applies the rules.
- **Travellers, Fabled and Lorics (奇遇).**
- **Night order.** Night-order fields in imported scripts are ignored.

## Accounts and history

- **Google sign-in** (Supabase Auth). Each profile has a unique nickname shown in the app.
- **Guest login (游客登录):** guests sign in themselves on their own phone with just a nickname, using Supabase anonymous sign-in. They get the full player experience, but their games are excluded from stats. A guest can later upgrade to Google sign-in and keep their history.
- Every game is stored. Store each player's **final** alignment, since alignment can change mid-game.
- v1 stats: overall win rate, win rate by team (good/evil), games played, most-played roles, and games run as DM. More will be added later.

## Scripts

The group switches between many custom scripts, and it usually has **only a photo** of the script, not a file. Custom scripts may contain **homebrew roles that aren't in the official library**.

Ways to add a script:
1. **Photo → Claude (primary).** The owner sends a photo of the script to Claude in a Claude Code session. Claude reads it, maps the roles to the library, adds homebrew roles as custom roles, and saves the script to the database, following a project skill. *Changed (2026-09-28): this replaces the planned in-app photo upload, Edge Function and review form.* The owner checks the result in the app, where the manual editor can fix anything.
2. **Manual editor:** pick roles from the library, or add custom roles by hand.
3. ~~**JSON import**~~: dropped for now (2026-09-28).

Internal script format: compatible with the standard BotC script JSON.
- A `{"id":"_meta", "name", "author"}` entry.
- Official roles as ID strings.
- Custom roles as full objects: `id`, `name`, `team`, `ability`, and optionally `reminders`.

The **role library** holds the official roles (with Chinese names and abilities: the three base editions, 实验性角色 and 华灯初上) plus custom roles saved from imported scripts, so they're reusable.
- Claude maps recognized roles to library IDs and only creates custom roles for unknown or homebrew ones. A photo's role reuses the library role when its ability means the same thing, even if worded differently; any change in meaning (e.g. "选择一名玩家" vs "选择一名存活的玩家") makes it a separate custom role. When unsure, Claude asks the owner.
- Custom roles, from the editor or from photos, live in the library's **自制角色** collection.
- **Seeding the library:** the official roles' Chinese names, abilities and reminders come from the official Chinese wiki. Photo imports add custom roles to the library over time.

## Pages

| Route | Page |
|---|---|
| `/` | 首页: create a room, join by code, recent games |
| `/login` | 登录: Google or 游客 (guest) |
| `/room/:code` | 房间: lobby, then the game. One URL for everyone: the view (DM console or player view) depends on the user's role in that room, and database rules control what data they get. |
| `/room/:code/summary` | 对局结算: end-of-game reveal of all roles and the grimoire |
| `/profile/:id` | 个人主页: stats and game history |
| `/games/:id` | 历史对局详情 |
| `/scripts` | 剧本库: manual editor, browse |
| `/scripts/:id` | 剧本详情: role list by team, editable |
| `/admin` | 管理: grant or revoke DM-eligible (admin only) |
