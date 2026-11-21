import { useEffect, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { DART_RINGS, DART_SECTORS, type FreccetteMove, type FreccetteState } from '@giochi/engine';
import { Banner, type BoardProps } from './common';
import { Row, SeatDot, T } from '../ui/kit';
import { useReducedMotion } from '../ui/settings';
import { sfx } from '../ui/sound';
import { TableBg } from '../ui/tables';
import { colors, seatColor, seatColors } from '../ui/theme';

/** Fetta di corona circolare fra due raggi e due angoli (gradi in senso orario dall'alto). */
function arc(r1: number, r2: number, a1: number, a2: number) {
  const p = (r: number, a: number) => {
    const rad = (a * Math.PI) / 180;
    return `${(Math.sin(rad) * r).toFixed(4)} ${(-Math.cos(rad) * r).toFixed(4)}`;
  };
  return `M${p(r1, a1)} L${p(r2, a1)} A${r2} ${r2} 0 0 1 ${p(r2, a2)} L${p(r1, a2)} A${r1} ${r1} 0 0 0 ${p(r1, a1)} Z`;
}

const BOARD_SCALE = 1.25; // margine per i numeri attorno al bersaglio
/** Spazio sotto il bersaglio per la freccetta in mano, in unità del bersaglio. */
const HAND = 0.62;
/** Dove sta la punta della freccetta in mano. */
const HAND_Y = BOARD_SCALE + 0.03;
const HAND_SCALE = 1.6;
/** Una freccetta piantata ha la coda un po' in basso a destra, verso chi l'ha lanciata (gradi). */
const LEAN = 164;

/**
 * Una freccetta con la punta nell'origine e la coda verso l'alto: punta d'acciaio, fusto zigrinato,
 * asta e alette del colore di chi la tira.
 */
function Dart({ x, y, angle, scale, color, shadow }: { x: number; y: number; angle: number; scale: number; color: string; shadow?: number }) {
  const line = colors.line;
  const body = (
    <>
      <Line x1={0} y1={0} x2={0} y2={-0.06} stroke="#D5DAE1" strokeWidth={0.014} strokeLinecap="round" />
      <Rect x={-0.022} y={-0.16} width={0.044} height={0.1} rx={0.018} fill="#7D8794" stroke={line} strokeWidth={0.009} />
      <Line x1={-0.022} y1={-0.1} x2={0.022} y2={-0.1} stroke={line} strokeWidth={0.006} />
      <Line x1={-0.022} y1={-0.125} x2={0.022} y2={-0.125} stroke={line} strokeWidth={0.006} />
      <Rect x={-0.009} y={-0.24} width={0.018} height={0.085} fill="#ECECEC" stroke={line} strokeWidth={0.006} />
      <Path d="M0 -0.215 L0.078 -0.3 L0.05 -0.345 L0 -0.33 L-0.05 -0.345 L-0.078 -0.3 Z" fill={color} stroke={line} strokeWidth={0.01} strokeLinejoin="round" />
      <Line x1={0} y1={-0.215} x2={0} y2={-0.335} stroke={line} strokeWidth={0.008} />
    </>
  );
  return (
    <G transform={`translate(${x.toFixed(4)} ${y.toFixed(4)}) scale(${scale.toFixed(3)})`}>
      {shadow ? (
        <G transform={`translate(${-0.035 * shadow} ${0.05 * shadow}) rotate(${angle})`} opacity={0.3}>
          <Path d="M0 0 L0.02 -0.16 L0.08 -0.3 L0 -0.34 L-0.08 -0.3 L-0.02 -0.16 Z" fill="#000" />
        </G>
      ) : null}
      <G transform={`rotate(${angle})`}>{body}</G>
    </G>
  );
}

function Dartboard({ size, children }: { size: number; children?: React.ReactNode }) {
  const R = DART_RINGS;
  const h = BOARD_SCALE * 2 + HAND;
  return (
    <Svg width={size} height={(size * h) / (BOARD_SCALE * 2)} viewBox={`${-BOARD_SCALE} ${-BOARD_SCALE} ${BOARD_SCALE * 2} ${h}`}>
      <Circle cx={0.03} cy={0.06} r={BOARD_SCALE - 0.02} fill="#000" opacity={0.35} />
      <Circle cx={0} cy={0} r={BOARD_SCALE - 0.02} fill="#1B1B1B" stroke={colors.line} strokeWidth={0.03} />
      {DART_SECTORS.map((n, i) => {
        const a1 = i * 18 - 9;
        const a2 = a1 + 18;
        const dark = i % 2 === 0;
        const single = dark ? '#222' : '#F3E5C0';
        const ring = dark ? '#D32F2F' : '#2E7D32';
        const rad = (i * 18 * Math.PI) / 180;
        return (
          <G key={n}>
            <Path d={arc(R.outerBull, R.trebleIn, a1, a2)} fill={single} />
            <Path d={arc(R.trebleIn, R.trebleOut, a1, a2)} fill={ring} />
            <Path d={arc(R.trebleOut, R.doubleIn, a1, a2)} fill={single} />
            <Path d={arc(R.doubleIn, R.doubleOut, a1, a2)} fill={ring} />
            <SvgText x={Math.sin(rad) * 1.12} y={-Math.cos(rad) * 1.12 + 0.05} fill="#fff" fontSize={0.13} fontWeight="bold" textAnchor="middle">
              {n}
            </SvgText>
          </G>
        );
      })}
      {/* Il filo metallico fra i settori. */}
      {DART_SECTORS.map((_, i) => {
        const a = ((i * 18 - 9) * Math.PI) / 180;
        return <Line key={`w${i}`} x1={Math.sin(a) * R.outerBull} y1={-Math.cos(a) * R.outerBull} x2={Math.sin(a) * R.doubleOut} y2={-Math.cos(a) * R.doubleOut} stroke="#BFC5CC" strokeWidth={0.006} opacity={0.7} />;
      })}
      {[R.trebleIn, R.trebleOut, R.doubleIn, R.doubleOut].map((r) => (
        <Circle key={r} r={r} fill="none" stroke="#BFC5CC" strokeWidth={0.006} opacity={0.7} />
      ))}
      <Circle cx={0} cy={0} r={R.outerBull} fill="#2E7D32" stroke="#BFC5CC" strokeWidth={0.006} />
      <Circle cx={0} cy={0} r={R.bull} fill="#D32F2F" />
      {children}
    </Svg>
  );
}

/** Il mirino ondeggia attorno al punto scelto: bisogna lasciare al momento giusto. */
function useWobble(active: boolean, base: { x: number; y: number }) {
  // Movimento ridotto: il mirino oscilla più piano e meno, il gioco resta lo stesso (P-MOTION-4).
  const k = useReducedMotion() ? 0.45 : 1;
  const [pos, setPos] = useState(base);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (!active) {
      setPos(base);
      return;
    }
    const t0 = Date.now();
    const loop = () => {
      const t = ((Date.now() - t0) / 1000) * k;
      setPos({ x: base.x + Math.sin(t * 2.1) * 0.13 + Math.sin(t * 5.3) * 0.03, y: base.y + Math.sin(t * 3.4 + 1) * 0.1 + Math.cos(t * 6.1) * 0.025 });
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [active, base.x, base.y, k]); // eslint-disable-line react-hooks/exhaustive-deps
  return pos;
}

type Flight = { x: number; y: number; angle: number; scale: number };

/** Durata del volo e dell'oscillazione dopo l'impatto, in millisecondi. */
const FLY_MS = 240;
const SETTLE_MS = 260;

export function FreccetteBoard({ view, me, names, myTurn, onMove }: BoardProps<FreccetteState, FreccetteMove>) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const size = Math.min(width - 24, (height - 250) / ((BOARD_SCALE * 2 + HAND) / (BOARD_SCALE * 2)), 560);
  const unit = size / (BOARD_SCALE * 2);
  // Col dito il mirino sta un po' sopra il polpastrello, così si vede dove si punta.
  const lift = width < 700 ? 56 / unit : 0;
  const [base, setBase] = useState<{ x: number; y: number } | null>(null);
  const [thrown, setThrown] = useState(false);
  const reticle = useWobble(myTurn && base !== null, base ?? { x: 0, y: 0 });
  const origin = useRef({ x: 0, y: 0 });

  const shownDarts = view.darts.length ? view.darts : view.lastTurn?.darts ?? [];
  const dartSeat = view.darts.length ? view.turn : view.lastTurn?.seat ?? view.turn;
  const last = view.lastTurn;

  // Ogni freccetta nuova arriva in volo dalla mano e si pianta oscillando.
  const [fly, setFly] = useState<Flight | null>(null);
  const lastHit = shownDarts[shownDarts.length - 1];
  const key = lastHit ? `${dartSeat}:${shownDarts.length}:${lastHit.x}:${lastHit.y}` : '';
  const prevKey = useRef(key);
  const from = useRef({ x: 0.25, angle: 180 });
  useEffect(() => {
    if (key === prevKey.current) return;
    prevKey.current = key;
    setThrown(false);
    if (!lastHit) return;
    if (reduced) {
      sfx('card');
      return;
    }
    const { x: sx, angle: sa } = from.current;
    from.current = { x: 0.25, angle: 180 };
    const t0 = Date.now();
    let hit = false;
    let raf = 0;
    const loop = () => {
      const t = Date.now() - t0;
      if (t < FLY_MS) {
        // Parte grande (vicina a chi guarda), sale un poco ad arco e rimpicciolisce verso il bersaglio.
        const p = t / FLY_MS;
        const e = 1 - (1 - p) ** 2;
        setFly({ x: sx + (lastHit.x - sx) * e, y: HAND_Y + (lastHit.y - HAND_Y) * e - Math.sin(p * Math.PI) * 0.25, angle: sa + (LEAN - sa) * e, scale: HAND_SCALE - (HAND_SCALE - 1) * e });
      } else if (t < FLY_MS + SETTLE_MS) {
        if (!hit) {
          hit = true;
          sfx('card');
        }
        const s = (t - FLY_MS) / 1000;
        setFly({ x: lastHit.x, y: lastHit.y, angle: LEAN + 7 * Math.sin(s * 55) * Math.exp(-s * 14), scale: 1 });
      } else {
        setFly(null);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    sfx('deal');
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      setFly(null);
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setBase(null);
    setThrown(false);
  }, [view.turn]);

  const canThrow = myTurn && !thrown && !fly;
  const toBoard = (pageX: number, pageY: number) => ({
    x: (pageX - origin.current.x) / unit - BOARD_SCALE,
    y: (pageY - origin.current.y) / unit - BOARD_SCALE - lift,
  });
  const color = seatColor(view.turn);
  const stuck = fly ? shownDarts.slice(0, -1) : shownDarts;
  // La freccetta in mano segue il mirino da sotto il bersaglio e punta verso di lui.
  const handX = base ? reticle.x * 0.6 : 0.25;
  const handAngle = base ? Math.max(150, Math.min(210, (Math.atan2(-(reticle.x - handX), reticle.y - HAND_Y) * 180) / Math.PI)) : 180;

  return (
    <TableBg table="pub" style={{ alignItems: 'center', gap: 10, paddingTop: 12 }}>
      <Row gap={10} wrap style={{ justifyContent: 'center', paddingHorizontal: 8 }}>
        {view.remaining.map((r, p) => (
          <View key={p} style={{ alignItems: 'center', padding: 8, borderRadius: 12, minWidth: 80, backgroundColor: view.turn === p ? colors.surface2 : colors.surface, borderWidth: 2, borderColor: view.turn === p ? seatColors[p % seatColors.length] : 'transparent' }}>
            <Row gap={6}>
              <SeatDot seat={p} />
              <T size={13} weight="800">
                {names[p]}
              </T>
            </Row>
            <T size={26} weight="900">
              {r}
            </T>
          </View>
        ))}
      </Row>
      {/* Si tiene premuto sul bersaglio per mirare e si lascia per lanciare. */}
      <View
        accessibilityRole="adjustable"
        accessibilityLabel="Bersaglio: tieni premuto per mirare, lascia per lanciare"
        onStartShouldSetResponder={() => canThrow}
        onMoveShouldSetResponder={() => canThrow}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          const { pageX, pageY, locationX, locationY } = e.nativeEvent;
          origin.current = { x: pageX - locationX, y: pageY - locationY };
          setBase(toBoard(pageX, pageY));
        }}
        onResponderMove={(e) => base && setBase(toBoard(e.nativeEvent.pageX, e.nativeEvent.pageY))}
        onResponderRelease={() => {
          if (!base || !canThrow) return;
          from.current = { x: handX, angle: handAngle };
          setThrown(true);
          setBase(null);
          onMove({ aim: { x: reticle.x, y: reticle.y } });
        }}
        onResponderTerminate={() => setBase(null)}
      >
        <View pointerEvents="none">
          <Dartboard size={size}>
            {stuck.map((d, i) => (
              <Dart key={i} x={d.x} y={d.y} angle={LEAN} scale={1} color={seatColor(dartSeat)} shadow={1} />
            ))}
            {fly && <Dart x={fly.x} y={fly.y} angle={fly.angle} scale={fly.scale} color={seatColor(dartSeat)} shadow={fly.scale < 1.05 ? 1 : 0} />}
            {base && myTurn && (
              <G>
                <Circle cx={reticle.x} cy={reticle.y} r={0.07} fill="none" stroke="#00E5FF" strokeWidth={0.015} />
                <Path d={`M${reticle.x - 0.11} ${reticle.y} H${reticle.x + 0.11} M${reticle.x} ${reticle.y - 0.11} V${reticle.y + 0.11}`} stroke="#00E5FF" strokeWidth={0.012} />
              </G>
            )}
            {canThrow && <Dart x={handX} y={HAND_Y} angle={handAngle} scale={HAND_SCALE} color={color} />}
          </Dartboard>
        </View>
      </View>
      <T size={15} color={colors.muted} center>
        {view.darts.length
          ? `${names[view.turn]}: ${view.darts.map((d) => d.label).join(' · ')}`
          : last
            ? `${names[last.seat]}: ${last.darts.map((d) => d.label).join(' · ')}${last.bust ? ' — sballato!' : ''}`
            : ' '}
      </T>
      {myTurn ? (
        <T size={14} weight="700" center>
          {base ? 'Lascia per lanciare' : `Tieni premuto sul bersaglio per mirare, lascia per lanciare (${3 - view.darts.length})`}
        </T>
      ) : (
        <Banner text={me === null ? `Tira ${names[view.turn]}` : `Tira ${names[view.turn]}…`} />
      )}
    </TableBg>
  );
}
