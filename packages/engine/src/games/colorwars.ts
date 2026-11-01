import { assert, type Game, type Seat } from '../core/types';
import { random, type HasRng } from '../core/rng';

export interface CwCell {
  o: Seat;
  v: number;
}
export type CwGrid = (CwCell | null)[];

export interface CwFrame {
  cells: CwGrid;
  /** Le celle appena esplose. */
  boom: number[];
}

export interface ColorWarsState extends HasRng {
  size: number;
  players: number;
  cells: CwGrid;
  /** Chi ha già messo la sua prima cella. */
  placed: boolean[];
  turn: Seat;
  moves: number;
  /** L'ultima reazione a catena, passo per passo, da far vedere. */
  chain: { seat: Seat; cell: number; frames: CwFrame[]; n: number };
  winner: Seat | null;
}

export type ColorWarsMove = { cell: number };

/** Oltre queste mosse (succede quasi mai) vince chi ha più punti: nessuna partita resta aperta per sempre. */
const MAX_MOVES = 400;
const EXPLODE_AT = 4;

function neighbours(size: number, cell: number): number[] {
  const x = cell % size;
  const y = Math.floor(cell / size);
  const out: number[] = [];
  if (x > 0) out.push(cell - 1);
  if (x < size - 1) out.push(cell + 1);
  if (y > 0) out.push(cell - size);
  if (y < size - 1) out.push(cell + size);
  return out;
}

const owners = (cells: CwGrid) => new Set(cells.flatMap((c) => (c ? [c.o] : [])));

/** Quanto dura un passo della catena: si segue a occhio anche quando è lunga. */
export function cwStepMs(frames: number): number {
  return Math.max(90, Math.min(320, 2600 / Math.max(frames, 1)));
}

/** Tutte le celle piene esplodono insieme, finché non ne resta nessuna o resta un colore solo. */
function react(cells: CwGrid, size: number, seat: Seat, allPlaced: boolean): CwFrame[] {
  const frames: CwFrame[] = [];
  for (;;) {
    const boom = cells.flatMap((c, i) => (c && c.v >= EXPLODE_AT ? [i] : []));
    if (!boom.length) return frames;
    if (!frames.length) frames.push({ cells: cells.map((c) => (c ? { ...c } : null)), boom: [] });
    for (const i of boom) {
      const left = cells[i]!.v - EXPLODE_AT;
      cells[i] = left > 0 ? { o: seat, v: left } : null;
    }
    for (const i of boom) {
      for (const n of neighbours(size, i)) cells[n] = { o: seat, v: (cells[n]?.v ?? 0) + 1 };
    }
    frames.push({ cells: cells.map((c) => (c ? { ...c } : null)), boom });
    if (allPlaced && owners(cells).size === 1) return frames;
  }
}

/** Un tocco su una cella, senza toccare il turno: serve alla partita e al computer per provare le mosse. */
function touch(s: Pick<ColorWarsState, 'cells' | 'size' | 'placed'>, seat: Seat, cell: number): { cells: CwGrid; frames: CwFrame[] } {
  const cells = s.cells.map((c) => (c ? { ...c } : null));
  if (!s.placed[seat]) {
    cells[cell] = { o: seat, v: 3 };
    return { cells, frames: [] };
  }
  cells[cell] = { o: seat, v: cells[cell]!.v + 1 };
  return { cells, frames: react(cells, s.size, seat, s.placed.every(Boolean)) };
}

export const colorwars: Game<ColorWarsState, ColorWarsMove, ColorWarsState> = {
  meta: {
    id: 'colorwars',
    name: 'Color Wars',
    category: 'abilita',
    minPlayers: 2,
    maxPlayers: 4,
    emoji: '💥',
    color: '#FF2E88',
    tagline: 'Una reazione a catena e il tavolo è tuo',
    rules: [
      'Griglia 5×5. Al primo turno ognuno sceglie una cella vuota, che parte da 3 punti.',
      'Poi, a ogni turno, tocchi una tua cella per aggiungerle un punto.',
      'A 4 punti la cella esplode: si svuota e manda un punto alle 4 celle vicine, che diventano tue con i punti che avevano.',
      'Se una vicina arriva a 4 esplode anche lei: le esplosioni vanno a catena.',
      'Chi resta senza celle è fuori. Vince chi resta da solo.',
    ],
    hiddenInfo: false,
    minutes: 5,
  },
  setup({ players, seed }) {
    const size = 5;
    return {
      rng: seed,
      size,
      players,
      cells: Array(size * size).fill(null),
      placed: Array(players).fill(false),
      turn: 0,
      moves: 0,
      chain: { seat: 0, cell: -1, frames: [], n: 0 },
      winner: null,
    };
  },
  activePlayers: (s) => (s.winner === null ? [s.turn] : []),
  play(s, seat, { cell }) {
    assert(Number.isInteger(cell) && cell >= 0 && cell < s.cells.length, 'Casella inesistente.');
    if (s.placed[seat]) assert(s.cells[cell]?.o === seat, 'Tocca una delle tue celle.');
    else assert(s.cells[cell] === null, 'Scegli una cella vuota.');
    // Il computer pesca a caso su una copia: i numeri della partita devono andare avanti a ogni mossa.
    random(s);
    const { cells, frames } = touch(s, seat, cell);
    s.cells = cells;
    s.placed[seat] = true;
    s.moves++;
    s.chain = { seat, cell, frames, n: s.chain.n + 1 };
    const allPlaced = s.placed.every(Boolean);
    const alive = owners(s.cells);
    if (allPlaced && alive.size === 1) {
      s.winner = [...alive][0];
      return;
    }
    if (s.moves >= MAX_MOVES) {
      const points = Array.from({ length: s.players }, (_, p) => s.cells.reduce((n, c) => n + (c?.o === p ? c.v : 0), 0));
      s.winner = points.indexOf(Math.max(...points));
      return;
    }
    for (let i = 1; i <= s.players; i++) {
      const next = (seat + i) % s.players;
      if (!s.placed[next] || alive.has(next)) {
        s.turn = next;
        return;
      }
    }
  },
  view: (s) => s,
  result(s) {
    if (s.winner === null) return null;
    const scores = Array.from({ length: s.players }, (_, p) => s.cells.filter((c) => c?.o === p).length);
    return { winners: [s.winner], scores, summary: 'Celle conquistate' };
  },
  bot(s, seat) {
    const size = s.size;
    if (!s.placed[seat]) {
      // Prima cella: lontano dagli altri, ma non sul bordo.
      let best = -1;
      let bestScore = -Infinity;
      s.cells.forEach((c, i) => {
        if (c) return;
        const x = i % size;
        const y = Math.floor(i / size);
        let near = 8;
        s.cells.forEach((o, j) => {
          if (o) near = Math.min(near, Math.abs(x - (j % size)) + Math.abs(y - Math.floor(j / size)));
        });
        const edge = x === 0 || y === 0 || x === size - 1 || y === size - 1 ? 1 : 0;
        const score = near - edge * 1.5 + random(s);
        if (score > bestScore) {
          bestScore = score;
          best = i;
        }
      });
      return { cell: best };
    }
    // Prova ogni sua cella: conta celle e punti miei e altrui, e quanto restano esposte le mie.
    let best = -1;
    let bestScore = -Infinity;
    s.cells.forEach((c, i) => {
      if (c?.o !== seat) return;
      const after = touch(s, seat, i).cells;
      let score = random(s) * 0.5;
      after.forEach((a, j) => {
        if (!a) return;
        const sign = a.o === seat ? 1 : -1;
        score += sign * (a.v + 2);
        if (a.o === seat) {
          // Una mia cella accanto a una loro pronta a esplodere si perde al prossimo turno.
          if (neighbours(size, j).some((n) => after[n] && after[n]!.o !== seat && after[n]!.v >= EXPLODE_AT - 1)) score -= a.v + 2;
        }
      });
      const left = owners(after);
      if (left.size === 1 && left.has(seat)) score += 1000;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    return { cell: best };
  },
  // Il computer aspetta che la catena di chi ha mosso finisca di vedersi, poi un attimo ancora.
  pause: (s) => 1400 + s.chain.frames.length * cwStepMs(s.chain.frames.length),
};
