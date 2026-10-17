import { useEffect, useRef, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import type { FootballMove, FootballView, Kick } from '@giochi/engine';
import { Banner, type BoardProps } from './common';
import { Button, Row, SeatDot, T, tap } from '../ui/kit';
import { useLocalPoint } from '../ui/useLocalPoint';
import { useReducedMotion } from '../ui/settings';
import { TableBg } from '../ui/tables';
import { colors } from '../ui/theme';

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

const OUTCOME: Record<Kick['outcome'], string> = { gol: 'GOL!', parata: 'PARATA!', fuori: 'FUORI!', palo: 'PALO!' };

export function FootballBoard({ view, me, names, myTurn, onMove }: BoardProps<FootballView, FootballMove>) {
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const goalW = Math.min(width - 40, (height - 330) * 2.6, 720);
  const goalH = goalW / 3;
  const point = useLocalPoint();
  const [pick, setPick] = useState<{ x: number; y: number } | null>(null);
  const last = view.kicks[view.kicks.length - 1];
  const [shown, setShown] = useState<Kick | null>(null);
  const [progress, setProgress] = useState(1);
  const raf = useRef<number | null>(null);
  useEffect(() => setPick(null), [view.kicks.length]);

  // Animazione del tiro appena calciato: il pallone parte dal dischetto e arriva sul punto finale.
  useEffect(() => {
    if (!last) return;
    setShown(last);
    if (reduced) {
      setProgress(1);
      return;
    }
    const t0 = Date.now();
    const loop = () => {
      const p = Math.min(1, (Date.now() - t0) / 600);
      setProgress(p);
      if (p < 1) raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [view.kicks.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function toPx(p: { x: number; y: number }) {
    return { x: (p.x * goalW) / 2, y: goalH - p.y * goalH };
  }

  const iShoot = me === view.shooter;
  const iKeep = me === view.keeper;
  let prompt = '';
  if (myTurn) prompt = iShoot ? 'Tocca il punto della porta dove tirare' : 'Tocca dove tuffarti';
  else if (me !== null && (iShoot || iKeep)) prompt = 'Aspetta l’avversario…';
  else prompt = `${names[view.shooter]} tira, ${names[view.keeper]} para`;

  const marks = (p: 0 | 1) => view.kicks.filter((k) => k.shooter === p).map((k) => (k.outcome === 'gol' ? '⚽' : '❌'));

  return (
    <TableBg table="stadium" scrim={0.25} style={{ alignItems: 'center', gap: 12, paddingTop: 12 }}>
      <Row gap={24}>
        {([0, 1] as const).map((p) => (
          <View key={p} style={{ alignItems: 'center' }}>
            <Row gap={6}>
              <SeatDot seat={p} />
              <T weight="900">{names[p]}</T>
            </Row>
            <T size={34} weight="900">
              {view.goals[p]}
            </T>
            <T size={14}>{marks(p).join(' ') || ' '}</T>
          </View>
        ))}
      </Row>
      {view.suddenDeath && <T weight="800" color={colors.accent}>Ad oltranza!</T>}
      <Pressable
        ref={point.ref}
        disabled={!myTurn}
        onPress={(e) => {
          tap();
          point.toLocal(e, (lx, ly) =>
            setPick({ x: Math.max(-1.2, Math.min(1.2, (lx - goalW / 2 - 20) / (goalW / 2))), y: Math.max(0, Math.min(1.2, (goalH + 20 - ly) / goalH)) }),
          );
        }}
        style={{ width: goalW + 40, height: goalH + 60, paddingHorizontal: 20, paddingTop: 20 }}
      >
        <View pointerEvents="none" style={{ width: goalW, height: goalH, borderWidth: 6, borderBottomWidth: 0, borderColor: '#fff', backgroundColor: '#ffffff18' }}>
          {/* rete */}
          {Array.from({ length: 11 }, (_, i) => (
            <View key={`v${i}`} style={{ position: 'absolute', left: (goalW / 12) * (i + 1), top: 0, bottom: 0, width: 1, backgroundColor: '#ffffff30' }} />
          ))}
          {Array.from({ length: 3 }, (_, i) => (
            <View key={`h${i}`} style={{ position: 'absolute', top: (goalH / 4) * (i + 1), left: 0, right: 0, height: 1, backgroundColor: '#ffffff30' }} />
          ))}
          {shown && (
            <>
              <View style={{ position: 'absolute', left: goalW / 2 + (shown.dive.x * goalW) / 2 - 30, top: goalH - shown.dive.y * goalH - 30, width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFC94A55', alignItems: 'center', justifyContent: 'center' }}>
                <T size={30}>🧤</T>
              </View>
              <View
                style={{
                  position: 'absolute',
                  left: goalW / 2 - 16 + toPx(shown.ball).x * easeOut(progress),
                  top: -16 + goalH * 1.6 + (toPx(shown.ball).y - goalH * 1.6) * easeOut(progress),
                  transform: [{ scale: 1.6 - 0.6 * progress }],
                }}
              >
                <T size={28}>⚽</T>
              </View>
            </>
          )}
          {pick && (
            <View style={{ position: 'absolute', left: goalW / 2 + (pick.x * goalW) / 2 - 18, top: goalH - pick.y * goalH - 18, width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: iShoot ? '#FFC94A' : '#00E5FF' }} />
          )}
        </View>
        <View pointerEvents="none" style={{ height: 6, backgroundColor: '#fff', marginLeft: -20, marginRight: -20 }} />
      </Pressable>
      <View style={{ minHeight: 44 }}>
        {shown && progress >= 1 && (
          <T size={36} weight="900" color={shown.outcome === 'gol' ? colors.accent : '#fff'}>
            {OUTCOME[shown.outcome]}
          </T>
        )}
      </View>
      <Banner text={prompt} tone={myTurn ? 'turn' : 'info'} />
      {myTurn && (
        <Button
          label={iShoot ? 'Tira!' : 'Para!'}
          disabled={!pick}
          onPress={() => pick && onMove(iShoot ? { aim: pick } : { dive: pick })}
          style={{ minWidth: 200 }}
        />
      )}
    </TableBg>
  );
}
