import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { cwStepMs, type ColorWarsMove, type ColorWarsState, type CwCell, type Seat } from '@giochi/engine';
import { MyCorner, othersOf, TableTop, useFit, type BoardProps, type SeatInfo } from './common';
import { T, tap } from '../ui/kit';
import { useReducedMotion } from '../ui/settings';
import { sfx } from '../ui/sound';
import { TableBg } from '../ui/tables';
import { colors, seatColor } from '../ui/theme';

const GAP = 5;

/** I punti di una cella, disposti come su un dado. */
const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.3, 0.5], [0.7, 0.5]],
  3: [[0.5, 0.28], [0.28, 0.68], [0.72, 0.68]],
  4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]],
};

function Cell({ cell, size, boom, last, can, onPress }: { cell: CwCell | null; size: number; boom: boolean; last: boolean; can: boolean; onPress: () => void }) {
  const pip = size * 0.2;
  const dots = cell ? PIPS[Math.min(cell.v, 4)] : [];
  return (
    <Pressable
      disabled={!can}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={cell ? `Cella del posto ${cell.o + 1}, ${cell.v} punti` : 'Cella vuota'}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size * 0.2,
        borderWidth: 3,
        borderColor: boom ? colors.text : can ? colors.accent : colors.line,
        backgroundColor: boom ? colors.accent2 : cell ? seatColor(cell.o) : pressed ? colors.surface2 : colors.surface,
        transform: [{ translateY: pressed ? 2 : 0 }],
      })}
    >
      {boom && !cell ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <T size={size * 0.5} color={colors.text}>
            ✸
          </T>
        </View>
      ) : null}
      {dots.map(([x, y], i) => (
        <View key={i} style={{ position: 'absolute', left: x * (size - 6) - pip / 2, top: y * (size - 6) - pip / 2, width: pip, height: pip, borderRadius: pip, backgroundColor: colors.line }} />
      ))}
      {last && !boom ? <View style={{ position: 'absolute', left: -3, top: -3, right: -3, bottom: -3, borderRadius: size * 0.2, borderWidth: 3, borderColor: colors.text }} /> : null}
    </Pressable>
  );
}

export function ColorWarsBoard({ view, me, names, myTurn, onMove }: BoardProps<ColorWarsState, ColorWarsMove>) {
  const { box, onLayout } = useFit();
  const reduced = useReducedMotion();
  const { chain } = view;
  // La catena si rivede a passi: finché non è finita il tavolo mostra il passo corrente, non il risultato.
  const [played, setPlayed] = useState(chain.n);
  const [step, setStep] = useState({ n: chain.n, i: 0 });
  const running = !reduced && played !== chain.n && chain.frames.length > 0;
  useEffect(() => {
    if (chain.n === played) return;
    if (reduced || !chain.frames.length) {
      setPlayed(chain.n);
      return;
    }
    const frames = chain.frames.length;
    let i = 0;
    setStep({ n: chain.n, i });
    const timer = setInterval(() => {
      i++;
      if (i >= frames) {
        clearInterval(timer);
        setPlayed(chain.n);
      } else {
        setStep({ n: chain.n, i });
        sfx('capture');
      }
    }, cwStepMs(frames));
    return () => clearInterval(timer);
  }, [chain.n]); // eslint-disable-line react-hooks/exhaustive-deps

  const frame = running ? chain.frames[step.n === chain.n ? step.i : 0] : null;
  const cells = frame ? frame.cells : view.cells;
  const boom = new Set(frame?.boom ?? []);
  const canPlay = myTurn && !running && me !== null;
  const first = me !== null && !view.placed[me];
  const side = box.w ? Math.floor(Math.min(box.w, box.h, 560)) : 0;
  const size = (side - GAP * (view.size - 1) - 16) / view.size;

  // Un tocco suona subito; chi muove dopo il primo giro vede la catena partire.
  const prev = useRef(chain.n);
  useEffect(() => {
    if (chain.n !== prev.current && chain.seat !== me) sfx('pick');
    prev.current = chain.n;
  }, [chain.n]); // eslint-disable-line react-hooks/exhaustive-deps

  const info = (seat: Seat): SeatInfo => {
    const mine = cells.filter((c) => c?.o === seat).length;
    const out = view.placed[seat] && mine === 0 && view.placed.every(Boolean);
    return { seat, name: names[seat], active: view.turn === seat && view.winner === null, score: out ? '✕' : mine, scoreLabel: out ? 'fuori' : mine === 1 ? 'cella' : 'celle' };
  };
  return (
    <TableBg table="teal">
      <View style={{ flex: 1, padding: 4, gap: 6 }}>
        <TableTop seats={othersOf(view.players, me).map(info)} />
        <View onLayout={onLayout} style={{ flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
          {side > 0 && (
            <View style={{ width: side, flexDirection: 'row', flexWrap: 'wrap', gap: GAP, padding: 5, borderRadius: 22, backgroundColor: colors.line }}>
              {cells.map((cell, i) => (
                <Cell
                  key={i}
                  cell={cell}
                  size={size}
                  boom={boom.has(i)}
                  last={!running && chain.cell === i && chain.seat !== me}
                  can={canPlay && (first ? cell === null : cell?.o === me)}
                  onPress={() => {
                    tap();
                    sfx('pick');
                    onMove({ cell: i });
                  }}
                />
              ))}
            </View>
          )}
        </View>
        <MyCorner info={me === null ? null : info(me)} note={canPlay ? (first ? 'Scegli una cella vuota: parte da 3 punti' : 'Tocca una tua cella per aggiungere un punto') : undefined} />
      </View>
    </TableBg>
  );
}
