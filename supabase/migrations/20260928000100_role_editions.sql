-- LIB-01: two more role collections join the library: Experimental characters
-- (实验性角色) and 华灯初上 (including its second season 山雨欲来).
alter table public.roles drop constraint roles_edition_check;
alter table public.roles add constraint roles_edition_check check (edition in ('tb', 'bmr', 'snv', 'exp', 'hdcs'));
