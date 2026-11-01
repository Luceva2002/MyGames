import { assert, type Game, type Seat } from '../core/types';
import { random, type HasRng } from '../core/rng';

/** Un pezzo: i suoi quadretti come [x, y]. */
export type MosaicoShape = [number, number][];

/** I 21 pezzi di ogni colore, da 1 a 5 quadretti. */
export const MOSAICO_PIECES: Record<string, MosaicoShape> = {
  i1: [[0, 0]],
  i2: [[0, 0], [1, 0]],
  i3: [[0, 0], [1, 0], [2, 0]],
  l3: [[0, 0], [0, 1], [1, 1]],
  i4: [[0, 0], [1, 0], [2, 0], [3, 0]],
  l4: [[0, 0], [0, 1], [0, 2], [1, 2]],
  o4: [[0, 0], [1, 0], [0, 1], [1, 1]],
  s4: [[1, 0], [2, 0], [0, 1], [1, 1]],
  t4: [[0, 0], [1, 0], [2, 0], [1, 1]],
  f5: [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]],
  i5: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  l5: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]],
  n5: [[1, 0], [1, 1], [0, 2], [1, 2], [0, 3]],
  p5: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]],
  t5: [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]],
  u5: [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  v5: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]],
  w5: [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]],
  x5: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
  y5: [[1, 0], [0, 1], [1, 1], [1, 2], [1, 3]],
  z5: [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]],
};
export const MOSAICO_IDS = Object.keys(MOSAICO_PIECES);

export interface MosaicoState extends HasRng {
  size: number;
  players: number;
  board: (Seat | null)[];
  /** I pezzi ancora da giocare di ogni colore. */
  reserve: string[][];
  /** L'angolo di partenza di ogni colore. */
  starts: number[];
  /** Chi non può più muovere: passa fino alla fine. */
  stuck: boolean[];
  turn: Seat;
  /** L'ultimo pezzo giocato, per farlo vedere a tutti. */
  last: { seat: Seat; cells: number[] } | null;
  over: boolean;
}

export interface MosaicoMove {
  piece: string;
  /** Quarti di giro in senso orario. */
  rot: number;
  flip: boolean;
  /** Angolo in alto a sinistra del pezzo sulla griglia. */
  x: number;
  y: number;
}

/** Il pezzo girato e specchiato, riportato vicino a (0, 0). */
export function mosaicoShape(piece: string, rot: number, flip: boolean): MosaicoShape {
  let cells: MosaicoShape = MOSAICO_PIECES[piece].map(([x, y]) => [flip ? -x : x, y]);
  for (let i = 0; i < ((rot % 4) + 4) % 4; i++) cells = cells.map(([x, y]) => [-y, x]);
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]): [number, number] => [x - minX, y - minY]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

/** Le posizioni diverse di un pezzo: gira e specchia, senza i doppioni dei pezzi simmetrici. */
export function mosaicoOrientations(piece: string): { rot: number; flip: boolean; cells: MosaicoShape }[] {
  const seen = new Set<string>();
  const out: { rot: number; flip: boolean; cells: MosaicoShape }[] = [];
  for (const flip of [false, true]) {
    for (let rot = 0; rot < 4; rot++) {
      const cells = mosaicoShape(piece, rot, flip);
      const key = JSON.stringify(cells);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ rot, flip, cells });
    }
  }
  return out;
}

const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const TIPS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Il pezzo sta qui? Dentro la griglia, su caselle libere, e tocca i suoi pezzi solo per gli spigoli. */
export function mosaicoFits(s: Pick<MosaicoState, 'size' | 'board' | 'reserve' | 'starts'>, seat: Seat, shape: MosaicoShape, ox: number, oy: number): boolean {
  const { size, board } = s;
  const first = s.reserve[seat].length === MOSAICO_IDS.length;
  let touchesTip = false;
  for (const [cx, cy] of shape) {
    const x = cx + ox;
    const y = cy + oy;
    if (x < 0 || y < 0 || x >= size || y >= size || board[y * size + x] !== null) return false;
    for (const [dx, dy] of SIDES) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < size && ny < size && board[ny * size + nx] === seat) return false;
    }
    if (first) {
      if (y * size + x === s.starts[seat]) touchesTip = true;
      continue;
    }
    for (const [dx, dy] of TIPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < size && ny < size && board[ny * size + nx] === seat) touchesTip = true;
    }
  }
  return touchesTip;
}

/** Le caselle da cui può ripartire un colore: l'angolo all'inizio, poi quelle sugli spigoli dei suoi pezzi. */
export function mosaicoCorners(s: Pick<MosaicoState, 'size' | 'board' | 'reserve' | 'starts'>, seat: Seat): number[] {
  const { size, board } = s;
  if (s.reserve[seat].length === MOSAICO_IDS.length) return board[s.starts[seat]] === null ? [s.starts[seat]] : [];
  const out = new Set<number>();
  board.forEach((owner, i) => {
    if (owner !== seat) return;
    const x = i % size;
    const y = Math.floor(i / size);
    for (const [dx, dy] of TIPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const n = ny * size + nx;
      if (board[n] !== null) continue;
      const beside = SIDES.some(([ax, ay]) => {
        const sx = nx + ax;
        const sy = ny + ay;
        return sx >= 0 && sy >= 0 && sx < size && sy < size && board[sy * size + sx] === seat;
      });
      if (!beside) out.add(n);
    }
  });
  return [...out];
}

/** Dove può andare un pezzo così orientato: l'angolo in alto a sinistra di ogni posizione valida. */
export function mosaicoSpots(s: Pick<MosaicoState, 'size' | 'board' | 'reserve' | 'starts'>, seat: Seat, shape: MosaicoShape): { x: number; y: number }[] {
  const out = new Map<number, { x: number; y: number }>();
  for (const c of mosaicoCorners(s, seat)) {
    const cx = c % s.size;
    const cy = Math.floor(c / s.size);
    for (const [px, py] of shape) {
      const x = cx - px;
      const y = cy - py;
      if (mosaicoFits(s, seat, shape, x, y)) out.set(y * s.size + x, { x, y });
    }
  }
  return [...out.values()];
}

/** Tutte le mosse valide di un colore; con `biggestOnly` solo i pezzi più grandi che hanno un posto. */
export function mosaicoMoves(s: MosaicoState, seat: Seat, biggestOnly = false): MosaicoMove[] {
  const out: MosaicoMove[] = [];
  const pieces = [...s.reserve[seat]].sort((a, b) => MOSAICO_PIECES[b].length - MOSAICO_PIECES[a].length);
  for (const piece of pieces) {
    if (biggestOnly && out.length && MOSAICO_PIECES[piece].length < MOSAICO_PIECES[out[0].piece].length) break;
    for (const { rot, flip, cells } of mosaicoOrientations(piece)) {
      for (const { x, y } of mosaicoSpots(s, seat, cells)) out.push({ piece, rot, flip, x, y });
    }
  }
  return out;
}

/** Questo pezzo ha ancora un posto, girandolo come si vuole? */
export function mosaicoHasSpot(s: Pick<MosaicoState, 'size' | 'board' | 'reserve' | 'starts'>, seat: Seat, piece: string): boolean {
  return mosaicoOrientations(piece).some(({ cells }) => mosaicoSpots(s, seat, cells).length > 0);
}

function canMove(s: MosaicoState, seat: Seat): boolean {
  return s.reserve[seat].some((piece) => mosaicoHasSpot(s, seat, piece));
}

/** Quadretti ancora in riserva: è il punteggio, meno è meglio. */
export const mosaicoLeft = (reserve: string[]) => reserve.reduce((n, id) => n + MOSAICO_PIECES[id].length, 0);

export const mosaico: Game<MosaicoState, MosaicoMove, MosaicoState> = {
  meta: {
    id: 'mosaico',
    name: 'Mosaico',
    category: 'tavolo',
    minPlayers: 2,
    maxPlayers: 4,
    emoji: '🧩',
    color: '#19D3C5',
    tagline: 'Conquista la griglia, un pezzo alla volta',
    rules: [
      'Ogni colore ha 21 pezzi, da 1 a 5 quadretti. La griglia è 14×14 in due, 17×17 in tre, 20×20 in quattro.',
      'Il primo pezzo deve coprire il tuo angolo.',
      'Ogni pezzo nuovo deve toccare un tuo pezzo per uno spigolo, e mai per un lato. I pezzi degli altri puoi toccarli come vuoi.',
      'Scegli un pezzo, giralo o specchialo e tocca la griglia: verde va bene, rosso no. Poi conferma.',
      'Chi non ha più posto per nessun pezzo passa. A fine partita vince chi ha meno quadretti rimasti.',
    ],
    hiddenInfo: false,
    minutes: 20,
  },
  setup({ players, seed }) {
    const size = players === 2 ? 14 : players === 3 ? 17 : 20;
    const m = size - 1;
    // In senso orario dal basso a sinistra; in due ci si siede agli angoli opposti.
    const corners = [m * size, 0, m, m * size + m];
    const starts = players === 2 ? [corners[0], corners[2]] : corners.slice(0, players);
    return {
      rng: seed,
      size,
      players,
      board: Array(size * size).fill(null),
      reserve: Array.from({ length: players }, () => [...MOSAICO_IDS]),
      starts,
      stuck: Array(players).fill(false),
      turn: 0,
      last: null,
      over: false,
    };
  },
  activePlayers: (s) => (s.over ? [] : [s.turn]),
  play(s, seat, { piece, rot, flip, x, y }) {
    assert(s.reserve[seat].includes(piece), 'Questo pezzo l’hai già giocato.');
    const shape = mosaicoShape(piece, rot, flip);
    assert(mosaicoFits(s, seat, shape, x, y), s.reserve[seat].length === MOSAICO_IDS.length ? 'Il primo pezzo deve coprire il tuo angolo.' : 'Deve toccare un tuo pezzo per uno spigolo, mai per un lato.');
    // Il computer pesca a caso su una copia: i numeri della partita devono andare avanti a ogni mossa.
    random(s);
    const cells = shape.map(([cx, cy]) => (cy + y) * s.size + cx + x);
    for (const c of cells) s.board[c] = seat;
    s.reserve[seat] = s.reserve[seat].filter((id) => id !== piece);
    s.last = { seat, cells };
    // Chi non può muovere passa da solo: il turno va al primo che ha ancora un posto.
    for (let i = 1; i <= s.players; i++) {
      const next = (seat + i) % s.players;
      if (s.stuck[next]) continue;
      if (canMove(s, next)) {
        s.turn = next;
        return;
      }
      s.stuck[next] = true;
    }
    s.over = true;
  },
  view: (s) => s,
  result(s) {
    if (!s.over) return null;
    const scores = s.reserve.map(mosaicoLeft);
    const best = Math.min(...scores);
    const winners = scores.flatMap((n, p) => (n === best ? [p] : []));
    return { winners: winners.length === s.players ? [] : winners, scores, lowWins: true, summary: 'Quadretti rimasti: meno è meglio' };
  },
  bot(s, seat) {
    // Il pezzo più grande che ha un posto, il più possibile verso il centro: lì c'è spazio per crescere.
    const moves = mosaicoMoves(s, seat, true);
    const mid = (s.size - 1) / 2;
    let best = moves[0];
    let bestScore = -Infinity;
    for (const m of moves) {
      const shape = mosaicoShape(m.piece, m.rot, m.flip);
      const far = shape.reduce((d, [cx, cy]) => d + Math.abs(cx + m.x - mid) + Math.abs(cy + m.y - mid), 0) / shape.length;
      const score = -far + random(s);
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    return best;
  },
  pause: () => 1500,
};
