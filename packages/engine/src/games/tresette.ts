import { assert, type Game, type Seat } from '../core/types';
import { type HasRng } from '../core/rng';
import { deal, italianDeck, shuffled, takeCard, type Card } from '../cards/cards';
import { teamCount, teamOf, trickWinner, TRESETTE_STRENGTH, TRESETTE_THIRDS } from '../cards/italian';
import type { Play } from './briscola';

export interface TresetteState extends HasRng {
  players: number;
  target: number;
  hands: Card[][];
  deck: Card[];
  trick: Play[];
  turn: Seat;
  handNo: number;
  /** Punti della mano in corso, in terzi di punto. */
  thirds: number[];
  teamScores: number[];
  lastTrick: { plays: Play[]; winner: Seat } | null;
  /** In due: le carte pescate dopo la presa si vedono. */
  lastDraw: { seat: Seat; card: Card }[];
  phase: 'play' | 'handEnd' | 'over';
  handPoints: number[] | null;
}

export type TresetteMove = { type: 'play'; card: string } | { type: 'next' };

export interface TresetteView {
  players: number;
  me: Seat | null;
  hand: Card[];
  playable: string[];
  handCounts: number[];
  deckCount: number;
  trick: Play[];
  turn: Seat;
  lastTrick: TresetteState['lastTrick'];
  lastDraw: TresetteState['lastDraw'];
  teamScores: number[];
  target: number;
  phase: TresetteState['phase'];
  handPoints: number[] | null;
}

function playable(s: TresetteState, seat: Seat): Card[] {
  const hand = s.hands[seat];
  if (!s.trick.length) return hand;
  const lead = s.trick[0].card.suit;
  const follow = hand.filter((c) => c.suit === lead);
  return follow.length ? follow : hand;
}

function dealHand(s: TresetteState) {
  s.deck = shuffled(s, italianDeck());
  s.hands = deal(s.deck, s.players, 10);
  s.trick = [];
  s.turn = s.handNo % s.players;
  s.thirds = Array(teamCount(s.players)).fill(0);
  s.lastTrick = null;
  s.lastDraw = [];
  s.phase = 'play';
  s.handPoints = null;
}

export const tresette: Game<TresetteState, TresetteMove, TresetteView, { target?: number }> = {
  // Presa appena chiusa: più tempo per vedere chi l'ha fatta; altrimenti un attimo per seguire la giocata.
  pause: (s) => (s.trick.length === 0 && s.lastTrick ? 1800 : 1100),
  meta: {
    id: 'tresette',
    name: 'Tresette',
    category: 'carte',
    minPlayers: 2,
    maxPlayers: 4,
    emoji: '3️⃣',
    color: '#8E44AD',
    tagline: 'Rispondi al seme e conta i terzi',
    rules: [
      'Bisogna rispondere al seme uscito; se non lo hai giochi quello che vuoi. Prende la carta più alta del seme d’uscita.',
      'Ordine di forza: tre, due, asso, re, cavallo, fante, 7, 6, 5, 4.',
      'L’asso vale un punto, tre, due e figure un terzo. L’ultima presa vale un punto in più.',
      'In quattro si gioca a coppie, in due si pesca dopo ogni presa. Si arriva a 21.',
    ],
    hiddenInfo: true,
    playerCounts: [2, 4],
    minutes: 20,
  },
  setup({ players, seed, options }) {
    assert(players === 2 || players === 4, 'Il tresette si gioca in due o in quattro.');
    const s = { rng: seed, players, target: options?.target ?? 21, handNo: 0, teamScores: Array(teamCount(players)).fill(0) } as TresetteState;
    dealHand(s);
    return s;
  },
  activePlayers: (s) => (s.phase === 'play' ? [s.turn] : s.phase === 'handEnd' ? [0] : []),
  play(s, seat, move) {
    if (move.type === 'next') {
      assert(s.phase === 'handEnd', 'La mano non è finita.');
      s.handNo++;
      dealHand(s);
      return;
    }
    assert(s.phase === 'play', 'Non si può giocare adesso.');
    assert(playable(s, seat).some((c) => c.id === move.card), 'Devi rispondere al seme.');
    const card = takeCard(s.hands[seat], move.card)!;
    s.trick.push({ seat, card });
    if (s.trick.length < s.players) {
      s.turn = (seat + 1) % s.players;
      return;
    }
    const winner = trickWinner(s.trick, TRESETTE_STRENGTH);
    const team = teamOf(winner, s.players);
    s.thirds[team] += s.trick.reduce((t, p) => t + (TRESETTE_THIRDS[p.card.rank] ?? 0), 0);
    s.lastTrick = { plays: s.trick, winner };
    s.trick = [];
    s.lastDraw = [];
    for (let i = 0; i < s.players && s.deck.length; i++) {
      const who = (winner + i) % s.players;
      const drawn = s.deck.pop()!;
      s.hands[who].push(drawn);
      s.lastDraw.push({ seat: who, card: drawn });
    }
    s.turn = winner;
    if (s.hands.every((h) => h.length === 0)) {
      s.thirds[team] += 3; // ultima presa
      s.handPoints = s.thirds.map((t) => Math.floor(t / 3));
      s.handPoints.forEach((p, t) => (s.teamScores[t] += p));
      const best = Math.max(...s.teamScores);
      const leaders = s.teamScores.filter((p) => p === best).length;
      s.phase = best >= s.target && leaders === 1 ? 'over' : 'handEnd';
    }
  },
  view(s, me) {
    return {
      players: s.players,
      me,
      hand: me === null ? [] : s.hands[me],
      playable: me === null || s.turn !== me || s.phase !== 'play' ? [] : playable(s, me).map((c) => c.id),
      handCounts: s.hands.map((h) => h.length),
      deckCount: s.deck.length,
      trick: s.trick,
      turn: s.turn,
      lastTrick: s.lastTrick,
      lastDraw: s.lastDraw,
      teamScores: s.teamScores,
      target: s.target,
      phase: s.phase,
      handPoints: s.handPoints,
    };
  },
  result(s) {
    if (s.phase !== 'over') return null;
    const team = s.teamScores.indexOf(Math.max(...s.teamScores));
    const winners = Array.from({ length: s.players }, (_, i) => i).filter((i) => teamOf(i, s.players) === team);
    return { winners, scores: s.teamScores, summary: s.teamScores.join(' a ') };
  },
  bot(s, seat) {
    if (s.phase === 'handEnd') return { type: 'next' };
    const options = playable(s, seat);
    const weak = (c: Card) => TRESETTE_STRENGTH[c.rank] + (TRESETTE_THIRDS[c.rank] ?? 0) * 2;
    const sorted = [...options].sort((a, b) => weak(a) - weak(b));
    if (!s.trick.length) {
      // In uscita gioca la carta più forte se è imbattibile (un tre), altrimenti una cartina.
      const three = options.find((c) => c.rank === 3);
      return { type: 'play', card: (three ?? sorted[0]).id };
    }
    const winners = options.filter((c) => trickWinner([...s.trick, { seat, card: c }], TRESETTE_STRENGTH) === seat);
    const current = trickWinner(s.trick, TRESETTE_STRENGTH);
    const partner = s.players === 4 && teamOf(current, 4) === teamOf(seat, 4);
    if (partner) {
      const ace = options.find((c) => c.rank === 1 && c.suit === s.trick[0].card.suit);
      return { type: 'play', card: (ace ?? sorted[0]).id };
    }
    if (winners.length) return { type: 'play', card: winners.sort((a, b) => TRESETTE_STRENGTH[a.rank] - TRESETTE_STRENGTH[b.rank])[0].id };
    return { type: 'play', card: sorted[0].id };
  },
};
