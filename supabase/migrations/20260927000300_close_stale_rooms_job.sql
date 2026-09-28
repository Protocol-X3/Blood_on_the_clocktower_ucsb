-- ROOM-14: close rooms idle for 24 hours even when nobody touches them.
-- (The room functions also close stale rooms lazily, but a refused join rolls
-- that back, so a scheduled job keeps the status accurate.)
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('close-stale-rooms', '*/10 * * * *', 'select private.close_stale_rooms()');
