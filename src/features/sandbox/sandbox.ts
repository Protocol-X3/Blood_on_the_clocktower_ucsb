import { lazy } from 'react';

/**
 * BOT-01: the bot sandbox exists only in development builds: `vite` (dev) and
 * `vite build --mode sandbox` (the E2E build). In a production build this constant
 * is false, so the bundler drops the dynamic imports below and the sandbox code.
 */
export const SANDBOX = import.meta.env.DEV || import.meta.env.MODE === 'sandbox';

export const LobbyBots = SANDBOX ? lazy(() => import('./BotSandbox').then((m) => ({ default: m.LobbyBots }))) : null;
export const BotDriver = SANDBOX ? lazy(() => import('./BotSandbox').then((m) => ({ default: m.BotDriver }))) : null;
