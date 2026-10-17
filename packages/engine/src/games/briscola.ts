import { assert, type Game, type Seat } from '../core/types';
import { type HasRng } from '../core/rng';
import { deal, italianDeck, shuffled, takeCard, type Card } from '../cards/cards';
import { BRISCOLA_POINTS, BRISCOLA_STRENGTH, teamCount, teamOf, trickWinner } from '../cards/italian';

export interface Play {
  seat: Seat;
  card: Card;
}

export interface BriscolaState extends HasRng {
  players: number;
  hands: Card[][];
  deck: Card[];
  trump: Card;
  trick: Play[];
  turn: Seat;
  captured: Card[][];
  lastTrick: { plays: Play[]; winner: Seat } | null;
  done: boolean;
}

export type BriscolaMove = { card: string };

export interface BriscolaView {
  players: number;
  me: Seat | null;
  hand: Card[];
  handCounts: number[];
  deckCount: number;
  trump: Card;
  trick: Play[];
  turn: Seat;
  lastTrick: BriscolaState['lastTrick'];
  /** Punti si vedono solo a fine partita, come al tavolo. */
  teamPoints: number[] | null;
  capturedCounts: number[];
}

const points = (cards: Card[]) => cards.reduce((t, c) => t + (BRISCOLA_POINTS[c.rank] ?? 0), 0);

function teamPoints(s: BriscolaState): number[] {
  const out = Array(teamCount(s.players)).fill(0);
  s.captured.forEach((cards, seat) => (out[teamOf(seat, s.players)] += points(cards)));
  return out;
}

export const briscola: Game<BriscolaState, BriscolaMove, BriscolaView> = {
  meta: {
    id: 'briscola',
    name: 'Briscola',
    category: 'carte',
    minPlayers: 2,
    maxPlayers: 4,
    emoji: '🃏',
    color: '#C0392B',
    tagline: 'Carichi, lisci e briscole',
    rules: [
      'Ognuno ha tre carte. La carta scoperta sotto il mazzo decide il seme di briscola.',
      'Non c’è obbligo di rispondere al seme: prende la briscola più alta, altrimenti la carta più alta del seme uscito.',
      'Dopo ogni presa si pesca. Asso 11, tre 10, re 4, cavallo 3, fante 2.',
      'Vince chi supera 60 punti su 120. In quattro si gioca a coppie.',
    ],
    hiddenInfo: true,
    minutes: 10,
  },
  setup({ players, seed }) {
    const s = { rng: seed, players } as BriscolaState;
    let deck = italianDeck();
    // In tre si toglie un due, così le carte si dividono in parti uguali.
    if (players === 3) deck = deck.filter((c) => !(c.rank === 2 && c.suit === 'c'));
    s.deck = shuffled(s, deck);
    s.trump = s.deck[0];
    s.hands = deal(s.deck, players, 3);
    s.trick = [];
    s.turn = 0;
    s.captured = Array.from({ length: players }, () => []);
    s.lastTrick = null;
    s.done = false;
    return s;
  },
  activePlayers: (s) => (s.done ? [] : [s.turn]),
  play(s, seat, { card: id }) {
    const card = takeCard(s.hands[seat], id);
    assert(card, 'Carta non in mano.');
    s.trick.push({ seat, card });
    if (s.trick.length < s.players) {
      s.turn = (seat + 1) % s.players;
      return;
    }
    const winner = trickWinner(s.trick, BRISCOLA_STRENGTH, s.trump.suit);
    s.captured[winner].push(...s.trick.map((p) => p.card));
    s.lastTrick = { plays: s.trick, winner };
    s.trick = [];
    for (let i = 0; i < s.players && s.deck.length; i++) s.hands[(winner + i) % s.players].push(s.deck.pop()!);
    s.turn = winner;
    s.done = s.hands.every((h) => h.length === 0);
  },
  view(s, me) {
    return {
      players: s.players,
      me,
      hand: me === null ? [] : s.hands[me],
      handCounts: s.hands.map((h) => h.length),
      deckCount: s.deck.length,
      trump: s.trump,
      trick: s.trick,
      turn: s.turn,
      lastTrick: s.lastTrick,
      teamPoints: s.done ? teamPoints(s) : null,
      capturedCounts: s.captured.map((c) => c.length),
    };
  },
  result(s) {
    if (!s.done) return null;
    const pts = teamPoints(s);
    const best = Math.max(...pts);
    const leaders = pts.flatMap((p, t) => (p === best ? [t] : []));
    const winners = leaders.length === 1 ? Array.from({ length: s.players }, (_, i) => i).filter((i) => teamOf(i, s.players) === leaders[0]) : [];
    return { winners, scores: pts, summary: pts.join(' a ') };
  },
  bot(s, seat) {
    const hand = s.hands[seat];
    const trump = s.trump.suit;
    const value = (c: Card) => (BRISCOLA_POINTS[c.rank] ?? 0) + (c.suit === trump ? 5 + BRISCOLA_STRENGTH[c.rank] / 2 : BRISCOLA_STRENGTH[c.rank] / 10);
    const cheapest = [...hand].sort((a, b) => value(a) - value(b));
    if (s.trick.length === 0) return { card: cheapest[0].id };
    const current = trickWinner(s.trick, BRISCOLA_STRENGTH, trump);
    const onTable = points(s.trick.map((p) => p.card));
    const partnerWinning = s.players === 4 && teamOf(current, 4) === teamOf(seat, 4);
    if (partnerWinning) {
      // Il compagno sta prendendo: carica se l'ultimo a giocare sei tu, altrimenti liscio.
      const load = [...hand].filter((c) => c.suit !== trump).sort((a, b) => (BRISCOLA_POINTS[b.rank] ?? 0) - (BRISCOLA_POINTS[a.rank] ?? 0));
      if (s.trick.length === 3 && load.length) return { card: load[0].id };
      return { card: cheapest[0].id };
    }
    const winning = cheapest.filter((c) => trickWinner([...s.trick, { seat, card: c }], BRISCOLA_STRENGTH, trump) === seat);
    if (winning.length && (onTable >= 2 || winning[0].suit !== trump)) return { card: winning[0].id };
    return { card: cheapest[0].id };
  },
};
