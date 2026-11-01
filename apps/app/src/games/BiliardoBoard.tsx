import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Image, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { BALL_R, isSolid, isStripe, POCKETS, simulateShot, TABLE_H, TABLE_W, type Ball, type BiliardoMove, type BiliardoState } from '@giochi/engine';
import { Banner, type BoardProps } from './common';
import { Chip, Row, SeatDot, T } from '../ui/kit';
import { TableBg, TABLES } from '../ui/tables';
import { colors } from '../ui/theme';
import { useReducedMotion } from '../ui/settings';
import { sfx } from '../ui/sound';

const BALL_COLORS: Record<number, string> = {
  0: '#FAFAF2', 1: '#F9C80E', 2: '#1E5BC6', 3: '#D7263D', 4: '#6A2C91', 5: '#F86624', 6: '#1B998B', 7: '#7B2D26', 8: '#151515',
};
const colorOf = (id: number) => BALL_COLORS[id > 8 ? id - 8 : id];

// --- Rotolamento -------------------------------------------------------------------------------
// Ogni pallina ha un orientamento in 3D: il polo del numero (n) e, per le mezze, l'asse delle
// due calotte bianche (c). Rotolando di una distanza d gira di d/R attorno all'asse perpendicolare
// al moto: così numero e fascia scorrono sotto la luce come su un tavolo vero.

type V3 = [number, number, number];
type Spin = { n: V3; c: V3 };

function rotate(v: V3, k: V3, a: number): V3 {
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dot = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const cx = k[1] * v[2] - k[2] * v[1];
  const cy = k[2] * v[0] - k[0] * v[2];
  const cz = k[0] * v[1] - k[1] * v[0];
  return [v[0] * cos + cx * sin + k[0] * dot * (1 - cos), v[1] * cos + cy * sin + k[1] * dot * (1 - cos), v[2] * cos + cz * sin + k[2] * dot * (1 - cos)];
}

function roll(s: Spin, dx: number, dy: number): Spin {
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return s;
  const k: V3 = [-dy / d, dx / d, 0];
  const a = d / BALL_R;
  return { n: rotate(s.n, k, a), c: rotate(s.c, k, a) };
}

const REST: Spin = { n: [0, 0, 1], c: [1, 0, 0] };

/**
 * Calotta sferica (attorno all'asse a, ampiezza theta) vista dall'alto, in pixel dal centro.
 * La parte che finisce dietro la pallina si schiaccia sul bordo, quindi resta solo quella visibile.
 */
function capPath(a: V3, theta: number, r: number) {
  if (Math.acos(Math.max(-1, Math.min(1, a[2]))) > Math.PI / 2 + theta) return null;
  const t: V3 = Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  let u: V3 = [a[1] * t[2] - a[2] * t[1], a[2] * t[0] - a[0] * t[2], a[0] * t[1] - a[1] * t[0]];
  const ul = Math.hypot(...u);
  u = [u[0] / ul, u[1] / ul, u[2] / ul];
  const w: V3 = [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]];
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  let d = '';
  for (let i = 0; i < 24; i++) {
    const f = (i / 24) * Math.PI * 2;
    let x = a[0] * ct + st * (u[0] * Math.cos(f) + w[0] * Math.sin(f));
    let y = a[1] * ct + st * (u[1] * Math.cos(f) + w[1] * Math.sin(f));
    const z = a[2] * ct + st * (u[2] * Math.cos(f) + w[2] * Math.sin(f));
    if (z < 0) {
      const l = Math.hypot(x, y) || 1;
      x /= l;
      y /= l;
    }
    d += `${i ? 'L' : 'M'}${(x * r).toFixed(2)} ${(y * r).toFixed(2)}`;
  }
  return d + 'Z';
}

function PoolBall({ id, x, y, r, spin, upright, opacity = 1 }: { id: number; x: number; y: number; r: number; spin: Spin; upright: boolean; opacity?: number }) {
  const stripe = isStripe(id);
  const n = spin.n;
  const disc = id === 0 ? null : capPath(n, 0.5, r);
  const caps = stripe ? [capPath(spin.c, 0.86, r), capPath([-spin.c[0], -spin.c[1], -spin.c[2]], 0.86, r)] : [];
  const showNum = id !== 0 && n[2] > 0.42 && r > 6.5;
  const nx = n[0] * r * 0.9;
  const ny = n[1] * r * 0.9;
  return (
    <G transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`} opacity={opacity}>
      <Circle r={r} fill={colorOf(id)} />
      {caps.map((d, i) => d && <Path key={i} d={d} fill="#FAFAF2" />)}
      {disc && <Path d={disc} fill="#FFFFFF" />}
      {showNum && (
        // Il numero resta dritto per chi guarda, anche col tavolo girato.
        <G transform={`translate(${nx.toFixed(2)} ${ny.toFixed(2)})${upright ? ' rotate(90)' : ''}`} opacity={Math.min(1, (n[2] - 0.42) * 4)}>
          <SvgText x={0} y={r * 0.24} fontSize={r * 0.68} fontWeight="900" fill="#151515" textAnchor="middle">
            {id}
          </SvgText>
        </G>
      )}
      <Circle r={r} fill="url(#shade)" />
      <Circle r={r} fill="none" stroke={colors.line} strokeWidth={Math.max(1, r * 0.12)} />
    </G>
  );
}

// --- Mira ---------------------------------------------------------------------------------------

/** Dove la bianca tocca per prima qualcosa, e quale pallina, per disegnare la linea di mira. */
function aimGuide(balls: Ball[], cue: Ball, dx: number, dy: number) {
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  let best = Infinity;
  let target: Ball | null = null;
  for (const b of balls) {
    if (b.in || b.id === 0) continue;
    const fx = b.x - cue.x;
    const fy = b.y - cue.y;
    const proj = fx * ux + fy * uy;
    if (proj <= 0) continue;
    const perp2 = fx * fx + fy * fy - proj * proj;
    const r2 = 4 * BALL_R * BALL_R;
    if (perp2 > r2) continue;
    const t = proj - Math.sqrt(r2 - perp2);
    if (t < best) {
      best = t;
      target = b;
    }
  }
  const wall = Math.min(
    ux > 0 ? (TABLE_W - BALL_R - cue.x) / ux : ux < 0 ? (BALL_R - cue.x) / ux : Infinity,
    uy > 0 ? (TABLE_H - BALL_R - cue.y) / uy : uy < 0 ? (BALL_R - cue.y) / uy : Infinity,
  );
  const t = Math.min(best, wall);
  const x = cue.x + ux * t;
  const y = cue.y + uy * t;
  if (!target || best > wall) return { x, y, target: null };
  // La pallina colpita parte lungo la linea dei centri.
  const ox = target.x - x;
  const oy = target.y - y;
  const ol = Math.hypot(ox, oy) || 1;
  return { x, y, target: { x: target.x, y: target.y, ux: ox / ol, uy: oy / ol } };
}

/** La stecca, rastremata: punta blu, ghiera bianca, fusto chiaro, impugnatura scura. */
function Cue({ cx, cy, ux, uy, gap, scale, shadow }: { cx: number; cy: number; ux: number; uy: number; gap: number; scale: number; shadow: { x: number; y: number } }) {
  const len = 0.78;
  const tip = BALL_R + gap;
  const at = (d: number) => ({ x: (cx - ux * (tip + d)) * scale, y: (cy - uy * (tip + d)) * scale });
  const w0 = Math.max(2.2, BALL_R * scale * 0.34);
  const w1 = w0 * 2.1;
  const widthAt = (d: number) => w0 + (w1 - w0) * (d / len);
  const vx = -uy;
  const vy = ux;
  const seg = (d1: number, d2: number) => {
    const a = at(d1);
    const b = at(d2);
    const h1 = widthAt(d1) / 2;
    const h2 = widthAt(d2) / 2;
    return `M${a.x + vx * h1} ${a.y + vy * h1}L${b.x + vx * h2} ${b.y + vy * h2}L${b.x - vx * h2} ${b.y - vy * h2}L${a.x - vx * h1} ${a.y - vy * h1}Z`;
  };
  const whole = seg(0, len);
  return (
    <G>
      <Path d={whole} fill="#000" opacity={0.28} transform={`translate(${shadow.x} ${shadow.y})`} />
      <Path d={seg(0, 0.012)} fill="#3C7BD9" />
      <Path d={seg(0.012, 0.04)} fill="#F4F1E8" />
      <Path d={seg(0.04, len * 0.6)} fill="#E2B57A" />
      <Path d={seg(len * 0.6, len * 0.63)} fill="#F2C94C" />
      <Path d={seg(len * 0.63, len)} fill="#3B1F0E" />
      <Path d={whole} fill="none" stroke={colors.line} strokeWidth={1.4} strokeLinejoin="round" />
    </G>
  );
}

// --- Tavolo -------------------------------------------------------------------------------------

/** Sponde dorate con le borchie magenta e le mattonelle turchesi, come il tavolo della casa. Non cambia mai durante il gioco. */
const TableFrame = memo(function TableFrame({ tableW, tableH, rail }: { tableW: number; tableH: number; rail: number }) {
  const W = tableW + rail * 2;
  const H = tableH + rail * 2;
  const cush = Math.round(rail * 0.4);
  const mid = (rail - cush) / 2;
  const diamonds: { x: number; y: number }[] = [];
  for (const k of [1, 2, 3, 5, 6, 7]) {
    const x = rail + (k / 8) * tableW;
    diamonds.push({ x, y: mid }, { x, y: H - mid });
  }
  for (const k of [1, 2, 3]) {
    const y = rail + (k / 4) * tableH;
    diamonds.push({ x: mid, y }, { x: W - mid, y });
  }
  return (
    <Svg width={W} height={H} style={{ position: 'absolute' }}>
      <Defs>
        <LinearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFE066" />
          <Stop offset="1" stopColor="#F2B705" />
        </LinearGradient>
      </Defs>
      <Rect x={1.5} y={1.5} width={W - 3} height={H - 3} rx={rail * 0.8} fill="url(#rim)" stroke={colors.line} strokeWidth={3} />
      <Rect x={5} y={5} width={W - 10} height={H - 10} rx={rail * 0.65} fill="none" stroke="#FFFFFF" strokeOpacity={0.14} strokeWidth={1.5} />
      <Rect x={rail - cush} y={rail - cush} width={tableW + cush * 2} height={tableH + cush * 2} fill="#0B4F55" stroke={colors.line} strokeWidth={2} />
      {diamonds.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={Math.max(3, rail * 0.17)} fill="#FF2E88" stroke={colors.line} strokeWidth={1.5} />
      ))}
    </Svg>
  );
});

/** Sopra il panno: luce della lampada, linea di testa, punti, ombra delle sponde e buche. */
const TableMarks = memo(function TableMarks({ tableW, tableH, rail, scale }: { tableW: number; tableH: number; rail: number; scale: number }) {
  const W = tableW + rail * 2;
  const H = tableH + rail * 2;
  return (
    <Svg width={W} height={H} style={{ position: 'absolute' }}>
      <Defs>
        <RadialGradient id="lamp" cx="50%" cy="50%" r="60%">
          <Stop offset="0.55" stopColor="#000" stopOpacity={0} />
          <Stop offset="1" stopColor="#000" stopOpacity={0.32} />
        </RadialGradient>
        <RadialGradient id="hole" cx="50%" cy="50%" r="50%">
          <Stop offset="0.6" stopColor="#000" />
          <Stop offset="1" stopColor="#2A2A2A" />
        </RadialGradient>
      </Defs>
      <Rect x={rail} y={rail} width={tableW} height={tableH} fill="url(#lamp)" />
      <Rect x={rail + 1.5} y={rail + 1.5} width={tableW - 3} height={tableH - 3} fill="none" stroke="#000" strokeOpacity={0.3} strokeWidth={3} />
      <Line x1={rail + 0.5 * scale} y1={rail} x2={rail + 0.5 * scale} y2={rail + tableH} stroke="#FFFFFF" strokeOpacity={0.16} strokeWidth={1} />
      <Circle cx={rail + 0.5 * scale} cy={rail + 0.5 * scale} r={2} fill="#FFFFFF" opacity={0.3} />
      <Circle cx={rail + 1.5 * scale} cy={rail + 0.5 * scale} r={2} fill="#FFFFFF" opacity={0.3} />
      {POCKETS.map((p, i) => (
        <G key={i}>
          <Circle cx={rail + p.x * scale} cy={rail + p.y * scale} r={p.r * scale + 2} fill="#12052B" stroke={colors.line} strokeWidth={2} />
          <Circle cx={rail + p.x * scale} cy={rail + p.y * scale} r={p.r * scale} fill="url(#hole)" />
        </G>
      ))}
    </Svg>
  );
});

// --- Gioco --------------------------------------------------------------------------------------

type Shown = { id: number; x: number; y: number; opacity: number; r: number };
type Pose = { ux: number; uy: number; gap: number };

/** Quanto si tira indietro la stecca alla forza massima, in unità di tavolo. */
const PULL = 0.22;
const pullGap = (power: number) => 0.015 + power * PULL;
/** Fotogrammi in cui una pallina scivola nella buca. */
const SINK_FRAMES = 10;

export function BiliardoBoard({ view, me, names, myTurn, onMove }: BoardProps<BiliardoState, BiliardoMove>) {
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const rail = width > 700 ? 26 : 20;
  // Sul telefono in verticale il tavolo si gira per lungo: molto più grande, con la testa in alto.
  const portrait = height > width * 1.2;
  // Spazio per i nomi in alto e per la forza del tiro in basso; il resto è tutto tavolo.
  const room = height - 210 - rail * 2;
  const tableW = portrait
    ? Math.min((width - 24 - rail * 2) * (TABLE_W / TABLE_H), room)
    : Math.min(width - 24 - rail * 2, room * (TABLE_W / TABLE_H), 1000);
  const scale = tableW / TABLE_W;
  const tableH = TABLE_H * scale;
  const outW = tableW + rail * 2;
  const outH = tableH + rail * 2;
  const br = BALL_R * scale;
  // Luce dall'alto a sinistra dello schermo, anche quando il tavolo è girato.
  const light = portrait ? { fx: '68%', fy: '34%', sx: -br * 0.22, sy: br * 0.3 } : { fx: '34%', fy: '32%', sx: br * 0.3, sy: br * 0.22 };

  const [placing, setPlacing] = useState(false);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [strike, setStrike] = useState<Pose | null>(null);
  const [anim, setAnim] = useState<{ balls: Shown[]; pose: Pose | null } | null>(null);
  const spins = useRef(new Map<number, Spin>());
  const lastId = useRef<number | null>(view.lastShot?.id ?? null);
  const raf = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const struck = useRef(false);
  const spinOf = (id: number) => spins.current.get(id) ?? REST;

  // Rigioca l'ultimo tiro: la fisica è deterministica, quindi è identico a quello del server.
  const replay = useMemo(() => (view.lastShot ? simulateShot(view.lastShot.before, view.lastShot.shot, true) : null), [view.lastShot?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const shot = view.lastShot;
    if (!shot || !replay?.frames || lastId.current === shot.id) return;
    lastId.current = shot.id;
    setStrike(null);
    // Con il movimento ridotto si salta l'animazione e si mostra subito il risultato (V-MO-2).
    if (reduced) return;
    const frames = replay.frames;
    const events = replay.events ?? [];
    const ids = shot.before.map((b) => b.id);
    const sl = Math.hypot(shot.shot.dx, shot.shot.dy) || 1;
    const dir = { ux: shot.shot.dx / sl, uy: shot.shot.dy / sl };
    // Chi guarda il tiro di un altro vede prima la stecca che arretra e colpisce; chi ha tirato l'ha già vista.
    const pre = struck.current ? 0 : 420;
    struck.current = false;
    const back = 300;
    const full = pullGap(shot.shot.power);
    // Per ogni pallina che va in buca: l'ultimo punto sul tavolo e la buca più vicina.
    const sinks = new Map<number, { frame: number; x: number; y: number; px: number; py: number }>();
    ids.forEach((_, k) => {
      const f = frames.findIndex((fr) => fr[k * 2] < 0);
      if (f <= 0) return;
      const x = frames[f - 1][k * 2];
      const y = frames[f - 1][k * 2 + 1];
      const p = POCKETS.reduce((a, b) => (Math.hypot(b.x - x, b.y - y) < Math.hypot(a.x - x, a.y - y) ? b : a));
      sinks.set(k, { frame: f, x, y, px: p.x, py: p.y });
    });
    const still = shot.before.filter((b) => !b.in).map((b) => ({ id: b.id, x: b.x, y: b.y, opacity: 1, r: 1 }));
    const prev = shot.before.map((b) => ({ x: b.x, y: b.y }));
    const t0 = Date.now();
    let heard = -1;
    const loop = () => {
      const el = Date.now() - t0;
      if (el < pre) {
        // Arretra piano, poi scatta in avanti, sempre più veloce, fino alla bianca.
        const gap = el < back ? full * (1 - (1 - el / back) ** 2) : full * (1 - ((el - back) / (pre - back)) ** 2);
        setAnim({ balls: still, pose: { ...dir, gap: Math.max(0, gap) } });
        raf.current = requestAnimationFrame(loop);
        return;
      }
      if (heard === -1) {
        heard = 0;
        if (pre) sfx('cue');
      }
      const f = ((el - pre) / 1000) * 60;
      const i = Math.floor(f);
      const frac = f - i;
      // Si sentono gli urti fra le biglie, le sponde e le buche, nel momento in cui succedono.
      for (const e of events) {
        if (e.frame > heard && e.frame <= i) {
          if (e.kind === 'pocket') sfx('pocket');
          else if (e.kind === 'hit' && e.v > 0.02) sfx('ball');
          else if (e.kind === 'cushion' && e.v > 0.08) sfx('card');
        }
      }
      heard = Math.max(heard, i);
      const last = frames.length - 1;
      if (i >= last + SINK_FRAMES) {
        setAnim(null);
        return;
      }
      const a = frames[Math.min(i, last)];
      const b = frames[Math.min(i + 1, last)];
      const balls: Shown[] = [];
      ids.forEach((id, k) => {
        if (a[k * 2] < 0) {
          // Scivola nella buca rimpicciolendo, invece di sparire di colpo.
          const sink = sinks.get(k);
          if (!sink) return;
          const p = (f - sink.frame) / SINK_FRAMES;
          if (p >= 1) return;
          const e = p * p;
          balls.push({ id, x: sink.x + (sink.px - sink.x) * e, y: sink.y + (sink.py - sink.y) * e, opacity: 1 - p * 0.6, r: 1 - p * 0.45 });
          return;
        }
        // Fra un fotogramma e l'altro si interpola: sugli schermi a 120 Hz il moto resta liscio.
        const x = b[k * 2] < 0 ? a[k * 2] : a[k * 2] + (b[k * 2] - a[k * 2]) * frac;
        const y = b[k * 2] < 0 ? a[k * 2 + 1] : a[k * 2 + 1] + (b[k * 2 + 1] - a[k * 2 + 1]) * frac;
        spins.current.set(id, roll(spinOf(id), x - prev[k].x, y - prev[k].y));
        prev[k] = { x, y };
        balls.push({ id, x, y, opacity: 1, r: 1 });
      });
      // La stecca accompagna il colpo per un attimo e poi sparisce.
      setAnim({ balls, pose: f < 5 ? { ...dir, gap: -0.004 + f * 0.003 } : null });
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      setAnim(null);
    };
  }, [view.lastShot?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDrag(null);
    setPlacing(view.ballInHand && myTurn);
  }, [view.turn, view.ballInHand, myTurn]);

  const animating = anim !== null;
  const cue = view.balls.find((b) => b.id === 0)!;
  const canAct = myTurn && !animating && !strike;

  // Trascinando si tira indietro la stecca: si tira dalla parte opposta al dito, e più il dito è lontano dalla bianca più forte è il colpo.
  const deadPx = br * 1.6;
  const maxPx = Math.max(110, Math.min(180, Math.max(outW, outH) * 0.3));
  const aim = (() => {
    if (!drag || placing) return null;
    const dx = cue.x - drag.x;
    const dy = cue.y - drag.y;
    const l = Math.hypot(dx, dy);
    if (l * scale < br * 0.8) return null;
    const power = Math.max(0, Math.min(1, (l * scale - deadPx) / maxPx));
    return { dx, dy, ux: dx / l, uy: dy / l, power };
  })();
  const guide = canAct && aim ? aimGuide(view.balls, cue, aim.dx, aim.dy) : null;

  const shoot = (a: NonNullable<typeof aim>) => {
    const move = { type: 'shoot' as const, dx: a.dx, dy: a.dy, power: Math.max(0.04, a.power) };
    if (reduced) {
      sfx('cue');
      onMove(move);
      return;
    }
    // Lasciando, la stecca scatta in avanti fino a toccare la bianca, e solo allora parte il tiro.
    const from = pullGap(a.power);
    const t0 = Date.now();
    const dur = 70 + a.power * 50;
    const step = () => {
      const p = Math.min(1, (Date.now() - t0) / dur);
      setStrike({ ux: a.ux, uy: a.uy, gap: from * (1 - p * p) });
      if (p < 1) requestAnimationFrame(step);
      else {
        sfx('cue');
        struck.current = true;
        onMove(move);
      }
    };
    requestAnimationFrame(step);
  };
  // Se il server non risponde col tiro (mossa rifiutata), la stecca non resta appesa.
  useEffect(() => {
    if (!strike) return;
    const t = setTimeout(() => setStrike(null), 2500);
    return () => clearTimeout(t);
  }, [strike !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Il punto toccato, dalle coordinate dello schermo a quelle del tavolo (anche quando è girato).
  const toTable = (pageX: number, pageY: number) => {
    const lx = pageX - origin.current.x;
    const ly = pageY - origin.current.y;
    return portrait ? { x: (outW - ly - rail) / scale, y: (lx - rail) / scale } : { x: (lx - rail) / scale, y: (ly - rail) / scale };
  };

  const groupLabel = (p: number) => {
    const g = view.groups[p];
    if (!g) return 'tavolo aperto';
    const left = view.balls.filter((b) => !b.in && (g === 'piene' ? isSolid(b.id) : isStripe(b.id))).length;
    return `${g} · ${left === 0 ? 'tocca alla nera' : `ne mancano ${left}`}`;
  };

  const balls: Shown[] = anim ? anim.balls : view.balls.filter((b) => !b.in).map((b) => ({ id: b.id, x: b.x, y: b.y, opacity: 1, r: 1 }));
  const pose: Pose | null = anim ? anim.pose : strike ?? (aim && canAct ? { ux: aim.ux, uy: aim.uy, gap: pullGap(aim.power) } : null);
  // Durante il tiro la stecca segue la bianca da dove è partita.
  const poseAt = anim && view.lastShot ? view.lastShot.before.find((b) => b.id === 0)! : cue;
  // Il livello che si muove è più grande del tavolo, così la stecca può uscire oltre le sponde.
  const M = 0.85 * scale;

  return (
    <TableBg table="billiard" scrim={0.2} style={{ alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 8 }}>
      <Row gap={20} wrap style={{ justifyContent: 'center' }}>
        {[0, 1].map((p) => (
          <View key={p} style={{ alignItems: 'center', opacity: view.turn === p ? 1 : 0.7, backgroundColor: '#12052BD9', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 2, borderColor: view.turn === p ? colors.accent : '#FFFFFF22' }}>
            <Row gap={6}>
              <SeatDot seat={p} />
              <T weight="900">{names[p]}</T>
            </Row>
            <T size={12} color={colors.muted}>
              {groupLabel(p)}
            </T>
          </View>
        ))}
      </Row>
      <View
        style={{ width: portrait ? outH : outW, height: portrait ? outW : outH, borderRadius: rail, boxShadow: `0px 6px 0px ${colors.line}`, zIndex: 2 }}
        onStartShouldSetResponder={() => canAct}
        onMoveShouldSetResponder={() => canAct}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          const { pageX, pageY, locationX, locationY } = e.nativeEvent;
          origin.current = { x: pageX - locationX, y: pageY - locationY };
          const pt = toTable(pageX, pageY);
          if (placing) {
            onMove({ type: 'place', x: pt.x, y: pt.y });
            setPlacing(false);
          } else setDrag(pt);
        }}
        onResponderMove={(e) => !placing && setDrag(toTable(e.nativeEvent.pageX, e.nativeEvent.pageY))}
        onResponderRelease={() => {
          // Lasciando con la stecca quasi a contatto il tiro si annulla.
          if (aim && aim.power > 0.03 && canAct) shoot(aim);
          setDrag(null);
        }}
        onResponderTerminate={() => setDrag(null)}
      >
        <View
          pointerEvents="none"
          style={[
            { width: outW, height: outH },
            portrait && { position: 'absolute', left: (outH - outW) / 2, top: (outW - outH) / 2, transform: [{ rotate: '-90deg' }] },
          ]}
        >
          <TableFrame tableW={tableW} tableH={tableH} rail={rail} />
          {/* Il panno è il velluto turchese a rombi del tavolo della casa. */}
          <Image source={TABLES.teal} style={{ position: 'absolute', left: rail, top: rail, width: tableW, height: tableH }} resizeMode="cover" />
          <TableMarks tableW={tableW} tableH={tableH} rail={rail} scale={scale} />
          <Svg width={tableW + M * 2} height={tableH + M * 2} style={{ position: 'absolute', left: rail - M, top: rail - M }}>
            <Defs>
              <RadialGradient id="shade" cx="50%" cy="50%" r="50%" fx={light.fx} fy={light.fy}>
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.85} />
                <Stop offset="0.28" stopColor="#FFFFFF" stopOpacity={0} />
                <Stop offset="0.72" stopColor="#000" stopOpacity={0} />
                <Stop offset="1" stopColor="#000" stopOpacity={0.45} />
              </RadialGradient>
            </Defs>
            <G transform={`translate(${M} ${M})`}>
              {guide && (
                <G>
                  <Line x1={cue.x * scale} y1={cue.y * scale} x2={guide.x * scale} y2={guide.y * scale} stroke="#FFFFFF" strokeOpacity={0.8} strokeWidth={2} strokeDasharray="6,5" />
                  <Circle cx={guide.x * scale} cy={guide.y * scale} r={br} stroke="#FFFFFF" strokeWidth={1.5} fill="none" />
                  {guide.target && aim && (
                    <Line
                      x1={guide.target.x * scale}
                      y1={guide.target.y * scale}
                      x2={(guide.target.x + guide.target.ux * (0.1 + aim.power * 0.25)) * scale}
                      y2={(guide.target.y + guide.target.uy * (0.1 + aim.power * 0.25)) * scale}
                      stroke={colors.accent}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                    />
                  )}
                </G>
              )}
              {balls.map((b) => (
                <Circle key={`s${b.id}`} cx={b.x * scale + light.sx} cy={b.y * scale + light.sy} r={br * b.r * 1.02} fill="#000" opacity={0.35 * b.opacity} />
              ))}
              {balls.map((b) => (
                <PoolBall key={b.id} id={b.id} x={b.x * scale} y={b.y * scale} r={br * b.r} spin={spinOf(b.id)} upright={portrait} opacity={b.opacity} />
              ))}
              {pose && <Cue cx={poseAt.x} cy={poseAt.y} ux={pose.ux} uy={pose.uy} gap={pose.gap} scale={scale} shadow={{ x: light.sx * 2, y: light.sy * 2 }} />}
            </G>
          </Svg>
        </View>
      </View>
      {/* Altezza fissa: mentre si mira il tavolo non deve spostarsi sotto il dito. */}
      <View style={{ height: 112, width: '100%', alignItems: 'center', gap: 8 }}>
      {view.lastShot && !animating && (
        <T size={14} color={colors.muted}>
          {names[view.lastShot.seat]} {view.lastShot.text}
        </T>
      )}
      {canAct || strike ? (
        <View style={{ gap: 8, alignItems: 'center', width: '100%', maxWidth: 520, paddingHorizontal: 12 }}>
          {view.ballInHand && (
            <Row gap={8}>
              <Chip label="Sposta la bianca" active={placing} onPress={() => setPlacing(true)} />
              <Chip label="Mira" active={!placing} onPress={() => setPlacing(false)} />
            </Row>
          )}
          {placing ? (
            <T color={colors.accent}>Tocca il tavolo dove mettere la bianca</T>
          ) : aim ? (
            <View style={{ width: '100%', gap: 4, alignItems: 'center' }} accessibilityLiveRegion="polite">
              <T size={14} weight="800" color={aim.power > 0.75 ? colors.danger : colors.accent}>
                Forza {Math.round(aim.power * 100)}% · lascia per tirare
              </T>
              <View style={{ width: '70%', height: 12, borderRadius: 999, backgroundColor: colors.surface2, borderWidth: 2, borderColor: colors.line, overflow: 'hidden' }}>
                <View style={{ width: `${aim.power * 100}%`, height: '100%', backgroundColor: aim.power > 0.75 ? colors.danger : colors.accent }} />
              </View>
            </View>
          ) : (
            <T size={14} weight="700" color={colors.text} center>
              Trascina indietro dalla bianca per mirare, lascia per tirare
            </T>
          )}
        </View>
      ) : (
        <Banner text={animating ? '…' : me === null || !myTurn ? `Tira ${names[view.turn]}` : 'Aspetta…'} />
      )}
      </View>
    </TableBg>
  );
}
