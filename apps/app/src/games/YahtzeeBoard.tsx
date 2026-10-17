import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { CATEGORY_LABEL, YAHTZEE_CATEGORIES, type YahtzeeMove, type YahtzeeView } from '@giochi/engine';
import { Banner, turnText, type BoardProps } from './common';
import { Button, Row, SeatDot, T, tap } from '../ui/kit';
import { TableBg } from '../ui/tables';
import { colors, seatColors } from '../ui/theme';

const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

export function Die({ value, size, held, onPress, blank }: { value: number; size: number; held?: boolean; onPress?: () => void; blank?: boolean }) {
  const pip = size * 0.18;
  return (
    <Pressable
      disabled={!onPress}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.2,
        backgroundColor: held ? colors.accent : '#FAFAF5',
        borderWidth: 3,
        borderColor: held ? '#C79A1E' : '#DDD',
        transform: [{ translateY: held ? -6 : 0 }],
      }}
    >
      {!blank &&
        PIPS[value].map(([r, c], i) => (
          <View
            key={i}
            style={{ position: 'absolute', width: pip, height: pip, borderRadius: pip, backgroundColor: '#222', left: size * (0.2 + c * 0.3) - pip / 2 - 3, top: size * (0.2 + r * 0.3) - pip / 2 - 3 }}
          />
        ))}
    </Pressable>
  );
}

export function YahtzeeBoard({ view, me, names, myTurn, onMove }: BoardProps<YahtzeeView, YahtzeeMove>) {
  const [held, setHeld] = useState([false, false, false, false, false]);
  useEffect(() => setHeld([false, false, false, false, false]), [view.turn, view.rollsLeft === 3]);
  const rolled = view.rollsLeft < 3;
  const players = Array.from({ length: view.players }, (_, i) => i);

  return (
    <TableBg table="dice" scrim={0.25}>
      <View style={{ alignItems: 'center', gap: 12, paddingVertical: 12 }}>
        <Row gap={10}>
          {view.dice.map((d, i) => (
            <Die key={i} value={d} size={56} blank={!rolled} held={rolled && (myTurn ? held[i] : view.held[i])} onPress={myTurn && rolled && view.rollsLeft > 0 ? () => setHeld((h) => h.map((x, j) => (j === i ? !x : x))) : undefined} />
          ))}
        </Row>
        <Banner text={myTurn ? (rolled ? (view.rollsLeft ? 'Tieni i dadi che ti servono o segna i punti' : 'Scegli dove segnare') : 'Tira i dadi!') : turnText(false, names, view.turn, me)} tone={myTurn ? 'turn' : 'info'} />
        {myTurn && view.rollsLeft > 0 && <Button label={rolled ? `Ritira (${view.rollsLeft})` : 'Tira'} icon="🎲" onPress={() => onMove({ type: 'roll', held })} style={{ minWidth: 200 }} />}
      </View>
      <ScrollView contentContainerStyle={{ padding: 10 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 8, alignSelf: 'center', width: '100%', maxWidth: 160 + view.players * 90 }}>
          <Row gap={0} style={{ paddingVertical: 6 }}>
            <View style={{ flex: 1.6 }} />
            {players.map((p) => (
              <View key={p} style={{ flex: 1, alignItems: 'center' }}>
                <SeatDot seat={p} />
                <T size={12} weight="800" center color={p === view.turn ? seatColors[p % seatColors.length] : colors.text}>
                  {names[p]}
                </T>
              </View>
            ))}
          </Row>
          {YAHTZEE_CATEGORIES.map((k, i) => (
            <View key={k}>
              {i === 6 && (
                <Row gap={0} style={{ paddingVertical: 4, borderTopWidth: 1, borderColor: colors.line }}>
                  <T size={12} color={colors.muted} style={{ flex: 1.6 }}>
                    Bonus (63+)
                  </T>
                  {players.map((p) => (
                    <T key={p} size={12} center color={colors.muted} style={{ flex: 1 }}>
                      {view.upper[p] >= 63 ? '+35' : `${view.upper[p]}/63`}
                    </T>
                  ))}
                </Row>
              )}
              <Row gap={0} style={{ borderTopWidth: 1, borderColor: colors.line, minHeight: 36 }}>
                <T size={14} style={{ flex: 1.6 }}>
                  {CATEGORY_LABEL[k]}
                </T>
                {players.map((p) => {
                  const scored = view.scores[p][k];
                  const canPick = myTurn && p === view.turn && rolled && scored === undefined;
                  return (
                    <Pressable
                      key={p}
                      disabled={!canPick}
                      onPress={() => {
                        tap();
                        onMove({ type: 'score', category: k });
                      }}
                      style={{ flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderRadius: 8, margin: 2, backgroundColor: canPick ? colors.surface2 : 'transparent' }}
                    >
                      <T size={15} weight={scored !== undefined ? '800' : '500'} color={scored !== undefined ? colors.text : canPick ? colors.accent : colors.dim}>
                        {scored !== undefined ? scored : p === view.turn && view.preview[k] !== undefined ? view.preview[k] : ''}
                      </T>
                    </Pressable>
                  );
                })}
              </Row>
            </View>
          ))}
          <Row gap={0} style={{ borderTopWidth: 2, borderColor: colors.line, paddingVertical: 8 }}>
            <T size={16} weight="900" style={{ flex: 1.6 }}>
              Totale
            </T>
            {players.map((p) => (
              <T key={p} size={18} weight="900" center style={{ flex: 1 }}>
                {view.totals[p]}
              </T>
            ))}
          </Row>
        </View>
      </ScrollView>
    </TableBg>
  );
}
