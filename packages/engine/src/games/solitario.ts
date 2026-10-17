import { assert, type Game } from '../core/types';
import { type HasRng } from '../core/rng';
import { frenchDeck, shuffled, type Card } from '../cards/cards';

export interface TableauCard {
  card: Card;
  up: boolean;
}

export interface SolitarioState extends HasRng {
  tableau: TableauCard[][];
  stock: Card[];
  waste: Card[];
  foundations: Card[][];
  draw: 1 | 3;
  moves: number;
  /** Mosse utili fatte dall'ultimo giro del mazzo: se un giro intero non porta niente, sei bloccato. */
  sinceRecycle: number;
  stuckPasses: number;
  resigned: boolean;
}

export type SolitarioFrom = { zone: 'waste' } | { zone: 'tableau'; pile: number; index: number } | { zone: 'foundation'; pile: number };
export type SolitarioTo = { zone: 'tableau'; pile: number } | { zone: 'foundation'; pile: number };
export type SolitarioMove = { type: 'draw' } | { type: 'move'; from: SolitarioFrom; to: SolitarioTo } | { type: 'resign' };

export interface SolitarioView {
  tableau: (Card | null)[][];
  stockCount: number;
  waste: Card[];
  foundations: Card[][];
  moves: number;
  draw: 1 | 3;
  stuck: boolean;
}

const red = (c: Card) => c.suit === 'h' || c.suit === 'd';
const top = <T,>(a: T[]) => a[a.length - 1];

function picked(s: SolitarioState, from: SolitarioFrom): Card[] {
  if (from.zone === 'waste') return s.waste.length ? [top(s.waste)] : [];
  if (from.zone === 'foundation') return s.foundations[from.pile]?.length ? [top(s.foundations[from.pile])] : [];
  const pile = s.tableau[from.pile];
  if (!pile || !pile[from.index]?.up) return [];
  return pile.slice(from.index).map((t) => t.card);
}

export function canPlace(s: SolitarioState, cards: Card[], to: SolitarioTo): boolean {
  if (!cards.length) return false;
  const first = cards[0];
  if (to.zone === 'foundation') {
    const f = s.foundations[to.pile];
    if (!f || cards.length !== 1) return false;
    return f.length ? top(f).suit === first.suit && top(f).rank === first.rank - 1 : first.rank === 1;
  }
  const pile = s.tableau[to.pile];
  if (!pile) return false;
  if (!pile.length) return first.rank === 13;
  const t = top(pile);
  return t.up && red(t.card) !== red(first) && t.card.rank === first.rank + 1;
}

/** Fondazione dove può andare una carta, per il doppio tocco. */
export function foundationFor(s: SolitarioState, card: Card): number | null {
  for (let i = 0; i < 4; i++) if (canPlace(s, [card], { zone: 'foundation', pile: i })) return i;
  return null;
}

function doMove(s: SolitarioState, from: SolitarioFrom, to: SolitarioTo) {
  const cards = picked(s, from);
  assert(cards.length, 'Non c’è niente da spostare.');
  assert(canPlace(s, cards, to), 'Lì non ci va.');
  if (from.zone === 'waste') s.waste.pop();
  else if (from.zone === 'foundation') s.foundations[from.pile].pop();
  else {
    const pile = s.tableau[from.pile];
    pile.splice(from.index);
    if (pile.length && !top(pile).up) top(pile).up = true;
  }
  if (to.zone === 'foundation') s.foundations[to.pile].push(cards[0]);
  else s.tableau[to.pile].push(...cards.map((card) => ({ card, up: true })));
  s.moves++;
  if (from.zone !== 'foundation') s.sinceRecycle++;
}

const won = (s: SolitarioState) => s.foundations.every((f) => f.length === 13);

export const solitario: Game<SolitarioState, SolitarioMove, SolitarioView, { draw?: 1 | 3 }> = {
  meta: {
    id: 'solitario',
    name: 'Solitario',
    category: 'carte',
    minPlayers: 1,
    maxPlayers: 1,
    emoji: '🂡',
    color: '#2E7D32',
    tagline: 'Il Klondike di sempre',
    rules: [
      'Porta tutte le carte sulle quattro basi in alto, dall’asso al re dello stesso seme.',
      'Nelle colonne si scende di uno alternando rosso e nero. Una colonna vuota si riempie solo con un re.',
      'Tocca il mazzo per girare una carta. Tocca una carta e poi dove spostarla; doppio tocco per mandarla sulla base.',
    ],
    hiddenInfo: false,
    minutes: 10,
  },
  setup({ seed, options }) {
    const s = { rng: seed, waste: [], foundations: [[], [], [], []], draw: options?.draw ?? 1, moves: 0, sinceRecycle: 0, stuckPasses: 0, resigned: false } as unknown as SolitarioState;
    const deck = shuffled(s, frenchDeck());
    s.tableau = Array.from({ length: 7 }, (_, i) => deck.splice(-(i + 1)).map((card, j) => ({ card, up: j === i })));
    s.stock = deck;
    return s;
  },
  activePlayers: (s) => (won(s) || s.resigned ? [] : [0]),
  play(s, _seat, move) {
    if (move.type === 'resign') {
      s.resigned = true;
      return;
    }
    if (move.type === 'draw') {
      if (s.stock.length) {
        for (let i = 0; i < s.draw && s.stock.length; i++) s.waste.push(s.stock.pop()!);
      } else {
        assert(s.waste.length, 'Il mazzo è finito.');
        s.stock = s.waste.reverse();
        s.waste = [];
        s.stuckPasses = s.sinceRecycle === 0 ? s.stuckPasses + 1 : 0;
        s.sinceRecycle = 0;
      }
      s.moves++;
      return;
    }
    doMove(s, move.from, move.to);
  },
  view(s) {
    return {
      tableau: s.tableau.map((p) => p.map((t) => (t.up ? t.card : null))),
      stockCount: s.stock.length,
      waste: s.waste.slice(-3),
      foundations: s.foundations,
      moves: s.moves,
      draw: s.draw,
      stuck: s.stuckPasses >= 1,
    };
  },
  result(s) {
    if (!won(s) && !s.resigned) return null;
    const placed = s.foundations.reduce((t, f) => t + f.length, 0);
    return won(s)
      ? { winners: [0], scores: [placed], summary: `Risolto in ${s.moves} mosse!` }
      : { winners: [], scores: [placed], summary: `${placed} carte su 52 sulle basi` };
  },
  bot(s) {
    if (s.stuckPasses >= 2) return { type: 'resign' };
    const sources: SolitarioFrom[] = [{ zone: 'waste' }, ...s.tableau.map((p, pile) => ({ zone: 'tableau' as const, pile, index: p.length - 1 }))];
    for (const from of sources) {
      const cards = picked(s, from);
      if (cards.length !== 1) continue;
      const f = foundationFor(s, cards[0]);
      if (f !== null) return { type: 'move', from, to: { zone: 'foundation', pile: f } };
    }
    // Sposta pile che scoprono una carta coperta.
    for (let pile = 0; pile < 7; pile++) {
      const p = s.tableau[pile];
      const index = p.findIndex((t) => t.up);
      if (index < 0) continue;
      if (index === 0 && p[0].card.rank === 13) continue; // re già in fondo: inutile spostarlo
      for (let to = 0; to < 7; to++) {
        if (to !== pile && canPlace(s, picked(s, { zone: 'tableau', pile, index }), { zone: 'tableau', pile: to })) {
          return { type: 'move', from: { zone: 'tableau', pile, index }, to: { zone: 'tableau', pile: to } };
        }
      }
    }
    if (s.waste.length) {
      for (let to = 0; to < 7; to++) if (canPlace(s, [top(s.waste)], { zone: 'tableau', pile: to })) return { type: 'move', from: { zone: 'waste' }, to: { zone: 'tableau', pile: to } };
    }
    if (s.stock.length || s.waste.length) return { type: 'draw' };
    return { type: 'resign' };
  },
};
