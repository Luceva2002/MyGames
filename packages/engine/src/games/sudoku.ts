import { assert, type Game } from '../core/types';
import { randomInt, shuffle, type HasRng } from '../core/rng';

/**
 * Sudoku classico 9×9, generato dalla partita (sempre con una sola soluzione). Si sceglie la
 * difficoltà, poi si riempiono le caselle: un numero sbagliato non si scrive e conta come errore;
 * al terzo errore la partita finisce. Tre aiuti scoprono una casella.
 */
export type SudokuLevel = 'facile' | 'medio' | 'difficile';

export interface SudokuState extends HasRng {
  level: SudokuLevel | null;
  /** 0 = vuota. Le date dall'inizio non si cambiano. */
  given: number[];
  values: number[];
  solution: number[];
  errors: number;
  hints: number;
  /** L'ultimo numero sbagliato, per farlo lampeggiare in rosso. */
  wrong: { cell: number; value: number; n: number } | null;
  /** L'ultima casella riempita giusta (anche con un aiuto). */
  filled: { cell: number; n: number } | null;
  moves: number;
  over: boolean;
}

export type SudokuMove = { type: 'level'; level: SudokuLevel } | { type: 'fill'; cell: number; value: number } | { type: 'hint'; cell?: number };

export type SudokuView = Omit<SudokuState, 'rng' | 'solution'>;

export const SUDOKU_MAX_ERRORS = 3;
export const SUDOKU_HINTS = 3;
export const SUDOKU_LEVELS: { id: SudokuLevel; label: string; clues: number }[] = [
  { id: 'facile', label: 'Facile', clues: 40 },
  { id: 'medio', label: 'Medio', clues: 32 },
  { id: 'difficile', label: 'Difficile', clues: 26 },
];

const box = (i: number) => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3);

/** Conta le soluzioni (fino a `limit`) con le maschere di bit: veloce anche in un telefono. */
function countSolutions(grid: number[], limit = 2): number {
  const g = [...grid];
  const rows = Array(9).fill(0);
  const cols = Array(9).fill(0);
  const boxes = Array(9).fill(0);
  for (let i = 0; i < 81; i++) {
    if (!g[i]) continue;
    const bit = 1 << g[i];
    rows[Math.floor(i / 9)] |= bit;
    cols[i % 9] |= bit;
    boxes[box(i)] |= bit;
  }
  let count = 0;
  const solve = (): void => {
    if (count >= limit) return;
    // La casella vuota con meno possibilità.
    let best = -1;
    let bestMask = 0;
    let bestN = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const mask = ~(rows[Math.floor(i / 9)] | cols[i % 9] | boxes[box(i)]) & 0x3fe;
      let n = 0;
      for (let m = mask; m; m &= m - 1) n++;
      if (n < bestN) {
        best = i;
        bestMask = mask;
        bestN = n;
        if (n <= 1) break;
      }
    }
    if (best < 0) {
      count++;
      return;
    }
    for (let v = 1; v <= 9; v++) {
      if (!(bestMask & (1 << v))) continue;
      const bit = 1 << v;
      const r = Math.floor(best / 9);
      const c = best % 9;
      const b = box(best);
      g[best] = v;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
      solve();
      g[best] = 0;
      rows[r] &= ~bit;
      cols[c] &= ~bit;
      boxes[b] &= ~bit;
      if (count >= limit) return;
    }
  };
  solve();
  return count;
}

/** Una griglia piena qualsiasi: si parte da una valida e si mescolano numeri, righe e colonne. */
function fullGrid(s: HasRng): number[] {
  const base = Array.from({ length: 81 }, (_, i) => {
    const r = Math.floor(i / 9);
    const c = i % 9;
    return ((r * 3 + Math.floor(r / 3) + c) % 9) + 1;
  });
  const digits = shuffle(s, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const order = () => shuffle(s, [0, 1, 2]).flatMap((band) => shuffle(s, [0, 1, 2]).map((x) => band * 3 + x));
  const rowOrder = order();
  const colOrder = order();
  const flip = randomInt(s, 2) === 1;
  return Array.from({ length: 81 }, (_, i) => {
    let r = rowOrder[Math.floor(i / 9)];
    let c = colOrder[i % 9];
    if (flip) [r, c] = [c, r];
    return digits[base[r * 9 + c] - 1];
  });
}

export function makeSudoku(s: HasRng, clues: number): { given: number[]; solution: number[] } {
  const solution = fullGrid(s);
  const given = [...solution];
  // Si tolgono caselle a coppie simmetriche finché la soluzione resta unica.
  const cells = shuffle(s, Array.from({ length: 41 }, (_, i) => i));
  let left = 81;
  for (const i of cells) {
    if (left <= clues) break;
    const j = 80 - i;
    const a = given[i];
    const b = given[j];
    given[i] = 0;
    given[j] = 0;
    if (countSolutions(given) !== 1) {
      given[i] = a;
      given[j] = b;
      continue;
    }
    left -= i === j ? 1 : 2;
  }
  return { given, solution };
}

const solved = (s: SudokuState) => s.level !== null && s.values.every((v, i) => v === s.solution[i]);

export const sudoku: Game<SudokuState, SudokuMove, SudokuView> = {
  meta: {
    id: 'sudoku',
    name: 'Sudoku',
    category: 'tavolo',
    minPlayers: 1,
    maxPlayers: 1,
    emoji: '🔢',
    color: '#FFF1D6',
    tagline: 'I numeri da 1 a 9, senza ripeterli',
    rules: [
      'Riempi la griglia: in ogni riga, in ogni colonna e in ogni riquadro 3×3 ci sono tutti i numeri da 1 a 9, una volta sola.',
      'Tocca una casella e poi un numero. Con la matita scrivi dei promemoria piccoli, che non contano.',
      'Un numero sbagliato non si scrive e conta come errore: al terzo errore la partita finisce.',
      'Hai tre aiuti: ognuno scopre la casella che hai scelto.',
    ],
    hiddenInfo: false,
    minutes: 15,
  },
  setup({ seed }) {
    return { rng: seed, level: null, given: Array(81).fill(0), values: Array(81).fill(0), solution: Array(81).fill(0), errors: 0, hints: SUDOKU_HINTS, wrong: null, filled: null, moves: 0, over: false };
  },
  activePlayers: (s) => (s.over ? [] : [0]),
  play(s, _seat, m) {
    if (m.type === 'level') {
      assert(s.level === null, 'La difficoltà è già scelta.');
      const lv = SUDOKU_LEVELS.find((l) => l.id === m.level);
      assert(lv, 'Difficoltà sconosciuta.');
      const { given, solution } = makeSudoku(s, lv.clues);
      s.level = lv.id;
      s.given = given;
      s.values = [...given];
      s.solution = solution;
      return;
    }
    assert(s.level !== null, 'Prima scegli la difficoltà.');
    const n = s.moves + 1;
    if (m.type === 'hint') {
      assert(s.hints > 0, 'Aiuti finiti.');
      let cell = m.cell;
      if (cell === undefined || s.values[cell]) {
        const empty = s.values.flatMap((v, i) => (v ? [] : [i]));
        cell = empty[randomInt(s, empty.length)];
      }
      assert(cell !== undefined && !s.values[cell], 'Non ci sono caselle vuote.');
      s.values[cell] = s.solution[cell];
      s.hints--;
      s.moves = n;
      s.filled = { cell, n };
      s.wrong = null;
    } else {
      assert(Number.isInteger(m.cell) && m.cell >= 0 && m.cell < 81, 'Casella non valida.');
      assert(Number.isInteger(m.value) && m.value >= 1 && m.value <= 9, 'Numero non valido.');
      assert(!s.given[m.cell] && s.values[m.cell] !== s.solution[m.cell], 'Questa casella è già giusta.');
      s.moves = n;
      if (s.solution[m.cell] === m.value) {
        s.values[m.cell] = m.value;
        s.filled = { cell: m.cell, n };
        s.wrong = null;
      } else {
        s.errors++;
        s.wrong = { cell: m.cell, value: m.value, n };
      }
    }
    if (solved(s) || s.errors >= SUDOKU_MAX_ERRORS) s.over = true;
  },
  view: ({ rng: _r, solution: _s, ...v }) => v,
  result(s) {
    if (!s.over) return null;
    const lv = SUDOKU_LEVELS.find((l) => l.id === s.level)?.label.toLowerCase() ?? '';
    if (solved(s)) {
      const aiuti = SUDOKU_HINTS - s.hints;
      return {
        winners: [0],
        summary: `Sudoku ${lv} risolto · ${s.errors === 0 ? 'nessun errore' : s.errors === 1 ? '1 errore' : `${s.errors} errori`}${aiuti ? ` · ${aiuti} ${aiuti === 1 ? 'aiuto' : 'aiuti'}` : ''}`,
        title: '🏆 Risolto!',
        celebrate: true,
      };
    }
    return { winners: [], summary: `Tre errori: il sudoku ${lv} ha vinto stavolta.`, title: 'Tre errori!' };
  },
  bot(s) {
    if (s.level === null) return { type: 'level', level: 'facile' };
    const empty = s.values.findIndex((v, i) => v !== s.solution[i]);
    // Ogni tanto sbaglia, così nelle prove si vede anche la sconfitta.
    if (randomInt(s, 30) === 0) return { type: 'fill', cell: empty, value: (s.solution[empty] % 9) + 1 };
    return { type: 'fill', cell: empty, value: s.solution[empty] };
  },
};
