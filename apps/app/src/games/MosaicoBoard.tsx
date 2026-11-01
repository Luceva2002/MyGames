import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, useWindowDimensions, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { MOSAICO_PIECES, mosaicoCorners, mosaicoFits, mosaicoHasSpot, mosaicoLeft, mosaicoOrientations, mosaicoShape, mosaicoSpots, type MosaicoMove, type MosaicoShape, type MosaicoState, type Seat } from '@giochi/engine';
import { MyCorner, othersOf, TableTop, useFit, type BoardProps, type SeatInfo } from './common';
import { Button, T, tap } from '../ui/kit';
import { sfx } from '../ui/sound';
import { TableBg } from '../ui/tables';
import { colors, seatColor } from '../ui/theme';
import { useLocalPoint } from '../ui/useLocalPoint';

const OK = '#7CF0B0';
const NO = '#FF5A6E';
const CONTROL = { flex: 1, paddingHorizontal: 2 };

const widthOf = (shape: MosaicoShape) => Math.max(...shape.map((c) => c[0])) + 1;
const heightOf = (shape: MosaicoShape) => Math.max(...shape.map((c) => c[1])) + 1;

/** La griglia con i pezzi già giocati: si ridisegna solo quando cambia, non mentre si trascina. */
const Grid = memo(function Grid({ side, size, board, last, corners, starts, firsts }: { side: number; size: number; board: (Seat | null)[]; last: number[]; corners: number[]; starts: number[]; firsts: boolean[] }) {
  const cell = side / size;
  const at = (i: number) => ({ x: (i % size) * cell, y: Math.floor(i / size) * cell });
  return (
    <Svg width={side} height={side}>
      <Rect width={side} height={side} fill={colors.line} />
      {board.map((owner, i) => {
        const p = at(i);
        return <Rect key={i} x={p.x + 0.5} y={p.y + 0.5} width={cell - 1} height={cell - 1} rx={Math.min(3, cell * 0.14)} fill={owner === null ? colors.surface : seatColor(owner)} />;
      })}
      {starts.map((c, seat) => {
        if (!firsts[seat]) return null;
        const p = at(c);
        return <Rect key={`s${seat}`} x={p.x + 2} y={p.y + 2} width={cell - 4} height={cell - 4} rx={2} fill="none" stroke={seatColor(seat)} strokeWidth={2.5} />;
      })}
      {last.map((c) => {
        const p = at(c);
        return <Rect key={`l${c}`} x={p.x + 1} y={p.y + 1} width={cell - 2} height={cell - 2} rx={2} fill="none" stroke="#FFFFFF" strokeWidth={2} />;
      })}
      {corners.map((c) => {
        const p = at(c);
        return <Circle key={`c${c}`} cx={p.x + cell / 2} cy={p.y + cell / 2} r={Math.max(2, cell * 0.16)} fill={colors.accent} />;
      })}
    </Svg>
  );
});

/** Un pezzo in piccolo, per la riserva. */
function Mini({ shape, cell, color }: { shape: MosaicoShape; cell: number; color: string }) {
  return (
    <View style={{ width: widthOf(shape) * cell, height: heightOf(shape) * cell }}>
      {shape.map(([x, y], i) => (
        <View key={i} style={{ position: 'absolute', left: x * cell, top: y * cell, width: cell - 1, height: cell - 1, borderRadius: 1.5, backgroundColor: color }} />
      ))}
    </View>
  );
}

export function MosaicoBoard({ view, me, names, myTurn, onMove }: BoardProps<MosaicoState, MosaicoMove>) {
  const { width, height } = useWindowDimensions();
  const wide = width >= 700 && width > height;
  const { box, onLayout } = useFit();
  const { size } = view;
  const side = box.w ? Math.floor((Math.min(box.w, box.h) - 16) / size) * size : 0;
  const cell = side / size;

  const [sel, setSel] = useState<MosaicoMove | null>(null);
  const moved = view.reserve.reduce((n, r) => n + r.length, 0);
  useEffect(() => setSel(null), [moved, view.turn]);

  const shape = sel ? mosaicoShape(sel.piece, sel.rot, sel.flip) : null;
  const fits = !!sel && !!shape && me !== null && myTurn && mosaicoFits(view, me, shape, sel.x, sel.y);

  /** Il posto valido più vicino al punto (cx, cy); se non ce n'è uno a portata il pezzo resta lì, in rosso. */
  const settle = (s: MosaicoShape, cx: number, cy: number, reach: number) => {
    const w = widthOf(s);
    const h = heightOf(s);
    const raw = { x: Math.max(0, Math.min(size - w, Math.round(cx - (w - 1) / 2))), y: Math.max(0, Math.min(size - h, Math.round(cy - (h - 1) / 2))) };
    let best = raw;
    let bestD = reach * reach + 0.01;
    for (const spot of mosaicoSpots(view, me!, s)) {
      const d = (spot.x + (w - 1) / 2 - cx) ** 2 + (spot.y + (h - 1) / 2 - cy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = spot;
      }
    }
    return best;
  };
  const centerOf = (s: MosaicoShape, x: number, y: number) => ({ cx: x + (widthOf(s) - 1) / 2, cy: y + (heightOf(s) - 1) / 2 });

  const choose = (piece: string) => {
    tap();
    if (sel?.piece === piece) return setSel(null);
    // Si parte da dove stava il pezzo di prima, altrimenti dal mio ultimo angolo libero; con una posizione che ci stia, se c'è.
    const orient = mosaicoOrientations(piece).find(({ cells }) => mosaicoSpots(view, me!, cells).length) ?? mosaicoOrientations(piece)[0];
    const spots = mosaicoSpots(view, me!, orient.cells);
    const mid = (size - 1) / 2;
    const near = spots.length ? spots.reduce((a, b) => (Math.abs(a.x - mid) + Math.abs(a.y - mid) <= Math.abs(b.x - mid) + Math.abs(b.y - mid) ? a : b)) : { x: 0, y: 0 };
    setSel({ piece, rot: orient.rot, flip: orient.flip, ...near });
  };
  const reshape = (rot: number, flip: boolean) => {
    if (!sel || !shape) return;
    tap();
    const { cx, cy } = centerOf(shape, sel.x, sel.y);
    const next = mosaicoShape(sel.piece, rot, flip);
    setSel({ ...sel, rot, flip, ...settle(next, cx, cy, 3) });
  };
  const confirm = () => {
    if (!fits || !sel) return;
    sfx('card');
    onMove(sel);
    setSel(null);
  };

  // Sulla griglia: un tocco porta il pezzo lì (al posto valido più vicino), trascinando si sposta di
  // quanto si muove il dito, così resta visibile; un tocco sul pezzo già verde lo conferma.
  const { ref, toLocal } = useLocalPoint<View>();
  const touch = useRef<{ px: number; py: number; moved: boolean; start: MosaicoMove } | null>(null);
  const grant = (e: GestureResponderEvent) => {
    if (!sel) return;
    touch.current = { px: e.nativeEvent.pageX, py: e.nativeEvent.pageY, moved: false, start: sel };
  };
  const moveTouch = (e: GestureResponderEvent) => {
    const t = touch.current;
    if (!t || !shape) return;
    const dx = e.nativeEvent.pageX - t.px;
    const dy = e.nativeEvent.pageY - t.py;
    if (!t.moved && Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
    t.moved = true;
    const x = Math.max(0, Math.min(size - widthOf(shape), t.start.x + Math.round(dx / cell)));
    const y = Math.max(0, Math.min(size - heightOf(shape), t.start.y + Math.round(dy / cell)));
    setSel((s) => (s && (s.x !== x || s.y !== y) ? { ...s, x, y } : s));
  };
  const release = (e: GestureResponderEvent) => {
    const t = touch.current;
    touch.current = null;
    if (!t || t.moved || !shape || !sel) return;
    e.persist?.();
    toLocal(e, (lx, ly) => {
      const gx = Math.floor(lx / cell);
      const gy = Math.floor(ly / cell);
      if (fits && shape.some(([cx, cy]) => cx + sel.x === gx && cy + sel.y === gy)) return confirm();
      tap();
      setSel({ ...sel, ...settle(shape, gx, gy, 3) });
    });
  };

  const corners = useMemo(() => (myTurn && me !== null ? mosaicoCorners(view, me) : []), [myTurn, me, view.board]); // eslint-disable-line react-hooks/exhaustive-deps
  const firsts = useMemo(() => view.reserve.map((r) => r.length === Object.keys(MOSAICO_PIECES).length), [view.reserve]);
  const mine = me === null ? [] : [...view.reserve[me]].sort((a, b) => MOSAICO_PIECES[b].length - MOSAICO_PIECES[a].length);
  const usable = useMemo(() => new Set(myTurn && me !== null ? view.reserve[me].filter((p) => mosaicoHasSpot(view, me, p)) : []), [myTurn, me, view.board]); // eslint-disable-line react-hooks/exhaustive-deps

  const info = (seat: Seat): SeatInfo => ({
    seat,
    name: names[seat],
    active: view.turn === seat && !view.over,
    score: mosaicoLeft(view.reserve[seat]),
    scoreLabel: view.stuck[seat] ? 'rimasti · passa' : 'rimasti',
  });

  const panelW = wide ? 320 : Math.min(width - 56, 560);
  const tile = Math.floor((panelW - 6 * 3) / 7);
  const mini = Math.floor((tile - 6) / 5);
  const panel =
    me === null ? null : (
      <View style={{ gap: 6, width: wide ? panelW : undefined, alignSelf: 'center' }}>
        <MyCorner info={info(me)} style={wide ? { position: 'relative', right: 0, bottom: 0, alignItems: 'center' } : undefined} note={myTurn && !sel ? (firsts[me] ? 'Scegli un pezzo: deve coprire il tuo angolo' : 'Scegli un pezzo: deve toccare un tuo spigolo') : undefined} />
        {myTurn && sel && (
          <View style={{ flexDirection: 'row', gap: 5, width: panelW }}>
            <Button small kind="ghost" color={colors.text} label="↻ Ruota" style={CONTROL} onPress={() => reshape(sel.rot + 1, sel.flip)} />
            <Button small kind="ghost" color={colors.text} label="⇋ Specchia" style={[CONTROL, { flex: 1.3 }]} onPress={() => reshape(sel.rot, !sel.flip)} />
            <Button small label="✓ Metti" disabled={!fits} style={CONTROL} onPress={confirm} />
          </View>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3, justifyContent: 'center', opacity: myTurn ? 1 : 0.65 }}>
          {mine.map((piece) => {
            const on = sel?.piece === piece;
            const can = usable.has(piece);
            return (
              <Pressable
                key={piece}
                disabled={!can}
                onPress={() => choose(piece)}
                accessibilityRole="button"
                accessibilityLabel={`Pezzo da ${MOSAICO_PIECES[piece].length} quadretti${on ? ', scelto' : ''}`}
                style={{ width: tile, height: tile, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.accent : 'rgba(18,5,43,0.6)', borderWidth: 2, borderColor: on ? colors.line : 'transparent', opacity: myTurn && !can ? 0.35 : 1 }}
              >
                <Mini shape={mosaicoShape(piece, 0, false)} cell={mini} color={on ? colors.onAccent : seatColor(me)} />
              </Pressable>
            );
          })}
        </View>
      </View>
    );

  return (
    <TableBg table="teal">
      <View style={{ flex: 1, padding: 2, gap: 6 }}>
        <TableTop seats={othersOf(view.players, me).map(info)} />
        <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column', gap: 8 }}>
          <View onLayout={onLayout} style={{ flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
            {side > 0 && (
              <View
                ref={ref}
                collapsable={false}
                onStartShouldSetResponder={() => !!sel}
                onMoveShouldSetResponder={() => !!sel}
                onResponderGrant={grant}
                onResponderMove={moveTouch}
                onResponderRelease={release}
                accessibilityLabel={`Griglia ${size} per ${size}`}
                style={{ width: side, height: side, borderRadius: 4, overflow: 'hidden', borderWidth: 0, touchAction: 'none' } as object}
              >
                <View pointerEvents="none">
                  <Grid side={side} size={size} board={view.board} last={view.last?.cells ?? []} corners={sel ? [] : corners} starts={view.starts} firsts={firsts} />
                </View>
                {sel && shape && shape.map(([x, y], i) => (
                  <View key={i} pointerEvents="none" style={{ position: 'absolute', left: (x + sel.x) * cell, top: (y + sel.y) * cell, width: cell, height: cell, backgroundColor: fits ? `${OK}E6` : `${NO}E6`, borderWidth: 2, borderColor: colors.line, borderRadius: 3 }} />
                ))}
              </View>
            )}
          </View>
          {panel}
        </View>
        {me === null && <T size={12} color="#ffffffaa" center>{`Griglia ${size}×${size}`}</T>}
      </View>
    </TableBg>
  );
}
