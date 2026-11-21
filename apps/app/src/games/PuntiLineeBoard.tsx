import { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { hLine, PUNTI_SIZES, vLine, type PuntiLineeMove, type PuntiLineeState, type Seat } from '@giochi/engine';
import { MyCorner, othersOf, TableTop, useFit, type BoardProps, type SeatInfo } from './common';
import { SeatAvatar } from '../ui/avatars';
import { Chip, Row, T, tap } from '../ui/kit';
import { PopIn } from '../ui/motion';
import { sfx } from '../ui/sound';
import { TableBg } from '../ui/tables';
import { colors, seatColor } from '../ui/theme';

/** Una linea tra due punti: il suo spazio da toccare è largo, così si prende anche col dito. */
function Line({ x, y, gap, across, owner, last, can, onPress }: { x: number; y: number; gap: number; across: boolean; owner: Seat | null; last: boolean; can: boolean; onPress: () => void }) {
  const hit = Math.min(44, gap * 0.56);
  const thick = Math.max(7, gap * 0.11);
  const len = gap - 4;
  const box = across ? { left: x + 2, top: y - hit / 2, width: len, height: hit } : { left: x - hit / 2, top: y + 2, width: hit, height: len };
  return (
    <Pressable disabled={!can} onPress={onPress} accessibilityRole="button" accessibilityLabel={owner === null ? 'Linea libera' : 'Linea tracciata'} style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center', zIndex: 2, ...box }}>
      {({ pressed }) => (
        <View
          style={{
            width: across ? len : thick,
            height: across ? thick : len,
            borderRadius: thick,
            backgroundColor: owner !== null ? seatColor(owner) : pressed ? colors.accent : can ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.14)',
            borderWidth: owner !== null ? 2 : 0,
            borderColor: last ? colors.text : colors.line,
          }}
        />
      )}
    </Pressable>
  );
}

export function PuntiLineeBoard({ view, me, names, myTurn, onMove }: BoardProps<PuntiLineeState, PuntiLineeMove>) {
  const { box, onLayout } = useFit();
  const { dots } = view;
  const side = box.w ? Math.floor(Math.min(box.w, box.h, 600)) - 22 : 0;
  const pad = 22;
  const gap = (side - pad * 2) / (dots - 1);
  const dot = Math.max(14, gap * 0.2);
  const pos = (i: number) => pad + i * gap;

  const closed = view.boxes.filter((b) => b !== null).length;
  const before = useRef(closed);
  useEffect(() => {
    if (closed > before.current) sfx('capture');
    before.current = closed;
  }, [closed]);

  const info = (seat: Seat): SeatInfo => ({
    seat,
    name: names[seat],
    active: view.turn === seat && closed < view.boxes.length,
    score: view.boxes.filter((b) => b === seat).length,
    scoreLabel: 'quadrati',
  });
  const draw = (line: number) => {
    tap();
    sfx('pick');
    onMove({ line });
  };
  const n = dots - 1;
  return (
    <TableBg table="teal">
      <View style={{ flex: 1, padding: 4, gap: 6 }}>
        <TableTop seats={othersOf(view.players, me).map(info)} />
        {myTurn && view.last === null && (
          <Row gap={6} style={{ justifyContent: 'center' }}>
            {PUNTI_SIZES.map((d) => (
              <Chip key={d} label={`${d}×${d}`} active={d === dots} onPress={() => d !== dots && onMove({ dots: d })} />
            ))}
          </Row>
        )}
        <View onLayout={onLayout} style={{ flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
          {side > 0 && (
            <View style={{ width: side, height: side, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, boxSizing: 'content-box' } as object}>
              {view.boxes.map((owner, b) =>
                owner === null ? null : (
                  <PopIn key={b} style={{ position: 'absolute', left: pos(b % n) + 2, top: pos(Math.floor(b / n)) + 2, width: gap - 4, height: gap - 4 }} pointerEvents="none">
                    <View style={{ flex: 1, borderRadius: 6, backgroundColor: seatColor(owner), alignItems: 'center', justifyContent: 'center' }}>
                      <SeatAvatar seat={owner} name={names[owner]} size={Math.round(gap * 0.55)} />
                    </View>
                  </PopIn>
                ),
              )}
              {Array.from({ length: dots }, (_, r) =>
                Array.from({ length: n }, (_, c) => {
                  const line = hLine(dots, r, c);
                  return <Line key={`h${line}`} x={pos(c)} y={pos(r)} gap={gap} across owner={view.lines[line]} last={view.last === line} can={myTurn && view.lines[line] === null} onPress={() => draw(line)} />;
                }),
              )}
              {Array.from({ length: n }, (_, r) =>
                Array.from({ length: dots }, (_, c) => {
                  const line = vLine(dots, r, c);
                  return <Line key={`v${line}`} x={pos(c)} y={pos(r)} gap={gap} across={false} owner={view.lines[line]} last={view.last === line} can={myTurn && view.lines[line] === null} onPress={() => draw(line)} />;
                }),
              )}
              {Array.from({ length: dots * dots }, (_, i) => (
                <View key={i} pointerEvents="none" style={{ position: 'absolute', zIndex: 3, left: pos(i % dots) - dot / 2, top: pos(Math.floor(i / dots)) - dot / 2, width: dot, height: dot, borderRadius: dot, backgroundColor: '#FFFDF6', borderWidth: 1.5, borderColor: colors.line }} />
              ))}
            </View>
          )}
        </View>
        {me !== null && <MyCorner info={info(me)} note={myTurn && view.last === null ? 'Tocca tra due punti per tracciare una linea' : undefined} />}
      </View>
    </TableBg>
  );
}
