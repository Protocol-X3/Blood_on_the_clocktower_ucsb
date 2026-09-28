// BOT-01: the bot sandbox must not ship in the production build.

/** Strings that only the sandbox code contains. */
export const SANDBOX_MARKERS = ['dev_add_bots', 'dev_remove_bots', 'dev_bot_draw', 'dev_bot_hand', 'dev_bot_post', '机器人沙盒'];

/** The files that contain sandbox code, and which marker gave each away. */
export function findSandboxCode(files: { path: string; text: string }[]): { path: string; marker: string }[] {
  return files.flatMap((f) => {
    const marker = SANDBOX_MARKERS.find((m) => f.text.includes(m));
    return marker ? [{ path: f.path, marker }] : [];
  });
}
