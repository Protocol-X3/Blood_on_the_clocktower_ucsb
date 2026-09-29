import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { allColumns, columnKey, LOG_MARKS, logRounds, phaseColumns, rectangle, rowKey, shownMark, textColumns, undoPaint } from '@/lib/game/logSheet';

const N1 = { kind: 'night', number: 1 } as const;

describe('the DM log table', () => {
  it('LOG-01: the table opens with min(5, ⌊players / 2⌋) nights and days', () => {
    expect(logRounds(5, N1)).toBe(2);
    expect(logRounds(7, N1)).toBe(3);
    expect(logRounds(9, N1)).toBe(4);
    expect(logRounds(10, N1)).toBe(5);
    expect(logRounds(15, N1)).toBe(5);
  });

  it('LOG-01: …and grows once the game goes past them', () => {
    expect(logRounds(7, { kind: 'night', number: 3 })).toBe(3);
    expect(logRounds(7, { kind: 'day', number: 4 })).toBe(4);
    expect(logRounds(15, { kind: 'night', number: 6 })).toBe(6);
  });

  it('LOG-01: 座位, 玩家, 初始角色, 角色设置, then 第1夜, 第1天, 第2夜 …', () => {
    const cols = allColumns(5, N1);
    expect(cols.map((c) => c.label)).toEqual(['座位', '玩家', '初始角色', '角色设置', '第1夜', '第1天', '第2夜', '第2天']);
    expect(cols.map((c) => c.key)).toEqual(['seat', 'name', 'role', 'setup', 'n1', 'd1', 'n2', 'd2']);
    expect(cols.map((c) => c.phase)).toEqual([null, null, null, null, 1, 1, 2, 2]);
    expect(cols.map((c) => c.kind)).toEqual(['seat', 'name', 'role', 'setup', 'night', 'day', 'night', 'day']);
    expect(textColumns(5, N1).map((c) => c.key)).toEqual(['setup', 'n1', 'd1', 'n2', 'd2']);
  });

  it('LOG-03: the current phase is marked; phases still to come are marked as later', () => {
    const cols = phaseColumns(7, { kind: 'day', number: 2 });
    expect(cols.filter((c) => c.current).map((c) => c.key)).toEqual(['d2']);
    expect(cols.filter((c) => c.later).map((c) => c.key)).toEqual(['n3', 'd3']);
    expect(cols.filter((c) => !c.current && !c.later).map((c) => c.key)).toEqual(['n1', 'd1', 'n2']);
    for (const c of allColumns(7, N1).slice(0, 4)) expect([c.current, c.later]).toEqual([false, false]);
  });

  it('LOG-01: every phase up to the current one has a column, whatever the game', () => {
    fc.assert(
      fc.property(fc.integer({ min: 5, max: 15 }), fc.constantFrom('night' as const, 'day' as const), fc.integer({ min: 1, max: 12 }), (n, kind, number) => {
        const cols = phaseColumns(n, { kind, number });
        expect(cols.length).toBe(2 * logRounds(n, { kind, number }));
        expect(cols.filter((c) => c.current)).toHaveLength(1);
        expect(cols.some((c) => c.kind === kind && c.phase === number)).toBe(true);
      }),
    );
  });

  it('LOG-01: a stored cell maps back to its column', () => {
    expect(columnKey('night', 3)).toBe('n3');
    expect(columnKey('day', 1)).toBe('d1');
    expect(columnKey('setup', null)).toBe('setup');
    expect(columnKey('name', null)).toBe('name');
  });

  it('LOG-05: seat rows and note rows have distinct keys', () => {
    expect(rowKey({ seat: 3 })).toBe('s3');
    expect(rowKey({ note: 'abc' })).toBe('n:abc');
  });

  it('LOG-06: five colours, in the palette order', () => {
    expect(LOG_MARKS.map((m) => m.mark)).toEqual(['red', 'yellow', 'violet', 'green', 'dead']);
    expect(LOG_MARKS.map((m) => m.label)).toEqual(['邪恶 / 错误', '外来者', '醉酒 / 中毒', '正确', '死亡']);
  });

  it("LOG-06: a cell's own colour wins over its row's; 清除 shows none", () => {
    expect(shownMark(null, 'red')).toBe('red');
    expect(shownMark(null, null)).toBe(null);
    expect(shownMark('green', 'red')).toBe('green');
    expect(shownMark('violet', null)).toBe('violet');
    expect(shownMark('none', 'yellow')).toBe(null);
  });

  it('LOG-06: a stroke covers the rectangle between the two cells, whichever way it is dragged', () => {
    const rows = ['a', 'b', 'c'];
    const cols = [1, 2, 3, 4];
    const key = (x: { row: string; col: number }) => `${x.row}${x.col}`;
    expect(rectangle(rows, cols, { row: 0, col: 1 }, { row: 1, col: 3 }).map(key)).toEqual(['a2', 'a3', 'a4', 'b2', 'b3', 'b4']);
    expect(rectangle(rows, cols, { row: 2, col: 2 }, { row: 1, col: 0 }).map(key)).toEqual(['b1', 'b2', 'b3', 'c1', 'c2', 'c3']);
    expect(rectangle(rows, cols, { row: 1, col: 1 }, { row: 1, col: 1 }).map(key)).toEqual(['b2']);
  });

  it('LOG-06: 撤销 puts each cell back to what it stored', () => {
    expect(undoPaint(null)).toBe('unset');
    expect(undoPaint('none')).toBe('clear');
    expect(undoPaint('dead')).toBe('dead');
    expect(undoPaint('red')).toBe('red');
  });
});
