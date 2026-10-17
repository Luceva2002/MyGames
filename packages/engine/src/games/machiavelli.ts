import { assert, type Game, type Seat } from '../core/types';
import { type HasRng } from '../core/rng';
import { deal, frenchDeck, shuffled, type Card } from '../cards/cards';
import { checkMeld, findMelds, NO_WILD, type Meld } from '../cards/melds';

export interface MachiavelliState extends HasRng {
  players: number;
  hands: Card[][];
  stock: Card[];
  table: Meld[];
  turn: Seat;
  winner: Seat | null;
  ended: boolean;
  last: string | null;
}

export type MachiavelliMove = { type: 'draw' } | { type: 'commit'; groups: string[][] };

export interface MachiavelliView {
  players: number;
  me: Seat | null;
  hand: Card[];
  handCounts: number[];
  stockCount: number;
  table: Meld[];
  turn: Seat;
  last: string | null;
}

export const machiavelli: Game<MachiavelliState, MachiavelliMove, MachiavelliView> = {
  meta: {
    id: 'machiavelli',
    name: 'Machiavelli',
    category: 'carte',
    minPlayers: 2,
    maxPlayers: 5,
    emoji: '🧠',
    color: '#5E35B1',
    tagline: 'Rimescola il tavolo come vuoi',
    rules: [
      'Due mazzi senza jolly, 13 carte a testa. Le combinazioni sono scale dello stesso seme e tris o poker di semi diversi.',
      'Al tuo turno cali almeno una carta. Puoi smontare e ricomporre tutte le combinazioni in tavola, purché alla fine siano tutte valide.',
      'Se non cali niente peschi una carta e passi.',
      'Vince chi finisce le carte per primo. Se il mazzo finisce vince chi ne ha meno.',
    ],
    hiddenInfo: true,
    minutes: 20,
  },
  setup({ players, seed }) {
    const s = { rng: seed, players, table: [], turn: 0, winner: null, ended: false, last: null } as unknown as MachiavelliState;
    s.stock = shuffled(s, frenchDeck({ copies: 2 }));
    s.hands = deal(s.stock, players, 13);
    return s;
  },
  activePlayers: (s) => (s.winner === null && !s.ended ? [s.turn] : []),
  play(s, seat, move) {
    const hand = s.hands[seat];
    if (move.type === 'draw') {
      if (!s.stock.length) {
        s.ended = true;
        return;
      }
      hand.push(s.stock.pop()!);
      s.last = 'pesca';
      s.turn = (seat + 1) % s.players;
      return;
    }
    const ids = move.groups.flat();
    assert(new Set(ids).size === ids.length, 'Una carta compare due volte.');
    const tableIds = s.table.flatMap((m) => m.cards.map((c) => c.id));
    assert(tableIds.every((id) => ids.includes(id)), 'Tutte le carte del tavolo devono restare in tavola.');
    const fromHand = ids.filter((id) => !tableIds.includes(id));
    assert(fromHand.length > 0, 'Devi calare almeno una carta dalla mano.');
    const byId = new Map([...s.table.flatMap((m) => m.cards), ...hand].map((c) => [c.id, c]));
    assert(fromHand.every((id) => hand.some((c) => c.id === id)), 'Carta non in mano.');
    const groups: Meld[] = [];
    for (const g of move.groups) {
      const m = checkMeld(g.map((id) => byId.get(id)!), NO_WILD);
      assert(m, 'C’è una combinazione non valida in tavola.');
      groups.push(m);
    }
    s.table = groups;
    s.hands[seat] = hand.filter((c) => !fromHand.includes(c.id));
    s.last = `cala ${fromHand.length} ${fromHand.length === 1 ? 'carta' : 'carte'}`;
    if (!s.hands[seat].length) {
      s.winner = seat;
      return;
    }
    s.turn = (seat + 1) % s.players;
  },
  view(s, me) {
    return {
      players: s.players,
      me,
      hand: me === null ? [] : s.hands[me],
      handCounts: s.hands.map((h) => h.length),
      stockCount: s.stock.length,
      table: s.table,
      turn: s.turn,
      last: s.last,
    };
  },
  result(s) {
    if (s.winner !== null) return { winners: [s.winner], scores: s.hands.map((h) => h.length), summary: 'Carte rimaste in mano' };
    if (!s.ended) return null;
    const min = Math.min(...s.hands.map((h) => h.length));
    return { winners: s.hands.flatMap((h, p) => (h.length === min ? [p] : [])), scores: s.hands.map((h) => h.length), summary: 'Mazzo finito: vince chi ha meno carte' };
  },
  bot(s, seat) {
    const hand = s.hands[seat];
    const groups = s.table.map((m) => m.cards.map((c) => c.id));
    const newMelds = findMelds(hand, NO_WILD);
    const used = new Set(newMelds.flatMap((m) => m.cards.map((c) => c.id)));
    for (const m of newMelds) groups.push(m.cards.map((c) => c.id));
    // Poi prova ad attaccare le carte rimaste alle combinazioni in tavola.
    const byId = new Map([...s.table.flatMap((m) => m.cards), ...hand].map((c) => [c.id, c]));
    for (const c of hand) {
      if (used.has(c.id)) continue;
      for (const g of groups) {
        if (checkMeld([...g.map((id) => byId.get(id)!), c], NO_WILD)) {
          g.push(c.id);
          used.add(c.id);
          break;
        }
      }
    }
    return used.size ? { type: 'commit', groups } : { type: 'draw' };
  },
};
