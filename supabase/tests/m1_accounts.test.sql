-- M1 · accounts: profiles, nicknames and permission levels.
select plan(28);

create temp table u as
select tests.create_user('admin') as admin,
       tests.create_user('alice') as alice,
       tests.create_user('bob') as bob,
       tests.create_user('dora', 'dm_eligible') as dora,
       tests.create_user('gus', 'player', true) as gus,
       tests.create_user('other') as other;
grant select on u to authenticated, anon;

-- PERM-01 / PERM-02
select is((select permission from profiles where id = (select alice from u)), 'player',
  'PERM-01: a new account starts as player');
select is((select permission from profiles where id = (select admin from u)), 'admin',
  'PERM-02 · M1.7: the account with the configured admin email becomes admin');
select is((select count(*)::int from profiles where permission = 'admin'), 1,
  'PERM-02: there is exactly one admin');
select is((select permission from profiles where id = (select other from u)), 'player',
  'PERM-02 · M1.7: any other email stays a player');
select throws_ok($$ update profiles set permission = 'admin' where id = (select alice from u) $$, '23505', null,
  'PERM-02: a second admin cannot exist, even at the database level');

-- PERM-02: nobody can make themselves or anyone else admin through the app.
select is(tests.try_as((select admin from u), format('select set_permission(%L, %L)', (select alice from u), 'admin')), 'FORBIDDEN',
  'PERM-02: even the admin cannot grant admin');
select is(tests.try_as((select admin from u), format('select set_permission(%L, %L)', (select admin from u), 'player')), 'FORBIDDEN',
  'PERM-02 · PERM-05: the admin cannot be demoted');

-- PERM-03 / M1.5
select is(tests.try_as((select admin from u), format('select set_permission(%L, %L)', (select alice from u), 'dm_eligible')), 'allow',
  'PERM-03 · M1.5: the admin can grant DM-eligible');
select is(tests.try_as((select dora from u), format('select set_permission(%L, %L)', (select alice from u), 'dm_eligible')), 'FORBIDDEN',
  'PERM-03 · M1.5: a DM-eligible user cannot grant DM-eligible');
select is(tests.try_as((select bob from u), format('select set_permission(%L, %L)', (select bob from u), 'dm_eligible')), 'FORBIDDEN',
  'PERM-03 · M1.5: a player cannot grant themselves DM-eligible');
select is(tests.try_as(null, format('select set_permission(%L, %L)', (select bob from u), 'dm_eligible')), 'permission denied for function set_permission',
  'PERM-03: a signed-out visitor cannot call it at all');

-- PERM-04
select is(tests.try_as((select admin from u), format('select set_permission(%L, %L)', (select gus from u), 'dm_eligible')), 'GUEST_NOT_ALLOWED',
  'PERM-04: a guest cannot be made DM-eligible');

-- PERM-05
select is((select private.can_dm((select admin from u))), true, 'PERM-05: the admin is always DM-eligible');

-- PERM-07: a change takes effect for the very next action, with no new sign-in.
select tests.login((select admin from u));
select set_permission((select bob from u), 'dm_eligible');
select tests.logout();
select is(tests.try_as((select bob from u), 'select create_room()'), 'allow',
  'PERM-07: a newly DM-eligible user can create a room right away');
select tests.login((select admin from u));
select set_permission((select bob from u), 'player');
select tests.logout();
select is(tests.try_as((select bob from u), 'select create_room()'), 'FORBIDDEN',
  'PERM-07: a revoked user loses the right right away');

-- PERM-08: profiles change only through set_nickname (own) and set_permission (admin).
select tests.login((select alice from u));
select lives_ok($$ update profiles set nickname = 'hacked' where id = (select bob from u) $$,
  'PERM-08: a direct update statement runs but…');
select tests.logout();
select is((select nickname from profiles where id = (select bob from u)), 'bob',
  'PERM-08: …changes nothing: users cannot edit another profile');
select tests.login((select alice from u));
update profiles set permission = 'dm_eligible' where id = (select alice from u);
select tests.logout();
select is((select permission from profiles where id = (select alice from u)), 'player',
  'PERM-08: users cannot edit their own permission level either');

-- AUTH-03: nicknames
select tests.login((select alice from u));
select set_nickname('  小林  ');
select tests.logout();
select is((select nickname from profiles where id = (select alice from u)), '小林',
  'AUTH-03: a nickname is stored with surrounding spaces trimmed');
select is((select char_length(nickname) from profiles where id = (select alice from u)), 2,
  'AUTH-03: a Chinese character counts as one');
select is(tests.try_as((select bob from u), $$ select set_nickname('小林') $$), 'NICKNAME_TAKEN',
  'AUTH-03: a duplicate nickname is refused');
select is(tests.try_as((select bob from u), $$ select set_nickname('ALICE') $$), 'allow',
  'AUTH-03: a nickname freed up by its owner can be taken');
select is(tests.try_as((select dora from u), $$ select set_nickname('BOB') $$), 'NICKNAME_TAKEN',
  'AUTH-03: uniqueness ignores letter case');
select is(tests.try_as((select bob from u), $$ select set_nickname('一二三四五六七八九十一二三') $$), 'NICKNAME_INVALID',
  'AUTH-03: 13 characters is too long; 1–12 are allowed');

-- AUTH-09: renaming later
select tests.login((select alice from u));
select set_nickname('林老板');
select tests.logout();
select is((select nickname from profiles where id = (select alice from u)), '林老板', 'AUTH-09: a user with a nickname can change it');
select is(tests.try_as((select dora from u), $$ select set_nickname('小林') $$), 'allow', 'AUTH-09: …and the old name becomes free');
select is(tests.try_as((select gus from u), $$ select set_nickname('游客甲') $$), 'allow', 'AUTH-09: guests can rename too');
select is(tests.try_as((select bob from u), $$ select set_nickname('Alice') $$), 'allow', 'AUTH-09: changing only the letter case of your own name is allowed');

select * from finish();
