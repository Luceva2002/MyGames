import { assert, type Game, type Seat } from '../core/types';
import { random, shuffle, type HasRng } from '../core/rng';
import { BALL_R, POCKETS, simulateShot, spotFree, TABLE_H, type Ball, type Shot } from '../physics/pool';

export type PoolGroup = 'piene' | 'mezze';

export interface BiliardoState extends HasRng {
  balls: Ball[];
  turn: Seat;
  groups: (PoolGroup | null)[];
  ballInHand: boolean;
  shots: number;
  /** Ultimo tiro: posizioni di partenza e tiro, per rigiocarlo in animazione. */
  lastShot: { id: number; seat: Seat; before: Ball[]; shot: Shot; text: string } | null;
  winner: Seat | null;
  over: boolean;
  reason: string | null;
}

export type BiliardoMove = { type: 'place'; x: number; y: number } | { type: 'shoot'; dx: number; dy: number; power: number };

const HEAD = { x: 0.5, y: 0.5 };
const FOOT = { x: 1.5, y: 0.5 };
const MAX_SHOTS = 300;

export const isSolid = (id: number) => id >= 1 && id <= 7;
export const isStripe = (id: number) => id >= 9 && id <= 15;
const groupOf = (id: number): PoolGroup | null => (isSolid(id) ? 'piene' : isStripe(id) ? 'mezze' : null);

function ownLeft(s: BiliardoState, seat: Seat): number {
  const g = s.groups[seat];
  if (!g) return 7;
  return s.balls.filter((b) => !b.in && groupOf(b.id) === g).length;
}

function rack(s: BiliardoState): Ball[] {
  const others = shuffle(s, [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15]);
  const balls: Ball[] = [{ id: 0, x: HEAD.x, y: HEAD.y, in: false }];
  const gap = BALL_R * 2 + 0.0004;
  let k = 0;
  for (let row = 0; row < 5; row++) {
    for (let j = 0; j <= row; j++) {
      const id = row === 2 && j === 1 ? 8 : others[k++];
      balls.push({ id, x: FOOT.x + row * gap * 0.866, y: FOOT.y + (j - row / 2) * gap, in: false });
    }
  }
  return balls;
}

function respawnCue(s: BiliardoState) {
  const cue = s.balls.find((b) => b.id === 0)!;
  cue.in = false;
  for (let i = 0; i < 40; i++) {
    const y = HEAD.y + ((i % 2 ? 1 : -1) * Math.ceil(i / 2) * BALL_R * 2.2);
    if (spotFree(s.balls, HEAD.x, y)) {
      cue.x = HEAD.x;
      cue.y = y;
      return;
    }
  }
}

export const biliardo: Game<BiliardoState, BiliardoMove, BiliardoState> = {
  meta: {
    id: 'biliardo',
    name: 'Biliardo',
    category: 'abilita',
    minPlayers: 2,
    maxPlayers: 2,
    emoji: '🎱',
    color: '#00695C',
    tagline: 'Palla 8: piene contro mezze',
    rules: [
      'Il primo che manda in buca una pallina (dopo l’apertura) prende quel gruppo: piene (1-7) o mezze (9-15).',
      'Trascina sul tavolo per mirare, scegli la forza e tira. Se imbuchi una tua pallina tiri ancora.',
      'Fallo se la bianca va in buca, se non tocchi niente o se tocchi prima una pallina dell’altro: l’avversario può spostare la bianca dove vuole.',
      'Imbucate tutte le tue, vince chi manda in buca la nera. Se la nera cade prima, perdi.',
    ],
    hiddenInfo: false,
    minutes: 10,
  },
  setup({ seed }) {
    const s = { rng: seed, turn: 0, groups: [null, null], ballInHand: false, shots: 0, lastShot: null, winner: null, over: false, reason: null } as unknown as BiliardoState;
    s.balls = rack(s);
    return s;
  },
  activePlayers: (s) => (s.over ? [] : [s.turn]),
  play(s, seat, move) {
    if (move.type === 'place') {
      assert(s.ballInHand, 'Puoi spostare la bianca solo dopo un fallo dell’avversario.');
      assert(Number.isFinite(move.x) && Number.isFinite(move.y) && spotFree(s.balls, move.x, move.y), 'Lì non c’è posto per la bianca.');
      const cue = s.balls.find((b) => b.id === 0)!;
      cue.x = move.x;
      cue.y = move.y;
      return;
    }
    assert(Number.isFinite(move.dx) && Number.isFinite(move.dy) && (move.dx !== 0 || move.dy !== 0), 'Direzione non valida.');
    const shot: Shot = { dx: move.dx, dy: move.dy, power: Math.max(0.05, Math.min(1, move.power)) };
    const before = s.balls.map((b) => ({ ...b }));
    const out = simulateShot(before, shot);
    s.balls = out.balls;
    s.ballInHand = false;
    s.shots++;
    const other = 1 - seat;
    const myGroup = s.groups[seat];
    const clearedBefore = myGroup !== null && before.filter((b) => !b.in && groupOf(b.id) === myGroup).length === 0;
    const cueIn = out.pocketed.includes(0);
    const eightIn = out.pocketed.includes(8);
    let foul = cueIn || out.firstHit === null;
    if (!foul && out.firstHit !== null) {
      if (myGroup === null) foul = out.firstHit === 8;
      else if (clearedBefore) foul = out.firstHit !== 8;
      else foul = groupOf(out.firstHit) !== myGroup;
    }
    const names = out.pocketed.filter((id) => id !== 0);
    let text = names.length ? `imbuca ${names.join(', ')}` : 'nessuna in buca';
    if (eightIn) {
      const win = clearedBefore && !foul;
      s.winner = win ? seat : other;
      s.over = true;
      s.reason = win ? 'Nera in buca: partita vinta!' : 'Nera in buca troppo presto';
      s.lastShot = { id: s.shots, seat, before, shot, text: win ? 'imbuca la nera!' : 'imbuca la nera… troppo presto' };
      return;
    }
    if (myGroup === null && !foul) {
      const first = names.map(groupOf).find((g) => g !== null);
      if (first) {
        s.groups[seat] = first;
        s.groups[other] = first === 'piene' ? 'mezze' : 'piene';
        text += ` e prende le ${first}`;
      }
    }
    const scoredOwn = !foul && s.groups[seat] !== null && names.some((id) => groupOf(id) === s.groups[seat]);
    if (cueIn) respawnCue(s);
    if (foul) {
      text = `fallo${cueIn ? ' (bianca in buca)' : out.firstHit === null ? ' (non tocca niente)' : ''}`;
      s.ballInHand = true;
      s.turn = other;
    } else if (!scoredOwn) s.turn = other;
    s.lastShot = { id: s.shots, seat, before, shot, text };
    if (s.shots >= MAX_SHOTS) {
      const left = [ownLeft(s, 0), ownLeft(s, 1)];
      s.winner = left[0] < left[1] ? 0 : left[1] < left[0] ? 1 : null;
      s.reason = 'Troppi tiri: vince chi ha meno palline';
      s.over = true;
    }
  },
  view: (s) => s,
  pause(s) {
    if (!s.lastShot) return 900;
    const frames = simulateShot(s.lastShot.before, s.lastShot.shot, true).frames!.length;
    return (frames / 60) * 1000 + 900;
  },
  result(s) {
    if (!s.over) return null;
    return { winners: s.winner === null ? [] : [s.winner], summary: s.reason ?? '' };
  },
  bot(s, seat) {
    const cue = s.balls.find((b) => b.id === 0)!;
    const myGroup = s.groups[seat];
    const cleared = myGroup !== null && ownLeft(s, seat) === 0;
    const targets = s.balls.filter((b) => !b.in && b.id !== 0 && (cleared ? b.id === 8 : b.id !== 8 && (myGroup === null || groupOf(b.id) === myGroup)));
    const blocked = (ax: number, ay: number, bx: number, by: number, skip: number[]) =>
      s.balls.some((o) => {
        if (o.in || skip.includes(o.id)) return false;
        const vx = bx - ax;
        const vy = by - ay;
        const l2 = vx * vx + vy * vy;
        const t = Math.max(0, Math.min(1, ((o.x - ax) * vx + (o.y - ay) * vy) / l2));
        const px = ax + vx * t - o.x;
        const py = ay + vy * t - o.y;
        return px * px + py * py < 4 * BALL_R * BALL_R;
      });
    let best: { score: number; dx: number; dy: number; dist: number } | null = null;
    for (const t of targets) {
      for (const p of POCKETS) {
        const px = p.x - t.x;
        const py = (p.y < 0 ? 0 : p.y > TABLE_H ? TABLE_H : p.y) - t.y;
        const pl = Math.hypot(px, py);
        const gx = t.x - (px / pl) * BALL_R * 2;
        const gy = t.y - (py / pl) * BALL_R * 2;
        const cx = gx - cue.x;
        const cy = gy - cue.y;
        const cl = Math.hypot(cx, cy);
        const cos = (cx * px + cy * py) / (cl * pl);
        if (cos < 0.35) continue;
        if (blocked(cue.x, cue.y, gx, gy, [0, t.id]) || blocked(t.x, t.y, p.x, p.y, [t.id])) continue;
        const score = cos * 2 - (cl + pl) * 0.4;
        if (!best || score > best.score) best = { score, dx: cx, dy: cy, dist: cl + pl };
      }
    }
    const noise = () => (random(s) - 0.5) * 0.03;
    if (s.shots === 0) return { type: 'shoot', dx: 1, dy: noise(), power: 0.95 };
    if (best) {
      const l = Math.hypot(best.dx, best.dy);
      return { type: 'shoot', dx: best.dx / l + noise(), dy: best.dy / l + noise(), power: Math.min(0.9, 0.25 + best.dist * 0.22) };
    }
    const t = targets.sort((a, b) => Math.hypot(a.x - cue.x, a.y - cue.y) - Math.hypot(b.x - cue.x, b.y - cue.y))[0] ?? s.balls.find((b) => !b.in && b.id !== 0)!;
    return { type: 'shoot', dx: t.x - cue.x + noise(), dy: t.y - cue.y + noise(), power: 0.5 };
  },
};
