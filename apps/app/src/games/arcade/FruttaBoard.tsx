import { useMemo, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { arcadeRng, type ArcadeMove, type ArcadeView } from '@giochi/engine';
import { usePaused, type BoardProps } from '../common';
import { TableBg } from '../../ui/tables';
import { T } from '../../ui/kit';
import { sfx } from '../../ui/sound';
import { colors } from '../../ui/theme';
import { Hud, NO_SELECT, StartCard, useFrame, useRecord } from './kit';

/**
 * Taglia la frutta: i frutti saltano su dal basso, un colpo di dito li taglia a metà. I petardi
 * non si toccano; tre frutti caduti interi e la partita finisce.
 */
const FRUITS: { e: string; juice: string }[] = [
  { e: '🍉', juice: '#FF4D6D' },
  { e: '🍊', juice: '#FF9F1C' },
  { e: '🍋', juice: '#FFE14D' },
  { e: '🍎', juice: '#FF3B3B' },
  { e: '🍐', juice: '#C8F560' },
  { e: '🍑', juice: '#FFB38A' },
  { e: '🍇', juice: '#9B5DE5' },
  { e: '🍓', juice: '#FF2E63' },
  { e: '🍍', juice: '#FFD23F' },
  { e: '🥝', juice: '#7CF0B0' },
];
const LIVES = 3;

interface Thing {
  id: number;
  fruit: number; // -1 = petardo
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  r: number;
}
interface Half {
  id: number;
  e: string;
  side: -1 | 1;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  r: number;
  angle: number;
}
interface Splash {
  id: number;
  x: number;
  y: number;
  color: string;
  life: number;
  r: number;
}
interface Pop {
  id: number;
  x: number;
  y: number;
  text: string;
  life: number;
}

export function FruttaBoard({ view, myTurn, onMove }: BoardProps<ArcadeView, ArcadeMove>) {
  return <Game key={view.seed} seed={view.seed} active={myTurn && !view.over} onMove={onMove} />;
}

function Game({ seed, active, onMove }: { seed: number; active: boolean; onMove: (m: ArcadeMove) => void }) {
  const paused = usePaused();
  const { best, submit } = useRecord('frutta');
  const [started, setStarted] = useState(false);
  const [, setFrame] = useState(0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const origin = useRef({ x: 0, y: 0 });
  const area = useRef<View>(null);
  const rnd = useMemo(() => arcadeRng(seed), [seed]);
  const g = useRef({
    things: [] as Thing[],
    halves: [] as Half[],
    splashes: [] as Splash[],
    pops: [] as Pop[],
    trail: [] as { x: number; y: number; t: number }[],
    nextWave: 600,
    time: 0,
    score: 0,
    sliced: 0,
    lives: LIVES,
    over: false,
    boom: null as { x: number; y: number; life: number } | null,
    id: 1,
    stroke: 0,
  }).current;

  const finish = () => {
    if (g.over) return;
    g.over = true;
    const record = submit(g.score);
    setTimeout(() => onMove({ type: 'end', score: g.score, record, note: `${g.sliced} frutti tagliati` }), 1100);
  };

  const wave = () => {
    const { w, h } = size;
    const r = Math.max(26, Math.min(44, w * 0.075));
    const n = 1 + Math.floor(rnd() * Math.min(4, 2 + g.score / 10));
    const bombChance = g.score < 8 ? 0 : Math.min(0.22, 0.08 + g.score / 400);
    for (let k = 0; k < n; k++) {
      const x = w * (0.15 + rnd() * 0.7);
      const peak = h * (0.45 + rnd() * 0.4);
      const gravity = h * 0.0000022;
      const vy = -Math.sqrt(2 * gravity * peak);
      const vx = (w / 2 - x) * (0.0006 + rnd() * 0.0006);
      g.things.push({ id: g.id++, fruit: rnd() < bombChance ? -1 : Math.floor(rnd() * FRUITS.length), x, y: h + r, vx, vy, rot: rnd() * 360, vr: (rnd() - 0.5) * 0.4, r });
    }
    sfx('deal');
  };

  const slice = (t: Thing) => {
    if (t.fruit < 0) {
      g.boom = { x: t.x, y: t.y, life: 900 };
      g.things = g.things.filter((x) => x !== t);
      sfx('pocket');
      finish();
      return;
    }
    const f = FRUITS[t.fruit];
    g.things = g.things.filter((x) => x !== t);
    g.score += 1;
    g.sliced += 1;
    g.stroke += 1;
    const angle = Math.atan2(g.trail.length > 1 ? g.trail[g.trail.length - 1].y - g.trail[g.trail.length - 2].y : 1, g.trail.length > 1 ? g.trail[g.trail.length - 1].x - g.trail[g.trail.length - 2].x : 0);
    for (const side of [-1, 1] as const) g.halves.push({ id: g.id++, e: f.e, side, x: t.x, y: t.y, vx: t.vx + side * 0.12, vy: Math.min(t.vy, 0) * 0.4 - 0.1, rot: t.rot, vr: side * 0.3, r: t.r, angle });
    for (let k = 0; k < 6; k++) g.splashes.push({ id: g.id++, x: t.x + (rnd() - 0.5) * t.r * 2, y: t.y + (rnd() - 0.5) * t.r * 2, color: f.juice, life: 700, r: 5 + rnd() * 9 });
    sfx('capture');
    if (g.stroke === 3 || g.stroke === 5) {
      const bonus = g.stroke;
      g.score += bonus;
      g.pops.push({ id: g.id++, x: t.x, y: t.y - t.r, text: `Combo ×${g.stroke}  +${bonus}`, life: 1100 });
      sfx('scopa');
    }
  };

  const running = started && active && !paused && size.w > 0;
  useFrame((dt) => {
    const { h } = size;
    const gravity = h * 0.0000022;
    g.time += dt;
    if (!g.over) {
      g.nextWave -= dt;
      if (g.nextWave <= 0) {
        wave();
        g.nextWave = Math.max(650, 1500 - g.score * 12) + rnd() * 400;
      }
    }
    for (const t of g.things) {
      t.vy += gravity * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.rot += t.vr * dt;
    }
    // Frutti caduti interi: una vita in meno. I petardi caduti non contano.
    const fallen = g.things.filter((t) => t.vy > 0 && t.y > h + t.r * 1.5);
    if (fallen.length && !g.over) {
      for (const t of fallen) {
        if (t.fruit < 0) continue;
        g.lives -= 1;
        g.pops.push({ id: g.id++, x: Math.min(Math.max(t.x, 40), size.w - 40), y: h - 40, text: '✕', life: 900 });
        if (g.lives <= 0) finish();
      }
    }
    g.things = g.things.filter((t) => !fallen.includes(t));
    for (const p of g.halves) {
      p.vy += gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    g.halves = g.halves.filter((p) => p.y < h + 80);
    for (const s of g.splashes) s.life -= dt;
    g.splashes = g.splashes.filter((s) => s.life > 0);
    for (const p of g.pops) {
      p.life -= dt;
      p.y -= dt * 0.04;
    }
    g.pops = g.pops.filter((p) => p.life > 0);
    if (g.boom) {
      g.boom.life -= dt;
      if (g.boom.life <= 0) g.boom = null;
    }
    const now = g.time;
    g.trail = g.trail.filter((p) => now - p.t < 140);
    setFrame((f) => (f + 1) % 1000000);
  }, running);

  // Il dito: ogni tratto fra due posizioni taglia quello che attraversa.
  const handle = (px: number, py: number) => {
    if (g.over) return;
    const x = px - origin.current.x;
    const y = py - origin.current.y;
    const prev = g.trail[g.trail.length - 1];
    g.trail.push({ x, y, t: g.time });
    if (!prev) return;
    for (const t of [...g.things]) {
      const dx = x - prev.x;
      const dy = y - prev.y;
      const len2 = dx * dx + dy * dy || 1;
      const k = Math.max(0, Math.min(1, ((t.x - prev.x) * dx + (t.y - prev.y) * dy) / len2));
      const cx = prev.x + k * dx - t.x;
      const cy = prev.y + k * dy - t.y;
      if (cx * cx + cy * cy < t.r * t.r * 0.9) slice(t);
    }
  };
  const runRef = useRef(running);
  runRef.current = running;
  const handleRef = useRef(handle);
  handleRef.current = handle;
  const responder = useMemo(
    () =>
      PanResponder.create({
        onPanResponderTerminationRequest: () => false,
        onStartShouldSetPanResponder: () => runRef.current,
        onMoveShouldSetPanResponder: () => runRef.current,
        onPanResponderGrant: (e) => {
          g.trail = [];
          g.stroke = 0;
          area.current?.measureInWindow((x, y) => (origin.current = { x, y }));
          handleRef.current(e.nativeEvent.pageX, e.nativeEvent.pageY);
        },
        onPanResponderMove: (e) => handleRef.current(e.nativeEvent.pageX, e.nativeEvent.pageY),
        onPanResponderRelease: () => {
          g.stroke = 0;
        },
      }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <TableBg table="wood" scrim={0.15}>
      <View
        ref={area}
        style={[{ flex: 1 }, NO_SELECT]}
        onLayout={(e) => {
          setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
          area.current?.measureInWindow((x, y) => (origin.current = { x, y }));
        }}
        {...responder.panHandlers}
      >
        <Hud score={g.score} best={best} extra={`${'❤️'.repeat(Math.max(0, g.lives))}${'🖤'.repeat(LIVES - Math.max(0, g.lives))}`} style={{ top: 12, left: 12 }} />
        {g.splashes.map((s) => (
          <View key={s.id} pointerEvents="none" style={{ position: 'absolute', left: s.x - s.r, top: s.y - s.r, width: s.r * 2, height: s.r * 2, borderRadius: s.r, backgroundColor: s.color, opacity: s.life / 700 }} />
        ))}
        {g.halves.map((p) => (
          <View key={p.id} pointerEvents="none" style={{ position: 'absolute', left: p.x - p.r, top: p.y - p.r, width: p.r * 2, height: p.r * 2, transform: [{ rotate: `${(p.angle * 180) / Math.PI + 90}deg` }] }}>
            <View style={{ position: 'absolute', left: p.side < 0 ? 0 : p.r, top: 0, width: p.r, height: p.r * 2, overflow: 'hidden', transform: [{ translateX: p.side * 4 }, { rotate: `${p.rot * 0.3}deg` }] }}>
              <T size={p.r * 1.7} style={{ position: 'absolute', left: p.side < 0 ? 0 : -p.r, top: 0, width: p.r * 2, height: p.r * 2, lineHeight: p.r * 2, textAlign: 'center' }}>
                {p.e}
              </T>
            </View>
          </View>
        ))}
        {g.things.map((t) => (
          <View key={t.id} pointerEvents="none" style={{ position: 'absolute', left: t.x - t.r, top: t.y - t.r, width: t.r * 2, height: t.r * 2, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: `${t.rot}deg` }] }}>
            {t.fruit < 0 && <View style={{ position: 'absolute', width: t.r * 2, height: t.r * 2, borderRadius: t.r, backgroundColor: 'rgba(255,46,136,0.35)', borderWidth: 3, borderColor: colors.accent2 }} />}
            <T size={t.r * 1.7} style={{ lineHeight: t.r * 2, textAlign: 'center' }}>
              {t.fruit < 0 ? '🧨' : FRUITS[t.fruit].e}
            </T>
          </View>
        ))}
        {g.trail.length > 1 && (
          <Svg pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }} width={size.w} height={size.h}>
            <Polyline points={g.trail.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={colors.line} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" opacity={0.5} />
            <Polyline points={g.trail.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        )}
        {g.pops.map((p) => (
          <View key={p.id} pointerEvents="none" style={{ position: 'absolute', left: p.x - 110, top: p.y - 20, width: 220, alignItems: 'center', opacity: Math.min(1, p.life / 400) }}>
            <T size={p.text === '✕' ? 34 : 24} weight="900" color={p.text === '✕' ? colors.accent2 : colors.accent} style={{ textShadowColor: colors.line, textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 0 }}>
              {p.text}
            </T>
          </View>
        ))}
        {g.boom && (
          <View pointerEvents="none" style={{ position: 'absolute', left: g.boom.x - 120, top: g.boom.y - 120, width: 240, height: 240, borderRadius: 120, backgroundColor: '#FFF6C2', opacity: g.boom.life / 900, alignItems: 'center', justifyContent: 'center', transform: [{ scale: 1.6 - g.boom.life / 900 }] }}>
            <T size={70}>💥</T>
          </View>
        )}
      </View>
      {!started && active && (
        <StartCard title="Taglia la frutta" lines={['Passa il dito sulla frutta per tagliarla.', 'Non toccare i petardi 🧨 e non farne cadere tre interi.']} onStart={() => setStarted(true)} />
      )}
    </TableBg>
  );
}
