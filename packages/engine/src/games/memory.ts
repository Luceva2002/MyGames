import { assert, type Game, type Seat } from '../core/types';
import { randomInt, shuffle, type HasRng } from '../core/rng';

/**
 * Memory delle maschere: carte coperte a coppie. A turno se ne girano due; se sono uguali si
 * tengono e si rigioca, altrimenti si ricoprono e tocca al prossimo. Da soli si cerca di finire
 * con meno mosse possibili; in compagnia vince chi trova più coppie.
 */
export const MEMORY_FACES = ['arlecchino', 'arlecchina', 'pulcinella', 'giullare', 'colombina', 'pantalone', 'forzuto', 'medico', 'rosaura', 'capitano'] as const;
export const MEMORY_PAIRS = MEMORY_FACES.length;

export interface MemoryState extends HasRng {
  players: number;
  /** La maschera di ogni carta (indice in MEMORY_FACES). */
  cards: number[];
  /** Chi ha preso ogni carta. */
  taken: (Seat | null)[];
  /** Le carte girate in questo turno (0, 1). */
  open: number[];
  /** Le due carte sbagliate appena girate: restano visibili finché non si gira la prossima. */
  miss: [number, number] | null;
  /** L'ultima coppia trovata, per festeggiarla. */
  match: { cards: [number, number]; seat: Seat; n: number } | null;
  /** Le carte già viste da tutti: la memoria del computer. */
  seen: boolean[];
  pairs: number[];
  turn: Seat;
  moves: number;
  flips: number;
}

export type MemoryMove = { flip: number };

export interface MemoryView {
  players: number;
  /** Per ogni carta: la maschera se è scoperta (presa, appena girata o sbagliata), altrimenti null. */
  faces: (number | null)[];
  taken: (Seat | null)[];
  open: number[];
  miss: [number, number] | null;
  match: MemoryState['match'];
  pairs: number[];
  turn: Seat;
  moves: number;
  flips: number;
}

export const memory: Game<MemoryState, MemoryMove, MemoryView> = {
  meta: {
    id: 'memory',
    name: 'Memory',
    category: 'tavolo',
    minPlayers: 1,
    maxPlayers: 4,
    emoji: '🎭',
    color: '#FF9F1C',
    tagline: 'Ritrova le coppie di maschere',
    rules: [
      'Venti carte coperte, dieci coppie di maschere. Al tuo turno gira due carte.',
      'Se sono uguali le tieni e giochi ancora; se sono diverse si ricoprono e tocca al prossimo.',
      'Ricorda dove stanno: le carte girate le vedono tutti.',
      'Da soli: finisci con meno mosse possibili. In compagnia vince chi trova più coppie.',
    ],
    hiddenInfo: false,
    minutes: 5,
  },
  setup({ players, seed }) {
    const s: MemoryState = { rng: seed, players, cards: [], taken: [], open: [], miss: null, match: null, seen: [], pairs: Array(players).fill(0), turn: 0, moves: 0, flips: 0 };
    s.cards = shuffle(s, Array.from({ length: MEMORY_PAIRS * 2 }, (_, i) => i % MEMORY_PAIRS));
    s.taken = s.cards.map(() => null);
    s.seen = s.cards.map(() => false);
    return s;
  },
  activePlayers: (s) => (s.taken.every((t) => t !== null) ? [] : [s.turn]),
  play(s, seat, m) {
    const i = m?.flip;
    assert(Number.isInteger(i) && i >= 0 && i < s.cards.length, 'Carta non valida.');
    assert(s.taken[i] === null, 'Questa coppia è già presa.');
    assert(!s.open.includes(i), 'Questa carta è già girata.');
    s.miss = null;
    s.flips++;
    s.seen[i] = true;
    s.open.push(i);
    if (s.open.length < 2) return;
    const [a, b] = s.open;
    s.open = [];
    s.moves++;
    if (s.cards[a] === s.cards[b]) {
      s.taken[a] = seat;
      s.taken[b] = seat;
      s.pairs[seat]++;
      s.match = { cards: [a, b], seat, n: s.moves };
    } else {
      s.miss = [a, b];
      s.turn = (s.turn + 1) % s.players;
    }
  },
  view(s) {
    return {
      players: s.players,
      faces: s.cards.map((f, i) => (s.taken[i] !== null || s.open.includes(i) || s.miss?.includes(i) ? f : null)),
      taken: s.taken,
      open: s.open,
      miss: s.miss,
      match: s.match,
      pairs: s.pairs,
      turn: s.turn,
      moves: s.moves,
      flips: s.flips,
    };
  },
  result(s) {
    if (!s.taken.every((t) => t !== null)) return null;
    if (s.players === 1) {
      const perfect = s.moves <= MEMORY_PAIRS + 4;
      return { winners: [0], scores: [s.moves], lowWins: true, summary: `Tutte le coppie in ${s.moves} mosse`, title: perfect ? '🏆 Memoria di ferro!' : '🎉 Tutte trovate!', celebrate: true };
    }
    const top = Math.max(...s.pairs);
    const winners = s.pairs.flatMap((p, i) => (p === top ? [i] : []));
    return { winners: winners.length === s.players ? [] : winners, scores: s.pairs, summary: s.pairs.map((p) => `${p}`).join(' – ') + ' coppie' };
  },
  pause: (s) => (s.miss ? 1700 : s.open.length ? 900 : 700),
  bot(s) {
    const known = new Map<number, number[]>();
    s.cards.forEach((f, i) => {
      if (s.taken[i] === null && s.seen[i]) known.set(f, [...(known.get(f) ?? []), i]);
    });
    const unseen = s.cards.flatMap((_, i) => (s.taken[i] === null && !s.seen[i] && !s.open.includes(i) ? [i] : []));
    const anyFree = s.cards.flatMap((_, i) => (s.taken[i] === null && !s.open.includes(i) ? [i] : []));
    if (s.open.length === 1) {
      const first = s.open[0];
      const mate = (known.get(s.cards[first]) ?? []).find((i) => i !== first);
      if (mate !== undefined) return { flip: mate };
      const pool = unseen.length ? unseen : anyFree;
      return { flip: pool[randomInt(s, pool.length)] };
    }
    for (const idx of known.values()) if (idx.length === 2) return { flip: idx[0] };
    const pool = unseen.length ? unseen : anyFree;
    return { flip: pool[randomInt(s, pool.length)] };
  },
};
