import { useEffect, useRef, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { DART_RINGS, DART_SECTORS, type DartHit, type FreccetteMove, type FreccetteState } from '@giochi/engine';
import { Banner, type BoardProps } from './common';
import { Button, Row, SeatDot, T, tap } from '../ui/kit';
import { useLocalPoint } from '../ui/useLocalPoint';
import { useReducedMotion } from '../ui/settings';
import { TableBg } from '../ui/tables';
import { colors, seatColors } from '../ui/theme';

/** Fetta di corona circolare fra due raggi e due angoli (gradi in senso orario dall'alto). */
function arc(r1: number, r2: number, a1: number, a2: number) {
  const p = (r: number, a: number) => {
    const rad = (a * Math.PI) / 180;
    return `${(Math.sin(rad) * r).toFixed(4)} ${(-Math.cos(rad) * r).toFixed(4)}`;
  };
  return `M${p(r1, a1)} L${p(r2, a1)} A${r2} ${r2} 0 0 1 ${p(r2, a2)} L${p(r1, a2)} A${r1} ${r1} 0 0 0 ${p(r1, a1)} Z`;
}

const BOARD_SCALE = 1.25; // margine per i numeri attorno al bersaglio

function Dartboard({ size, darts, reticle }: { size: number; darts: DartHit[]; reticle?: { x: number; y: number } | null }) {
  const R = DART_RINGS;
  return (
    <Svg width={size} height={size} viewBox={`${-BOARD_SCALE} ${-BOARD_SCALE} ${BOARD_SCALE * 2} ${BOARD_SCALE * 2}`}>
      <Circle cx={0} cy={0} r={BOARD_SCALE} fill="#1B1B1B" />
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
      <Circle cx={0} cy={0} r={R.outerBull} fill="#2E7D32" />
      <Circle cx={0} cy={0} r={R.bull} fill="#D32F2F" />
      {darts.map((d, i) => (
        <G key={i}>
          <Circle cx={d.x} cy={d.y} r={0.035} fill="#FFC94A" stroke="#000" strokeWidth={0.012} />
        </G>
      ))}
      {reticle && (
        <G>
          <Circle cx={reticle.x} cy={reticle.y} r={0.07} fill="none" stroke="#00E5FF" strokeWidth={0.015} />
          <Path d={`M${reticle.x - 0.11} ${reticle.y} H${reticle.x + 0.11} M${reticle.x} ${reticle.y - 0.11} V${reticle.y + 0.11}`} stroke="#00E5FF" strokeWidth={0.012} />
        </G>
      )}
    </Svg>
  );
}

/** Il mirino ondeggia attorno al punto scelto: bisogna lanciare al momento giusto. */
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

export function FreccetteBoard({ view, me, names, myTurn, onMove }: BoardProps<FreccetteState, FreccetteMove>) {
  const { width, height } = useWindowDimensions();
  const size = Math.min(width - 24, height - 280, 560);
  const point = useLocalPoint();
  const [base, setBase] = useState({ x: 0, y: -0.6 });
  const reticle = useWobble(myTurn, base);
  const shownDarts = view.darts.length ? view.darts : view.lastTurn?.darts ?? [];
  const last = view.lastTurn;

  const aimAt = (px: number, py: number) => {
    const scale = (BOARD_SCALE * 2) / size;
    setBase({ x: px * scale - BOARD_SCALE, y: py * scale - BOARD_SCALE });
  };

  return (
    <TableBg table="pub" scrim={0.2} style={{ alignItems: 'center', gap: 10, paddingTop: 8 }}>
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
      <Pressable
        ref={point.ref}
        disabled={!myTurn}
        onPress={(e) => {
          tap();
          point.toLocal(e, aimAt);
        }}
      >
        <View pointerEvents="none">
          <Dartboard size={size} darts={shownDarts} reticle={myTurn ? reticle : null} />
        </View>
      </Pressable>
      <T size={15} color={colors.muted} center>
        {view.darts.length
          ? `${names[view.turn]}: ${view.darts.map((d) => d.label).join(' · ')}`
          : last
            ? `${names[last.seat]}: ${last.darts.map((d) => d.label).join(' · ')}${last.bust ? ' — sballato!' : ''}`
            : 'Tocca il bersaglio per scegliere dove mirare'}
      </T>
      {myTurn ? (
        <Button label={`Lancia (${3 - view.darts.length})`} icon="🎯" onPress={() => onMove({ aim: reticle })} style={{ minWidth: 220 }} />
      ) : (
        <Banner text={me === null ? `Tira ${names[view.turn]}` : `Tira ${names[view.turn]}…`} />
      )}
    </TableBg>
  );
}
