import { assert, type Game, type Seat } from '../core/types';
import { random, type HasRng } from '../core/rng';

/**
 * Rigori a turno: uno tira, l'altro para, poi ci si scambia. Si sceglie in segreto e in contemporanea:
 * chi tira mira un punto della porta, il portiere sceglie dove tuffarsi.
 * Porta: x da -1 (palo sinistro) a 1 (palo destro), y da 0 (terra) a 1 (traversa).
 */
export interface Kick {
  shooter: Seat;
  aim: { x: number; y: number };
  ball: { x: number; y: number };
  dive: { x: number; y: number };
  outcome: 'gol' | 'parata' | 'fuori' | 'palo';
}

export interface FootballState extends HasRng {
  kicks: Kick[];
  /** Scelte segrete del tiro in corso. */
  pendingAim: { x: number; y: number } | null;
  pendingDive: { x: number; y: number } | null;
  regulation: number;
  done: boolean;
}

export type FootballMove = { aim: { x: number; y: number }; power?: number } | { dive: { x: number; y: number } };

export interface FootballView {
  kicks: Kick[];
  shooter: Seat;
  keeper: Seat;
  me: Seat | null;
  /** Hai già scelto per questo tiro: aspetti l'altro. */
  waiting: boolean[];
  goals: [number, number];
  regulation: number;
  suddenDeath: boolean;
}

const KEEPER_REACH = 0.42;
const SPREAD = 0.09;

function goals(s: FootballState): [number, number] {
  const g: [number, number] = [0, 0];
  for (const k of s.kicks) if (k.outcome === 'gol') g[k.shooter]++;
  return g;
}

function shooterOf(s: FootballState): Seat {
  return s.kicks.length % 2 === 0 ? 0 : 1;
}

function decided(s: FootballState): boolean {
  const [a, b] = goals(s);
  const taken = [0, 0];
  for (const k of s.kicks) taken[k.shooter]++;
  const n = s.regulation;
  if (taken[0] <= n && taken[1] <= n) {
    // Durante i cinque rigori: finisce se uno non può più essere raggiunto.
    const leftA = n - taken[0];
    const leftB = n - taken[1];
    if (a + leftA < b || b + leftB < a) return true;
    if (taken[0] === n && taken[1] === n) return a !== b;
    return false;
  }
  // Ad oltranza: si decide dopo ogni coppia di tiri.
  return taken[0] === taken[1] && a !== b;
}

function resolve(s: FootballState) {
  const aim = s.pendingAim!;
  const dive = s.pendingDive!;
  const g = () => {
    const u = Math.max(random(s), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random(s));
  };
  // Più miri all'angolo, più rischi: la dispersione cresce vicino ai pali e alla traversa.
  const edge = Math.max(Math.abs(aim.x), aim.y);
  const spread = SPREAD * (0.6 + edge);
  const ball = { x: aim.x + g() * spread, y: Math.max(0, aim.y + g() * spread) };
  let outcome: Kick['outcome'];
  if (Math.abs(ball.x) > 1.04 || ball.y > 1.04) outcome = 'fuori';
  else if (Math.abs(ball.x) > 0.97 || ball.y > 0.97) outcome = 'palo';
  else if (Math.hypot((ball.x - dive.x) * 1, (ball.y - dive.y) * 1.3) < KEEPER_REACH) outcome = 'parata';
  else outcome = 'gol';
  s.kicks.push({ shooter: shooterOf(s), aim, ball, dive, outcome });
  s.pendingAim = null;
  s.pendingDive = null;
  s.done = decided(s);
}

export const football: Game<FootballState, FootballMove, FootballView> = {
  meta: {
    id: 'football',
    name: 'Football Strike',
    category: 'abilita',
    minPlayers: 2,
    maxPlayers: 2,
    emoji: '⚽',
    color: '#43A047',
    tagline: 'Rigori uno contro uno: tira e para',
    rules: [
      'Cinque rigori a testa, a turno: quando tiri scegli il punto della porta, quando pari scegli dove tuffarti.',
      'Le scelte sono segrete e contemporanee: nessuno vede quella dell’altro.',
      'Angoli e incrocio sono imprendibili ma rischi il palo o di tirare fuori.',
      'In parità dopo cinque si va ad oltranza.',
    ],
    hiddenInfo: true,
    minutes: 5,
  },
  setup({ seed }) {
    return { rng: seed, kicks: [], pendingAim: null, pendingDive: null, regulation: 5, done: false };
  },
  activePlayers(s) {
    if (s.done) return [];
    const shooter = shooterOf(s);
    const out: Seat[] = [];
    if (!s.pendingAim) out.push(shooter);
    if (!s.pendingDive) out.push(1 - shooter);
    return out;
  },
  play(s, seat, move) {
    const shooter = shooterOf(s);
    if ('aim' in move) {
      assert(seat === shooter && !s.pendingAim, 'Adesso non tiri tu.');
      s.pendingAim = { x: Math.max(-1.3, Math.min(1.3, move.aim.x)), y: Math.max(0, Math.min(1.3, move.aim.y)) };
    } else {
      assert(seat !== shooter && !s.pendingDive, 'Adesso non pari tu.');
      s.pendingDive = { x: Math.max(-1, Math.min(1, move.dive.x)), y: Math.max(0, Math.min(1, move.dive.y)) };
    }
    if (s.pendingAim && s.pendingDive) resolve(s);
  },
  pause: (s) => (s.kicks.length && !s.pendingAim && !s.pendingDive ? 1800 : 700),
  view(s, me) {
    const shooter = shooterOf(s);
    const taken = s.kicks.length;
    return {
      kicks: s.kicks,
      shooter,
      keeper: 1 - shooter,
      me,
      waiting: [shooter === 0 ? !!s.pendingAim : !!s.pendingDive, shooter === 1 ? !!s.pendingAim : !!s.pendingDive],
      goals: goals(s),
      regulation: s.regulation,
      suddenDeath: taken >= s.regulation * 2,
    };
  },
  result(s) {
    if (!s.done) return null;
    const g = goals(s);
    return { winners: [g[0] > g[1] ? 0 : 1], scores: g, summary: `${g[0]} a ${g[1]} ai rigori` };
  },
  bot(s, seat) {
    const shooter = shooterOf(s);
    if (seat === shooter) {
      const x = (random(s) < 0.5 ? -1 : 1) * (0.45 + random(s) * 0.4);
      return { aim: { x, y: 0.15 + random(s) * 0.6 } };
    }
    return { dive: { x: (random(s) * 2 - 1) * 0.75, y: 0.2 + random(s) * 0.5 } };
  },
};
