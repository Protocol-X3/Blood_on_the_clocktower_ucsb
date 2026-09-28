import { lazy, useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';

/**
 * BOT-01: the bot sandbox ships with the app but stays off unless the admin switches it on
 * under 管理. Its code is a separate chunk, loaded only while the sandbox is on.
 */
export const LobbyBots = lazy(() => import('./BotSandbox').then((m) => ({ default: m.LobbyBots })));
export const BotDriver = lazy(() => import('./BotSandbox').then((m) => ({ default: m.BotDriver })));

/** Whether the admin has switched the bot sandbox on (read when the page loads). */
export function useBotSandbox(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    supabase.rpc('bot_sandbox_enabled').then(({ data }) => {
      if (live) setOn(data === true);
    });
    return () => {
      live = false;
    };
  }, []);
  return on;
}
