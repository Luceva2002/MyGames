import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { BALL_R, isSolid, isStripe, POCKETS, simulateShot, TABLE_H, TABLE_W, type Ball, type BiliardoMove, type BiliardoState } from '@giochi/engine';
import { Banner, type BoardProps } from './common';
import { Button, Chip, Row, SeatDot, T } from '../ui/kit';
import { TableBg, TABLES } from '../ui/tables';
import { colors } from '../ui/theme';
import { useReducedMotion } from '../ui/settings';

const BALL_COLORS: Record<number, string> = {
  0: '#FAFAFA', 1: '#F9C80E', 2: '#1E5BC6', 3: '#D7263D', 4: '#6A2C91', 5: '#F86624', 6: '#1B998B', 7: '#7B2D26', 8: '#111111',
};
const colorOf = (id: number) => BALL_COLORS[id > 8 ? id - 8 : id];

function PoolBall({ id, x, y, scale }: { id: number; x: number; y: number; scale: number }) {
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
  const tableW = Math.min(width - 24 - rail * 2, (height - 300) * 2, 1000);
  const scale = tableW / TABLE_W;
  const tableH = TABLE_H * scale;
  const [aim, setAim] = useState<{ x: number; y: number } | null>(null);
  const [power, setPower] = useState(0.55);
  const [placing, setPlacing] = useState(false);
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
    const t0 = Date.now();
    const loop = () => {
      const i = Math.floor(((Date.now() - t0) / 1000) * 60);
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

  const handleTouch = (lx: number, ly: number) => {
    if (!canAct) return;
    const x = lx / scale;
    const y = ly / scale;
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
          <View key={p} style={{ alignItems: 'center', opacity: view.turn === p ? 1 : 0.6 }}>
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
          style={{ width: tableW, height: tableH, backgroundColor: '#0B6E4F', borderRadius: 4 }}
          onStartShouldSetResponder={() => canAct}
          onMoveShouldSetResponder={() => canAct}
          onResponderGrant={(e) => handleTouch(e.nativeEvent.locationX, e.nativeEvent.locationY)}
          onResponderMove={(e) => !placing && handleTouch(e.nativeEvent.locationX, e.nativeEvent.locationY)}
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
            {shownBalls.filter((b) => !b.in).map((b) => (
              <PoolBall key={b.id} id={b.id} x={b.x} y={b.y} scale={scale} />
            ))}
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
              <Row gap={6} style={{ width: '100%' }}>
                <T size={13} color={colors.muted}>
                  Forza
                </T>
                {Array.from({ length: 10 }, (_, i) => (i + 1) / 10).map((p) => (
                  <Pressable key={p} onPress={() => setPower(p)} style={{ flex: 1, height: 26, borderRadius: 4, backgroundColor: p <= power + 0.001 ? (p > 0.75 ? colors.danger : colors.accent) : colors.surface2 }} />
                ))}
              </Row>
              <Button label={aim ? 'Tira' : 'Trascina sul tavolo per mirare'} disabled={!aim} onPress={() => aim && onMove({ type: 'shoot', dx: aim.x - cue.x, dy: aim.y - cue.y, power })} style={{ alignSelf: 'stretch' }} />
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
