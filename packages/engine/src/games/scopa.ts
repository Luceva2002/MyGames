import { assert, type Game, type Seat } from '../core/types';
import { type HasRng } from '../core/rng';
import { deal, italianDeck, shuffled, takeCard, type Card } from '../cards/cards';
import { primieraScore, teamCount, teamOf } from '../cards/italian';

export interface ScopaTeamReport {
  cards: number;
  denari: number;
  settebello: boolean;
  primiera: number;
  scope: number;
  points: number;
  /** Dettaglio dei punti presi: carte, denari, settebello, primiera. */
  won: string[];
}

export interface ScopaState extends HasRng {
  players: number;
  target: number;
  hands: Card[][];
  table: Card[];
  deck: Card[];
  captured: Card[][];
  scope: number[];
  lastTaker: Seat | null;
  turn: Seat;
  handNo: number;
  phase: 'play' | 'handEnd' | 'over';
  teamScores: number[];
  report: ScopaTeamReport[] | null;
  lastPlay: { seat: Seat; card: Card; taken: Card[]; scopa: boolean } | null;
}

export type ScopaMove = { type: 'play'; card: string; take?: string[] } | { type: 'next' };

export interface ScopaView {
  players: number;
  me: Seat | null;
  hand: Card[];
  handCounts: number[];
  table: Card[];
  deckCount: number;
  capturedCounts: number[];
  scope: number[];
  turn: Seat;
  phase: ScopaState['phase'];
  teamScores: number[];
  target: number;
  report: ScopaTeamReport[] | null;
  lastPlay: ScopaState['lastPlay'];
}

/** Tutte le prese possibili con questa carta. Se c'è una carta dello stesso valore, si può prendere solo quella. */
export function captureOptions(table: Card[], card: Card): Card[][] {
  const singles = table.filter((c) => c.rank === card.rank).map((c) => [c]);
  if (singles.length) return singles;
  const options: Card[][] = [];
  const walk = (start: number, sum: number, chosen: Card[]) => {
    if (sum === card.rank && chosen.length >= 2) options.push([...chosen]);
    if (sum >= card.rank) return;
    for (let i = start; i < table.length; i++) {
      chosen.push(table[i]);
      walk(i + 1, sum + table[i].rank, chosen);
      chosen.pop();
    }
  };
  walk(0, 0, []);
  return options;
}

function sameSet(a: string[], b: Card[]): boolean {
  return a.length === b.length && b.every((c) => a.includes(c.id));
}

function dealHand(s: ScopaState) {
  for (;;) {
    s.deck = shuffled(s, italianDeck());
    s.table = s.deck.splice(-4);
    // Con tre o quattro re in tavola non si potrebbero mai fare scope: si rimescola.
    if (s.table.filter((c) => c.rank === 10).length < 3) break;
  }
  s.hands = deal(s.deck, s.players, 3);
  s.captured = Array.from({ length: s.players }, () => []);
  s.scope = Array(s.players).fill(0);
  s.lastTaker = null;
  s.lastPlay = null;
  s.turn = (s.handNo + 1) % s.players;
  s.phase = 'play';
  s.report = null;
}

function scoreHand(s: ScopaState): ScopaTeamReport[] {
  const teams = teamCount(s.players);
  const rows: ScopaTeamReport[] = Array.from({ length: teams }, (_, t) => {
    const cards = s.captured.filter((_, seat) => teamOf(seat, s.players) === t).flat();
    const scope = s.scope.reduce((sum, n, seat) => sum + (teamOf(seat, s.players) === t ? n : 0), 0);
    return {
      cards: cards.length,
      denari: cards.filter((c) => c.suit === 'd').length,
      settebello: cards.some((c) => c.suit === 'd' && c.rank === 7),
      primiera: primieraScore(cards),
      scope,
      points: scope,
      won: [],
    };
  });
  // Carte, denari e primiera vanno solo a chi ne ha strettamente di più.
  const award = (label: string, value: (r: ScopaTeamReport) => number) => {
    const best = Math.max(...rows.map(value));
    const leaders = rows.filter((r) => value(r) === best);
    if (leaders.length === 1) {
      leaders[0].points++;
      leaders[0].won.push(label);
    }
  };
  award('carte', (r) => r.cards);
  award('denari', (r) => r.denari);
  award('primiera', (r) => r.primiera);
  const sb = rows.find((r) => r.settebello);
  if (sb) {
    sb.points++;
    sb.won.push('settebello');
  }
  for (const r of rows) if (r.scope) r.won.push(r.scope === 1 ? '1 scopa' : `${r.scope} scope`);
  return rows;
}

function endOfPlay(s: ScopaState) {
  if (s.hands.some((h) => h.length)) return;
  if (s.deck.length) {
    s.hands = deal(s.deck, s.players, 3);
    return;
  }
  if (s.lastTaker !== null) s.captured[s.lastTaker].push(...s.table);
  s.table = [];
  s.report = scoreHand(s);
  s.report.forEach((r, t) => (s.teamScores[t] += r.points));
  const best = Math.max(...s.teamScores);
  const leaders = s.teamScores.filter((p) => p === best).length;
  s.phase = best >= s.target && leaders === 1 ? 'over' : 'handEnd';
}

export const scopa: Game<ScopaState, ScopaMove, ScopaView, { target?: number }> = {
  // Dopo una presa (o una scopa) si lascia il tempo di vederla prima che giochi il prossimo.
  pause: (s) => (s.lastPlay?.scopa ? 2000 : s.lastPlay?.taken.length ? 1600 : 1100),
  meta: {
    id: 'scopa',
    name: 'Scopa',
    category: 'carte',
    minPlayers: 2,
    maxPlayers: 4,
    emoji: '🧹',
    color: '#E0A526',
    tagline: 'Il classico con le carte piacentine',
    rules: [
      'Giochi una carta: se in tavola c’è una carta dello stesso valore la prendi, altrimenti puoi prendere più carte che sommate fanno quel valore.',
      'Se svuoti il tavolo fai scopa e guadagni un punto.',
      'A fine mano: un punto per chi ha più carte, più denari, la primiera e il settebello.',
      'In quattro si gioca a coppie (chi siede di fronte). Si arriva a 11.',
    ],
    hiddenInfo: true,
    minutes: 15,
  },
  setup({ players, seed, options }) {
    const s: ScopaState = {
      rng: seed,
      players,
      target: options?.target ?? 11,
      hands: [],
      table: [],
      deck: [],
      captured: [],
      scope: [],
      lastTaker: null,
      turn: 0,
      handNo: 0,
      phase: 'play',
      teamScores: Array(teamCount(players)).fill(0),
      report: null,
      lastPlay: null,
    };
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
    const hand = s.hands[seat];
    const card = hand.find((c) => c.id === move.card);
    assert(card, 'Carta non in mano.');
    const options = captureOptions(s.table, card);
    let taken: Card[] = [];
    if (options.length) {
      if (move.take?.length) {
        const chosen = options.find((o) => sameSet(move.take!, o));
        assert(chosen, 'Presa non valida.');
        taken = chosen;
      } else {
        assert(options.length === 1, 'Scegli quali carte prendere.');
        taken = options[0];
      }
    } else {
      assert(!move.take?.length, 'Con questa carta non si prende niente.');
    }
    takeCard(hand, card.id);
    let scopaMade = false;
    if (taken.length) {
      s.table = s.table.filter((c) => !taken.includes(c));
      s.captured[seat].push(card, ...taken);
      s.lastTaker = seat;
      const lastCardOfHand = s.deck.length === 0 && s.hands.every((h) => h.length === 0);
      if (s.table.length === 0 && !lastCardOfHand) {
        s.scope[seat]++;
        scopaMade = true;
      }
    } else {
      s.table.push(card);
    }
    s.lastPlay = { seat, card, taken, scopa: scopaMade };
    s.turn = (seat + 1) % s.players;
    endOfPlay(s);
  },
  view(s, me) {
    return {
      players: s.players,
      me,
      hand: me === null ? [] : s.hands[me],
      handCounts: s.hands.map((h) => h.length),
      table: s.table,
      deckCount: s.deck.length,
      capturedCounts: s.captured.map((c) => c.length),
      scope: s.scope,
      turn: s.turn,
      phase: s.phase,
      teamScores: s.teamScores,
      target: s.target,
      report: s.report,
      lastPlay: s.lastPlay,
    };
  },
  result(s) {
    if (s.phase !== 'over') return null;
    const best = Math.max(...s.teamScores);
    const team = s.teamScores.indexOf(best);
    const winners = Array.from({ length: s.players }, (_, i) => i).filter((seat) => teamOf(seat, s.players) === team);
    return { winners, scores: s.teamScores, summary: `${s.teamScores.join(' a ')}` };
  },
  bot(s, seat) {
    if (s.phase === 'handEnd') return { type: 'next' };
    let best: { score: number; move: ScopaMove } | null = null;
    for (const card of s.hands[seat]) {
      const options = captureOptions(s.table, card);
      if (options.length) {
        for (const opt of options) {
          const got = [card, ...opt];
          let score = 10 + got.length;
          score += got.filter((c) => c.suit === 'd').length * 2;
          score += got.filter((c) => c.rank === 7).length * 3;
          if (got.some((c) => c.suit === 'd' && c.rank === 7)) score += 15;
          if (opt.length === s.table.length) score += 20;
          if (!best || score > best.score) best = { score, move: { type: 'play', card: card.id, take: opt.map((c) => c.id) } };
        }
      } else {
        const sum = s.table.reduce((t, c) => t + c.rank, 0) + card.rank;
        let score = -card.rank * 0.1;
        if (sum <= 10) score -= 8; // lascia una scopa facile all'avversario
        if (card.rank === 7) score -= 4;
        if (card.suit === 'd') score -= 2;
        if (!best || score > best.score) best = { score, move: { type: 'play', card: card.id } };
      }
    }
    return best!.move;
  },
};
