import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { GameReport } from '@/features/history/GameReport';
import { loadGame, type GameRecord } from '@/features/history/loadGame';
import { useAuth } from '@/features/auth/useAuth';
import { supabase } from '@/services/supabase';
import { MessagePage } from './ComingSoon';

type State = { status: 'loading' } | { status: 'hidden' } | { status: 'ready'; record: GameRecord };

/**
 * 历史对局 (HIST-02 / HIST-03): a past game, for its players, its DM and the admin.
 * Everything from the summary, plus the nominations with their counts and the board.
 */
export function GameHistoryPage() {
  const { id = '' } = useParams();
  const { profile } = useAuth();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Row level security returns nothing to anyone else (HIST-02).
      const { data: game } = await supabase.from('games').select('*').eq('id', id).eq('status', 'ended').maybeSingle();
      const record = game ? await loadGame(game) : null;
      if (!cancelled) setState(record ? { status: 'ready', record } : { status: 'hidden' });
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.status === 'loading') return <LoadingScreen label="正在载入对局…" />;
  if (state.status === 'hidden') return <MessagePage title="无法查看" message="只有这局的玩家、说书人和管理员可以查看这局对局。" />;
  const { record } = state;
  const date = record.game.ended_at?.slice(0, 10) ?? '';
  return (
    <GameReport
      record={record}
      eyebrow={`历史对局 · ${date}${record.scriptName ? ` · ${record.scriptName}` : ''}`}
      full
      footer={
        profile ? (
          <Button asChild variant="outline" size="lg">
            <Link to={`/profile/${profile.id}`}>我的主页</Link>
          </Button>
        ) : null
      }
    />
  );
}
