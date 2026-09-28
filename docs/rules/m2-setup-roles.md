# M2 · Setup & roles rules

Status: **Approved** by the owner, 2026-09-27.

## LIB · Role library

- **LIB-01** The library contains every character of Trouble Brewing, Bad Moon Rising and Sects & Violets, the Experimental characters (实验性角色) and 华灯初上 (with its second season 山雨欲来, including both versions of the revised （改） roles), excluding Travellers, Fabled and Lorics. Each one has a stable ID (the standard English script-tool ID, or pinyin for 华灯初上), a Chinese name, a team and a Chinese ability description. Names, abilities and reminder tokens follow the official Chinese wiki (clocktower-wiki.gstonegames.com). *Changed (2026-09-28): the base editions' paraphrased wording was replaced with the wiki's.* · *Script (a completeness check against the list of IDs)*
- **LIB-02** Official library roles can't be edited or deleted through the app. · *pgTAP*
- **LIB-03** Each role shows a one-character token glyph (e.g. 占 for 占卜师). A role may override its glyph. · *Unit*

## SCRIPT · Script editor

- **SCRIPT-01** Every signed-in user can browse scripts. Only DM-eligible users can create or edit them. · *pgTAP, E2E*
- **SCRIPT-02** A script has a name (required, at most 30 characters), an optional author and at least one role. No role appears twice in the same script. · *Unit, pgTAP*
- **SCRIPT-03** A script can mix library roles and custom roles. A custom role needs a Chinese name, a team and an ability, and its ID must be unique. · *pgTAP, E2E*
- **SCRIPT-04** A custom role created in the editor is saved into the library, marked 自定义, so other scripts can reuse it. *Decided (2026-09-27): this is in M2, not M6, because the manual editor needs it.* · *pgTAP, E2E*
- **SCRIPT-05** A script's roles are shown grouped by team, in this order: Townsfolk, Outsiders, Minions, Demons. · *E2E*
- **SCRIPT-06** Editing a script later doesn't change games already played with it, because each game keeps its own copy of the roles used. · *pgTAP*

## SETUP · Setup wizard

- **SETUP-01** For 5 to 15 players, the recommended counts (Townsfolk / Outsiders / Minions / Demons) follow the official table:

  | Players | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
  |---|---|---|---|---|---|---|---|---|---|---|---|
  | Townsfolk | 3 | 3 | 5 | 5 | 5 | 7 | 7 | 7 | 9 | 9 | 9 |
  | Outsiders | 0 | 1 | 0 | 1 | 2 | 0 | 1 | 2 | 0 | 1 | 2 |
  | Minions | 1 | 1 | 1 | 1 | 1 | 2 | 2 | 2 | 3 | 3 | 3 |
  | Demons | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |

  · *Unit*
- **SETUP-02** In every recommendation, the four counts add up to the player count, and there is exactly one Demon. · *Property*
- **SETUP-03** Player counts outside 5–15, including non-whole numbers, have no recommendation. · *Property*
- **SETUP-04** A seat's starting alignment comes from its actual role's team: Townsfolk and Outsiders start good (善良), and Minions and Demons start evil (邪恶). · *Unit, pgTAP*
- **SETUP-05** Only the room's DM can run setup. · *pgTAP*
- **SETUP-06** The wizard runs in order: basics (seat count, script, assignment mode) → role composition → assignment or draw → start. The DM can go back to any earlier step until the game starts. · *E2E*
- **SETUP-07** The composition has exactly as many roles as there are seats. Every role comes from the chosen script, and none is used twice. If the team counts differ from the recommendation, the app shows a warning but still allows it. · *Unit, pgTAP*
- **SETUP-08** Each role in the composition has a shown role, which defaults to itself. The DM can set it to any role in the script (e.g. the Drunk shown as a Townsfolk). · *pgTAP, E2E*
- **SETUP-09** In manual mode, every seat must get exactly one role from the composition before the game can start. · *pgTAP, E2E*
- **SETUP-10** The game can start only when every seat has a player and a role. At start, every player sees their role card at the same time, and the phase becomes 第1夜. · *pgTAP, E2E*

## DRAW · Card draw

- **DRAW-01** The server shuffles the cards (one per composition role) uniformly at random. Nobody can tell which card is which before drawing. · *Integration (statistical test on many shuffles)*
- **DRAW-02** Each seated player draws exactly one card and can't draw a second. · *pgTAP*
- **DRAW-03** If two players tap the same card at the same moment, exactly one gets it. The other sees "已被抽走，请重选" and picks again. · *Integration (repeated races)*
- **DRAW-04** After drawing, a player sees their own shown role immediately. Other players only see that the card is taken, and by which seat. · *pgTAP, E2E*
- **DRAW-05** The DM sees each seat's actual and shown role live as the cards are drawn. · *E2E*
- **DRAW-06** Before the game starts, the DM can reset the draw and reshuffle, for example after a mistake. · *pgTAP, E2E*

## SECRET · Role secrecy

- **SECRET-01** Until the game ends, a player can read only their **own shown role**. They can never read any actual role, or another seat's role in any form. · *pgTAP (every game state)*
- **SECRET-02** The DM can read every seat's actual role, shown role and alignment in their game. · *pgTAP*
- **SECRET-03** After the game ends, every participant can read every seat's actual role, shown role and final alignment. · *pgTAP*
- **SECRET-04** Role data never reaches a player's device before it's allowed. The network responses to a player contain no other seat's role and no actual roles. · *E2E (inspects network traffic)*
