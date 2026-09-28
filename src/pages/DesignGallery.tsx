import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Ornament } from '@/components/ui/Ornament';
import { Panel } from '@/components/ui/Panel';
import { RoleToken } from '@/components/ui/RoleToken';
import { StarField } from '@/components/ui/StarField';
import { ThemeScope, type ThemeName } from '@/components/ui/ThemeScope';
import { TEAM_LABEL, TEAMS, type Team } from '@/lib/game/teams';

const SAMPLE: Record<Team, { glyph: string; name: string }> = {
  townsfolk: { glyph: '占', name: '占卜师' },
  outsider: { glyph: '酒', name: '酒鬼' },
  minion: { glyph: '毒', name: '投毒者' },
  demon: { glyph: '魔', name: '小恶魔' },
};

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

            <Panel variant="gilded" padding="lg" className="mx-auto flex w-full max-w-72 flex-col items-center text-center">
              <RoleToken glyph="共" team="townsfolk" label="共情者" size="xl" />
              <h3 className="mt-5 font-serif text-3xl font-black tracking-[0.2em]">共情者</h3>
              <span className="mt-2 rounded-full border border-[#2f62a8]/40 bg-[#e3ecf8] px-2.5 py-0.5 text-xs font-medium text-[#1d4a85]">
                镇民 · 善良阵营
              </span>
              <Ornament className="mt-4" />
              <p className="mt-3 text-sm leading-7 text-[#3f3325]">
                每个夜晚，你会得知与你相邻的两名存活玩家之中，有几名属于邪恶阵营。
              </p>
            </Panel>
          </div>
        </ThemeScope>
      ))}
    </div>
  );
}
