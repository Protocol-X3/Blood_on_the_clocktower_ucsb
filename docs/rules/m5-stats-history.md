# M5 · Stats & history rules

Status: **Approved** by the owner, 2026-09-27.

"Ended game" means a game the DM finished with a winning team. Games that were never ended don't count anywhere in stats.

## STATS · Player statistics

- **STATS-01** A user's games played is the number of ended games in which they held a player seat. Running a game as DM doesn't count as playing. · *Unit, Integration*
- **STATS-02** A game is a win when the player's **final** alignment matches the winning team. Win rate is wins ÷ games played, shown as a whole percentage, or "—" with 0 games. · *Unit, Property*
- **STATS-03** Win rate by team is calculated separately over the games where the player's final alignment was good, and those where it was evil. · *Unit, Property*
- **STATS-04** Most-played roles lists the player's top 3 roles by count, using the actual role they held when the game started. Ties go to the more recently played role. *Decided (2026-09-27): it uses the starting role, not the final role.* · *Unit*
- **STATS-05** Games as DM is the number of ended games the user ran as DM. · *Unit, Integration*
- **STATS-06** Guests have no stats. A game with guests still counts normally for the non-guest players in it. · *Unit, pgTAP*
- **STATS-07** When a guest upgrades to Google sign-in, their earlier games start counting toward their stats. *Decided (2026-09-27): all of the guest's earlier games count after the upgrade, not only the games played afterwards.* · *Integration*

## HIST · Game history

- **HIST-01** A user's profile lists their ended games, newest first, each with the date, script, their role, alignment and result. · *E2E*
- **HIST-02** A past game's page can be viewed by its participants (the players and the DM) and by the admin, and by no one else. · *pgTAP*
- **HIST-03** A past game's page shows everything from its summary, plus the nominations with their vote counts and the board posts. · *E2E*
- **HIST-04** Every signed-in user can see any profile's nickname and stats. Game details stay limited as in HIST-02. · *pgTAP, E2E*
- **HIST-05** The stats and history pages show the exact expected numbers for a seeded set of known games. · *E2E (fixture)*
