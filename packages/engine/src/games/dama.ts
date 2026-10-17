import { assert, type Game, type Seat } from '../core/types';
import { random, type HasRng } from '../core/rng';

/** Casella: null vuota, altrimenti proprietario e se è dama. */
export type DamaPiece = { owner: Seat; king: boolean } | null;

export interface DamaState extends HasRng {
  board: DamaPiece[];
  turn: Seat;
  /** Mosse senza prese né promozioni, per la patta. */
  quiet: number;
  last: number[] | null;
  winner: Seat | null | 'draw';
}

/** Una mossa è il percorso delle caselle toccate dal pezzo, dalla partenza all'arrivo. */
export type DamaMove = { path: number[] };

export interface DamaPlan {
  path: number[];
  captured: number[];
  kingsCaptured: number;
  firstKingAt: number;
  byKing: boolean;
}

const idx = (r: number, c: number) => r * 8 + c;
const inside = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
/** Il bianco (posto 0) sta in basso e sale; il nero scende. */
const forward = (owner: Seat) => (owner === 0 ? -1 : 1);

function captures(board: DamaPiece[], from: number, piece: NonNullable<DamaPiece>, taken: number[], path: number[], out: DamaPlan[]) {
  const r = Math.floor(from / 8);
  const c = from % 8;
  const dirs = piece.king ? [-1, 1] : [forward(piece.owner)];
  let extended = false;
  for (const dr of dirs) {
    for (const dc of [-1, 1]) {
      const mr = r + dr;
      const mc = c + dc;
      const lr = r + 2 * dr;
      const lc = c + 2 * dc;
      if (!inside(lr, lc)) continue;
      const mid = idx(mr, mc);
      const land = idx(lr, lc);
      const victim = board[mid];
      if (!victim || victim.owner === piece.owner || taken.includes(mid)) continue;
      if (board[land] && land !== path[0]) continue;
      // Nella dama italiana la pedina non può mangiare la dama.
      if (victim.king && !piece.king) continue;
      extended = true;
      const promotes = !piece.king && (lr === 0 || lr === 7);
      if (promotes) {
        pushPlan(board, [...path, land], [...taken, mid], piece, out);
      } else {
        captures(board, land, piece, [...taken, mid], [...path, land], out);
      }
    }
  }
  if (!extended && taken.length) pushPlan(board, path, taken, piece, out);
}

function pushPlan(board: DamaPiece[], path: number[], captured: number[], piece: NonNullable<DamaPiece>, out: DamaPlan[]) {
  const kingIdx = captured.findIndex((sq) => board[sq]?.king);
  out.push({ path, captured, kingsCaptured: captured.filter((sq) => board[sq]?.king).length, firstKingAt: kingIdx < 0 ? 99 : kingIdx, byKing: piece.king });
}

export function damaMoves(board: DamaPiece[], turn: Seat): DamaPlan[] {
  const caps: DamaPlan[] = [];
  const steps: DamaPlan[] = [];
  for (let sq = 0; sq < 64; sq++) {
    const p = board[sq];
    if (!p || p.owner !== turn) continue;
    captures(board, sq, p, [], [sq], caps);
    const r = Math.floor(sq / 8);
    const c = sq % 8;
    for (const dr of p.king ? [-1, 1] : [forward(p.owner)]) {
      for (const dc of [-1, 1]) {
        if (inside(r + dr, c + dc) && !board[idx(r + dr, c + dc)]) {
          steps.push({ path: [sq, idx(r + dr, c + dc)], captured: [], kingsCaptured: 0, firstKingAt: 99, byKing: p.king });
        }
      }
    }
  }
  if (!caps.length) return steps;
  // Regole di precedenza italiane: più pezzi, poi con la dama, poi più dame, poi la dama incontrata prima.
  const filters: ((a: DamaPlan[]) => DamaPlan[])[] = [
    (a) => a.filter((m) => m.captured.length === Math.max(...a.map((x) => x.captured.length))),
    (a) => (a.some((m) => m.byKing) ? a.filter((m) => m.byKing) : a),
    (a) => a.filter((m) => m.kingsCaptured === Math.max(...a.map((x) => x.kingsCaptured))),
    (a) => a.filter((m) => m.firstKingAt === Math.min(...a.map((x) => x.firstKingAt))),
  ];
  return filters.reduce((a, f) => f(a), caps);
}

function applyPlan(s: DamaState, plan: DamaPlan) {
  const piece = s.board[plan.path[0]]!;
  s.board[plan.path[0]] = null;
  for (const sq of plan.captured) s.board[sq] = null;
  const end = plan.path[plan.path.length - 1];
  const row = Math.floor(end / 8);
  const promotes = !piece.king && ((piece.owner === 0 && row === 0) || (piece.owner === 1 && row === 7));
  s.board[end] = { owner: piece.owner, king: piece.king || promotes };
  s.quiet = plan.captured.length || promotes ? 0 : s.quiet + 1;
  s.last = plan.path;
  s.turn = 1 - s.turn;
  if (!damaMoves(s.board, s.turn).length) s.winner = 1 - s.turn;
  else if (s.quiet >= 80) s.winner = 'draw';
}

function evaluate(board: DamaPiece[], seat: Seat): number {
  let score = 0;
  board.forEach((p, sq) => {
    if (!p) return;
    const row = Math.floor(sq / 8);
    const advance = p.owner === 0 ? 7 - row : row;
    const v = p.king ? 5 : 2 + advance * 0.1;
    score += p.owner === seat ? v : -v;
  });
  return score;
}

function search(s: DamaState, depth: number, alpha: number, beta: number, seat: Seat): number {
  if (s.winner !== null) return s.winner === 'draw' ? 0 : s.winner === seat ? 1000 + depth : -1000 - depth;
  if (depth === 0) return evaluate(s.board, seat);
  const moves = damaMoves(s.board, s.turn);
  const maximizing = s.turn === seat;
  let best = maximizing ? -Infinity : Infinity;
  for (const m of moves) {
    const child: DamaState = { ...s, board: [...s.board] };
    applyPlan(child, m);
    const v = search(child, depth - 1, alpha, beta, seat);
    if (maximizing) {
      best = Math.max(best, v);
      alpha = Math.max(alpha, v);
    } else {
      best = Math.min(best, v);
      beta = Math.min(beta, v);
    }
    if (beta <= alpha) break;
  }
  return best;
}

export const dama: Game<DamaState, DamaMove, DamaState & { moves: DamaPlan[] }> = {
  meta: {
    id: 'dama',
    name: 'Dama',
    category: 'tavolo',
    minPlayers: 2,
    maxPlayers: 2,
    emoji: '⚫',
    color: '#6D4C41',
    tagline: 'Dama italiana, presa obbligatoria',
    rules: [
      'Le pedine avanzano di una casella in diagonale; arrivate in fondo diventano dama, che si muove anche all’indietro.',
      'Mangiare è obbligatorio, anche più pezzi di fila. La pedina non può mangiare la dama.',
      'Se ci sono più prese possibili bisogna scegliere quella che mangia più pezzi, poi quella fatta con la dama.',
      'Vince chi lascia l’avversario senza pezzi o senza mosse.',
    ],
    hiddenInfo: false,
    minutes: 15,
  },
  setup({ seed }) {
    const board: DamaPiece[] = Array(64).fill(null);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r + c) % 2 === 0) continue;
        if (r < 3) board[idx(r, c)] = { owner: 1, king: false };
        if (r > 4) board[idx(r, c)] = { owner: 0, king: false };
      }
    }
    return { rng: seed, board, turn: 0, quiet: 0, last: null, winner: null };
  },
  activePlayers: (s) => (s.winner === null ? [s.turn] : []),
  play(s, seat, { path }) {
    const plan = damaMoves(s.board, seat).find((m) => m.path.length === path.length && m.path.every((sq, i) => sq === path[i]));
    assert(plan, damaMoves(s.board, seat).some((m) => m.captured.length) ? 'Devi mangiare (la presa più grande).' : 'Mossa non valida.');
    applyPlan(s, plan);
  },
  view: (s) => ({ ...s, moves: s.winner === null ? damaMoves(s.board, s.turn) : [] }),
  result(s) {
    if (s.winner === null) return null;
    if (s.winner === 'draw') return { winners: [], summary: 'Patta: troppe mosse senza prese' };
    return { winners: [s.winner], summary: `Vince il ${s.winner === 0 ? 'bianco' : 'nero'}` };
  },
  bot(s, seat) {
    const moves = damaMoves(s.board, seat);
    let best: DamaPlan[] = [];
    let bestScore = -Infinity;
    for (const m of moves) {
      const child: DamaState = { ...s, board: [...s.board] };
      applyPlan(child, m);
      const v = search(child, 4, -Infinity, Infinity, seat);
      if (v > bestScore) {
        bestScore = v;
        best = [m];
      } else if (v === bestScore) best.push(m);
    }
    return { path: best[Math.floor(random(s) * best.length)].path };
  },
};
