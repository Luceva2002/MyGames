/**
 * Fisica del biliardo, deterministica: solo somme, prodotti e radici, così il telefono può
 * rigiocare il tiro in animazione e ottenere esattamente quello che ha calcolato il server.
 * Tavolo: x da 0 a 2, y da 0 a 1.
 */
export const TABLE_W = 2;
export const TABLE_H = 1;
export const BALL_R = 0.0225;
export const POCKETS = [
  { x: 0, y: 0, r: 0.062 },
  { x: 1, y: -0.012, r: 0.052 },
  { x: 2, y: 0, r: 0.062 },
  { x: 0, y: 1, r: 0.062 },
  { x: 1, y: 1.012, r: 0.052 },
  { x: 2, y: 1, r: 0.062 },
];
export const MAX_SPEED = 5.5;

// Passo piccolo e più giri di urti per passo: le palline del triangolo si passano la spinta
// in modo pulito, invece di incastrarsi o "scivolare" una sull'altra.
const DT = 1 / 960;
const FRICTION = 0.38;
const CUSHION = 0.78;
const MAX_STEPS = 960 * 25;
const FRAME_EVERY = 16;
// Contatto fra palline: durata di circa 6 passi, rimbalzo come avorio/resina (e ≈ 0.93).
const STIFFNESS = 126000;
const DAMPING = 23;

export interface Ball {
  id: number;
  x: number;
  y: number;
  /** In buca. */
  in: boolean;
}

export interface Shot {
  dx: number;
  dy: number;
  /** 0..1 */
  power: number;
}

export interface ShotOutcome {
  balls: Ball[];
  firstHit: number | null;
  pocketed: number[];
  cushionAfterContact: boolean;
  /** Posizioni (x, y per ogni pallina, nell'ordine dell'array) a 60 fotogrammi al secondo. */
  frames: number[][] | null;
  /** Cosa succede e in quale fotogramma (per i suoni): urto fra palline, sponda, buca; v è la forza 0..1. */
  events: { frame: number; kind: 'hit' | 'cushion' | 'pocket'; v: number }[] | null;
}

export function simulateShot(start: Ball[], shot: Shot, recordFrames = false): ShotOutcome {
  const balls = start.map((b) => ({ ...b, vx: 0, vy: 0 }));
  const cue = balls.find((b) => b.id === 0)!;
  const len = Math.sqrt(shot.dx * shot.dx + shot.dy * shot.dy) || 1;
  const power = Math.max(0.02, Math.min(1, shot.power));
  cue.vx = (shot.dx / len) * power * MAX_SPEED;
  cue.vy = (shot.dy / len) * power * MAX_SPEED;
  let firstHit: number | null = null;
  const pocketed: number[] = [];
  let cushionAfterContact = false;
  const touching = new Set<number>();
  const frames: number[][] | null = recordFrames ? [] : null;
  const events: ShotOutcome['events'] = recordFrames ? [] : null;
  const note = (kind: 'hit' | 'cushion' | 'pocket', v: number) => {
    if (!events || !frames) return;
    const frame = frames.length;
    // Un solo suono per tipo e fotogramma, il più forte.
    const same = events.find((e) => e.frame === frame && e.kind === kind);
    if (same) same.v = Math.max(same.v, v);
    else events.push({ frame, kind, v: Math.min(1, v) });
  };
  const snap = () => frames?.push(balls.flatMap((b) => (b.in ? [-1, -1] : [Math.round(b.x * 10000) / 10000, Math.round(b.y * 10000) / 10000])));
  snap();

  for (let step = 0; step < MAX_STEPS; step++) {
    let moving = false;
    for (const b of balls) {
      if (b.in) continue;
      const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (sp === 0) continue;
      const next = sp - FRICTION * DT;
      if (next <= 0.002) {
        b.vx = 0;
        b.vy = 0;
        continue;
      }
      moving = true;
      b.vx = (b.vx / sp) * next;
      b.vy = (b.vy / sp) * next;
      b.x += b.vx * DT;
      b.y += b.vy * DT;
    }
    // Buche
    for (const b of balls) {
      if (b.in) continue;
      for (const p of POCKETS) {
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        if (dx * dx + dy * dy < p.r * p.r) {
          b.in = true;
          b.vx = 0;
          b.vy = 0;
          pocketed.push(b.id);
          note('pocket', 1);
          break;
        }
      }
    }
    // Urti fra palline: contatto "morbido" (una molla rigidissima con un filo di smorzamento),
    // calcolato per tutte le coppie insieme. Così nel triangolo la spinta si divide fra le palline
    // e il gruppo si apre, invece di passare tutta all'ultima come nel pendolo di Newton.
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (a.in) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        if (b.in) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        const key = i * 64 + j;
        if (d2 >= 4 * BALL_R * BALL_R || d2 === 0) {
          touching.delete(key);
          continue;
        }
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        const approach = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        const f = STIFFNESS * (2 * BALL_R - d) + DAMPING * approach;
        if (f > 0) {
          a.vx -= f * DT * nx;
          a.vy -= f * DT * ny;
          b.vx += f * DT * nx;
          b.vy += f * DT * ny;
          moving = true;
        }
        if (!touching.has(key)) {
          touching.add(key);
          if (approach > 0) {
            if (firstHit === null && (a.id === 0 || b.id === 0)) firstHit = a.id === 0 ? b.id : a.id;
            note('hit', approach / MAX_SPEED);
          }
        }
      }
    }
    // Sponde
    for (const b of balls) {
      if (b.in) continue;
      let hit = false;
      if (b.x < BALL_R) {
        b.x = BALL_R + (BALL_R - b.x);
        b.vx = -b.vx * CUSHION;
        hit = true;
      } else if (b.x > TABLE_W - BALL_R) {
        b.x = TABLE_W - BALL_R - (b.x - (TABLE_W - BALL_R));
        b.vx = -b.vx * CUSHION;
        hit = true;
      }
      if (b.y < BALL_R) {
        b.y = BALL_R + (BALL_R - b.y);
        b.vy = -b.vy * CUSHION;
        hit = true;
      } else if (b.y > TABLE_H - BALL_R) {
        b.y = TABLE_H - BALL_R - (b.y - (TABLE_H - BALL_R));
        b.vy = -b.vy * CUSHION;
        hit = true;
      }
      if (hit) note('cushion', Math.sqrt(b.vx * b.vx + b.vy * b.vy) / MAX_SPEED);
      if (hit && firstHit !== null) cushionAfterContact = true;
    }
    if (step % FRAME_EVERY === 0) snap();
    if (!moving) break;
  }
  snap();
  return { balls: balls.map(({ id, x, y, in: inn }) => ({ id, x, y, in: inn })), firstHit, pocketed, cushionAfterContact, frames, events };
}

/** Il punto dove mettere la bianca è libero? */
export function spotFree(balls: Ball[], x: number, y: number, ignore = 0): boolean {
  if (x < BALL_R || x > TABLE_W - BALL_R || y < BALL_R || y > TABLE_H - BALL_R) return false;
  return balls.every((b) => b.in || b.id === ignore || (b.x - x) ** 2 + (b.y - y) ** 2 >= 4 * BALL_R * BALL_R);
}
