import { assert, type Game, type Seat } from '../core/types';
import { random, type HasRng } from '../core/rng';

/** Ordine dei settori in senso orario partendo dall'alto. */
export const DART_SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
/** Raggi del bersaglio regolamentare, normalizzati sul bordo esterno del doppio (=1). */
export const DART_RINGS = { bull: 0.037, outerBull: 0.094, trebleIn: 0.582, trebleOut: 0.629, doubleIn: 0.953, doubleOut: 1 };

export interface DartHit {
  x: number;
  y: number;
  score: number;
  label: string;
  /** Moltiplicatore: 2 per il doppio e il centro, serve per la chiusura in doppio. */
  mult: number;
}

/** Punteggio di una freccetta che arriva in (x, y), con y verso il basso come sullo schermo. */
export function scoreDart(x: number, y: number): DartHit {
  const r = Math.hypot(x, y);
  if (r <= DART_RINGS.bull) return { x, y, score: 50, label: 'Centro!', mult: 2 };
  if (r <= DART_RINGS.outerBull) return { x, y, score: 25, label: '25', mult: 1 };
  if (r > DART_RINGS.doubleOut) return { x, y, score: 0, label: 'Fuori', mult: 0 };
  // Angolo in senso orario dall'alto.
  let deg = (Math.atan2(x, -y) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  const sector = DART_SECTORS[Math.floor(((deg + 9) % 360) / 18)];
  if (r >= DART_RINGS.trebleIn && r <= DART_RINGS.trebleOut) return { x, y, score: sector * 3, label: `T${sector}`, mult: 3 };
  if (r >= DART_RINGS.doubleIn) return { x, y, score: sector * 2, label: `D${sector}`, mult: 2 };
  return { x, y, score: sector, label: String(sector), mult: 1 };
}

/** Centro di un bersaglio (settore e anello) per chi deve mirare, es. il computer. */
export function aimPoint(sector: number, ring: 'single' | 'treble' | 'double' | 'bull'): { x: number; y: number } {
  if (ring === 'bull') return { x: 0, y: 0 };
  const i = DART_SECTORS.indexOf(sector);
  const r = ring === 'treble' ? 0.605 : ring === 'double' ? 0.976 : 0.8;
  const a = (i * 18 * Math.PI) / 180;
  return { x: Math.sin(a) * r, y: -Math.cos(a) * r };
}

function gauss(s: HasRng): number {
  const u = Math.max(random(s), 1e-9);
  const v = random(s);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface FreccetteState extends HasRng {
  players: number;
  start: number;
  doubleOut: boolean;
  remaining: number[];
  turn: Seat;
  darts: DartHit[];
  turnStart: number;
  /** L'ultimo turno completo di ognuno, per mostrarlo sul tabellone. */
  lastTurn: { seat: Seat; darts: DartHit[]; bust: boolean } | null;
  winner: Seat | null;
  round: number;
  maxRounds: number;
}

export type FreccetteMove = { aim: { x: number; y: number } };

const PLAYER_SPREAD = 0.035;
const BOT_SPREAD = 0.13;

export const freccette: Game<FreccetteState, FreccetteMove, FreccetteState, { start?: number; doubleOut?: boolean }> = {
  meta: {
    id: 'freccette',
    name: 'Freccette',
    category: 'abilita',
    minPlayers: 1,
    maxPlayers: 8,
    emoji: '🎯',
    color: '#D84315',
    tagline: '301: azzera il punteggio per primo',
    rules: [
      'Ognuno parte da 301 punti e a ogni turno tira tre freccette: il mirino ondeggia, tocca per lanciare al momento giusto.',
      'Il punteggio di ogni freccetta si sottrae. Anello esterno doppio, anello interno triplo, centro 50.',
      'Se vai sotto zero il turno non vale (sballato). Vince chi arriva esattamente a zero.',
    ],
    hiddenInfo: false,
    minutes: 10,
  },
  setup({ players, seed, options }) {
    const start = options?.start ?? 301;
    return {
      rng: seed,
      players,
      start,
      doubleOut: options?.doubleOut ?? false,
      remaining: Array(players).fill(start),
      turn: 0,
      darts: [],
      turnStart: start,
      lastTurn: null,
      winner: null,
      round: 0,
      maxRounds: 20,
    };
  },
  activePlayers: (s) => (s.winner === null && s.round < s.maxRounds ? [s.turn] : []),
  play(s, seat, { aim }) {
    assert(Number.isFinite(aim?.x) && Number.isFinite(aim?.y), 'Mira non valida.');
    const x = Math.max(-1.4, Math.min(1.4, aim.x)) + gauss(s) * PLAYER_SPREAD;
    const y = Math.max(-1.4, Math.min(1.4, aim.y)) + gauss(s) * PLAYER_SPREAD;
    const hit = scoreDart(x, y);
    s.darts.push(hit);
    const left = s.remaining[seat] - hit.score;
    const bust = left < 0 || (s.doubleOut && (left === 1 || (left === 0 && hit.mult !== 2)));
    if (bust) {
      s.remaining[seat] = s.turnStart;
      endTurn(s, seat, true);
      return;
    }
    s.remaining[seat] = left;
    if (left === 0) {
      s.winner = seat;
      s.lastTurn = { seat, darts: s.darts, bust: false };
      return;
    }
    if (s.darts.length === 3) endTurn(s, seat, false);
  },
  view: (s) => s,
  result(s) {
    if (s.winner !== null) return { winners: [s.winner], scores: s.remaining, summary: s.players === 1 ? `Chiuso in ${s.round + 1} turni` : 'Punti rimasti' };
    if (s.round < s.maxRounds) return null;
    const best = Math.min(...s.remaining);
    return { winners: s.remaining.flatMap((r, p) => (r === best ? [p] : [])), scores: s.remaining, summary: 'Turni finiti: vince chi è più vicino a zero' };
  },
  bot(s, seat) {
    const left = s.remaining[seat];
    let target = aimPoint(20, 'treble');
    if (left <= 60) {
      // Prova a chiudere: singolo, doppio o triplo che porta esattamente a zero.
      if (left <= 20) target = aimPoint(left, 'single');
      else if (left === 25 || left === 50) target = aimPoint(20, 'bull');
      else if (left % 2 === 0 && left <= 40) target = aimPoint(left / 2, 'double');
      else if (left % 3 === 0) target = aimPoint(left / 3, 'treble');
      else target = aimPoint(Math.min(20, left - 20 > 0 ? 20 : left), 'single');
    }
    return { aim: { x: target.x + gauss(s) * BOT_SPREAD, y: target.y + gauss(s) * BOT_SPREAD } };
  },
};

function endTurn(s: FreccetteState, seat: Seat, bust: boolean) {
  s.lastTurn = { seat, darts: s.darts, bust };
  s.darts = [];
  s.turn = (seat + 1) % s.players;
  if (s.turn === 0) s.round++;
  s.turnStart = s.remaining[s.turn];
}
