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
      return 'Шум! Бежит в укрытие';
    case 'hiding':
      return cat.timer > 0 ? `Прячется ещё ${turnsWord(cat.timer)}` : 'Успокаивается';
    case 'cautious':
      return 'Осторожничает у входа — доверие растёт';
    case 'interested': {
      if (cat.activity === 'rest') return 'Идёт к цели в своём темпе — переводит дух';
      if (cat.target?.kind === 'toy') return cat.activity === 'play' ? 'Играет с игрушкой' : 'Бежит к игрушке';
      if (cat.target?.id?.startsWith('bait:')) return 'Идёт к приманке в ловушке';
      if (cat.target?.kind === 'food') return 'Почуяв еду, идёт к ней';
      return 'Что-то привлекло внимание';
    }
    default:
      if (cat.activity === 'sleep') return cat.hunger === 0 ? 'Живот полон — можно и вздремнуть' : 'Дремлет';
      if (cat.activity === 'groom') return 'Умывается';
      if (cat.activity === 'rest') return 'Переводит дух между шагами';
      if (cat.target?.kind === 'follow') {
        const mum = s.cats.find((k) => k.id === cat.follows);
        if (mum?.mode === 'trapped') return cat.activity === 'walk' ? 'Спешит к маме в ловушке' : 'Ждёт маму возле ловушки';
        return cat.activity === 'walk' ? 'Догоняет маму' : 'Держится поближе к маме';
      }
      if (cat.target?.kind === 'patrol') return 'Обходит свою территорию';
      if (cat.target?.kind === 'home') return 'Возвращается на любимое место';
      return 'Отдыхает и посматривает по сторонам';
  }
}

export function catSenses(cat: Cat, s?: GameState): string[] {
  const out: string[] = [];
  const k = foodNoticeRadius(cat, 'kibble');
  const t = foodNoticeRadius(cat, 'tuna');
  if (cat.follows) {
    const mum = s?.cats.find((c) => c.id === cat.follows);
    out.push(`Котёнок: всюду ходит за мамой${mum ? ` (${mum.name})` : ''} и не отходит от неё дальше 2 клеток`);
  }
  if (k < 0) out.push('Еда сейчас совсем не интересует');
  else if (cat.picky && cat.preferredFood) {
    const r = foodNoticeRadius(cat, cat.preferredFood);
    const ring = cat.minNotice > 0 ? `в ${cat.minNotice}–${r} клетках` : `за ${cellsWord(r)}`;
    out.push(`Привереда: ест только ${FOOD_NAMES[cat.preferredFood]} и чует его ${ring}, на остальное даже не смотрит`);
  } else if (cat.minNotice > 0) out.push(`Сам находит еду в ${cat.minNotice}–${k} клетках (тунец — до ${t}). Ближе — подачка, её он не замечает`);
  else out.push(`Чует корм за ${cellsWord(k)}, тунец — за ${cellsWord(t)}`);
  if (cat.pace > 1) out.push(`Ходит не спеша: шаг раз в ${cat.pace} ${plural(cat.pace, 'ход', 'хода', 'ходов')}`);
  const toy = toyNoticeRadius(cat);
  if (toy > 0) out.push(`Замечает игрушку за ${cellsWord(toy)}`);
  if (cat.fear >= 3) out.push('Никогда не выходит из тени');
  else if (cat.fear === 2) out.push('Старается держаться в тени');
  if (cat.fear > cat.trust) out.push(`Помедлит у входа: ${turnsWord(cat.fear - cat.trust)}`);
  return out;
}

/** What the hand tool does to a noisy thing. */
export const NOISE_ACTION: Record<string, string> = {
  chimes: 'Позвонить',
  radio: 'Включить радио',
  mower: 'Завести косилку',
};
export const NOISE_SOUND: Record<string, string> = { chimes: 'звенит', radio: 'играет', mower: 'тарахтит' };

/** Gates are garden wickets everywhere except in the garages, where they are garage doors. */
export function gateWords(location: string) {
  const doors = location === 'garages';
  return {
    title: doors ? 'Ворота' : 'Калитка',
    acc: doors ? 'ворота' : 'калитку',
    open: doors ? 'Открыты' : 'Открыта',
    closed: doors ? 'Закрыты' : 'Закрыта',
    slams: doors ? 'захлопнутся' : 'захлопнется',
    spring: (n: number) => (doors ? `Ворота на пружине: после открытия сами закрываются через ${turnsWord(n)}.` : `Калитка на пружине: после открытия сама закрывается через ${turnsWord(n)}.`),
  };
}

export const LOCATION_NAMES: Record<string, string> = {
  yard: 'Двор',
  park: 'Парк',
  garages: 'Гаражи',
  garden: 'Сад',
  market: 'Рынок',
  dacha: 'Дача',
  quay: 'Набережная',
};
