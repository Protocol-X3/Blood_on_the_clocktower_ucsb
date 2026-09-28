import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { Dialog } from '@/components/ui/Dialog';
import type { Script } from '@/features/roles/data';
import { supabase, type Room } from '@/services/supabase';

type Act = (run: () => PromiseLike<{ error: unknown }>, after?: () => void) => Promise<void>;

/** SETUP-06 step 1, "basics": script and assignment mode (the seat count is set in the lobby). */
export function StartSetup({ room, act, seated }: { room: Room; act: Act; seated: number }) {
  const [open, setOpen] = useState(false);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [script, setScript] = useState('');
  const [mode, setMode] = useState<'manual' | 'draw'>('draw');

  useEffect(() => {
    if (!open) return;
    supabase
      .from('scripts')
      .select('*')
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        setScripts(data ?? []);
        setScript((s) => s || data?.[0]?.id || '');
      });
  }, [open]);

  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        开始配置对局
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="配置对局" description={`${room.seat_count} 个座位 · 已入座 ${seated} 人`} className="max-w-md">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm text-ink-muted">
            剧本
            <select
              aria-label="剧本"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className="min-h-12 rounded-xl border border-line bg-surface-2 px-3 text-ink"
            >
              {scripts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          {scripts.length === 0 ? (
            <p className="text-sm text-ink-muted">
              还没有剧本。<Link to="/scripts/new" className="text-gold-strong underline">新建剧本</Link>
            </p>
          ) : null}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm text-ink-muted">分配方式</legend>
            {(
              [
                ['draw', '抽卡', '洗牌后，每位玩家在手机上抽取一张牌。'],
                ['manual', '手动分配', '由说书人为每个座位指定角色。'],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className={cn(
                  'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-3',
                  mode === value ? 'border-gold bg-gold/10' : 'border-line',
                )}
              >
                <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="size-4 accent-[var(--gold)]" />
                <span>
                  <span className="block font-medium">{label}</span>
                  <span className="block text-xs text-ink-muted">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <Button
            disabled={!script}
            onClick={() => act(() => supabase.rpc('start_setup', { p_room: room.id, p_script: script, p_mode: mode }), () => setOpen(false))}
          >
            下一步
          </Button>
        </div>
      </Dialog>
    </>
  );
}
