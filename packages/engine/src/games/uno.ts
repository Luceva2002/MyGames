import { assert, type Game, type Seat } from '../core/types';
import { type HasRng } from '../core/rng';
import { deal, shuffled, takeCard, unoDeck, UNO_COLORS, UNO_DRAW2, UNO_REVERSE, UNO_SKIP, UNO_WILD4, type Card } from '../cards/cards';

export interface UnoState extends HasRng {
  players: number;
  hands: Card[][];
  deck: Card[];
  discard: Card[];
  color: string;
  direction: 1 | -1;
  turn: Seat;
  /** Il giocatore ha già pescato in questo turno: può solo giocare la carta pescata o passare. */
  drawn: string | null;
  winner: Seat | null;
  last: { seat: Seat; text: string } | null;
}

export type UnoMove = { type: 'play'; card: string; color?: string } | { type: 'draw' } | { type: 'pass' };

export interface UnoView {
  players: number;
  me: Seat | null;
  hand: Card[];
  playable: string[];
  handCounts: number[];
  deckCount: number;
  top: Card;
  color: string;
  direction: 1 | -1;
  turn: Seat;
  drawn: string | null;
  last: UnoState['last'];
}

function canPlay(card: Card, top: Card, color: string): boolean {
  return card.suit === 'w' || card.suit === color || card.rank === top.rank;
}

function next(s: UnoState, from: Seat, steps = 1): Seat {
  return (((from + s.direction * steps) % s.players) + s.players) % s.players;
}

function drawCards(s: UnoState, seat: Seat, n: number): Card[] {
  const got: Card[] = [];
  for (let i = 0; i < n; i++) {
    if (!s.deck.length) {
      const top = s.discard.pop()!;
      s.deck = shuffled(s, s.discard);
      s.discard = [top];
    }
    const c = s.deck.pop();
    if (!c) break;
    s.hands[seat].push(c);
    got.push(c);
  }
  return got;
}

function playableCards(s: UnoState, seat: Seat): Card[] {
  const top = s.discard[s.discard.length - 1];
  const hand = s.drawn ? s.hands[seat].filter((c) => c.id === s.drawn) : s.hands[seat];
  return hand.filter((c) => canPlay(c, top, s.color));
}

const COLOR_NAMES: Record<string, string> = { r: 'rosso', g: 'verde', b: 'blu', y: 'giallo' };

export const uno: Game<UnoState, UnoMove, UnoView> = {
  meta: {
    id: 'uno',
    name: 'UNO',
    category: 'carte',
    minPlayers: 2,
    maxPlayers: 10,
    emoji: '🌈',
    color: '#E53935',
    tagline: 'Colori, +4 e cambi di giro',
    rules: [
      'Gioca una carta dello stesso colore o dello stesso numero/simbolo di quella in cima. I jolly si giocano sempre e fanno scegliere il colore.',
      'Se non puoi o non vuoi giocare, peschi una carta: se va bene puoi giocarla subito, altrimenti passi.',
      '⊘ salta il prossimo, ⇄ inverte il giro, +2 e +4 fanno pescare e saltare il turno.',
      'Vince chi resta per primo senza carte.',
    ],
    hiddenInfo: true,
    minutes: 10,
  },
  setup({ players, seed }) {
    const s = { rng: seed, players, direction: 1, turn: 0, drawn: null, winner: null, last: null } as UnoState;
    s.deck = shuffled(s, unoDeck());
    s.hands = deal(s.deck, players, 7);
    // La prima carta scoperta è sempre un numero, così la partita parte senza effetti strani.
    const i = s.deck.findIndex((c) => c.rank <= 9 && c.suit !== 'w');
    s.discard = s.deck.splice(i, 1);
    s.color = s.discard[0].suit;
    return s;
  },
  activePlayers: (s) => (s.winner === null ? [s.turn] : []),
  play(s, seat, move) {
    if (move.type === 'draw') {
      assert(!s.drawn, 'Hai già pescato.');
      const [card] = drawCards(s, seat, 1);
      s.last = { seat, text: 'pesca' };
      const top = s.discard[s.discard.length - 1];
      if (card && canPlay(card, top, s.color)) s.drawn = card.id;
      else s.turn = next(s, seat);
      return;
    }
    if (move.type === 'pass') {
      assert(s.drawn, 'Prima devi pescare.');
      s.drawn = null;
      s.turn = next(s, seat);
      s.last = { seat, text: 'passa' };
      return;
    }
    const card = playableCards(s, seat).find((c) => c.id === move.card);
    assert(card, 'Questa carta non si può giocare.');
    if (card.suit === 'w') assert(move.color && (UNO_COLORS as readonly string[]).includes(move.color), 'Scegli un colore.');
    takeCard(s.hands[seat], card.id);
    s.discard.push(card);
    s.color = card.suit === 'w' ? move.color! : card.suit;
    s.drawn = null;
    let text = 'gioca';
    if (s.hands[seat].length === 0) {
      s.winner = seat;
      s.last = { seat, text: 'chiude!' };
      return;
    }
    let to = next(s, seat);
    if (card.rank === UNO_SKIP) {
      text = `salta %v${next(s, seat)}`;
      to = next(s, seat, 2);
    } else if (card.rank === UNO_REVERSE) {
      s.direction = s.direction === 1 ? -1 : 1;
      text = 'inverte il giro';
      to = s.players === 2 ? seat : next(s, seat);
    } else if (card.rank === UNO_DRAW2 || card.rank === UNO_WILD4) {
      const n = card.rank === UNO_DRAW2 ? 2 : 4;
      const victim = next(s, seat);
      drawCards(s, victim, n);
      text = `fa pescare ${n} a %v${victim}`;
      to = next(s, seat, 2);
    }
    if (card.suit === 'w') text += ` e sceglie ${COLOR_NAMES[s.color]}`;
    if (s.hands[seat].length === 1) text += ' — UNO!';
    s.last = { seat, text };
    s.turn = to;
  },
  view(s, me) {
    return {
      players: s.players,
      me,
      hand: me === null ? [] : s.hands[me],
      playable: me === null || me !== s.turn || s.winner !== null ? [] : playableCards(s, me).map((c) => c.id),
      handCounts: s.hands.map((h) => h.length),
      deckCount: s.deck.length,
      top: s.discard[s.discard.length - 1],
      color: s.color,
      direction: s.direction,
      turn: s.turn,
      drawn: s.drawn,
      last: s.last,
    };
  },
  result(s) {
    if (s.winner === null) return null;
    // Punti come nel regolamento: a chi chiude vanno i punti delle carte rimaste agli altri.
    const points = s.hands.flat().reduce((t, c) => t + (c.suit === 'w' ? 50 : c.rank >= 10 ? 20 : c.rank), 0);
    return { winners: [s.winner], summary: `${points} punti dalle carte rimaste agli altri` };
  },
  bot(s, seat) {
    const options = playableCards(s, seat);
    if (!options.length) return s.drawn ? { type: 'pass' } : { type: 'draw' };
    const nextCount = s.hands[next(s, seat)].length;
    const score = (c: Card) => (c.suit === 'w' ? (nextCount <= 2 ? 30 : -10) : 0) + (c.rank >= 10 && c.suit !== 'w' ? (nextCount <= 3 ? 20 : 5) : 0) + (c.rank <= 9 ? c.rank : 0);
    const card = [...options].sort((a, b) => score(b) - score(a))[0];
    if (card.suit !== 'w') return { type: 'play', card: card.id };
    const counts = UNO_COLORS.map((col) => s.hands[seat].filter((c) => c.suit === col).length);
    return { type: 'play', card: card.id, color: UNO_COLORS[counts.indexOf(Math.max(...counts))] };
  },
};

/** Testo dell'ultima giocata con i nomi al posto dei segnaposto. */
export function unoLastText(last: UnoState['last'], names: string[]): string {
  if (!last) return '';
  return `${names[last.seat]} ${last.text.replace(/%v(\d+)/, (_, n) => names[Number(n)])}`;
}
