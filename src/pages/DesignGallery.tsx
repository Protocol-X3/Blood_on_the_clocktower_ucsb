import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Panel } from '@/components/ui/Panel';
import { RoleToken } from '@/components/ui/RoleToken';
import { StarField } from '@/components/ui/StarField';
import { ThemeScope, type ThemeName } from '@/components/ui/ThemeScope';
import { SeatCircle, type CircleSeat } from '@/features/live/SeatCircle';
import { HiddenRole } from '@/features/roles/HiddenRole';
import { RoleCard } from '@/features/roles/RoleCard';
import { TEAM_LABEL, TEAMS, type Team } from '@/lib/game/teams';

const SAMPLE: Record<Team, { glyph: string; name: string }> = {
  townsfolk: { glyph: '占', name: '占卜师' },
  outsider: { glyph: '酒', name: '酒鬼' },
  minion: { glyph: '毒', name: '投毒者' },
  demon: { glyph: '魔', name: '小恶魔' },
};

const CARD = { name: '共情者', team: 'townsfolk' as const, glyph: '共', ability: '每个夜晚，你会得知与你相邻的两名存活玩家之中，有几名属于邪恶阵营。' };

const CIRCLE: CircleSeat[] = [1, 2, 3, 4, 5, 6, 7].map((seat) => ({
  seat,
  label: `玩家${seat}`,
  alive: seat !== 2 && seat !== 5,
  ghostVoteUsed: seat === 5,
  vote: 'idle',
  raised: false,
  mine: seat === 3,
}));

const THEMES: { theme: ThemeName; title: string }[] = [
  { theme: 'day', title: '白天 · 玩家' },
  { theme: 'night', title: '夜晚 · 玩家' },
  { theme: 'grimoire', title: '魔典 · 说书人' },
];

/** Every design-system component in all three themes, for visual review (UI-04). */
export function DesignGallery() {
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-3">
      {THEMES.map(({ theme, title }) => (
        <ThemeScope key={theme} theme={theme} className="paper-grain relative overflow-hidden" data-testid={`theme-${theme}`}>
          {theme === 'night' && <StarField />}
          <div className="relative flex flex-col gap-6 px-5 py-8">
            <h2 className="font-serif text-2xl font-black tracking-[0.15em] text-gold-strong">{title}</h2>

            <div className="flex flex-wrap items-end gap-4">
              {TEAMS.map((team) => (
                <RoleToken key={team} glyph={SAMPLE[team].glyph} team={team} label={SAMPLE[team].name} />
              ))}
              <RoleToken glyph="葬" team="townsfolk" label="送葬者" dead />
              <RoleToken glyph="共" team="townsfolk" label="共情者" selected />
            </div>

            <div className="flex flex-wrap gap-2">
              {TEAMS.map((team) => (
                <Chip key={team} tone={team}>
                  {TEAM_LABEL[team]}
                </Chip>
              ))}
              <Chip tone="gold">红鲱鱼</Chip>
              <Chip tone="blood">被提名</Chip>
              <Chip>夜间死亡</Chip>
            </div>

            <div className="flex flex-col gap-3">
              <Button size="lg">举手</Button>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline">更改角色</Button>
                <Button variant="ghost">取消</Button>
                <Button variant="danger">标记死亡</Button>
                <Button disabled>已锁定</Button>
              </div>
            </div>

            <Panel className="flex flex-col gap-1">
              <span className="text-xs text-ink-faint">1号 小林 · 第2天</span>
              <p className="m-0 text-sm leading-relaxed">我是占卜师。昨晚查验 4号 和 6号，结果：其中有恶魔。</p>
            </Panel>

            <RoleCard role={CARD} className="max-w-72" />

            {/* SECRET-05: the same card, face down until the player taps it. */}
            <HiddenRole role={CARD} caption="我的角色 · 3号" />

            {/* DEATH-03: dead seats are greyed and crossed out. */}
            <SeatCircle label="示例座位" size={220} seats={CIRCLE} center={<span className="font-serif text-2xl font-black">5</span>} />
          </div>
        </ThemeScope>
      ))}
    </div>
  );
}
