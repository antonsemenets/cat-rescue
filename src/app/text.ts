// Player-facing texts (Russian).

import { foodNoticeRadius, toyNoticeRadius } from '../core/rules';
import type { Cat, FoodKind, GameState, ItemKind } from '../core/types';

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

export const turnsWord = (n: number) => `${n} ${plural(n, 'ход', 'хода', 'ходов')}`;
export const cellsWord = (n: number) => `${n} ${plural(n, 'клетку', 'клетки', 'клеток')}`;

export const ITEM_NAMES: Record<ItemKind, string> = {
  trap: 'Котоловушка',
  kibble: 'Корм',
  tuna: 'Тунец',
  box: 'Укрытие',
  toy: 'Игрушка',
};

export const FOOD_NAMES: Record<FoodKind, string> = { kibble: 'корм', tuna: 'тунец' };

export const TRAITS: { key: 'hunger' | 'fear' | 'curiosity' | 'trust'; name: string; tip: string }[] = [
  { key: 'hunger', name: 'Голод', tip: 'Чем голоднее, тем дальше чует еду' },
  { key: 'fear', name: 'Пугливость', tip: 'Пугливые избегают открытых мест и шума' },
  { key: 'curiosity', name: 'Любопытство', tip: 'Любопытные бегут к игрушкам' },
  { key: 'trust', name: 'Доверие', tip: 'Доверчивые не медлят у входа в ловушку' },
];

export function catStatus(cat: Cat, s: GameState): string {
  switch (cat.mode) {
    case 'trapped':
      return 'В безопасности. Скоро поедет в приют!';
    case 'frightened':
      return 'Испугалась шума и бежит в укрытие';
    case 'hiding':
      return cat.timer > 0 ? `Прячется ещё ${turnsWord(cat.timer)}` : 'Успокаивается';
    case 'cautious':
      return 'Осторожничает у входа — доверие растёт';
    case 'interested': {
      if (cat.target?.kind === 'toy') return cat.activity === 'play' ? 'Играет с игрушкой' : 'Бежит к игрушке';
      if (cat.target?.id?.startsWith('bait:')) return 'Идёт к приманке в ловушке';
      if (cat.target?.kind === 'food') return 'Учуяла еду и идёт к ней';
      return 'Чем-то заинтересовалась';
    }
    default:
      if (cat.activity === 'sleep') return cat.hunger === 0 ? 'Сыта и дремлет' : 'Дремлет';
      if (cat.activity === 'groom') return 'Умывается';
      if (cat.target?.kind === 'patrol') return 'Обходит свою территорию';
      if (cat.target?.kind === 'home') return 'Возвращается на любимое место';
      void s;
      return 'Отдыхает и посматривает по сторонам';
  }
}

export function catSenses(cat: Cat): string[] {
  const out: string[] = [];
  const k = foodNoticeRadius(cat, 'kibble');
  const t = foodNoticeRadius(cat, 'tuna');
  if (k < 0) out.push('Не голодна — еда её не интересует');
  else out.push(`Чует корм за ${cellsWord(k)}, тунец — за ${cellsWord(t)}`);
  const toy = toyNoticeRadius(cat);
  if (toy > 0) out.push(`Замечает игрушку за ${cellsWord(toy)}`);
  if (cat.fear >= 3) out.push('Никогда не выходит из тени');
  else if (cat.fear === 2) out.push('Старается держаться в тени');
  if (cat.fear > cat.trust) out.push(`Помедлит у входа: ${turnsWord(cat.fear - cat.trust)}`);
  return out;
}

export const LOCATION_NAMES: Record<string, string> = {
  yard: 'Двор',
  park: 'Парк',
  garages: 'Гаражи',
  garden: 'Сад',
};
