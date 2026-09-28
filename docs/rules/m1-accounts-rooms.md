# M1 · Accounts & rooms rules

Status: **Approved** by the owner, 2026-09-27.

## AUTH · Sign-in

- **AUTH-01** A user can sign in with Google. After signing in, they return to the page they were trying to open. · *E2E (up to the Google redirect); full sign-in: owner*
- **AUTH-02** A guest signs in with only a nickname (游客登录). No email or password is asked for. · *E2E, Integration*
- **AUTH-03** Nicknames are 1–12 characters after trimming spaces (a Chinese character counts as one) and unique among all users, ignoring letter case. A duplicate shows "昵称已被使用". *Decided (2026-09-27): the limit is 12 characters.* · *Unit, pgTAP, E2E*
- **AUTH-04** A new Google user must choose a nickname before entering any room. · *E2E*
- **AUTH-05** A guest can upgrade to a Google account and keeps their nickname, profile and game history. · *Integration*
- **AUTH-06** Signing out ends the session on that device. A guest who signs out is warned first (in Chinese) that the guest account can't be recovered. · *E2E*
- **AUTH-07** Every page except `/login` needs a signed-in user. Visitors who aren't signed in are sent to `/login` and brought back afterwards. · *E2E*
- **AUTH-08** A session survives page reloads and the phone locking. Players don't have to sign in again during a game night. · *E2E*
- **AUTH-09** A signed-in user, Google or guest, can change their own nickname at any time on their 个人主页, under the same rules as AUTH-03 (their own current name, even in another letter case, doesn't count as taken). The new name shows everywhere at once, including in rooms and past games, and the old name becomes free. *Added 2026-09-28.* · *pgTAP, E2E*

## PERM · Permission levels

- **PERM-01** Every new account starts as Player (玩家). · *pgTAP*
- **PERM-02** The account signed in with the configured admin Google email is Admin. There is exactly one admin, and no one can change who it is through the app. · *pgTAP*
- **PERM-03** Only the admin can grant or revoke DM-eligible (可担任说书人). · *pgTAP, E2E*
- **PERM-04** Guest accounts can never be DM-eligible. · *pgTAP*
- **PERM-05** The admin is always DM-eligible. · *pgTAP*
- **PERM-06** `/admin` lists every non-guest user with their level and lets the admin change it. Anyone else who opens `/admin` sees a Chinese "no permission" page. · *E2E*
- **PERM-07** A permission change takes effect immediately, without the affected user signing out and back in. · *Integration*
- **PERM-08** Users can edit only their own profile. No one can edit another user's nickname or level, except the admin changing levels. · *pgTAP*

## ROOM · Rooms, seats and the DM seat

- **ROOM-01** Only DM-eligible users, including the admin, can create a room. The creator starts in the DM seat. · *pgTAP, E2E*
- **ROOM-02** A room code is 4 characters from an alphabet without look-alikes (no 0/O or 1/I/L), and it's unique among open rooms. · *Unit, pgTAP*
- **ROOM-03** Joining by code ignores letter case. An unknown or closed code shows "房间不存在". · *E2E*
- **ROOM-04** Any signed-in user, including guests, can join an open room. · *pgTAP, E2E*
- **ROOM-05** The DM sets the seat count between 5 and 15. Seats are numbered 1 to N, clockwise. · *pgTAP, E2E*
- **ROOM-06** Between games, a player can take any empty seat, move to another empty seat, or leave their seat. A user holds at most one seat, and a seat holds at most one user. · *pgTAP*
- **ROOM-07** If two players take the same seat at the same moment, exactly one succeeds. The other sees "座位已被占用". · *Integration*
- **ROOM-08** Between games, the DM can move a player to another empty seat, unseat them, or remove them from the room. · *pgTAP, E2E*
- **ROOM-09** Only DM-eligible users can take the DM seat. A room has at most one DM, and the DM can't also hold a player seat. · *pgTAP*
- **ROOM-10** The DM can leave the DM seat only while no game is in progress. Any DM-eligible member can then take it. · *pgTAP, E2E*
- **ROOM-11** The admin can reassign the DM seat to another DM-eligible member at any time, including mid-game. Nobody else can. · *pgTAP*
- **ROOM-12** The DM can't reduce the seat count below the highest occupied seat number. · *pgTAP*
- **ROOM-13** Joins, seat changes and DM-seat changes appear on every member's screen within 3 seconds, without reloading. · *E2E (two browsers)*
- **ROOM-14** A room closes when its creator or the admin closes it, or after 24 hours with no activity. A closed room can't be joined, but its games stay in history. · *pgTAP, Integration*
- **ROOM-15** People who aren't members of a room can't see its members, seats or games. · *pgTAP*
