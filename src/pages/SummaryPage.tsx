import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { GameReport } from '@/features/history/GameReport';
import { loadGame, type GameRecord } from '@/features/history/loadGame';
import { supabase } from '@/services/supabase';
import { MessagePage } from './ComingSoon';

type State = { status: 'loading' } | { status: 'none' } | { status: 'ready'; record: GameRecord };

/**
 * 对局结算 (END-02 / END-03): the room's latest ended game, with every seat's actual
 * and shown role, final alignment, deaths, the DM log and the winning team. Only the
 * game's participants (and the admin) can read it (SECRET-03, HIST-02).
 */
export function SummaryPage() {
  const { code = '' } = useParams();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: room } = await supabase.from('rooms').select('id').eq('code', code.toUpperCase()).order('created_at', { ascending: false }).limit(1).maybeSingle();
      const { data: game } = room
        ? await supabase.from('games').select('*').eq('room_id', room.id).eq('status', 'ended').order('ended_at', { ascending: false }).limit(1).maybeSingle()
        : { data: null };
      const record = game ? await loadGame(game) : null;
      if (!cancelled) setState(record ? { status: 'ready', record } : { status: 'none' });
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (state.status === 'loading') return <LoadingScreen label="正在载入结算…" />;
  if (state.status === 'none') return <MessagePage title="暂无结算" message="这个房间还没有你参与过的已结束对局。" />;
  return (
    <GameReport
      record={state.record}
      eyebrow={`对局结算 · ${code.toUpperCase()}`}
      full={false}
      footer={
        <div className="flex flex-col gap-2">
          <Button asChild variant="outline" size="lg">
            <Link to={`/room/${code.toUpperCase()}`}>返回房间</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to={`/games/${state.record.game.id}`}>查看完整记录</Link>
          </Button>
        </div>
      }
    />
  );
}
