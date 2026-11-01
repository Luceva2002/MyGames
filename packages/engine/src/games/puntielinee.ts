import { assert, type Game, type Seat } from '../core/types';
import { pick, random, type HasRng } from '../core/rng';

export interface PuntiLineeState extends HasRng {
  /** Punti per lato: 5 vuol dire 4×4 quadrati. */
  dots: number;
  players: number;
  /** Chi ha tracciato ogni linea: prima le orizzontali, poi le verticali. */
  lines: (Seat | null)[];
  boxes: (Seat | null)[];
  turn: Seat;
  last: number | null;
}

export type PuntiLineeMove = { line: number } | { dots: number };

export const PUNTI_SIZES = [4, 5, 6];

/** Numero della linea orizzontale che parte dal punto (r, c). */
export const hLine = (dots: number, r: number, c: number) => r * (dots - 1) + c;
/** Numero della linea verticale che parte dal punto (r, c). */
export const vLine = (dots: number, r: number, c: number) => dots * (dots - 1) + r * dots + c;

/** I quattro lati di un quadrato. */
function sidesOf(dots: number, box: number): number[] {
  const n = dots - 1;
  const r = Math.floor(box / n);
  const c = box % n;
  return [hLine(dots, r, c), hLine(dots, r + 1, c), vLine(dots, r, c), vLine(dots, r, c + 1)];
}

/** I quadrati toccati da una linea: uno sul bordo, due in mezzo. */
function boxesOf(dots: number, line: number): number[] {
  const n = dots - 1;
  const hCount = dots * n;
  const out: number[] = [];
  if (line < hCount) {
    const r = Math.floor(line / n);
    const c = line % n;
    if (r > 0) out.push((r - 1) * n + c);
    if (r < n) out.push(r * n + c);
  } else {
    const v = line - hCount;
    const r = Math.floor(v / dots);
    const c = v % dots;
    if (c > 0) out.push(r * n + c - 1);
    if (c < n) out.push(r * n + c);
  }
  return out;
}

const drawn = (lines: (Seat | null)[], dots: number, box: number) => sidesOf(dots, box).filter((l) => lines[l] !== null).length;

function freeLines(lines: (Seat | null)[]): number[] {
  return lines.flatMap((o, i) => (o === null ? [i] : []));
}

/** Quanti quadrati regala una linea: chi viene dopo chiude tutti quelli che può, uno dopo l'altro. */
function giveaway(s: PuntiLineeState, line: number): number {
  const lines = [...s.lines];
  lines[line] = 0;
  let given = 0;
  for (;;) {
    const open = s.boxes.flatMap((_, b) => (drawn(lines, s.dots, b) === 3 ? [b] : []));
    if (!open.length) return given;
    for (const l of sidesOf(s.dots, open[0])) if (lines[l] === null) lines[l] = 0;
    given++;
  }
}

function emptyBoard(dots: number) {
  return { dots, lines: Array(2 * dots * (dots - 1)).fill(null) as (Seat | null)[], boxes: Array((dots - 1) ** 2).fill(null) as (Seat | null)[] };
}

export const puntielinee: Game<PuntiLineeState, PuntiLineeMove, PuntiLineeState> = {
  meta: {
    id: 'puntielinee',
    name: 'Punti e linee',
    category: 'tavolo',
    minPlayers: 2,
    maxPlayers: 4,
    emoji: '🔲',
    color: '#FFE14D',
    tagline: 'Chiudi il quadrato e rigioca',
    rules: [
      'A turno si tocca lo spazio tra due punti vicini per tracciare una linea.',
      'Chi chiude il quarto lato di un quadrato lo colora e gioca ancora.',
      'Attento al terzo lato: lascia il quadrato pronto per chi viene dopo.',
      'Quando tutti i quadrati sono chiusi, vince chi ne ha di più.',
    ],
    hiddenInfo: false,
    minutes: 5,
  },
  setup({ players, seed }) {
    return { rng: seed, players, turn: 0, last: null, ...emptyBoard(5) };
  },
  activePlayers: (s) => (s.boxes.every((b) => b !== null) ? [] : [s.turn]),
  play(s, seat, move) {
    if ('dots' in move) {
      assert(PUNTI_SIZES.includes(move.dots), 'Griglia non disponibile.');
      assert(s.last === null, 'La griglia si sceglie prima della prima linea.');
      Object.assign(s, emptyBoard(move.dots));
      return;
    }
    const { line } = move;
    assert(Number.isInteger(line) && line >= 0 && line < s.lines.length && s.lines[line] === null, 'Questa linea c’è già.');
    // Il computer pesca a caso su una copia: i numeri della partita devono andare avanti a ogni mossa.
    random(s);
    s.lines[line] = seat;
    s.last = line;
    const closed = boxesOf(s.dots, line).filter((b) => drawn(s.lines, s.dots, b) === 4);
    for (const b of closed) s.boxes[b] = seat;
    if (!closed.length) s.turn = (seat + 1) % s.players;
  },
  view: (s) => s,
  result(s) {
    if (s.boxes.some((b) => b === null)) return null;
    const scores = Array.from({ length: s.players }, (_, p) => s.boxes.filter((b) => b === p).length);
    const best = Math.max(...scores);
    const winners = scores.flatMap((n, p) => (n === best ? [p] : []));
    return { winners: winners.length === s.players ? [] : winners, scores, summary: 'Quadrati chiusi' };
  },
  bot(s) {
    const free = freeLines(s.lines);
    // Se può chiudere chiude; altrimenti evita il terzo lato; altrimenti regala il meno possibile.
    const closing = free.filter((l) => boxesOf(s.dots, l).some((b) => drawn(s.lines, s.dots, b) === 3));
    if (closing.length) return { line: pick(s, closing) };
    const safe = free.filter((l) => boxesOf(s.dots, l).every((b) => drawn(s.lines, s.dots, b) < 2));
    if (safe.length) return { line: pick(s, safe) };
    const costs = free.map((l) => ({ l, cost: giveaway(s, l) }));
    const least = Math.min(...costs.map((c) => c.cost));
    return { line: pick(s, costs.filter((c) => c.cost === least).map((c) => c.l)) };
  },
  pause: () => 1400,
};
