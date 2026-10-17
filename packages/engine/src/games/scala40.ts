import { assert, type Game, type Seat } from '../core/types';
import { type HasRng } from '../core/rng';
import { deal, frenchDeck, shuffled, type Card } from '../cards/cards';
import { checkMeld, findMelds, meldPoints40, type Meld, type MeldRules } from '../cards/melds';

export const SCALA40_RULES: MeldRules = { isWild: (c) => c.suit === 'j', maxWild: 2, setDistinctSuits: true, setMax: 4 };

export interface TableMeld extends Meld {
  id: number;
  owner: Seat;
}

export interface Scala40State extends HasRng {
  players: number;
  limit: number;
  scores: number[];
  out: boolean[];
  round: number;
  hands: Card[][];
  stock: Card[];
  discard: Card[];
  melds: TableMeld[];
  nextMeldId: number;
  opened: boolean[];
  turn: Seat;
  phase: 'draw' | 'play' | 'roundEnd' | 'over';
  /** Carta presa dagli scarti: va usata nello stesso turno. */
  mustUse: string | null;
  roundPenalty: number[] | null;
  last: string | null;
}

export type Scala40Move =
  | { type: 'draw'; source: 'stock' | 'discard' }
  | { type: 'open'; melds: string[][] }
  | { type: 'meld'; cards: string[] }
  | { type: 'attach'; meld: number; cards: string[] }
  | { type: 'discard'; card: string }
  | { type: 'next' };

export interface Scala40View {
  players: number;
  me: Seat | null;
  hand: Card[];
  handCounts: number[];
  stockCount: number;
  discardTop: Card | null;
  melds: TableMeld[];
  opened: boolean[];
  turn: Seat;
  phase: Scala40State['phase'];
  mustUse: string | null;
  scores: number[];
  out: boolean[];
  limit: number;
  roundPenalty: number[] | null;
  last: string | null;
}

export function penaltyValue(c: Card): number {
  if (c.suit === 'j') return 25;
  if (c.rank === 1) return 11;
  return Math.min(c.rank, 10);
}

function takeIds(hand: Card[], ids: string[]): Card[] {
  assert(new Set(ids).size === ids.length, 'Carta ripetuta.');
  const cards = ids.map((id) => hand.find((c) => c.id === id));
  assert(cards.every(Boolean), 'Carta non in mano.');
  return cards as Card[];
}

function removeFromHand(hand: Card[], cards: Card[]) {
  for (const c of cards) hand.splice(hand.indexOf(c), 1);
}

function nextActive(s: Scala40State, from: Seat): Seat {
  for (let i = 1; i <= s.players; i++) {
    const p = (from + i) % s.players;
    if (!s.out[p]) return p;
  }
  return from;
}

function dealRound(s: Scala40State) {
  s.stock = shuffled(s, frenchDeck({ copies: 2, jokersPerDeck: 2 }));
  s.hands = Array.from({ length: s.players }, () => []);
  const active = Array.from({ length: s.players }, (_, p) => p).filter((p) => !s.out[p]);
  const dealt = deal(s.stock, active.length, 13);
  active.forEach((p, i) => (s.hands[p] = dealt[i]));
  s.discard = [s.stock.pop()!];
  s.melds = [];
  s.opened = Array(s.players).fill(false);
  s.mustUse = null;
  s.roundPenalty = null;
  s.phase = 'draw';
  s.turn = active[s.round % active.length];
  s.last = null;
}

function addMeld(s: Scala40State, owner: Seat, meld: Meld) {
  s.melds.push({ ...meld, id: s.nextMeldId++, owner });
}

function drawStock(s: Scala40State): Card {
  if (!s.stock.length) {
    const top = s.discard.pop()!;
    s.stock = shuffled(s, s.discard);
    s.discard = [top];
  }
  return s.stock.pop()!;
}

function endRound(s: Scala40State, closer: Seat) {
  s.roundPenalty = s.hands.map((h, p) => (s.out[p] || p === closer ? 0 : h.reduce((t, c) => t + penaltyValue(c), 0)));
  s.roundPenalty.forEach((v, p) => (s.scores[p] += v));
  s.scores.forEach((v, p) => {
    if (v >= s.limit) s.out[p] = true;
  });
  const alive = s.out.filter((o) => !o).length;
  s.phase = alive <= 1 ? 'over' : 'roundEnd';
}

/** Chi deve leggere i punti della mano finita per andare avanti: il primo ancora in gioco. */
function firstAlive(s: Scala40State): Seat {
  return s.out.findIndex((o) => !o);
}

export const scala40: Game<Scala40State, Scala40Move, Scala40View, { limit?: number }> = {
  meta: {
    id: 'scala40',
    name: 'Scala 40',
    category: 'carte',
    minPlayers: 2,
    maxPlayers: 6,
    emoji: '🪜',
    color: '#1565C0',
    tagline: 'Apri con 40 punti e chiudi per primo',
    rules: [
      'Due mazzi francesi con i jolly, 13 carte a testa. A ogni turno peschi (dal mazzo o lo scarto) e alla fine scarti una carta.',
      'Combinazioni: scale dello stesso seme (A-2-3 o Q-K-A) e tris o poker di semi diversi. Il jolly sostituisce una carta.',
      'Per aprire devi calare in un turno combinazioni che valgono almeno 40 punti. Dopo puoi calare e attaccare carte anche alle combinazioni degli altri.',
      'Lo scarto lo prendi solo se lo usi subito. Chiude chi scarta l’ultima carta: gli altri si segnano i punti rimasti in mano. A 101 sei fuori.',
    ],
    hiddenInfo: true,
    minutes: 25,
  },
  setup({ players, seed, options }) {
    const s = {
      rng: seed,
      players,
      limit: options?.limit ?? 101,
      scores: Array(players).fill(0),
      out: Array(players).fill(false),
      round: 0,
      nextMeldId: 1,
    } as Scala40State;
    dealRound(s);
    return s;
  },
  activePlayers(s) {
    if (s.phase === 'draw' || s.phase === 'play') return [s.turn];
    if (s.phase === 'roundEnd') return [firstAlive(s)];
    return [];
  },
  play(s, seat, move) {
    const hand = s.hands[seat];
    switch (move.type) {
      case 'next': {
        assert(s.phase === 'roundEnd', 'La mano non è finita.');
        s.round++;
        dealRound(s);
        return;
      }
      case 'draw': {
        assert(s.phase === 'draw', 'Hai già pescato.');
        if (move.source === 'discard') {
          assert(s.discard.length, 'Non ci sono scarti.');
          const c = s.discard.pop()!;
          hand.push(c);
          s.mustUse = c.id;
          s.last = 'prende lo scarto';
        } else {
          hand.push(drawStock(s));
          s.last = 'pesca dal mazzo';
        }
        s.phase = 'play';
        return;
      }
      case 'open': {
        assert(s.phase === 'play', 'Prima pesca.');
        assert(!s.opened[seat], 'Hai già aperto.');
        const all = move.melds.flat();
        const cards = takeIds(hand, all);
        assert(hand.length - cards.length >= 1, 'Devi tenere almeno una carta da scartare.');
        let points = 0;
        const melds: Meld[] = [];
        for (const ids of move.melds) {
          const m = checkMeld(takeIds(hand, ids), SCALA40_RULES);
          assert(m, 'Una delle combinazioni non è valida.');
          points += meldPoints40(m);
          melds.push(m);
        }
        assert(points >= 40, `Per aprire servono 40 punti (ne hai ${points}).`);
        removeFromHand(hand, cards);
        melds.forEach((m) => addMeld(s, seat, m));
        s.opened[seat] = true;
        if (s.mustUse && all.includes(s.mustUse)) s.mustUse = null;
        s.last = `apre con ${points} punti`;
        return;
      }
      case 'meld': {
        assert(s.phase === 'play', 'Prima pesca.');
        assert(s.opened[seat], 'Prima devi aprire con 40 punti.');
        const cards = takeIds(hand, move.cards);
        assert(hand.length - cards.length >= 1, 'Devi tenere almeno una carta da scartare.');
        const m = checkMeld(cards, SCALA40_RULES);
        assert(m, 'Combinazione non valida.');
        removeFromHand(hand, cards);
        addMeld(s, seat, m);
        if (s.mustUse && move.cards.includes(s.mustUse)) s.mustUse = null;
        s.last = 'cala una combinazione';
        return;
      }
      case 'attach': {
        assert(s.phase === 'play', 'Prima pesca.');
        assert(s.opened[seat], 'Prima devi aprire con 40 punti.');
        const target = s.melds.find((m) => m.id === move.meld);
        assert(target, 'Combinazione non trovata.');
        const cards = takeIds(hand, move.cards);
        assert(hand.length - cards.length >= 1, 'Devi tenere almeno una carta da scartare.');
        const m = checkMeld([...target.cards, ...cards], SCALA40_RULES);
        assert(m, 'Queste carte non si attaccano lì.');
        removeFromHand(hand, cards);
        Object.assign(target, m);
        if (s.mustUse && move.cards.includes(s.mustUse)) s.mustUse = null;
        s.last = 'attacca';
        return;
      }
      case 'discard': {
        assert(s.phase === 'play', 'Prima pesca.');
        assert(!s.mustUse, 'Devi usare la carta presa dagli scarti.');
        const c = hand.find((x) => x.id === move.card);
        assert(c, 'Carta non in mano.');
        hand.splice(hand.indexOf(c), 1);
        s.discard.push(c);
        if (!hand.length) {
          s.last = 'chiude!';
          endRound(s, seat);
          return;
        }
        s.last = 'scarta';
        s.turn = nextActive(s, seat);
        s.phase = 'draw';
        return;
      }
    }
  },
  view(s, me) {
    return {
      players: s.players,
      me,
      hand: me === null ? [] : s.hands[me],
      handCounts: s.hands.map((h) => h.length),
      stockCount: s.stock.length,
      discardTop: s.discard[s.discard.length - 1] ?? null,
      melds: s.melds,
      opened: s.opened,
      turn: s.turn,
      phase: s.phase,
      mustUse: s.mustUse,
      scores: s.scores,
      out: s.out,
      limit: s.limit,
      roundPenalty: s.roundPenalty,
      last: s.last,
    };
  },
  result(s) {
    if (s.phase !== 'over') return null;
    const winner = s.out.findIndex((o) => !o);
    const winners = winner >= 0 ? [winner] : [s.scores.indexOf(Math.min(...s.scores))];
    return { winners, scores: s.scores, summary: 'Punti di penalità (meno è meglio)' };
  },
  bot(s, seat) {
    if (s.phase === 'roundEnd') return { type: 'next' };
    const hand = s.hands[seat];
    if (s.phase === 'draw') {
      const top = s.discard[s.discard.length - 1];
      if (top && s.opened[seat] && top.suit !== 'j') {
        const fits = s.melds.some((m) => checkMeld([...m.cards, top], SCALA40_RULES));
        if (fits) return { type: 'draw', source: 'discard' };
      }
      return { type: 'draw', source: 'stock' };
    }
    if (s.mustUse) {
      const c = hand.find((x) => x.id === s.mustUse)!;
      const m = s.melds.find((mm) => checkMeld([...mm.cards, c], SCALA40_RULES));
      if (m && hand.length > 1) return { type: 'attach', meld: m.id, cards: [c.id] };
    }
    const keepOne = (cards: Card[]) => hand.length - cards.length >= 1;
    if (!s.opened[seat]) {
      const melds = findMelds(hand, SCALA40_RULES, meldPoints40);
      const points = melds.reduce((t, m) => t + meldPoints40(m), 0);
      const used = melds.flatMap((m) => m.cards);
      if (points >= 40 && keepOne(used)) return { type: 'open', melds: melds.map((m) => m.cards.map((c) => c.id)) };
    } else {
      const melds = findMelds(hand, SCALA40_RULES, meldPoints40);
      if (melds.length && keepOne(melds[0].cards)) return { type: 'meld', cards: melds[0].cards.map((c) => c.id) };
      for (const c of hand) {
        if (c.suit === 'j' || hand.length <= 1) continue;
        const m = s.melds.find((mm) => checkMeld([...mm.cards, c], SCALA40_RULES));
        if (m) return { type: 'attach', meld: m.id, cards: [c.id] };
      }
    }
    // Scarta la carta che serve meno: alta e senza compagne vicine.
    const useful = (c: Card) =>
      hand.filter((o) => o !== c && o.suit !== 'j' && ((o.rank === c.rank && o.suit !== c.suit) || (o.suit === c.suit && Math.abs(o.rank - c.rank) <= 2))).length;
    const candidates = hand.filter((c) => c.suit !== 'j');
    const pool = candidates.length ? candidates : hand;
    const worst = [...pool].sort((a, b) => useful(a) - useful(b) || penaltyValue(b) - penaltyValue(a))[0];
    return { type: 'discard', card: worst.id };
  },
};
