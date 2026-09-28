import { Link } from 'react-router';
import { cn } from '@/components/ui/cn';
import type { Script } from '@/features/roles/data';

export type AssignmentMode = 'manual' | 'draw';

/** SETUP-06 step 1, "basics": the script and the assignment mode. */
export function BasicsFields({
  scripts,
  script,
  onScript,
  mode,
  onMode,
}: {
  scripts: Script[];
  script: string;
  onScript: (id: string) => void;
  mode: AssignmentMode;
  onMode: (m: AssignmentMode) => void;
}) {
  return (
    <>
      <label className="flex flex-col gap-1.5 text-sm text-ink-muted">
        剧本
        <select aria-label="剧本" value={script} onChange={(e) => onScript(e.target.value)} className="min-h-12 rounded-xl border border-line bg-surface-2 px-3 text-ink">
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
            className={cn('flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-3', mode === value ? 'border-gold bg-gold/10' : 'border-line')}
          >
            <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => onMode(value)} className="size-4 accent-[var(--gold)]" />
            <span>
              <span className="block font-medium">{label}</span>
              <span className="block text-xs text-ink-muted">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </>
  );
}
