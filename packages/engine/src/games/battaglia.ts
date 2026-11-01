import { assert, type Game, type Seat } from '../core/types';
import { pick, random, type HasRng } from '../core/rng';

export const NAVALE_SIZE = 10;
/** La flotta classica: lunghezze delle navi. */
export const NAVALE_FLEET = [5, 4, 3, 3, 2];
export const SHIP_NAMES: Record<number, string> = { 5: 'la portaerei', 4: 'la corazzata', 3: "l'incrociatore", 2: 'il cacciatorpediniere' };

export interface Ship {
  x: number;
  y: number;
  len: number;
  /** In orizzontale, altrimenti in verticale. */
  h: boolean;
}

export type NavaleOutcome = 'acqua' | 'colpito' | 'affondato';

export interface NavaleState extends HasRng {
  phase: 'place' | 'battle';
  fleets: (Ship[] | null)[];
  /** I colpi sparati da ogni giocatore, come caselle della griglia avversaria. */
  shots: number[][];
  turn: Seat;
  last: { seat: Seat; cell: number; outcome: NavaleOutcome; len?: number } | null;
  winner: Seat | null;
}

export type NavaleMove = { type: 'place'; ships: Ship[] } | { type: 'shot'; cell: number };

/** Il mare di un giocatore visto da fuori: i colpi ricevuti e solo le navi già affondate. */
export interface NavaleSea {
  misses: number[];
  hits: number[];
  sunk: Ship[];
}

export interface NavaleView {
  phase: 'place' | 'battle';
  turn: Seat;
  winner: Seat | null;
  last: NavaleState['last'];
  /** Chi ha già schierato la flotta. */
  ready: boolean[];
  /** La mia flotta (mai quella degli altri). */
  myFleet: Ship[] | null;
  /** Il mare di ogni giocatore: quanto si può sapere guardandolo da fuori. */
  seas: NavaleSea[];
  /** A partita finita si scoprono le navi rimaste. */
  revealed: (Ship[] | null)[] | null;
}

export function shipCells(ship: Ship): number[] {
  return Array.from({ length: ship.len }, (_, i) => (ship.h ? ship.y * NAVALE_SIZE + ship.x + i : (ship.y + i) * NAVALE_SIZE + ship.x));
}

/** La nave sta qui? Dentro la griglia e senza sovrapporsi alle altre. */
export function shipFits(fleet: Ship[], ship: Ship): boolean {
  const end = (ship.h ? ship.x : ship.y) + ship.len - 1;
  if (ship.x < 0 || ship.y < 0 || ship.x >= NAVALE_SIZE || ship.y >= NAVALE_SIZE || end >= NAVALE_SIZE) return false;
  const taken = new Set(fleet.flatMap(shipCells));
  return shipCells(ship).every((c) => !taken.has(c));
}

function validFleet(ships: unknown): ships is Ship[] {
  if (!Array.isArray(ships)) return false;
  const lens = ships.map((s) => s?.len).sort((a, b) => b - a);
  if (JSON.stringify(lens) !== JSON.stringify(NAVALE_FLEET)) return false;
  const placed: Ship[] = [];
  for (const raw of ships) {
    const ship = { x: raw.x, y: raw.y, len: raw.len, h: !!raw.h };
    if (!Number.isInteger(ship.x) || !Number.isInteger(ship.y) || !shipFits(placed, ship)) return false;
    placed.push(ship);
  }
  return true;
}

/** Una flotta messa a caso. `rand` è un numero tra 0 e 1: lo passa chi chiama (il telefono o il computer). */
export function randomFleet(rand: () => number): Ship[] {
  const fleet: Ship[] = [];
  for (const len of NAVALE_FLEET) {
    for (;;) {
      const ship = { x: Math.floor(rand() * NAVALE_SIZE), y: Math.floor(rand() * NAVALE_SIZE), len, h: rand() < 0.5 };
      if (shipFits(fleet, ship)) {
        fleet.push(ship);
        break;
      }
    }
  }
  return fleet;
}

/** Il mare di `target` visto da fuori. */
function seaOf(s: NavaleState, target: Seat): NavaleSea {
  const fired = new Set(s.shots[1 - target]);
  const fleet = s.fleets[target] ?? [];
  const ship = new Set(fleet.flatMap(shipCells));
  return {
    misses: [...fired].filter((c) => !ship.has(c)),
    hits: [...fired].filter((c) => ship.has(c)),
    sunk: fleet.filter((f) => shipCells(f).every((c) => fired.has(c))),
  };
}

const around = (c: number) => {
  const x = c % NAVALE_SIZE;
  const y = Math.floor(c / NAVALE_SIZE);
  const out: number[] = [];
  if (x > 0) out.push(c - 1);
  if (x < NAVALE_SIZE - 1) out.push(c + 1);
  if (y > 0) out.push(c - NAVALE_SIZE);
  if (y < NAVALE_SIZE - 1) out.push(c + NAVALE_SIZE);
  return out;
};

/**
 * Dove sparare guardando solo il mare da fuori, come farebbe una persona.
 * Bersaglio: dopo un colpo a segno insiste lì, seguendo la linea se ne ha due di fila.
 * Caccia: altrimenti spara dove possono stare più navi fra quelle rimaste.
 */
function aim(s: NavaleState, sea: NavaleSea): number {
  const shot = new Set([...sea.misses, ...sea.hits]);
  const free = (c: number) => !shot.has(c);
  const sunkCells = new Set(sea.sunk.flatMap(shipCells));
  const open = sea.hits.filter((c) => !sunkCells.has(c));
  if (open.length) {
    const hit = new Set(open);
    const inLine: number[] = [];
    for (const c of open) {
      const x = c % NAVALE_SIZE;
      if (x < NAVALE_SIZE - 1 && hit.has(c + 1)) {
        let a = c;
        while (hit.has(a) && Math.floor(a / NAVALE_SIZE) === Math.floor(c / NAVALE_SIZE)) a--;
        let b = c + 1;
        while (hit.has(b) && Math.floor(b / NAVALE_SIZE) === Math.floor(c / NAVALE_SIZE)) b++;
        for (const e of [a, b]) if (e >= 0 && e < 100 && Math.floor(e / NAVALE_SIZE) === Math.floor(c / NAVALE_SIZE) && free(e)) inLine.push(e);
      }
      if (hit.has(c + NAVALE_SIZE)) {
        let a = c;
        while (hit.has(a)) a -= NAVALE_SIZE;
        let b = c + NAVALE_SIZE;
        while (hit.has(b)) b += NAVALE_SIZE;
        for (const e of [a, b]) if (e >= 0 && e < 100 && free(e)) inLine.push(e);
      }
    }
    if (inLine.length) return pick(s, inLine);
    const beside = open.flatMap(around).filter(free);
    if (beside.length) return pick(s, beside);
  }
  // Le navi rimaste: ogni posizione possibile vota le sue caselle.
  const left = [...NAVALE_FLEET];
  for (const ship of sea.sunk) left.splice(left.indexOf(ship.len), 1);
  const blocked = new Set([...sea.misses, ...sunkCells]);
  const votes = Array(NAVALE_SIZE * NAVALE_SIZE).fill(0) as number[];
  for (const len of left) {
    for (const h of [true, false]) {
      for (let y = 0; y < NAVALE_SIZE; y++) {
        for (let x = 0; x < NAVALE_SIZE; x++) {
          const ship = { x, y, len, h };
          if (!shipFits([], ship)) continue;
          const cells = shipCells(ship);
          if (cells.some((c) => blocked.has(c))) continue;
          for (const c of cells) votes[c]++;
        }
      }
    }
  }
  let best = -1;
  let bestScore = -1;
  votes.forEach((v, c) => {
    if (!free(c)) return;
    const score = v + random(s) * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  });
  return best;
}

export const CELL_LABEL = (c: number) => `${'ABCDEFGHIJ'[c % NAVALE_SIZE]}${Math.floor(c / NAVALE_SIZE) + 1}`;

export const battaglia: Game<NavaleState, NavaleMove, NavaleView> = {
  meta: {
    id: 'battaglia',
    name: 'Battaglia navale',
    category: 'tavolo',
    minPlayers: 2,
    maxPlayers: 2,
    emoji: '🚢',
    color: '#56B4E9',
    tagline: 'Trova la flotta nemica e affondala',
    rules: [
      'Griglia 10×10. Ognuno schiera di nascosto la sua flotta: navi da 5, 4, 3, 3 e 2 caselle.',
      'Tocca una casella per mettere la nave, usa Ruota per girarla oppure A caso per farlo in un tocco.',
      'A turno si spara un colpo sulla griglia avversaria: acqua, colpito o affondato.',
      'Vince chi affonda per primo tutta la flotta nemica.',
    ],
    hiddenInfo: true,
    minutes: 15,
  },
  setup({ seed }) {
    return { rng: seed, phase: 'place', fleets: [null, null], shots: [[], []], turn: 0, last: null, winner: null };
  },
  activePlayers(s) {
    if (s.winner !== null) return [];
    if (s.phase === 'place') return [0, 1].filter((p) => !s.fleets[p]);
    return [s.turn];
  },
  play(s, seat, move) {
    if (move.type === 'place') {
      assert(s.phase === 'place' && !s.fleets[seat], 'La flotta è già schierata.');
      assert(validFleet(move.ships), 'La flotta non è completa o le navi si sovrappongono.');
      s.fleets[seat] = move.ships.map((m) => ({ x: m.x, y: m.y, len: m.len, h: !!m.h }));
      if (s.fleets.every(Boolean)) s.phase = 'battle';
      return;
    }
    assert(s.phase === 'battle', 'Prima si schierano le flotte.');
    const { cell } = move;
    assert(Number.isInteger(cell) && cell >= 0 && cell < NAVALE_SIZE * NAVALE_SIZE, 'Casella inesistente.');
    assert(!s.shots[seat].includes(cell), 'Qui hai già sparato.');
    s.shots[seat].push(cell);
    // Il computer tira a caso a ogni colpo: i numeri della partita devono andare avanti.
    random(s);
    const enemy = 1 - seat;
    const ship = s.fleets[enemy]!.find((f) => shipCells(f).includes(cell));
    const fired = new Set(s.shots[seat]);
    const sunk = !!ship && shipCells(ship).every((c) => fired.has(c));
    s.last = { seat, cell, outcome: !ship ? 'acqua' : sunk ? 'affondato' : 'colpito', len: sunk ? ship.len : undefined };
    if (s.fleets[enemy]!.flatMap(shipCells).every((c) => fired.has(c))) s.winner = seat;
    else s.turn = enemy;
  },
  view(s, seat) {
    return {
      phase: s.phase,
      turn: s.turn,
      winner: s.winner,
      last: s.last,
      ready: s.fleets.map(Boolean),
      myFleet: seat === null ? null : s.fleets[seat],
      seas: [seaOf(s, 0), seaOf(s, 1)],
      revealed: s.winner !== null ? s.fleets : null,
    };
  },
  result(s) {
    if (s.winner === null) return null;
    const scores = [0, 1].map((p) => seaOf(s, 1 - p).sunk.length);
    return { winners: [s.winner], scores, summary: 'Navi affondate' };
  },
  bot(s, seat) {
    if (s.phase === 'place') return { type: 'place', ships: randomFleet(() => random(s)) };
    return { type: 'shot', cell: aim(s, seaOf(s, 1 - seat)) };
  },
  pause: (s) => (s.phase === 'place' ? 400 : 1600),
};
