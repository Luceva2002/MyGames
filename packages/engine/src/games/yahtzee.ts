import { assert, type Game, type Seat } from '../core/types';
import { randomInt, type HasRng } from '../core/rng';

export const YAHTZEE_CATEGORIES = [
  'uno', 'due', 'tre', 'quattro', 'cinque', 'sei',
  'tris', 'poker', 'full', 'scalina', 'scala', 'yahtzee', 'chance',
] as const;
export type YahtzeeCategory = (typeof YAHTZEE_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<YahtzeeCategory, string> = {
  uno: 'Uno', due: 'Due', tre: 'Tre', quattro: 'Quattro', cinque: 'Cinque', sei: 'Sei',
  tris: 'Tris', poker: 'Poker', full: 'Full (25)', scalina: 'Scala piccola (30)', scala: 'Scala grande (40)', yahtzee: 'Yahtzee (50)', chance: 'Chance',
};

export interface YahtzeeState extends HasRng {
  players: number;
  scores: Partial<Record<YahtzeeCategory, number>>[];
  bonus: number[];
  dice: number[];
  held: boolean[];
  rollsLeft: number;
  turn: Seat;
  rollCount: number;
}

export type YahtzeeMove = { type: 'roll'; held: boolean[] } | { type: 'score'; category: YahtzeeCategory };

export interface YahtzeeView extends YahtzeeState {
  /** Punti che si farebbero adesso in ogni casella libera. */
  preview: Partial<Record<YahtzeeCategory, number>>;
  totals: number[];
  upper: number[];
}

const sum = (d: number[]) => d.reduce((a, b) => a + b, 0);
const counts = (d: number[]) => [1, 2, 3, 4, 5, 6].map((v) => d.filter((x) => x === v).length);
const hasRun = (d: number[], len: number) => {
  const set = new Set(d);
  for (let start = 1; start + len - 1 <= 6; start++) if (Array.from({ length: len }, (_, i) => start + i).every((v) => set.has(v))) return true;
  return false;
};

export function scoreFor(category: YahtzeeCategory, dice: number[], joker = false): number {
  const c = counts(dice);
  const upper = YAHTZEE_CATEGORIES.indexOf(category);
  if (upper < 6) return c[upper] * (upper + 1);
  switch (category) {
    case 'tris': return c.some((n) => n >= 3) ? sum(dice) : 0;
    case 'poker': return c.some((n) => n >= 4) ? sum(dice) : 0;
    case 'full': return joker || (c.includes(3) && c.includes(2)) ? 25 : 0;
    case 'scalina': return joker || hasRun(dice, 4) ? 30 : 0;
    case 'scala': return joker || hasRun(dice, 5) ? 40 : 0;
    case 'yahtzee': return c.includes(5) ? 50 : 0;
    default: return sum(dice);
  }
}

function upperTotal(sc: YahtzeeState['scores'][number]) {
  return YAHTZEE_CATEGORIES.slice(0, 6).reduce((t, k) => t + (sc[k] ?? 0), 0);
}

function total(s: YahtzeeState, p: Seat) {
  const sc = s.scores[p];
  const base = YAHTZEE_CATEGORIES.reduce((t, k) => t + (sc[k] ?? 0), 0);
  return base + (upperTotal(sc) >= 63 ? 35 : 0) + s.bonus[p];
}

function isYahtzee(d: number[]) {
  return d.every((x) => x === d[0]);
}

function preview(s: YahtzeeState, p: Seat) {
  const out: Partial<Record<YahtzeeCategory, number>> = {};
  if (s.rollsLeft === 3) return out;
  // Yahtzee extra con la casella già piena: vale da jolly per full e scale.
  const joker = isYahtzee(s.dice) && s.scores[p].yahtzee !== undefined;
  for (const k of YAHTZEE_CATEGORIES) if (s.scores[p][k] === undefined) out[k] = scoreFor(k, s.dice, joker);
  return out;
}

function finished(s: YahtzeeState) {
  return s.scores.every((sc) => Object.keys(sc).length === YAHTZEE_CATEGORIES.length);
}

function roll(s: YahtzeeState) {
  s.dice = s.dice.map((d, i) => (s.held[i] ? d : 1 + randomInt(s, 6)));
  s.rollsLeft--;
  s.rollCount++;
}

export const yahtzee: Game<YahtzeeState, YahtzeeMove, YahtzeeView> = {
  meta: {
    id: 'yahtzee',
    name: 'Yahtzee',
    category: 'dadi',
    minPlayers: 1,
    maxPlayers: 6,
    emoji: '🎲',
    color: '#F57C00',
    tagline: 'Cinque dadi, tre tiri, tredici caselle',
    rules: [
      'A ogni turno tiri cinque dadi fino a tre volte, tenendo quelli che vuoi (tocca un dado per bloccarlo).',
      'Poi scegli una casella libera dove segnare i punti: ogni casella si usa una volta sola.',
      'Se nella parte alta (uno…sei) fai almeno 63 punti prendi 35 punti di bonus. Ogni yahtzee in più vale 100.',
      'Dopo tredici turni vince chi ha il totale più alto.',
    ],
    hiddenInfo: false,
    minutes: 15,
  },
  setup({ players, seed }) {
    return {
      rng: seed,
      players,
      scores: Array.from({ length: players }, () => ({})),
      bonus: Array(players).fill(0),
      dice: [1, 2, 3, 4, 5],
      held: Array(5).fill(false),
      rollsLeft: 3,
      turn: 0,
      rollCount: 0,
    };
  },
  activePlayers: (s) => (finished(s) ? [] : [s.turn]),
  play(s, seat, move) {
    if (move.type === 'roll') {
      assert(s.rollsLeft > 0, 'Hai già tirato tre volte: scegli dove segnare.');
      s.held = s.rollsLeft === 3 ? Array(5).fill(false) : move.held.slice(0, 5).map(Boolean);
      roll(s);
      return;
    }
    assert(s.rollsLeft < 3, 'Prima tira i dadi.');
    assert(s.scores[seat][move.category] === undefined, 'Casella già usata.');
    if (isYahtzee(s.dice) && s.scores[seat].yahtzee === 50) s.bonus[seat] += 100;
    s.scores[seat][move.category] = preview(s, seat)[move.category]!;
    s.turn = (seat + 1) % s.players;
    s.rollsLeft = 3;
    s.held = Array(5).fill(false);
  },
  view(s) {
    return {
      ...s,
      preview: preview(s, s.turn),
      totals: Array.from({ length: s.players }, (_, p) => total(s, p)),
      upper: s.scores.map(upperTotal),
    };
  },
  result(s) {
    if (!finished(s)) return null;
    const totals = Array.from({ length: s.players }, (_, p) => total(s, p));
    const best = Math.max(...totals);
    const winners = totals.flatMap((t, p) => (t === best ? [p] : []));
    return { winners: s.players === 1 ? [0] : winners.length === s.players ? [] : winners, scores: totals, summary: s.players === 1 ? `Hai fatto ${best} punti` : `Miglior punteggio: ${best}` };
  },
  bot(s, seat) {
    if (s.rollsLeft === 3) return { type: 'roll', held: Array(5).fill(false) };
    const pv = preview(s, seat);
    const free = Object.keys(pv) as YahtzeeCategory[];
    // Peso: preferisci le caselle "difficili" quando escono, e non sprecare le facili.
    const weight = (k: YahtzeeCategory) => {
      const v = pv[k]!;
      if (k === 'chance') return v * 0.6 - 5;
      if (YAHTZEE_CATEGORIES.indexOf(k) < 6) return v - (YAHTZEE_CATEGORIES.indexOf(k) + 1) * 3 + 2;
      return v;
    };
    const bestCat = free.sort((a, b) => weight(b) - weight(a))[0];
    if (s.rollsLeft > 0 && weight(bestCat) < 25) {
      const c = counts(s.dice);
      const target = c.indexOf(Math.max(...c)) + 1;
      if (Math.max(...c) <= 2 && (pv.scalina !== undefined || pv.scala !== undefined)) {
        const seen = new Set<number>();
        return { type: 'roll', held: s.dice.map((d) => (d >= 2 && d <= 5 && !seen.has(d) ? (seen.add(d), true) : false)) };
      }
      return { type: 'roll', held: s.dice.map((d) => d === target) };
    }
    return { type: 'score', category: bestCat };
  },
};
