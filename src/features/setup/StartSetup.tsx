import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { supabase, type Room } from '@/services/supabase';
import { BasicsFields, type AssignmentMode } from './BasicsFields';
import { useScripts } from './useScripts';

type Act = (run: () => PromiseLike<{ error: unknown }>, after?: () => void) => Promise<void>;

/**
 * SETUP-06 step 1, "basics", from the lobby: script and assignment mode (the seat count
 * is set in the lobby). SETUP-11: 下一步 waits until every seat has a player.
 */
export function StartSetup({ room, act, seated }: { room: Room; act: Act; seated: number }) {
  const [open, setOpen] = useState(false);
  const scripts = useScripts(open);
  const [picked, setPicked] = useState('');
  const script = picked || scripts?.[0]?.id || '';
  const [mode, setMode] = useState<AssignmentMode>('draw');
  const empty = room.seat_count - seated;

  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        开始配置对局
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="配置对局" description={`${room.seat_count} 个座位 · 已入座 ${seated} 人`} className="max-w-md">
        <div className="flex flex-col gap-4">
          <BasicsFields scripts={scripts ?? []} script={script} onScript={setPicked} mode={mode} onMode={setMode} />
          {empty > 0 ? (
            <p className="text-sm font-medium text-blood-text" role="status" data-testid="seats-missing">
              还有 {empty} 个空座。所有座位坐满后才能继续。
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              返回
            </Button>
            <Button
              disabled={!script || empty > 0}
              onClick={() => act(() => supabase.rpc('start_setup', { p_room: room.id, p_script: script, p_mode: mode }), () => setOpen(false))}
            >
              下一步
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
