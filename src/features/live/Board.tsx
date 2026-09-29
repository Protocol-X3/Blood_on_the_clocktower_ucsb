import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import type { BoardPost } from '@/features/game/useGameData';
import { supabase } from '@/services/supabase';
import { postPhase, timeOf } from './model';

const MAX = 140;

/**
 * 公告板 (BOARD-01..03): newest first, each post signed with seat, nickname, phase
 * and time. Authors delete their own posts; the DM deletes any. No editing.
 */
export function Board({
  posts,
  names,
  me,
  isDm,
  canPost,
  act,
  gameId,
  limit,
}: {
  posts: BoardPost[];
  names: Map<number, string>;
  me: string;
  isDm: boolean;
  canPost: boolean;
  act: (run: () => PromiseLike<{ error: unknown }>, after?: () => void) => Promise<void>;
  gameId: string;
  limit?: number;
}) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const length = [...body.trim()].length;
  const shown = limit ? posts.slice(0, limit) : posts;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const sent = body;
    // Clear only what was sent: the player may already be typing the next post.
    await act(
      () => supabase.rpc('post_board', { p_game: gameId, p_body: sent }),
      () => setBody((current) => (current === sent ? '' : current)),
    );
    setBusy(false);
  }

  return (
    <section aria-label="公告板" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-lg font-bold tracking-wider">公告板</h2>
        <span className="text-xs text-ink-faint">{posts.length} 条</span>
      </div>
      {canPost ? (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label className="sr-only" htmlFor="board-body">
            发布内容
          </label>
          <textarea
            id="board-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            maxLength={MAX + 20}
            placeholder={isDm ? '以说书人身份发布…' : '说点什么…'}
            className="min-h-16 w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-[15px] text-ink placeholder:text-ink-faint focus:border-gold focus:outline-none"
          />
          <div className="flex items-center justify-between">
            <span className={cn('text-xs', length > MAX ? 'text-blood-text' : 'text-ink-faint')} aria-live="polite">
              {length}/{MAX}
            </span>
            <Button type="submit" variant="outline" disabled={busy || length < 1 || length > MAX}>
              发布
            </Button>
          </div>
        </form>
      ) : null}
      <ol className="flex flex-col gap-2" aria-label="帖子">
        {shown.length === 0 ? <li className="text-sm text-ink-faint">还没有帖子。</li> : null}
        {shown.map((p) => {
          const author = p.is_dm ? '说书人' : `${p.seat}号 ${names.get(p.seat ?? 0) ?? ''}`;
          const mine = p.author_id === me;
          return (
            <li
              key={p.id}
              data-testid="board-post"
              className={cn('flex flex-col gap-1 rounded-xl border px-3 py-2.5', p.is_dm ? 'border-gold/50 bg-gold/10' : 'border-line bg-surface')}
            >
              <div className="flex items-center gap-2 text-xs text-ink-faint">
                <b className={cn('font-bold', p.is_dm ? 'text-gold-strong' : 'text-ink')}>{author}</b>
                <span>{postPhase(p)}</span>
                <span>{timeOf(p.created_at)}</span>
                {mine || isDm ? (
                  <button
                    type="button"
                    className="ml-auto -my-2 min-h-11 rounded-lg px-2 text-ink-faint hover:text-blood-text"
                    onClick={async () => {
                      await act(() => supabase.rpc('delete_post', { p_post: p.id }));
                    }}
                  >
                    删除
                  </button>
                ) : null}
              </div>
              <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">{p.body}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
