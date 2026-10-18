import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { CATEGORY_LABEL, YAHTZEE_CATEGORIES, type YahtzeeMove, type YahtzeeView } from '@giochi/engine';
import { turnText, type BoardProps } from './common';
import { Button, Row, T, tap } from '../ui/kit';
import { SeatAvatar } from '../ui/avatars';
import { FlyIn, Pulse } from '../ui/motion';
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
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={blank ? 'Dado da tirare' : `Dado ${value}${held ? ', tenuto' : ''}`}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={{ alignItems: 'center', gap: 6 }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.22,
          backgroundColor: '#FFFBEE',
          borderWidth: 3,
          borderColor: held ? colors.accent2 : colors.line,
          boxShadow: held ? `0px 0px 0px 3px ${colors.accent}, 0px 10px 0px ${colors.line}` : `0px 5px 0px ${colors.line}`,
          transform: [{ translateY: held ? -10 : 0 }],
        }}
      >
        {!blank &&
          PIPS[value].map(([r, c], i) => (
            <View
              key={i}
              style={{ position: 'absolute', width: pip, height: pip, borderRadius: pip, backgroundColor: value === 1 || value === 4 ? colors.accent2 : colors.line, left: size * (0.2 + c * 0.3) - pip / 2 - 3, top: size * (0.2 + r * 0.3) - pip / 2 - 3 }}
            />
          ))}
        {blank && (
          <T size={size * 0.4} weight="900" color={colors.dim} center style={{ lineHeight: size - 6 }}>
            ?
          </T>
        )}
      </View>
      <View style={[styles.holdTag, { opacity: held ? 1 : 0 }]}>
        <T size={10} weight="900" color={colors.onAccent}>
          TENUTO
        </T>
      </View>
    </Pressable>
  );
}

export function YahtzeeBoard({ view, me, names, myTurn, onMove }: BoardProps<YahtzeeView, YahtzeeMove>) {
  const [held, setHeld] = useState([false, false, false, false, false]);
  useEffect(() => setHeld([false, false, false, false, false]), [view.turn, view.rollsLeft === 3]);
  const rolled = view.rollsLeft < 3;
  const players = Array.from({ length: view.players }, (_, i) => i);

  const { width } = useWindowDimensions();
  const dieSize = Math.min(76, Math.floor((Math.min(width, 700) - 80) / 5.6));
  const canHold = myTurn && rolled && view.rollsLeft > 0;
  return (
    <TableBg table="teal">
      {/* I giocatori in fila col totale: chi tira pulsa. */}
      <Row gap={8} wrap style={{ justifyContent: 'center', paddingTop: 8 }}>
        {players.map((p) => (
          <Pulse key={p} active={p === view.turn}>
            <View style={[styles.player, p === view.turn && { borderColor: seatColors[p % seatColors.length] }]}>
              <SeatAvatar seat={p} name={names[p]} size={30} />
              <View>
                <T size={12} weight="800" lines={1}>
                  {p === me ? 'Tu' : names[p]}
                </T>
                <T size={18} weight="900" color={colors.accent}>
                  {view.totals[p]}
                </T>
              </View>
            </View>
          </Pulse>
        ))}
      </Row>
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 12 }}>
        <Row gap={Math.round(dieSize * 0.18)}>
          {view.dice.map((d, i) => {
            const isHeld = rolled && (myTurn ? held[i] : view.held[i]);
            return (
              // Ogni tiro i dadi non tenuti rotolano di nuovo sul tavolo.
              <FlyIn key={isHeld ? `h${i}` : `${view.rollsLeft}-${view.turn}-${i}`} from={isHeld || !rolled ? 'none' : 'above'} delay={i * 60} sound={isHeld || !rolled ? undefined : 'card'}>
                <Die value={d} size={dieSize} blank={!rolled} held={isHeld} onPress={canHold ? () => setHeld((h) => h.map((x, j) => (j === i ? !x : x))) : undefined} />
              </FlyIn>
            );
          })}
        </Row>
        <T size={14} weight="800" color="#ffffffdd" center>
          {myTurn ? (rolled ? (view.rollsLeft ? 'Tocca i dadi da tenere, poi ritira o segna i punti qui sotto' : 'Scegli dove segnare i punti') : 'Tira i dadi!') : turnText(false, names, view.turn, me)}
        </T>
        {myTurn && view.rollsLeft > 0 && (
          <Row gap={10}>
            <Button label={rolled ? 'Ritira' : 'Tira'} icon="🎲" onPress={() => onMove({ type: 'roll', held })} style={{ minWidth: 180 }} />
            <Row gap={4} style={styles.rolls}>
              {[0, 1, 2].map((k) => (
                <View key={k} style={[styles.rollDot, k < view.rollsLeft && { backgroundColor: colors.accent }]} />
              ))}
            </Row>
          </Row>
        )}
      </View>
      <ScrollView contentContainerStyle={{ padding: 10 }}>
        <View style={{ backgroundColor: '#12052BD9', borderRadius: 18, padding: 10, alignSelf: 'center', width: '100%', maxWidth: 180 + view.players * 90, borderWidth: 3, borderColor: colors.line }}>
          <Row gap={0} style={{ paddingVertical: 6 }}>
            <View style={{ flex: 1.6 }} />
            {players.map((p) => (
              <View key={p} style={{ flex: 1, alignItems: 'center' }}>
                <SeatAvatar seat={p} name={names[p]} size={26} />
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
                      style={{ flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderRadius: 999, margin: 3, backgroundColor: canPick ? (view.preview[k] ? colors.accent : colors.surface2) : 'transparent', borderWidth: canPick ? 2 : 0, borderColor: colors.line }}
                    >
                      <T size={15} weight={scored !== undefined || canPick ? '900' : '500'} color={scored !== undefined ? colors.text : canPick ? (view.preview[k] ? colors.onAccent : colors.muted) : colors.dim}>
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

const styles = StyleSheet.create({
  player: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingLeft: 4, paddingRight: 10, borderRadius: 999, backgroundColor: '#12052BB3', borderWidth: 2.5, borderColor: '#FFFFFF22' },
  holdTag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: colors.accent, borderWidth: 1.5, borderColor: colors.line },
  rolls: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: '#12052BB3' },
  rollDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.line, backgroundColor: '#FFFFFF33' },
});
