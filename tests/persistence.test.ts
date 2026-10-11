import { describe, expect, it } from 'vitest';
import { defaultSave, isLevelUnlocked, loadSave, parseSave, recordLevelResult, SAVE_KEY, writeSave, type StorageLike } from '../src/persistence/save';

function mem(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

const RESULT = { stars: 2 as const, turns: 9, itemsUsed: 2, rescued: 1, total: 1, checks: { rescue: true, turns: true, efficiency: false } };

describe('persistence', () => {
  it('round-trips progress, rescued cats and settings', () => {
    const st = mem();
    let d = defaultSave();
    d = recordLevelResult(d, 'l1', RESULT, ['ryzhik'], 1000);
    d.settings.musicVolume = 0.1;
    d.settings.animSpeed = 2;
    writeSave(d, st);
    const back = loadSave(st);
    expect(back).toEqual(d);
    expect(back.rescued.ryzhik).toEqual({ levelId: 'l1', rescuedAt: 1000, pets: 0 });
  });

  it('keeps the best stars and turns across replays', () => {
    let d = defaultSave();
    d = recordLevelResult(d, 'l1', { ...RESULT, stars: 3, turns: 5 }, ['ryzhik']);
    d = recordLevelResult(d, 'l1', { ...RESULT, stars: 1, turns: 12 }, ['ryzhik']);
    expect(d.levels.l1).toEqual({ completed: true, stars: 3, bestTurns: 5 });
  });

  it('survives garbage in storage', () => {
    expect(parseSave('not json')).toEqual(defaultSave());
    expect(parseSave(JSON.stringify({ version: 7 }))).toEqual(defaultSave());
    const st = mem();
    st.setItem(SAVE_KEY, JSON.stringify({ version: 1, levels: { l1: { completed: true, stars: 99 } }, settings: { sfxVolume: 5 } }));
    const d = loadSave(st);
    expect(d.levels.l1.stars).toBe(3);
    expect(d.settings.sfxVolume).toBe(1);
  });

  it('does not crash when storage throws', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {},
    };
    expect(loadSave(broken)).toEqual(defaultSave());
    expect(() => writeSave(defaultSave(), broken)).not.toThrow();
  });

  it('remembers which briefings were shown and ignores garbage there', () => {
    expect(parseSave(JSON.stringify({ version: 1, seenBriefings: ['l1', 5, 'l2'] })).seenBriefings).toEqual(['l1', 'l2']);
    expect(parseSave(JSON.stringify({ version: 1, seenBriefings: 'l1' })).seenBriefings).toEqual([]);
  });

  it('migrates renamed cats in old saves (Тень → Дартик)', () => {
    const d = parseSave(JSON.stringify({ version: 1, levels: {}, rescued: { ten: { levelId: 'l3', rescuedAt: 5, pets: 3 } }, settings: {} }));
    expect(d.rescued.dartik).toEqual({ levelId: 'l3', rescuedAt: 5, pets: 3 });
    expect(d.rescued.ten).toBeUndefined();
  });

  it('unlocks levels sequentially', () => {
    let d = defaultSave();
    const ids = ['l1', 'l2', 'l3'];
    expect(isLevelUnlocked(d, ids, 'l1')).toBe(true);
    expect(isLevelUnlocked(d, ids, 'l2')).toBe(false);
    d = recordLevelResult(d, 'l1', RESULT, []);
    expect(isLevelUnlocked(d, ids, 'l2')).toBe(true);
    expect(isLevelUnlocked(d, ids, 'l3')).toBe(false);
  });

  it('keeps a beaten level open when levels are reordered', () => {
    let d = defaultSave();
    d = recordLevelResult(d, 'l1', RESULT, []);
    d = recordLevelResult(d, 'l3', RESULT, []);
    // l3 moved before l2, which is not beaten yet
    expect(isLevelUnlocked(d, ['l1', 'l3', 'l2'], 'l2')).toBe(true);
    expect(isLevelUnlocked(d, ['l1', 'l2', 'l3'], 'l3')).toBe(true);
  });
});
