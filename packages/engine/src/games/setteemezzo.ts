import { assert, type Game, type Seat } from '../core/types';
import { random, randomInt, type HasRng } from '../core/rng';
import { italianDeck, shuffled, type Card } from '../cards/cards';

export interface SetteState extends HasRng {
  players: number;
  chips: number[];
  round: number;
  totalRounds: number;
  banker: Seat;
  phase: 'bet' | 'play' | 'reveal';
  bets: (number | null)[];
  hands: Card[][];
  status: ('playing' | 'stood' | 'bust')[];
  turn: Seat;
  deck: Card[];
  /** Vincite e perdite dell'ultima mano, per posto. */
  deltas: number[] | null;
}

export type SetteMove = { type: 'bet'; amount: number } | { type: 'hit' } | { type: 'stand' } | { type: 'next' };

export interface SetteView {
  players: number;
  me: Seat | null;
  chips: number[];
  round: number;
  totalRounds: number;
  banker: Seat;
  phase: SetteState['phase'];
  bets: (number | null)[];
  /** null = carta coperta. */
  hands: (Card | null)[][];
  totals: (number | null)[];
  status: SetteState['status'];
  turn: Seat;
  deltas: number[] | null;
  maxBet: number;
}

const MATTA = (c: Card) => c.suit === 'd' && c.rank === 10;
const MAX_BET = 5;
const START_CHIPS = 20;

export function setteValue(cards: Card[]): number {
  const base = cards.filter((c) => !MATTA(c)).reduce((t, c) => t + (c.rank >= 8 ? 0.5 : c.rank), 0);
  if (!cards.some(MATTA)) return base;
  // La matta (re di denari) vale quello che conviene di più senza sballare.
  for (let v = 7; v >= 1; v--) if (base + v <= 7.5) return base + v;
  return base + 0.5;
}

/** Sette e mezzo "reale": un sette e una figura, con due sole carte. */
function reale(cards: Card[]) {
  return cards.length === 2 && setteValue(cards) === 7.5 && cards.some((c) => c.rank === 7 && !MATTA(c));
}

function order(s: SetteState): Seat[] {
  return Array.from({ length: s.players - 1 }, (_, i) => (s.banker + 1 + i) % s.players);
}

function startRound(s: SetteState) {
  s.deck = shuffled(s, italianDeck());
  s.hands = Array.from({ length: s.players }, () => []);
  s.status = Array(s.players).fill('playing');
  s.bets = Array(s.players).fill(null);
  s.deltas = null;
  s.phase = 'bet';
}

function dealFirst(s: SetteState) {
  for (let p = 0; p < s.players; p++) s.hands[p].push(s.deck.pop()!);
  s.phase = 'play';
  s.turn = order(s)[0];
}

function advance(s: SetteState) {
  const seq = [...order(s), s.banker];
  const i = seq.indexOf(s.turn);
  const next = seq.slice(i + 1).find((p) => s.status[p] === 'playing');
  if (next !== undefined) {
    s.turn = next;
    return;
  }
  settle(s);
}

function settle(s: SetteState) {
  const b = s.banker;
  const bankerBust = s.status[b] === 'bust';
  const bankerValue = setteValue(s.hands[b]);
  const deltas = Array(s.players).fill(0);
  for (const p of order(s)) {
    const bet = s.bets[p] ?? 1;
    let d: number;
    if (s.status[p] === 'bust') d = -bet;
    else if (bankerBust || setteValue(s.hands[p]) > bankerValue) d = reale(s.hands[p]) ? bet * 2 : bet;
    else d = -bet; // in parità vince il banco
    deltas[p] = d;
    deltas[b] -= d;
  }
  deltas.forEach((d, p) => (s.chips[p] += d));
  s.deltas = deltas;
  s.phase = 'reveal';
}

export const setteemezzo: Game<SetteState, SetteMove, SetteView> = {
  meta: {
    id: 'setteemezzo',
    name: 'Sette e mezzo',
    category: 'carte',
    minPlayers: 2,
    maxPlayers: 8,
    emoji: '7️⃣',
    color: '#16A085',
    tagline: 'Arriva a 7½ senza sballare',
    rules: [
      'Il banco gira a ogni mano. Gli altri puntano da 1 a 5 fiches e ricevono una carta coperta.',
      'Chiedi carta finché vuoi: le carte valgono il loro numero, le figure mezzo punto. Il re di denari è la matta e vale quello che ti serve.',
      'Chi supera 7½ sballa e perde la puntata. Poi gioca il banco: chi fa più del banco vince, in parità vince il banco.',
      'Sette e mezzo con un sette e una figura paga doppio. Dopo due giri di banco vince chi ha più fiches.',
    ],
    hiddenInfo: true,
    minutes: 10,
  },
  setup({ players, seed }) {
    const s = { rng: seed, players, chips: Array(players).fill(START_CHIPS), round: 0, totalRounds: players * 2, banker: 0, turn: 0 } as SetteState;
    startRound(s);
    return s;
  },
  activePlayers(s) {
    if (s.phase === 'bet') return order(s).filter((p) => s.bets[p] === null);
    if (s.phase === 'play') return [s.turn];
    if (s.phase === 'reveal' && s.round + 1 < s.totalRounds) return [0];
    return [];
  },
  play(s, seat, move) {
    if (move.type === 'bet') {
      assert(s.phase === 'bet' && seat !== s.banker && s.bets[seat] === null, 'Non puoi puntare adesso.');
      assert(Number.isInteger(move.amount) && move.amount >= 1 && move.amount <= MAX_BET, `Punta da 1 a ${MAX_BET}.`);
      s.bets[seat] = move.amount;
      if (order(s).every((p) => s.bets[p] !== null)) dealFirst(s);
      return;
    }
    if (move.type === 'next') {
      assert(s.phase === 'reveal', 'La mano non è finita.');
      s.round++;
      s.banker = s.round % s.players;
      startRound(s);
      return;
    }
    assert(s.phase === 'play' && s.turn === seat, 'Non è il tuo turno.');
    if (move.type === 'hit') {
      s.hands[seat].push(s.deck.pop()!);
      const v = setteValue(s.hands[seat]);
      if (v > 7.5) {
        s.status[seat] = 'bust';
        advance(s);
      } else if (v === 7.5) {
        s.status[seat] = 'stood';
        advance(s);
      }
      return;
    }
    s.status[seat] = 'stood';
    advance(s);
  },
  view(s, me) {
    const reveal = s.phase === 'reveal';
    return {
      players: s.players,
      me,
      chips: s.chips,
      round: s.round,
      totalRounds: s.totalRounds,
      banker: s.banker,
      phase: s.phase,
      bets: s.bets,
      hands: s.hands.map((h, p) => h.map((c, i) => (i === 0 && p !== me && !reveal && s.status[p] !== 'bust' ? null : c))),
      totals: s.hands.map((h, p) => (h.length && (p === me || reveal || s.status[p] === 'bust') ? setteValue(h) : null)),
      status: s.status,
      turn: s.turn,
      deltas: s.deltas,
      maxBet: MAX_BET,
    };
  },
  result(s) {
    if (s.phase !== 'reveal' || s.round + 1 < s.totalRounds) return null;
    const best = Math.max(...s.chips);
    const winners = s.chips.flatMap((c, p) => (c === best ? [p] : []));
    return { winners: winners.length === s.players ? [] : winners, scores: s.chips, summary: 'Fiches finali' };
  },
  bot(s, seat) {
    if (s.phase === 'bet') return { type: 'bet', amount: 1 + randomInt(s, 3) };
    if (s.phase === 'reveal') return { type: 'next' };
    const v = setteValue(s.hands[seat]);
    if (seat === s.banker) {
      // Il banco vede chi è ancora in gioco ma non le carte coperte: prova a battere almeno metà dei rimasti.
      const alive = order(s).filter((p) => s.status[p] !== 'bust').length;
      return { type: alive === 0 || v >= 6 ? 'stand' : 'hit' };
    }
    return { type: v < 5 ? 'hit' : v < 6 && random(s) < 0.5 ? 'hit' : 'stand' };
  },
};
