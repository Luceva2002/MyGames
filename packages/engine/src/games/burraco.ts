import { assert, type Game, type Seat } from '../core/types';
import { type HasRng } from '../core/rng';
import { deal, frenchDeck, shuffled, type Card } from '../cards/cards';
import { checkMeld, findMelds, type Meld, type MeldRules } from '../cards/melds';
import { teamCount, teamOf } from '../cards/italian';

const isWildCard = (c: Card) => c.suit === 'j' || c.rank === 2;

export const BURRACO_RULES: MeldRules = {
  isWild: isWildCard,
  maxWild: 1,
  setDistinctSuits: false,
  setMax: 99,
  wildCanBeNatural: (c) => c.rank === 2,
};

export interface BurracoMeld extends Meld {
  id: number;
  team: number;
}

export interface BurracoTeamReport {
  melded: number;
  burraco: number;
  closing: number;
  inHand: number;
  noPozzetto: number;
  total: number;
}

export interface BurracoState extends HasRng {
  players: number;
  target: number;
  hands: Card[][];
  stock: Card[];
  discard: Card[];
  pozzetti: Card[][];
  pozzettoTaken: boolean[];
  melds: BurracoMeld[];
  nextMeldId: number;
  turn: Seat;
  handNo: number;
  phase: 'draw' | 'play' | 'handEnd' | 'over';
  teamScores: number[];
  report: BurracoTeamReport[] | null;
  last: string | null;
}

export type BurracoMove =
  | { type: 'draw'; source: 'stock' | 'discard' }
  | { type: 'meld'; cards: string[] }
  | { type: 'attach'; meld: number; cards: string[] }
  | { type: 'discard'; card: string }
  | { type: 'next' };

export interface BurracoView {
  players: number;
  me: Seat | null;
  hand: Card[];
  handCounts: number[];
  stockCount: number;
  discard: Card[];
  pozzettoTaken: boolean[];
  melds: (BurracoMeld & { burraco: 'pulito' | 'sporco' | null })[];
  turn: Seat;
  phase: BurracoState['phase'];
  teamScores: number[];
  target: number;
  report: BurracoTeamReport[] | null;
  last: string | null;
}

export function burracoValue(c: Card): number {
  if (c.suit === 'j') return 30;
  if (c.rank === 2) return 20;
  if (c.rank === 1) return 15;
  return c.rank >= 8 ? 10 : 5;
}

/** Una carta fa da matta se non sta al suo posto naturale. */
function actingWild(m: Meld, i: number): boolean {
  const c = m.cards[i];
  if (c.suit === 'j') return true;
  const natural = m.ranks[i] === 14 ? 1 : m.ranks[i];
  if (c.rank !== natural) return true;
  if (m.kind === 'run') {
    const suit = m.cards.find((x, j) => x.suit !== 'j' && x.rank === (m.ranks[j] === 14 ? 1 : m.ranks[j]))?.suit;
    return c.suit !== suit;
  }
  return false;
}

export function burracoKind(m: Meld): 'pulito' | 'sporco' | null {
  if (m.cards.length < 7) return null;
  return m.cards.some((_, i) => actingWild(m, i)) ? 'sporco' : 'pulito';
}

function teamHasBurraco(s: BurracoState, team: number) {
  return s.melds.some((m) => m.team === team && burracoKind(m));
}

function takeIds(hand: Card[], ids: string[]): Card[] {
  assert(new Set(ids).size === ids.length, 'Carta ripetuta.');
  const cards = ids.map((id) => hand.find((c) => c.id === id));
  assert(cards.every(Boolean), 'Carta non in mano.');
  return cards as Card[];
}

function dealHand(s: BurracoState) {
  s.stock = shuffled(s, frenchDeck({ copies: 2, jokersPerDeck: 2 }));
  s.hands = deal(s.stock, s.players, 11);
  s.pozzetti = [s.stock.splice(-11), s.stock.splice(-11)];
  s.discard = [s.stock.pop()!];
  s.pozzettoTaken = Array(teamCount(s.players)).fill(false);
  s.melds = [];
  s.turn = s.handNo % s.players;
  s.phase = 'draw';
  s.report = null;
  s.last = null;
}

function endHand(s: BurracoState, closer: Seat | null) {
  const teams = teamCount(s.players);
  s.report = Array.from({ length: teams }, (_, t) => {
    const mine = s.melds.filter((m) => m.team === t);
    const melded = mine.reduce((sum, m) => sum + m.cards.reduce((a, c) => a + burracoValue(c), 0), 0);
    const burraco = mine.reduce((sum, m) => sum + (burracoKind(m) === 'pulito' ? 200 : burracoKind(m) === 'sporco' ? 100 : 0), 0);
    const closing = closer !== null && teamOf(closer, s.players) === t ? 100 : 0;
    const inHand = -s.hands.filter((_, p) => teamOf(p, s.players) === t).flat().reduce((a, c) => a + burracoValue(c), 0);
    const noPozzetto = s.pozzettoTaken[t] ? 0 : -100;
    return { melded, burraco, closing, inHand, noPozzetto, total: melded + burraco + closing + inHand + noPozzetto };
  });
  s.report.forEach((r, t) => (s.teamScores[t] += r.total));
  const best = Math.max(...s.teamScores);
  s.phase = best >= s.target && s.teamScores.filter((x) => x === best).length === 1 ? 'over' : 'handEnd';
}

/** Mano vuota: se la squadra non ha ancora il pozzetto lo prende, altrimenti è la chiusura. */
function handEmptied(s: BurracoState, seat: Seat, byDiscard: boolean): boolean {
  const team = teamOf(seat, s.players);
  if (!s.pozzettoTaken[team]) {
    s.pozzettoTaken[team] = true;
    s.hands[seat] = s.pozzetti.pop()!;
    s.last = byDiscard ? 'prende il pozzetto' : 'prende il pozzetto al volo';
    return false;
  }
  return byDiscard;
}

/** Quante carte servono ancora in mano dopo aver calato, per non restare bloccati. */
function minLeft(s: BurracoState, team: number, burracoAfter: boolean): number {
  if (!s.pozzettoTaken[team]) return 0; // svuotare la mano dà il pozzetto
  return burracoAfter ? 1 : 2;
}

export const burraco: Game<BurracoState, BurracoMove, BurracoView, { target?: number }> = {
  meta: {
    id: 'burraco',
    name: 'Burraco',
    category: 'carte',
    minPlayers: 2,
    maxPlayers: 4,
    emoji: '🎴',
    color: '#00897B',
    tagline: 'Pinelle, pozzetti e burraco pulito',
    rules: [
      'Due mazzi con i jolly, 11 carte a testa e due pozzetti da 11. In quattro si gioca a coppie.',
      'Peschi una carta dal mazzo oppure prendi tutti gli scarti, cali scale e tris e scarti una carta.',
      'Jolly e 2 (pinelle) fanno da matta, una sola per combinazione. Sette o più carte sono un burraco: pulito vale 200, sporco 100.',
      'Chi finisce le carte prende il pozzetto. Per chiudere serve il pozzetto e almeno un burraco. Si arriva a 1005.',
    ],
    hiddenInfo: true,
    playerCounts: [2, 4],
    minutes: 40,
  },
  setup({ players, seed, options }) {
    assert(players === 2 || players === 4, 'Il burraco si gioca in due o in quattro.');
    const s = { rng: seed, players, target: options?.target ?? 1005, handNo: 0, nextMeldId: 1, teamScores: Array(teamCount(players)).fill(0) } as BurracoState;
    dealHand(s);
    return s;
  },
  activePlayers(s) {
    if (s.phase === 'draw' || s.phase === 'play') return [s.turn];
    if (s.phase === 'handEnd') return [0];
    return [];
  },
  play(s, seat, move) {
    const hand = s.hands[seat];
    const team = teamOf(seat, s.players);
    switch (move.type) {
      case 'next':
        assert(s.phase === 'handEnd', 'La mano non è finita.');
        s.handNo++;
        dealHand(s);
        return;
      case 'draw':
        assert(s.phase === 'draw', 'Hai già pescato.');
        if (move.source === 'discard') {
          assert(s.discard.length, 'Non ci sono scarti.');
          hand.push(...s.discard);
          s.last = s.discard.length === 1 ? 'prende lo scarto' : `prende ${s.discard.length} scarti`;
          s.discard = [];
        } else {
          if (!s.stock.length) {
            // Mazzo finito: la mano si chiude senza bonus.
            endHand(s, null);
            return;
          }
          hand.push(s.stock.pop()!);
          s.last = 'pesca';
        }
        s.phase = 'play';
        return;
      case 'meld': {
        assert(s.phase === 'play', 'Prima pesca.');
        const cards = takeIds(hand, move.cards);
        const m = checkMeld(cards, BURRACO_RULES);
        assert(m, 'Combinazione non valida.');
        assert(hand.length - cards.length >= minLeft(s, team, teamHasBurraco(s, team) || !!burracoKind(m)), 'Non puoi restare senza carte: ti serve un burraco per chiudere.');
        for (const c of cards) hand.splice(hand.indexOf(c), 1);
        s.melds.push({ ...m, id: s.nextMeldId++, team });
        s.last = 'cala';
        if (!hand.length) handEmptied(s, seat, false);
        return;
      }
      case 'attach': {
        assert(s.phase === 'play', 'Prima pesca.');
        const target = s.melds.find((m) => m.id === move.meld);
        assert(target && target.team === team, 'Puoi attaccare solo alle combinazioni della tua squadra.');
        const cards = takeIds(hand, move.cards);
        const m = checkMeld([...target.cards, ...cards], BURRACO_RULES);
        assert(m, 'Queste carte non si attaccano lì.');
        assert(hand.length - cards.length >= minLeft(s, team, teamHasBurraco(s, team) || !!burracoKind(m)), 'Non puoi restare senza carte: ti serve un burraco per chiudere.');
        for (const c of cards) hand.splice(hand.indexOf(c), 1);
        Object.assign(target, m);
        s.last = 'attacca';
        if (!hand.length) handEmptied(s, seat, false);
        return;
      }
      case 'discard': {
        assert(s.phase === 'play', 'Prima pesca.');
        const c = hand.find((x) => x.id === move.card);
        assert(c, 'Carta non in mano.');
        if (hand.length === 1 && s.pozzettoTaken[team]) assert(teamHasBurraco(s, team), 'Per chiudere serve almeno un burraco.');
        hand.splice(hand.indexOf(c), 1);
        s.discard.push(c);
        s.last = 'scarta';
        if (!hand.length && handEmptied(s, seat, true)) {
          s.last = 'chiude!';
          endHand(s, seat);
          return;
        }
        s.turn = (seat + 1) % s.players;
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
      discard: s.discard,
      pozzettoTaken: s.pozzettoTaken,
      melds: s.melds.map((m) => ({ ...m, burraco: burracoKind(m) })),
      turn: s.turn,
      phase: s.phase,
      teamScores: s.teamScores,
      target: s.target,
      report: s.report,
      last: s.last,
    };
  },
  result(s) {
    if (s.phase !== 'over') return null;
    const team = s.teamScores.indexOf(Math.max(...s.teamScores));
    return { winners: Array.from({ length: s.players }, (_, p) => p).filter((p) => teamOf(p, s.players) === team), scores: s.teamScores, summary: s.teamScores.join(' a ') };
  },
  bot(s, seat) {
    if (s.phase === 'handEnd') return { type: 'next' };
    const hand = s.hands[seat];
    const team = teamOf(seat, s.players);
    const mine = s.melds.filter((m) => m.team === team);
    if (s.phase === 'draw') {
      const top = s.discard[s.discard.length - 1];
      const useful = top && (mine.some((m) => checkMeld([...m.cards, top], BURRACO_RULES)) || findMelds([...hand, top], BURRACO_RULES).some((m) => m.cards.includes(top)));
      return { type: 'draw', source: useful || s.discard.length >= 4 ? 'discard' : 'stock' };
    }
    const hasBurraco = teamHasBurraco(s, team);
    const allowed = (left: number, makesBurraco: boolean) => left >= minLeft(s, team, hasBurraco || makesBurraco);
    for (const m of findMelds(hand, BURRACO_RULES)) {
      if (allowed(hand.length - m.cards.length, !!burracoKind(m))) return { type: 'meld', cards: m.cards.map((c) => c.id) };
    }
    // Attacca prima le carte naturali, le matte solo se servono a chiudere un burraco.
    const order = [...hand].sort((a, b) => Number(isWildCard(a)) - Number(isWildCard(b)));
    for (const c of order) {
      for (const m of mine) {
        const next = checkMeld([...m.cards, c], BURRACO_RULES);
        if (!next) continue;
        if (isWildCard(c) && next.cards.length < 6) continue;
        if (allowed(hand.length - 1, !!burracoKind(next))) return { type: 'attach', meld: m.id, cards: [c.id] };
      }
    }
    const canClose = s.pozzettoTaken[team] && hasBurraco;
    const pool = hand.filter((c) => !isWildCard(c));
    const candidates = pool.length ? pool : hand;
    if (hand.length === 1 && s.pozzettoTaken[team] && !canClose) {
      // Bloccato con una carta: non dovrebbe succedere grazie ai controlli sopra.
      return { type: 'discard', card: hand[0].id };
    }
    const keep = (c: Card) => hand.filter((o) => o !== c && !isWildCard(o) && (o.rank === c.rank || (o.suit === c.suit && Math.abs(o.rank - c.rank) <= 2))).length;
    const worst = [...candidates].sort((a, b) => keep(a) - keep(b) || burracoValue(a) - burracoValue(b))[0];
    return { type: 'discard', card: worst.id };
  },
};
