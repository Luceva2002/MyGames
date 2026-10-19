import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { BALL_R, isSolid, isStripe, POCKETS, simulateShot, TABLE_H, TABLE_W, type Ball, type BiliardoMove, type BiliardoState } from '@giochi/engine';
import { Banner, type BoardProps } from './common';
import { Button, Chip, Row, SeatDot, T } from '../ui/kit';
import { TableBg, TABLES } from '../ui/tables';
import { colors } from '../ui/theme';
import { useReducedMotion } from '../ui/settings';
import { sfx } from '../ui/sound';

const BALL_COLORS: Record<number, string> = {
  0: '#FAFAFA', 1: '#F9C80E', 2: '#1E5BC6', 3: '#D7263D', 4: '#6A2C91', 5: '#F86624', 6: '#1B998B', 7: '#7B2D26', 8: '#111111',
};
const colorOf = (id: number) => BALL_COLORS[id > 8 ? id - 8 : id];

function PoolBall({ id, x, y, scale, upright }: { id: number; x: number; y: number; scale: number; upright?: boolean }) {
  const d = BALL_R * 2 * scale;
  const stripe = isStripe(id);
  return (
    <View
      style={{
        position: 'absolute',
        left: x * scale - d / 2,
        top: y * scale - d / 2,
        width: d,
        height: d,
        borderRadius: d,
        backgroundColor: stripe ? '#FAFAFA' : colorOf(id),
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0.5,
        borderColor: '#0006',
        // Sul tavolo girato le palle si raddrizzano, così i numeri si leggono.
        transform: upright ? [{ rotate: '90deg' }] : undefined,
      }}
    >
      {stripe && <View style={{ position: 'absolute', left: 0, right: 0, top: d * 0.22, bottom: d * 0.22, backgroundColor: colorOf(id) }} />}
      {id !== 0 && d > 14 && (
        <View style={{ width: d * 0.52, height: d * 0.52, borderRadius: d, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
          <T size={d * 0.34} weight="900" color="#111" style={{ lineHeight: d * 0.4 }}>
            {id}
          </T>
        </View>
      )}
    </View>
  );
}

/** Dove la bianca tocca per prima qualcosa, per disegnare la linea di mira. */
function aimGuide(balls: Ball[], cue: Ball, dx: number, dy: number) {
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  let best = Infinity;
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
    if (t < best) best = t;
  }
  const walls = [
    ux > 0 ? (TABLE_W - BALL_R - cue.x) / ux : ux < 0 ? (BALL_R - cue.x) / ux : Infinity,
    uy > 0 ? (TABLE_H - BALL_R - cue.y) / uy : uy < 0 ? (BALL_R - cue.y) / uy : Infinity,
  ];
  const t = Math.min(best, ...walls);
  return { x: cue.x + ux * t, y: cue.y + uy * t, hitsBall: best <= Math.min(...walls) };
}

export function BiliardoBoard({ view, me, names, myTurn, onMove }: BoardProps<BiliardoState, BiliardoMove>) {
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const rail = 18;
  // Sul telefono in verticale il tavolo si gira per lungo: molto più grande, con la testa in alto.
  const portrait = height > width * 1.2;
  const tableW = portrait ? Math.min((width - 24 - rail * 2) * (TABLE_W / TABLE_H), height - 330) : Math.min(width - 24 - rail * 2, (height - 300) * 2, 1000);
  const scale = tableW / TABLE_W;
  const tableH = TABLE_H * scale;
  const [aim, setAim] = useState<{ x: number; y: number } | null>(null);
  const [power, setPower] = useState(0.4);
  const [placing, setPlacing] = useState(false);
  const [striking, setStriking] = useState(false);
  const [trackW, setTrackW] = useState(0);
  const [frame, setFrame] = useState<number[] | null>(null);
  const lastId = useRef<number | null>(view.lastShot?.id ?? null);
  const raf = useRef<number | null>(null);

  // Rigioca l'ultimo tiro: la fisica è deterministica, quindi è identico a quello del server.
  const anim = useMemo(() => (view.lastShot ? simulateShot(view.lastShot.before, view.lastShot.shot, true) : null), [view.lastShot?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!view.lastShot || !anim?.frames || lastId.current === view.lastShot.id) return;
    lastId.current = view.lastShot.id;
    // Con il movimento ridotto si salta l'animazione e si mostra subito il risultato (V-MO-2).
    if (reduced) return;
    const frames = anim.frames;
    const events = anim.events ?? [];
    const t0 = Date.now();
    let prev = -1;
    const loop = () => {
      const i = Math.floor(((Date.now() - t0) / 1000) * 60);
      // Si sentono gli urti fra le biglie, le sponde e le buche, nel momento in cui succedono.
      for (const e of events) {
        if (e.frame > prev && e.frame <= i) {
          if (e.kind === 'pocket') sfx('pocket');
          else if (e.kind === 'hit' && e.v > 0.02) sfx('ball');
          else if (e.kind === 'cushion' && e.v > 0.08) sfx('card');
        }
      }
      prev = i;
      if (i >= frames.length) {
        setFrame(null);
        return;
      }
      setFrame(frames[i]);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [view.lastShot?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setAim(null);
    setPlacing(view.ballInHand && myTurn);
  }, [view.turn, view.ballInHand, myTurn]);

  const animating = frame !== null;
  const shownBalls: Ball[] = animating && view.lastShot ? view.lastShot.before.map((b, i) => ({ ...b, x: frame![i * 2], y: frame![i * 2 + 1], in: frame![i * 2] < 0 })) : view.balls;
  const cue = view.balls.find((b) => b.id === 0)!;
  const canAct = myTurn && !animating;
  const guide = canAct && aim && !placing ? aimGuide(view.balls, cue, aim.x - cue.x, aim.y - cue.y) : null;

  // Stecca: punta dietro la bianca, lungo la mira; arretra con la forza e scatta in avanti al tiro.
  const stick = (() => {
    if (!guide || !aim) return null;
    const l = Math.hypot(aim.x - cue.x, aim.y - cue.y) || 1;
    const ux = (aim.x - cue.x) / l;
    const uy = (aim.y - cue.y) / l;
    const gap = BALL_R * 1.4 + (striking ? 0 : 0.03 + power * 0.2);
    const len = 0.8;
    const x1 = cue.x - ux * gap;
    const y1 = cue.y - uy * gap;
    return { x1, y1, x2: x1 - ux * len, y2: y1 - uy * len, tx: x1 - ux * 0.02, ty: y1 - uy * 0.02, bx: x1 - ux * len * 0.62, by: y1 - uy * len * 0.62 };
  })();
  const sw = Math.max(7, BALL_R * scale * 0.9);
  const shoot = () => {
    if (!aim || striking) return;
    setStriking(true);
    setTimeout(() => {
      sfx('cue');
      setStriking(false);
      onMove({ type: 'shoot', dx: aim.x - cue.x, dy: aim.y - cue.y, power });
    }, 120);
  };

  const handleTouch = (lx: number, ly: number) => {
    if (!canAct) return;
    // Col tavolo girato il punto toccato si riporta nelle coordinate del gioco.
    const x = portrait ? (tableW - ly) / scale : lx / scale;
    const y = portrait ? lx / scale : ly / scale;
    if (placing) {
      onMove({ type: 'place', x, y });
      setPlacing(false);
    } else setAim({ x, y });
  };

  const groupLabel = (p: number) => {
    const g = view.groups[p];
    if (!g) return 'tavolo aperto';
    const left = view.balls.filter((b) => !b.in && (g === 'piene' ? isSolid(b.id) : isStripe(b.id))).length;
    return `${g} · ${left === 0 ? 'tocca alla nera' : `ne mancano ${left}`}`;
  };

  return (
    <TableBg table="billiard" scrim={0.2} style={{ alignItems: 'center', gap: 10, paddingTop: 8 }}>
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
      <View style={{ padding: rail, backgroundColor: '#5D3A1A', borderRadius: 16 }}>
        <View
          style={{ width: portrait ? tableH : tableW, height: portrait ? tableW : tableH }}
          onStartShouldSetResponder={() => canAct}
          onMoveShouldSetResponder={() => canAct}
          onResponderGrant={(e) => handleTouch(e.nativeEvent.locationX, e.nativeEvent.locationY)}
          onResponderMove={(e) => !placing && handleTouch(e.nativeEvent.locationX, e.nativeEvent.locationY)}
        >
        <View
          pointerEvents="none"
          style={[
            { width: tableW, height: tableH, backgroundColor: '#0B6E4F', borderRadius: 4 },
            portrait && { position: 'absolute', left: (tableH - tableW) / 2, top: (tableW - tableH) / 2, transform: [{ rotate: '-90deg' }] },
          ]}
        >
          {/* Panno del tavolo: texture generata con Higgsfield. */}
          <View pointerEvents="none" style={{ position: "absolute", width: tableW, height: tableH }}><Image source={TABLES.felt} style={{ width: tableW, height: tableH, borderRadius: 4 }} resizeMode="cover" /></View>
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: tableW, height: tableH }}>
            {POCKETS.map((p, i) => (
              <View key={i} style={{ position: 'absolute', left: p.x * scale - p.r * scale, top: Math.max(-p.r, Math.min(TABLE_H - p.r, p.y - p.r)) * scale, width: p.r * 2 * scale, height: p.r * 2 * scale, borderRadius: 999, backgroundColor: '#050505' }} />
            ))}
            <View style={{ position: 'absolute', left: 0.5 * scale, top: 0, bottom: 0, width: 1, backgroundColor: '#ffffff22' }} />
            {guide && (
              <Svg width={tableW} height={tableH} style={{ position: 'absolute' }}>
                <Line x1={cue.x * scale} y1={cue.y * scale} x2={guide.x * scale} y2={guide.y * scale} stroke="#ffffffcc" strokeWidth={2} strokeDasharray="6,5" />
                <Circle cx={guide.x * scale} cy={guide.y * scale} r={BALL_R * scale} stroke="#fff" strokeWidth={1.5} fill="none" />
              </Svg>
            )}
            {stick && (
              // La stecca dietro la bianca: più è tirata indietro, più forte è il colpo.
              <Svg width={tableW} height={tableH} style={{ position: 'absolute' }}>
                <Line x1={stick.x1 * scale} y1={stick.y1 * scale} x2={stick.x2 * scale} y2={stick.y2 * scale} stroke="#00000055" strokeWidth={sw + 2} strokeLinecap="round" transform="translate(3,4)" />
                <Line x1={stick.x1 * scale} y1={stick.y1 * scale} x2={stick.x2 * scale} y2={stick.y2 * scale} stroke="#C8894A" strokeWidth={sw} strokeLinecap="round" />
                <Line x1={stick.bx * scale} y1={stick.by * scale} x2={stick.x2 * scale} y2={stick.y2 * scale} stroke="#3B1F0E" strokeWidth={sw + 2} strokeLinecap="round" />
                <Line x1={stick.x1 * scale} y1={stick.y1 * scale} x2={stick.tx * scale} y2={stick.ty * scale} stroke="#EAF4FF" strokeWidth={sw - 1} strokeLinecap="butt" />
              </Svg>
            )}
            {shownBalls.filter((b) => !b.in).map((b) => (
              <PoolBall key={b.id} id={b.id} x={b.x} y={b.y} scale={scale} upright={portrait} />
            ))}
          </View>
        </View>
        </View>
      </View>
      {view.lastShot && (
        <T size={14} color={colors.muted}>
          {names[view.lastShot.seat]} {view.lastShot.text}
        </T>
      )}
      {canAct ? (
        <View style={{ gap: 10, alignItems: 'center', width: '100%', maxWidth: 520, paddingHorizontal: 12 }}>
          {view.ballInHand && (
            <Row gap={8}>
              <Chip label="Sposta la bianca" active={placing} onPress={() => setPlacing(true)} />
              <Chip label="Mira" active={!placing} onPress={() => setPlacing(false)} />
            </Row>
          )}
          {!placing && (
            <>
              <Row gap={10} style={{ width: '100%' }}>
                <T size={13} weight="800" color={colors.muted} style={{ width: 74 }}>
                  Forza {Math.round(power * 100)}%
                </T>
                {/* Si trascina il dito sulla barra: la stecca sul tavolo arretra insieme. */}
                <View
                  accessibilityRole="adjustable"
                  accessibilityLabel={`Forza del tiro ${Math.round(power * 100)} per cento`}
                  onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={(e) => trackW && setPower(Math.max(0.05, Math.min(1, e.nativeEvent.locationX / trackW)))}
                  onResponderMove={(e) => trackW && setPower(Math.max(0.05, Math.min(1, e.nativeEvent.locationX / trackW)))}
                  style={styles.track}
                >
                  <View pointerEvents="none" style={[styles.fill, { width: `${power * 100}%`, backgroundColor: power > 0.75 ? colors.danger : colors.accent }]} />
                  <View pointerEvents="none" style={[styles.knob, { left: Math.max(0, power * trackW - 14) }]} />
                </View>
              </Row>
              <Button label={aim ? 'Tira!' : 'Tocca o trascina sul tavolo per mirare'} disabled={!aim || striking} onPress={shoot} style={{ alignSelf: 'stretch' }} />
            </>
          )}
          {placing && <T color={colors.accent}>Tocca il tavolo dove mettere la bianca</T>}
        </View>
      ) : (
        <Banner text={animating ? '…' : me === null || !myTurn ? `Tira ${names[view.turn]}` : 'Aspetta…'} />
      )}
    </TableBg>
  );
}

const styles = StyleSheet.create({
  track: { flex: 1, height: 30, borderRadius: 999, backgroundColor: colors.surface2, borderWidth: 3, borderColor: colors.line, overflow: 'visible', justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999 },
  knob: { position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFBEE', borderWidth: 3, borderColor: colors.line, top: -2 },
});
