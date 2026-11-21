import { useMemo, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import { arcadeRng, type ArcadeMove, type ArcadeView } from '@giochi/engine';
import { usePaused, type BoardProps } from '../common';
import { TableBg } from '../../ui/tables';
import { T } from '../../ui/kit';
import Svg from 'react-native-svg';
import { Place } from '../../ui/morbido/draw';
import { MOSTRINI } from '../../ui/morbido/shapes';
import { sfx } from '../../ui/sound';
import { colors } from '../../ui/theme';
import { Hud, NO_SELECT, StartCard, useFrame, useKeys, useKeyUp, useRecord } from './kit';

/**
 * Il razzo di Bobo: si vola tenendo premuto, si scende lasciando. Girandole di fuoco e
 * palloncini scoppiettanti da evitare, zecchini da prendere. Il punteggio sono i metri.
 */
const PX_PER_M = 28;
const PLAYER_X = 0.24;

type Obstacle =
  | { kind: 'bar'; id: number; x: number; y: number; len: number; angle: number; spin: number }
  | { kind: 'balloon'; id: number; x: number; y: number; base: number; amp: number; phase: number; r: number };
interface Coin {
  id: number;
  x: number;
  y: number;
  taken: boolean;
}
interface Spark {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export function RazzoBoard({ view, myTurn, onMove }: BoardProps<ArcadeView, ArcadeMove>) {
  return <Game key={view.seed} seed={view.seed} active={myTurn && !view.over} onMove={onMove} />;
}

function Game({ seed, active, onMove }: { seed: number; active: boolean; onMove: (m: ArcadeMove) => void }) {
  const paused = usePaused();
  const { best, submit } = useRecord('razzo');
  const [started, setStarted] = useState(false);
  const [, setFrame] = useState(0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const rnd = useMemo(() => arcadeRng(seed), [seed]);
  const g = useRef({
    y: 0,
    vy: 0,
    thrust: false,
    dist: 0,
    speed: 0.26,
    coins: 0,
    obstacles: [] as Obstacle[],
    coinList: [] as Coin[],
    sparks: [] as Spark[],
    nextAt: 500,
    id: 1,
    dead: false,
    over: false,
    time: 0,
    init: false,
  }).current;

  const meters = () => Math.floor(g.dist / PX_PER_M) + g.coins * 10;
  const ground = size.h - Math.max(40, size.h * 0.08);
  const ceiling = 70;
  const pr = Math.max(24, Math.min(36, size.w * 0.065));

  const finish = () => {
    if (g.over) return;
    g.over = true;
    const score = meters();
    const record = submit(score);
    setTimeout(() => onMove({ type: 'end', score, record, note: `${g.coins} zecchini` }), 1200);
  };

  const spawn = (x: number) => {
    const span = ground - ceiling;
    const roll = rnd();
    if (roll < 0.55) {
      const len = span * (0.28 + rnd() * 0.22);
      const angle = [0, 90, 45, -45][Math.floor(rnd() * 4)];
      const spin = g.dist > 2500 && rnd() < 0.35 ? (rnd() < 0.5 ? -1 : 1) * (0.04 + rnd() * 0.05) : 0;
      g.obstacles.push({ kind: 'bar', id: g.id++, x, y: ceiling + len / 2 + rnd() * (span - len), len, angle, spin });
    } else {
      const r = pr * 1.05;
      const base = ceiling + r + rnd() * (span - 2 * r);
      g.obstacles.push({ kind: 'balloon', id: g.id++, x, y: base, base, amp: span * (0.08 + rnd() * 0.15), phase: rnd() * Math.PI * 2, r });
    }
    // Una fila o un arco di zecchini poco più avanti.
    const cy = ceiling + 40 + rnd() * (span - 80);
    const arc = rnd() < 0.5;
    for (let k = 0; k < 5; k++) g.coinList.push({ id: g.id++, x: x + 170 + k * 34, y: cy + (arc ? Math.sin((k / 4) * Math.PI) * -40 : 0), taken: false });
  };

  const running = started && active && !paused && size.w > 0;
  useFrame((dt) => {
    if (!g.init) {
      g.init = true;
      g.y = (ground + ceiling) / 2;
    }
    g.time += dt;
    const px = size.w * PLAYER_X;
    // Volo: spinta verso l'alto tenendo premuto, gravità quando si lascia.
    const accel = g.thrust && !g.dead ? -0.0024 : 0.0021;
    g.vy = Math.max(-0.75, Math.min(0.9, g.vy + accel * dt));
    g.y += g.vy * dt;
    if (g.y < ceiling + pr) {
      g.y = ceiling + pr;
      g.vy = 0;
    }
    if (g.y > ground - pr) {
      g.y = ground - pr;
      g.vy = 0;
      if (g.dead) finish();
    }
    const move = g.dead ? 0 : g.speed * dt;
    if (!g.dead) {
      g.dist += move;
      g.speed = Math.min(0.62, 0.26 + g.dist / 90000);
    }
    for (const o of g.obstacles) {
      o.x -= move;
      if (o.kind === 'bar') o.angle += o.spin * dt;
      else o.y = o.base + Math.sin(g.time / 600 + o.phase) * o.amp;
    }
    for (const c of g.coinList) c.x -= move;
    g.obstacles = g.obstacles.filter((o) => o.x > -200);
    g.coinList = g.coinList.filter((c) => c.x > -40 && !c.taken);
    g.nextAt -= move;
    if (g.nextAt <= 0) {
      spawn(size.w + 120);
      g.nextAt = Math.max(260, 520 - g.dist / 200) + rnd() * 220;
    }
    // Scintille del razzo.
    if (g.thrust && !g.dead && rnd() < 0.8) g.sparks.push({ id: g.id++, x: px - pr * 1.1, y: g.y + pr * 0.55, vx: -0.12 - rnd() * 0.15, vy: 0.12 + rnd() * 0.15, life: 380, color: rnd() < 0.5 ? colors.accent : '#FF9F1C' });
    for (const s of g.sparks) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
    }
    g.sparks = g.sparks.filter((s) => s.life > 0);
    if (!g.dead) {
      // Zecchini.
      for (const c of g.coinList) {
        if (!c.taken && Math.hypot(c.x - px, c.y - g.y) < pr + 12) {
          c.taken = true;
          g.coins++;
          sfx('pick');
        }
      }
      // Ostacoli: distanza dal segmento di fuoco o dal palloncino.
      const hitR = pr * 0.72;
      for (const o of g.obstacles) {
        let hit = false;
        if (o.kind === 'bar') {
          const a = (o.angle * Math.PI) / 180;
          const hx = (Math.cos(a) * o.len) / 2;
          const hy = (Math.sin(a) * o.len) / 2;
          const ax = o.x - hx;
          const ay = o.y - hy;
          const dx = 2 * hx;
          const dy = 2 * hy;
          const k = Math.max(0, Math.min(1, ((px - ax) * dx + (g.y - ay) * dy) / (dx * dx + dy * dy || 1)));
          hit = Math.hypot(ax + k * dx - px, ay + k * dy - g.y) < hitR + 9;
        } else hit = Math.hypot(o.x - px, o.y - g.y) < hitR + o.r * 0.8;
        if (hit) {
          g.dead = true;
          g.thrust = false;
          sfx('pocket');
          for (let k = 0; k < 18; k++) g.sparks.push({ id: g.id++, x: px, y: g.y, vx: (rnd() - 0.5) * 0.6, vy: (rnd() - 0.5) * 0.6, life: 700, color: [colors.accent, colors.accent2, '#fff'][k % 3] });
          break;
        }
      }
    }
    setFrame((f) => (f + 1) % 1000000);
  }, running);

  const setThrust = (v: boolean) => {
    if (!g.dead) g.thrust = v;
  };
  useKeys((k) => {
    if (k !== ' ' && k !== 'ArrowUp' && k !== 'w') return false;
    setThrust(true);
    return true;
  }, running);
  useKeyUp((k) => {
    if (k === ' ' || k === 'ArrowUp' || k === 'w') setThrust(false);
  }, running);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onPanResponderTerminationRequest: () => false,
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => setThrust(true),
        onPanResponderRelease: () => setThrust(false),
        onPanResponderTerminate: () => setThrust(false),
      }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const px = size.w * PLAYER_X;
  if (!g.init && size.h) g.y = (ground + ceiling) / 2;
  const tilt = g.dead ? 60 : Math.max(-18, Math.min(18, g.vy * 30));
  const stripe = (g.dist * 0.9) % 60;

  return (
    <TableBg table="night" scrim={0.4}>
      <View style={[{ flex: 1 }, NO_SELECT]} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} {...responder.panHandlers}>
        {size.w > 0 && (
          <>
            {/* Il selciato che scorre: dà la sensazione di velocità. */}
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: ground, bottom: 0, backgroundColor: 'rgba(13,14,17,0.72)', borderTopWidth: 3, borderColor: colors.accent, overflow: 'hidden' }}>
              {Array.from({ length: Math.ceil(size.w / 60) + 2 }, (_, i) => (
                <View key={i} style={{ position: 'absolute', left: i * 60 - stripe, top: 8, width: 30, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,225,77,0.45)' }} />
              ))}
            </View>
            {g.coinList.map((c) => (
              <View key={c.id} pointerEvents="none" style={{ position: 'absolute', left: c.x - 11, top: c.y - 11, width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFC933', borderWidth: 2.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 2, borderColor: '#B8860B' }} />
              </View>
            ))}
            {g.obstacles.map((o) =>
              o.kind === 'bar' ? (
                <View key={o.id} pointerEvents="none" style={{ position: 'absolute', left: o.x - o.len / 2, top: o.y - 9, width: o.len, height: 18, transform: [{ rotate: `${o.angle}deg` }] }}>
                  <View style={{ position: 'absolute', left: 10, right: 10, top: 2, height: 14, borderRadius: 7, backgroundColor: '#FF9F1C', borderWidth: 2.5, borderColor: colors.line, overflow: 'hidden' }}>
                    <View style={{ position: 'absolute', left: 0, right: 0, top: 3, height: 4, backgroundColor: '#FFF2A8', opacity: 0.6 + 0.4 * Math.sin(g.time / 60) }} />
                  </View>
                  {[0, 1].map((k) => (
                    <View key={k} style={{ position: 'absolute', [k ? 'right' : 'left']: -6, top: -6, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accent2, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: `${g.time / 3}deg` }] }}>
                      <T size={16} weight="900" color={colors.accent} style={{ lineHeight: 18 }}>
                        ✷
                      </T>
                    </View>
                  ))}
                </View>
              ) : (
                <View key={o.id} pointerEvents="none" style={{ position: 'absolute', left: o.x - o.r, top: o.y - o.r * 1.1, width: o.r * 2, height: o.r * 2.6, alignItems: 'center' }}>
                  <View style={{ width: o.r * 2, height: o.r * 2.2, borderRadius: o.r, backgroundColor: colors.accent2, borderWidth: 1.5, borderColor: colors.line }}>
                    <View style={{ position: 'absolute', left: o.r * 0.4, top: o.r * 0.35, width: o.r * 0.45, height: o.r * 0.6, borderRadius: o.r * 0.3, backgroundColor: 'rgba(255,255,255,0.55)' }} />
                  </View>
                  <View style={{ width: 2, height: o.r * 0.5, backgroundColor: colors.line }} />
                  <T size={12} weight="900" color={colors.accent} style={{ position: 'absolute', top: o.r * 0.8 }}>
                    ⚡
                  </T>
                </View>
              ),
            )}
            {g.sparks.map((s) => (
              <View key={s.id} pointerEvents="none" style={{ position: 'absolute', left: s.x - 4, top: s.y - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: s.color, opacity: Math.min(1, s.life / 300) }} />
            ))}
            {/* Bobo a cavallo del razzo. */}
            <View pointerEvents="none" style={{ position: 'absolute', left: px - pr * 1.4, top: g.y - pr * 1.9, width: pr * 2.8, height: pr * 3.2, transform: [{ rotate: `${tilt}deg` }] }}>
              <Svg width={pr * 2.2} height={pr * 2.2} viewBox="0 0 100 100" style={{ position: 'absolute', left: pr * 0.3, top: -pr * 0.2 }}>
                <Place parts={MOSTRINI.bobo.parts} cx={50} cy={50} size={100} />
              </Svg>
              <T size={pr * 1.7} style={{ position: 'absolute', left: pr * 0.35, top: pr * 1.45, lineHeight: pr * 2, transform: [{ rotate: '45deg' }] }}>
                🚀
              </T>
            </View>
          </>
        )}
        <Hud score={meters()} label="metri" best={best} extra={`🪙 ${g.coins}`} style={{ top: 12, left: 12 }} />
      </View>
      {!started && active && (
        <StartCard title="Il razzo di Bobo" lines={['Tieni premuto per salire, lascia per scendere.', 'Evita girandole e palloncini, prendi gli zecchini. Sul computer: spazio.']} onStart={() => setStarted(true)} />
      )}
    </TableBg>
  );
}
