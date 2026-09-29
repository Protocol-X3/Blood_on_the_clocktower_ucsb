# M3 · Live game rules

Status: **Approved** by the owner, 2026-09-27.

"Everyone sees X" means every member of the room sees it within 3 seconds, without reloading.

## PHASE · Day and night

- **PHASE-01** A game starts at 第1夜. Each advance goes from night N to day N, then from day N to night N+1. · *Unit, pgTAP*
- **PHASE-02** Only the DM can advance the phase, and everyone sees the new phase. · *pgTAP, E2E*
- **PHASE-03** Player screens use the night theme during nights and the day theme during days. · *E2E*
- **PHASE-04** Phases only move forward; there's no undo. *Decided (2026-09-27): there's no undo button. Mistakes are fixed with the DM's other actions, such as reviving a player.* · *pgTAP*
- **PHASE-05** Nominations and votes only happen during days. · *pgTAP*

## DEATH · Deaths, revives and ghost votes

- **DEATH-01** The DM can mark any living player dead, with a cause: 处决 (executed), 夜间死亡 (died at night) or 其他 (other, with optional text). Everyone sees who died and why. · *pgTAP, E2E*
- **DEATH-02** The DM can revive a dead player, and everyone sees them alive again. *Decided (2026-09-27): a revived player keeps their ghost-vote status in case they die again, and the DM can adjust it (DEATH-04).* · *pgTAP, E2E*
- **DEATH-03** Dead players are shown greyed out with a shroud (亡) on every screen, and every seat token of a dead player is crossed out with a red X. *Changed (2026-09-28): the X was added to make deaths obvious at a glance.* · *E2E*
- **DEATH-04** A player who dies starts with one unused ghost vote. The DM can manually mark it used or unused. · *pgTAP*

## NOM · Nominations

- **NOM-01** Only the DM opens a nomination, by choosing the nominator and the nominee. Only one nomination can be open at a time. · *pgTAP*
- **NOM-02** The app warns the DM, but doesn't block, when the nominator already nominated today, the nominee was already nominated today, or the nominator is dead. · *Unit, E2E*
- **NOM-03** The DM can cancel an open nomination before the vote circle starts. · *pgTAP*
- **NOM-04** Everyone sees the open nomination: who nominated whom. · *E2E*

## VOTE · Voting and the vote circle

- **VOTE-01** While a nomination is open, every living player, and every dead player with an unused ghost vote, can raise (举手) or lower their hand freely. Everyone sees hand states live. · *pgTAP, E2E*
- **VOTE-02** A dead player whose ghost vote is spent can't raise their hand. · *pgTAP, E2E*
- **VOTE-03** The vote circle visits every seat exactly once, clockwise, starting with the seat after the nominee and ending with the nominee. · *Unit, Property*
- **VOTE-04** When the clock hand passes a seat, that seat's vote is locked as it stands, and the player can't change it anymore. · *pgTAP, E2E*
- **VOTE-05** The clock hand advances automatically, at 1.5 seconds per seat by default. The DM can set the speed between 0.5 and 3 seconds. · *E2E*
- **VOTE-06** The DM can pause and resume the clock hand, or step it forward one seat at a time. · *E2E*
- **VOTE-07** A dead player whose locked vote is a raised hand spends their ghost vote. · *pgTAP*
- **VOTE-08** Before closing the vote, the DM can correct any locked vote, and the ghost vote is spent or refunded to match. · *pgTAP*
- **VOTE-09** A nomination's vote count is the number of locked raised hands. · *Unit*
- **VOTE-10** The threshold is half the number of living players, rounded up. · *Unit, Property*
- **VOTE-11** At the end of each vote, the player on the block is the nominee with the highest count that day that is at or above the threshold. If two nominees share that highest count, nobody is on the block. · *Unit, Property*
- **VOTE-12** If the DM's device disconnects or sleeps mid-circle, the circle pauses and resumes from the same seat. · *Integration, E2E*
- **VOTE-13** When the circle completes, everyone sees the final count, the threshold and who is on the block. · *E2E*
- **VOTE-14** At the end of the day, the DM confirms the execution of the player on the block, which marks them dead with cause 处决, or confirms 无人处决 (no execution). · *pgTAP, E2E*

## BOARD · Public board (公告板)

- **BOARD-01** Every seated player, alive or dead, and the DM can post a message of 1–140 characters. DM posts are labelled 说书人. · *pgTAP, E2E*
- **BOARD-02** Posts show the seat number, nickname, phase and time, newest first. Everyone sees new posts. · *E2E*
- **BOARD-03** Authors can delete their own posts, and the DM can delete any post. Posts can't be edited. · *pgTAP*
- **BOARD-04** People who aren't members of the room can't read its board. · *pgTAP*

## END · Ending a game

- **END-01** Only the DM can end the game, choosing the winning team: 善良 (good) or 邪恶 (evil). · *pgTAP*
- **END-02** Ending the game records every seat's final actual role, shown role and alignment, and takes everyone to the summary page. · *pgTAP, E2E*
- **END-03** The summary shows every seat's actual and shown role, alignment, deaths with their causes, and the winning team. · *E2E*
- **END-04** After a game ends, the room goes back to the lobby for the next game, with seats kept. · *pgTAP, E2E*
- **END-05** Instead of ending the game, the DM can discard it, after a second confirmation. The game is deleted with everything recorded in it, never counts in anyone's stats or history, and has no summary. Everyone goes back to the lobby with seats kept and sees that the game was discarded. · *pgTAP, E2E*

## RECON · Reconnecting

- **RECON-01** A player who reloads or reopens the app returns to the same room, seat, role and current phase, including an open nomination or vote in progress. · *E2E*

## BOT · Bot sandbox (development only)

- **BOT-01** The bot sandbox ships with the live site but is **off** unless the admin switches it on under 管理 (it starts off). Only the admin can flip it. While it's off, nobody sees the bot tools and the database refuses every bot action. *Changed (2026-09-28): replaces "development builds only".* · *pgTAP, E2E*
- **BOT-02** While the sandbox is on, any room's DM can fill empty seats with bots. Bots draw cards, raise hands at random and post at random, so one person can run a full game. · *E2E*
