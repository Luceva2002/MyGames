import { assert, type Game, type Seat } from '../core/types';
import { pick, random, type HasRng } from '../core/rng';

export interface TrisState extends HasRng {
  board: (Seat | null)[];
  turn: Seat;
  winLine: number[] | null;
  /** Chi ha iniziato: alla rivincita si alterna. */
  starter: Seat;
}

export type TrisMove = { cell: number };

export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function winLine(board: (Seat | null)[]): number[] | null {
  return LINES.find(([a, b, c]) => board[a] !== null && board[a] === board[b] && board[a] === board[c]) ?? null;
}

export const tris: Game<TrisState, TrisMove, TrisState, { starter?: Seat }> = {
  meta: {
    id: 'tris',
    name: 'Tris',
    category: 'tavolo',
    minPlayers: 2,
    maxPlayers: 2,
    emoji: '⭕',
    color: '#5B8DEF',
    tagline: 'Tre in fila e hai vinto',
    rules: ['Si gioca a turno su una griglia 3×3.', 'Vince chi allinea per primo tre simboli in orizzontale, verticale o diagonale.'],
    hiddenInfo: false,
    minutes: 1,
  },
  setup({ seed, options }) {
    const starter = options?.starter ?? 0;
    return { rng: seed, board: Array(9).fill(null), turn: starter, winLine: null, starter };
  },
  activePlayers: (s) => [s.turn],
  play(s, seat, { cell }) {
    assert(cell >= 0 && cell < 9 && s.board[cell] === null, 'Casella occupata.');
    s.board[cell] = seat;
    s.winLine = winLine(s.board);
    s.turn = 1 - seat;
  },
  view: (s) => s,
  result(s) {
    if (s.winLine) {
      const w = s.board[s.winLine[0]]!;
      return { winners: [w], summary: `Tris!` };
    }
    if (s.board.every((c) => c !== null)) return { winners: [], summary: 'Pareggio' };
    return null;
  },
  bot(s, seat) {
    const free = s.board.flatMap((c, i) => (c === null ? [i] : []));
    const completing = (who: Seat) =>
      free.find((i) => {
        const b = [...s.board];
        b[i] = who;
        return winLine(b) !== null;
      });
    const win = completing(seat);
    if (win !== undefined) return { cell: win };
    const block = completing(1 - seat);
    if (block !== undefined) return { cell: block };
    if (s.board[4] === null) return { cell: 4 };
    const corners = free.filter((i) => [0, 2, 6, 8].includes(i));
    // Un po' di imprevedibilità, così il computer non gioca sempre uguale.
    return { cell: corners.length && random(s) < 0.7 ? pick(s, corners) : pick(s, free) };
  },
};
