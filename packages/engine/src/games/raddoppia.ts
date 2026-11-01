import { assert, type Game } from '../core/types';
import { random, randomInt, type HasRng } from '../core/rng';

/**
 * Raddoppia: tessere su una griglia 4×4 che scivolano tutte insieme; due uguali che si toccano
 * diventano una sola dal valore doppio. Si vince arrivando alla tessera 2048.
 */
export interface RaddoppiaTile {
  id: number;
  v: number;
  cell: number;
}

export interface RaddoppiaState extends HasRng {
  tiles: RaddoppiaTile[];
  /** Le tessere assorbite nell'ultima mossa: scivolano sotto quella che le ha prese, poi spariscono. */
  ghosts: RaddoppiaTile[];
  merged: number[];
  spawned: number | null;
  nextId: number;
  score: number;
  best: number;
  moves: number;
  over: boolean;
  won: boolean;
}

export type RaddoppiaDir = 'up' | 'down' | 'left' | 'right';
export type RaddoppiaMove = { dir: RaddoppiaDir } | { type: 'stop' };

export type RaddoppiaView = Omit<RaddoppiaState, 'rng' | 'nextId'>;

export const RADDOPPIA_GOAL = 2048;
const N = 4;

function spawn(s: RaddoppiaState) {
  const used = new Set(s.tiles.map((t) => t.cell));
  const free = Array.from({ length: N * N }, (_, i) => i).filter((i) => !used.has(i));
  if (!free.length) return;
  const cell = free[randomInt(s, free.length)];
  const id = s.nextId++;
  s.tiles.push({ id, v: random(s) < 0.9 ? 2 : 4, cell });
  s.spawned = id;
}

/** Le righe da comprimere nella direzione data, dalla casella verso cui si scivola. */
function lines(dir: RaddoppiaDir): number[][] {
  const out: number[][] = [];
  for (let a = 0; a < N; a++) {
    const line: number[] = [];
    for (let b = 0; b < N; b++) {
      if (dir === 'left') line.push(a * N + b);
      if (dir === 'right') line.push(a * N + (N - 1 - b));
      if (dir === 'up') line.push(b * N + a);
      if (dir === 'down') line.push((N - 1 - b) * N + a);
    }
    out.push(line);
  }
  return out;
}

/** Fa scivolare tutto: restituisce se qualcosa si è mosso. */
function slide(s: RaddoppiaState, dir: RaddoppiaDir): boolean {
  const at = new Map(s.tiles.map((t) => [t.cell, t]));
  let moved = false;
  s.ghosts = [];
  s.merged = [];
  for (const line of lines(dir)) {
    let target = 0;
    let last: RaddoppiaTile | null = null;
    let lastMerged = false;
    for (const cell of line) {
      const t = at.get(cell);
      if (!t) continue;
      if (last && !lastMerged && last.v === t.v) {
        // Si fonde con quella davanti.
        last.v *= 2;
        s.score += last.v;
        s.merged.push(last.id);
        if (last.v >= RADDOPPIA_GOAL) s.won = true;
        s.ghosts.push({ ...t, cell: last.cell });
        s.tiles = s.tiles.filter((x) => x.id !== t.id);
        lastMerged = true;
        moved = true;
        continue;
      }
      const dest = line[target++];
      if (t.cell !== dest) moved = true;
      t.cell = dest;
      last = t;
      lastMerged = false;
    }
  }
  return moved;
}

export function raddoppiaCanMove(tiles: RaddoppiaTile[]): boolean {
  if (tiles.length < N * N) return true;
  const grid: number[] = Array(N * N).fill(0);
  for (const t of tiles) grid[t.cell] = t.v;
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const v = grid[r * N + c];
      if (c < N - 1 && grid[r * N + c + 1] === v) return true;
      if (r < N - 1 && grid[(r + 1) * N + c] === v) return true;
    }
  return false;
}

export const raddoppia: Game<RaddoppiaState, RaddoppiaMove, RaddoppiaView> = {
  meta: {
    id: 'raddoppia',
    name: 'Raddoppia',
    category: 'tavolo',
    minPlayers: 1,
    maxPlayers: 1,
    emoji: '🔢',
    color: '#FF2E88',
    tagline: 'Unisci le tessere uguali fino a 2048',
    rules: [
      'Scorri col dito (o usa le frecce): tutte le tessere scivolano da quella parte.',
      'Due tessere uguali che si scontrano diventano una sola dal valore doppio, e il nuovo valore va nel punteggio.',
      'Dopo ogni mossa compare una tessera nuova da 2 o da 4.',
      'Arriva alla tessera 2048 per vincere. Se la griglia è piena e non si unisce più niente, la partita finisce.',
    ],
    hiddenInfo: false,
    minutes: 8,
  },
  setup({ seed }) {
    const s: RaddoppiaState = { rng: seed, tiles: [], ghosts: [], merged: [], spawned: null, nextId: 1, score: 0, best: 2, moves: 0, over: false, won: false };
    spawn(s);
    spawn(s);
    s.spawned = null;
    return s;
  },
  activePlayers: (s) => (s.over ? [] : [0]),
  play(s, _seat, m) {
    if ('type' in m) {
      assert(m.type === 'stop', 'Mossa non valida.');
      s.over = true;
      return;
    }
    assert(['up', 'down', 'left', 'right'].includes(m.dir), 'Direzione non valida.');
    s.spawned = null;
    // Una mossa che non sposta niente non conta: niente tessera nuova.
    if (!slide(s, m.dir)) {
      s.ghosts = [];
      return;
    }
    s.moves++;
    spawn(s);
    s.best = Math.max(...s.tiles.map((t) => t.v));
    if (s.won || !raddoppiaCanMove(s.tiles)) s.over = true;
  },
  view: ({ rng: _r, nextId: _n, ...v }) => v,
  result(s) {
    if (!s.over) return null;
    if (s.won) return { winners: [0], scores: [s.score], summary: `${s.score} punti in ${s.moves} mosse`, title: '🏆 Hai fatto 2048!', celebrate: true };
    return { winners: [0], scores: [s.score], summary: `${s.score} punti · tessera più alta ${s.best}`, title: 'Griglia piena!' };
  },
  bot(s) {
    // Semplice e decente: preferisce giù e sinistra, come chi gioca davvero.
    for (const dir of ['down', 'left', 'right', 'up'] as RaddoppiaDir[]) {
      const copy: RaddoppiaState = JSON.parse(JSON.stringify(s));
      if (slide(copy, dir)) return { dir };
    }
    return { type: 'stop' };
  },
};
