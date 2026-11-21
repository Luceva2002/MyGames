import { useEffect, useMemo, useRef } from 'react';
import { PanResponder, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import type { RaddoppiaMove, RaddoppiaTile, RaddoppiaView } from '@giochi/engine';
import { useFit, type BoardProps } from '../common';
import { TableBg } from '../../ui/tables';
import { T } from '../../ui/kit';
import { sfx } from '../../ui/sound';
import { useReducedMotion } from '../../ui/settings';
import { colors } from '../../ui/theme';
import { Hud, NO_SELECT, swipeDir, useKeys, useRecord } from './kit';

/** Raddoppia: le tessere scivolano tutte insieme e due uguali diventano una dal valore doppio. */
const N = 4;
const GAP = 8;
const SLIDE_MS = 110;

const TILE: Record<number, { bg: string; fg: string }> = {
  2: { bg: '#FFFFFF', fg: colors.line },
  4: { bg: '#FFF1B8', fg: colors.line },
  8: { bg: '#2EC4B6', fg: colors.line },
  16: { bg: '#56B4E9', fg: colors.line },
  32: { bg: '#B57BFF', fg: '#fff' },
  64: { bg: '#FF4F8B', fg: '#fff' },
  128: { bg: '#FFC933', fg: colors.line },
  256: { bg: '#FF9F1C', fg: colors.line },
  512: { bg: '#7CF0B0', fg: colors.line },
  1024: { bg: '#E0457B', fg: '#fff' },
  2048: { bg: '#FFC933', fg: colors.line },
};
const tileColor = (v: number) => TILE[v] ?? { bg: '#0D0E11', fg: colors.accent };

export function RaddoppiaBoard({ view, myTurn, onMove }: BoardProps<RaddoppiaView, RaddoppiaMove>) {
  const { best, submit } = useRecord('raddoppia');
  const { box, onLayout } = useFit();
  const reduced = useReducedMotion();
  const active = myTurn && !view.over;

  // Un suono quando due tessere si uniscono; il record si salva quando la partita finisce.
  const lastMoves = useRef(view.moves);
  useEffect(() => {
    if (view.moves !== lastMoves.current && view.merged.length) sfx(view.merged.length > 1 ? 'capture' : 'pick');
    lastMoves.current = view.moves;
  }, [view.moves]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (view.over) submit(view.score);
  }, [view.over]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (dir: 'up' | 'down' | 'left' | 'right') => active && onMove({ dir });
  useKeys((k) => {
    const map: Record<string, 'up' | 'down' | 'left' | 'right'> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
    if (!map[k]) return false;
    go(map[k]);
    return true;
  }, active);

  const goRef = useRef(go);
  goRef.current = go;
  const done = useRef(false);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onPanResponderTerminationRequest: () => false,
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          done.current = false;
        },
        onPanResponderMove: (_, gs) => {
          if (done.current) return;
          const d = swipeDir(gs.dx, gs.dy, 28);
          if (d) {
            done.current = true;
            goRef.current(d);
          }
        },
      }),
    [],
  );

  const size = Math.max(200, Math.min(box.w - 8, box.h - 8, 520));
  const cell = (size - GAP * (N + 1)) / N;
  const tiles = [...view.ghosts.map((t) => ({ ...t, ghost: true })), ...view.tiles.map((t) => ({ ...t, ghost: false }))];

  return (
    <TableBg table="teal">
      <View style={[{ flex: 1, paddingTop: 64, padding: 10 }, NO_SELECT]} {...responder.panHandlers}>
        <Hud score={view.score} best={best !== null ? Math.max(best, view.over ? view.score : 0) : null} extra={`tessera ${view.best}`} style={{ top: 8, left: 8 }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }} onLayout={onLayout}>
          <View style={{ width: size, height: size, borderRadius: 20, backgroundColor: 'rgba(13,14,17,0.78)', borderWidth: 1.5, borderColor: colors.line, boxShadow: `0px 6px 16px rgba(0,0,0,0.35)` }}>
            {Array.from({ length: N * N }, (_, i) => (
              <View key={i} style={{ position: 'absolute', left: GAP + (i % N) * (cell + GAP), top: GAP + Math.floor(i / N) * (cell + GAP), width: cell, height: cell, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)' }} />
            ))}
            {tiles.map((t) => (
              <Tile key={t.id} tile={t} cell={cell} ghost={t.ghost} merged={view.merged.includes(t.id)} spawned={view.spawned === t.id} moveKey={view.moves} reduced={reduced} />
            ))}
          </View>
        </View>
        {view.moves === 0 && (
          <T size={14} weight="800" color="#fff" center style={{ paddingBottom: 6 }}>
            Scorri col dito (o usa le frecce) per far scivolare le tessere
          </T>
        )}
      </View>
    </TableBg>
  );
}

function Tile({ tile, cell, ghost, merged, spawned, moveKey, reduced }: { tile: RaddoppiaTile; cell: number; ghost: boolean; merged: boolean; spawned: boolean; moveKey: number; reduced: boolean }) {
  const x = GAP + (tile.cell % N) * (cell + GAP);
  const y = GAP + Math.floor(tile.cell / N) * (cell + GAP);
  const tx = useSharedValue(x);
  const ty = useSharedValue(y);
  const sc = useSharedValue(spawned && !reduced ? 0 : 1);
  useEffect(() => {
    const d = reduced ? 0 : SLIDE_MS;
    tx.value = withTiming(x, { duration: d });
    ty.value = withTiming(y, { duration: d });
  }, [x, y]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (reduced) return;
    if (spawned) sc.value = withSequence(withTiming(0, { duration: SLIDE_MS }), withTiming(1, { duration: 140 }));
    else if (merged) sc.value = withSequence(withTiming(1, { duration: SLIDE_MS }), withTiming(1.15, { duration: 90 }), withTiming(1, { duration: 110 }));
  }, [moveKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const anim = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: sc.value }] }));
  const c = tileColor(tile.v);
  const digits = String(tile.v).length;
  const fs = cell * (digits <= 2 ? 0.46 : digits === 3 ? 0.38 : 0.3);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: 0, top: 0, width: cell, height: cell, borderRadius: 12, backgroundColor: c.bg, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', zIndex: ghost ? 0 : 1, boxShadow: `0px 6px 16px rgba(0,0,0,0.35)` },
        anim,
      ]}
    >
      {tile.v >= 2048 && (
        <T size={cell * 0.2} style={{ position: 'absolute', top: 2, lineHeight: cell * 0.24 }}>
          👑
        </T>
      )}
      <T size={fs} weight="900" color={c.fg} style={{ lineHeight: fs * 1.15 }}>
        {tile.v}
      </T>
    </Animated.View>
  );
}
