import { assert, type Game, type Seat } from '../core/types';
import { random, type HasRng } from '../core/rng';

/**
 * Scacchi completi: arrocco, en passant, promozione, scacco matto, stallo,
 * regola delle 50 mosse, tripla ripetizione e materiale insufficiente.
 * Scacchiera 0..63, riga 0 = ottava traversa (lato nero). Maiuscole bianco (posto 0), minuscole nero.
 */
export interface ChessState extends HasRng {
  board: (string | null)[];
  turn: Seat;
  castling: string;
  ep: number | null;
  halfmove: number;
  fullmove: number;
  history: string[];
  last: { from: number; to: number } | null;
  outcome: { winner: Seat | null; reason: string } | null;
}

export type ChessMove = { from: number; to: number; promo?: 'q' | 'r' | 'b' | 'n' };

export interface ChessView extends ChessState {
  legal: ChessMove[];
  check: boolean;
  captured: [string[], string[]];
}

const white = (p: string) => p === p.toUpperCase();
const ownerOf = (p: string): Seat => (white(p) ? 0 : 1);
const row = (sq: number) => sq >> 3;
const col = (sq: number) => sq & 7;
const at = (r: number, c: number) => (r >= 0 && r < 8 && c >= 0 && c < 8 ? r * 8 + c : -1);

const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const ROOK = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

function attacked(board: (string | null)[], sq: number, by: Seat): boolean {
  const r = row(sq);
  const c = col(sq);
  const is = (s: number, types: string) => {
    const p = s >= 0 ? board[s] : null;
    return !!p && ownerOf(p) === by && types.includes(p.toLowerCase());
  };
  const pawnRow = by === 0 ? r + 1 : r - 1;
  if (is(at(pawnRow, c - 1), 'p') || is(at(pawnRow, c + 1), 'p')) return true;
  if (KNIGHT.some(([dr, dc]) => is(at(r + dr, c + dc), 'n'))) return true;
  if (KING.some(([dr, dc]) => is(at(r + dr, c + dc), 'k'))) return true;
  for (const [dirs, types] of [[ROOK, 'rq'], [BISHOP, 'bq']] as const) {
    for (const [dr, dc] of dirs) {
      let rr = r + dr;
      let cc = c + dc;
      while (at(rr, cc) >= 0) {
        const p = board[at(rr, cc)];
        if (p) {
          if (ownerOf(p) === by && types.includes(p.toLowerCase())) return true;
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
  }
  return false;
}

function kingSquare(board: (string | null)[], seat: Seat) {
  return board.indexOf(seat === 0 ? 'K' : 'k');
}

export function inCheck(s: Pick<ChessState, 'board'>, seat: Seat) {
  return attacked(s.board, kingSquare(s.board, seat), 1 - seat);
}

function pseudo(s: ChessState): ChessMove[] {
  const out: ChessMove[] = [];
  const me = s.turn;
  for (let sq = 0; sq < 64; sq++) {
    const p = s.board[sq];
    if (!p || ownerOf(p) !== me) continue;
    const r = row(sq);
    const c = col(sq);
    const t = p.toLowerCase();
    const add = (to: number) => {
      if (to < 0) return false;
      const q = s.board[to];
      if (q && ownerOf(q) === me) return false;
      out.push({ from: sq, to });
      return !q;
    };
    if (t === 'p') {
      const dir = me === 0 ? -1 : 1;
      const one = at(r + dir, c);
      const promoRow = me === 0 ? 0 : 7;
      const push = (to: number) => {
        if (row(to) === promoRow) for (const promo of ['q', 'r', 'b', 'n'] as const) out.push({ from: sq, to, promo });
        else out.push({ from: sq, to });
      };
      if (one >= 0 && !s.board[one]) {
        push(one);
        const two = at(r + 2 * dir, c);
        if ((me === 0 ? r === 6 : r === 1) && !s.board[two]) out.push({ from: sq, to: two });
      }
      for (const dc of [-1, 1]) {
        const to = at(r + dir, c + dc);
        if (to < 0) continue;
        const q = s.board[to];
        if ((q && ownerOf(q) !== me) || to === s.ep) push(to);
      }
    } else if (t === 'n' || t === 'k') {
      for (const [dr, dc] of t === 'n' ? KNIGHT : KING) add(at(r + dr, c + dc));
      if (t === 'k') {
        const home = me === 0 ? 60 : 4;
        const [kSide, qSide] = me === 0 ? ['K', 'Q'] : ['k', 'q'];
        if (sq === home && !attacked(s.board, home, 1 - me)) {
          if (s.castling.includes(kSide) && !s.board[home + 1] && !s.board[home + 2] && !attacked(s.board, home + 1, 1 - me) && !attacked(s.board, home + 2, 1 - me)) {
            out.push({ from: home, to: home + 2 });
          }
          if (s.castling.includes(qSide) && !s.board[home - 1] && !s.board[home - 2] && !s.board[home - 3] && !attacked(s.board, home - 1, 1 - me) && !attacked(s.board, home - 2, 1 - me)) {
            out.push({ from: home, to: home - 2 });
          }
        }
      }
    } else {
      const dirs = t === 'r' ? ROOK : t === 'b' ? BISHOP : [...ROOK, ...BISHOP];
      for (const [dr, dc] of dirs) {
        let rr = r + dr;
        let cc = c + dc;
        while (at(rr, cc) >= 0 && add(at(rr, cc))) {
          rr += dr;
          cc += dc;
        }
      }
    }
  }
  return out;
}

/** Esegue la mossa sullo stato senza controllare la legalità né la fine partita. */
function make(s: ChessState, m: ChessMove) {
  const p = s.board[m.from]!;
  const t = p.toLowerCase();
  const captured = s.board[m.to];
  s.board[m.to] = m.promo ? (white(p) ? m.promo.toUpperCase() : m.promo) : p;
  s.board[m.from] = null;
  if (t === 'p' && m.to === s.ep) s.board[m.to + (white(p) ? 8 : -8)] = null;
  if (t === 'k' && Math.abs(m.to - m.from) === 2) {
    const rookFrom = m.to > m.from ? m.from + 3 : m.from - 4;
    const rookTo = m.to > m.from ? m.from + 1 : m.from - 1;
    s.board[rookTo] = s.board[rookFrom];
    s.board[rookFrom] = null;
  }
  s.ep = t === 'p' && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : null;
  const strip = (chars: string) => (s.castling = s.castling.replace(new RegExp(`[${chars}]`, 'g'), ''));
  if (p === 'K') strip('KQ');
  if (p === 'k') strip('kq');
  for (const sq of [m.from, m.to]) {
    if (sq === 63) strip('K');
    if (sq === 56) strip('Q');
    if (sq === 7) strip('k');
    if (sq === 0) strip('q');
  }
  s.halfmove = t === 'p' || captured ? 0 : s.halfmove + 1;
  if (s.turn === 1) s.fullmove++;
  s.turn = 1 - s.turn;
  s.last = { from: m.from, to: m.to };
}

function copy(s: ChessState): ChessState {
  return { ...s, board: [...s.board], history: s.history };
}

export function legalMoves(s: ChessState): ChessMove[] {
  return pseudo(s).filter((m) => {
    const c = copy(s);
    make(c, m);
    return !inCheck(c, s.turn);
  });
}

const key = (s: ChessState) => `${s.board.map((p) => p ?? '.').join('')}${s.turn}${s.castling}${s.ep ?? '-'}`;

function insufficient(board: (string | null)[]) {
  const pieces = board.filter((p): p is string => !!p && p.toLowerCase() !== 'k');
  if (pieces.length === 0) return true;
  return pieces.length === 1 && 'bn'.includes(pieces[0].toLowerCase());
}

function finish(s: ChessState) {
  const moves = legalMoves(s);
  if (!moves.length) {
    s.outcome = inCheck(s, s.turn) ? { winner: 1 - s.turn, reason: 'Scacco matto' } : { winner: null, reason: 'Stallo' };
  } else if (s.halfmove >= 100) s.outcome = { winner: null, reason: 'Patta per la regola delle 50 mosse' };
  else if (insufficient(s.board)) s.outcome = { winner: null, reason: 'Patta: materiale insufficiente' };
  else if (s.history.filter((h) => h === key(s)).length >= 3) s.outcome = { winner: null, reason: 'Patta per ripetizione' };
}

const VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
// Bonus di posizione semplice: centro per cavalli e pedoni avanzati.
const CENTER = Array.from({ length: 64 }, (_, sq) => 3.5 - Math.max(Math.abs(row(sq) - 3.5), Math.abs(col(sq) - 3.5)));

function evaluate(s: ChessState, seat: Seat): number {
  let score = 0;
  s.board.forEach((p, sq) => {
    if (!p) return;
    const t = p.toLowerCase();
    let v = VALUE[t];
    if (t === 'n' || t === 'b') v += CENTER[sq] * 8;
    if (t === 'p') v += (white(p) ? 6 - row(sq) : row(sq) - 1) * 6 + CENTER[sq] * 3;
    if (t === 'q') v += CENTER[sq] * 2;
    score += ownerOf(p) === seat ? v : -v;
  });
  return score;
}

function search(s: ChessState, depth: number, alpha: number, beta: number, seat: Seat): number {
  const moves = legalMoves(s);
  if (!moves.length) return inCheck(s, s.turn) ? (s.turn === seat ? -100000 - depth : 100000 + depth) : 0;
  if (depth === 0) return evaluate(s, seat);
  // Prima le prese: il taglio alfa-beta funziona meglio.
  moves.sort((a, b) => (s.board[b.to] ? VALUE[s.board[b.to]!.toLowerCase()] : 0) - (s.board[a.to] ? VALUE[s.board[a.to]!.toLowerCase()] : 0));
  const maximizing = s.turn === seat;
  let best = maximizing ? -Infinity : Infinity;
  for (const m of moves) {
    const c = copy(s);
    make(c, m);
    const v = search(c, depth - 1, alpha, beta, seat);
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

const START = 'rnbqkbnrpppppppp' + '.'.repeat(32) + 'PPPPPPPPRNBQKBNR';

export const scacchi: Game<ChessState, ChessMove, ChessView> = {
  meta: {
    id: 'scacchi',
    name: 'Scacchi',
    category: 'tavolo',
    minPlayers: 2,
    maxPlayers: 2,
    emoji: '♟️',
    color: '#455A64',
    tagline: 'Il re dei giochi da tavolo',
    rules: [
      'Il bianco muove per primo. Tocca un pezzo per vedere dove può andare.',
      'Arrocco, presa al passo e promozione sono inclusi: per arroccare muovi il re di due caselle.',
      'Vince chi dà scacco matto. Stallo, 50 mosse senza prese o pedoni, tripla ripetizione e materiale insufficiente sono patta.',
    ],
    hiddenInfo: false,
    minutes: 30,
  },
  setup({ seed }) {
    const s: ChessState = {
      rng: seed,
      board: START.split('').map((ch) => (ch === '.' ? null : ch)),
      turn: 0,
      castling: 'KQkq',
      ep: null,
      halfmove: 0,
      fullmove: 1,
      history: [],
      last: null,
      outcome: null,
    };
    s.history = [key(s)];
    return s;
  },
  activePlayers: (s) => (s.outcome ? [] : [s.turn]),
  play(s, seat, move) {
    const legal = legalMoves(s).find((m) => m.from === move.from && m.to === move.to && (m.promo ?? null) === (move.promo ?? (m.promo ? 'q' : null)));
    assert(legal, inCheck(s, seat) ? 'Sei sotto scacco: devi pararlo.' : 'Mossa non valida.');
    make(s, legal);
    s.history = [...s.history, key(s)];
    finish(s);
  },
  view(s) {
    const captured: [string[], string[]] = [[], []];
    const count = (ch: string) => s.board.filter((p) => p === ch).length;
    const full: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    for (const [t, n] of Object.entries(full)) {
      for (let i = count(t.toUpperCase()); i < n; i++) captured[1].push(t.toUpperCase());
      for (let i = count(t); i < n; i++) captured[0].push(t);
    }
    return { ...s, history: [], legal: s.outcome ? [] : legalMoves(s), check: inCheck(s, s.turn), captured };
  },
  result(s) {
    if (!s.outcome) return null;
    return { winners: s.outcome.winner === null ? [] : [s.outcome.winner], summary: s.outcome.reason };
  },
  bot(s, seat) {
    const moves = legalMoves(s);
    const pieces = s.board.filter(Boolean).length;
    const depth = pieces < 12 ? 3 : 2;
    let best: ChessMove[] = [];
    let bestScore = -Infinity;
    for (const m of moves) {
      const c = copy(s);
      make(c, m);
      const v = search(c, depth, -Infinity, Infinity, seat) + random(s) * 10;
      if (v > bestScore) {
        bestScore = v;
        best = [m];
      }
    }
    return best[0];
  },
};
