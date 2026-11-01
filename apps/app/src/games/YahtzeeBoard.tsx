import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { CATEGORY_LABEL, YAHTZEE_CATEGORIES, type Seat, type YahtzeeCategory, type YahtzeeMove, type YahtzeeView } from '@giochi/engine';
import { turnText, type BoardProps } from './common';
import { Button, Row, T, tap } from '../ui/kit';
import { SeatAvatar } from '../ui/avatars';
import { FlyIn, Pulse } from '../ui/motion';
import { TableBg } from '../ui/tables';
import { colors, seatColors } from '../ui/theme';

const SHORT: Record<YahtzeeCategory, string> = {
  uno: 'Uno', due: 'Due', tre: 'Tre', quattro: 'Quattro', cinque: 'Cinque', sei: 'Sei',
  tris: 'Tris', poker: 'Poker', full: 'Full', scalina: 'Scala di 4', scala: 'Scala di 5', yahtzee: 'Yahtzee', chance: 'Chance',
};
const HINT: Partial<Record<YahtzeeCategory, string>> = { tris: 'somma', poker: 'somma', full: '25', scalina: '30', scala: '40', yahtzee: '50', chance: 'somma' };

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
      // Larga quanto il dado: la scritta TENUTO può sporgere un po' senza allargare la fila.
      style={{ alignItems: 'center', gap: 6, width: size }}
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

  const { width, height } = useWindowDimensions();
  // Da computer (schermo largo) dadi a sinistra e scheda a destra, così si vede tutto senza scorrere.
  const side = width >= 900 && width > height;
  const dieSize = Math.min(76, Math.floor((Math.min(width, 700) - 80) / 5.6));
  const canHold = myTurn && rolled && view.rollsLeft > 0;
  // Si vede la scheda di chi sta tirando: la mia quando tocca a me, quella del computer mentre gioca.
  const sheetSeat = myTurn && me !== null ? me : view.turn;
  return (
    <TableBg table="teal">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={side ? { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 12, flexGrow: 1 } : { flexGrow: 1 }}>
      <View style={side ? { flex: 1, justifyContent: 'center' } : undefined}>
      {/* I giocatori in fila col totale: chi tira ha la freccia e il nome colorato. */}
      <Row gap={8} wrap style={{ justifyContent: 'center', paddingTop: 8 }}>
        {players.map((p) => (
          <Pulse key={p} active={p === view.turn}>
            <View style={styles.player}>
              <SeatAvatar seat={p} name={names[p]} size={30} />
              <View>
                <T size={12} weight="800" lines={1} color={p === view.turn ? seatColors[p % seatColors.length] : colors.text}>
                  {p === view.turn ? '▶ ' : ''}
                  {p === me ? 'Tu' : names[p]}
                </T>
                <T size={18} weight="800" color={colors.accent}>
                  {view.totals[p]}
                </T>
              </View>
            </View>
          </Pulse>
        ))}
      </Row>
      <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
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
          {myTurn ? (rolled ? (view.rollsLeft ? 'Tocca i dadi da tenere, poi ritira o segna' : 'Scegli dove segnare i punti') : 'Tira i dadi!') : turnText(false, names, view.turn, me)}
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
      </View>
      <View style={side ? { width: Math.min(560, width * 0.48) } : { paddingHorizontal: 8, paddingBottom: 8 }}>
      <ScoreSheet view={view} names={names} me={me} seat={sheetSeat} canPick={myTurn && rolled} onPick={(category) => onMove({ type: 'score', category })} />
      </View>
      </ScrollView>
    </TableBg>
  );
}

/** Faccia piccola di dado per le caselle dall'Uno al Sei. */
function MiniDie({ value, size = 24 }: { value: number; size?: number }) {
  const pip = size * 0.2;
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.22, backgroundColor: '#FFFBEE', borderWidth: 2, borderColor: colors.line }}>
      {PIPS[value].map(([r, c], i) => (
        <View key={i} style={{ position: 'absolute', width: pip, height: pip, borderRadius: pip, backgroundColor: value === 1 || value === 4 ? colors.accent2 : colors.line, left: size * (0.2 + c * 0.3) - pip / 2 - 2, top: size * (0.2 + r * 0.3) - pip / 2 - 2 }} />
      ))}
    </View>
  );
}

/**
 * Una casella della scheda. Già segnata: il punteggio con la spunta. Libera nel mio turno: i punti
 * che farei adesso, accesa se valgono qualcosa (tocco = segno lì). Libera e fuori turno: un trattino.
 */
function Cell({ k, scored, preview, canPick, best, onPick }: { k: YahtzeeCategory; scored?: number; preview?: number; canPick: boolean; best: boolean; onPick: () => void }) {
  const upper = YAHTZEE_CATEGORIES.indexOf(k) < 6;
  const pickable = canPick && scored === undefined && preview !== undefined;
  const hot = pickable && (preview ?? 0) > 0;
  return (
    <Pressable
      disabled={!pickable}
      accessibilityRole={pickable ? 'button' : undefined}
      accessibilityLabel={`${CATEGORY_LABEL[k]}: ${scored !== undefined ? `${scored} punti segnati` : pickable ? `segna ${preview} punti` : 'libera'}`}
      onPress={() => {
        tap();
        onPick();
      }}
      style={(state) => [
        styles.cell,
        scored !== undefined && styles.cellDone,
        hot && styles.cellHot,
        best && styles.cellBest,
        pickable && !hot && styles.cellZero,
        { transform: [{ translateY: (state as { pressed: boolean }).pressed ? 2 : 0 }] },
      ]}
    >
      {upper ? <MiniDie value={YAHTZEE_CATEGORIES.indexOf(k) + 1} /> : null}
      <T size={13} weight="800" lines={1} style={{ flex: 1, minWidth: 0 }} color={hot ? colors.onAccent : scored !== undefined ? colors.muted : colors.text}>
        {SHORT[k]}
        {!upper && HINT[k] && HINT[k] !== 'somma' ? (
          <T size={10} weight="700" color={hot ? colors.onAccent : colors.dim}>
            {`  ${HINT[k]}`}
          </T>
        ) : null}
      </T>
      <T size={17} weight="800" color={hot ? colors.onAccent : scored !== undefined ? colors.text : pickable ? colors.muted : colors.dim}>
        {scored !== undefined ? (scored === 0 ? '✗' : `${scored}`) : pickable ? (hot ? `+${preview}` : '0') : '–'}
      </T>
    </Pressable>
  );
}

/**
 * La scheda dei punti come in una plancia da gioco: a sinistra la parte alta (dall'Uno al Sei) con la
 * barra del bonus, a destra le combinazioni. Sta tutta nello schermo, senza scorrere; il confronto
 * con gli altri giocatori si apre a parte.
 */
function ScoreSheet({ view, names, me, seat, canPick, onPick }: { view: YahtzeeView; names: string[]; me: Seat | null; seat: Seat; canPick: boolean; onPick: (k: YahtzeeCategory) => void }) {
  const [compare, setCompare] = useState(false);
  const { width } = useWindowDimensions();
  const sc = view.scores[seat];
  const pick = canPick && seat === view.turn;
  const free = YAHTZEE_CATEGORIES.filter((k) => sc[k] === undefined && view.preview[k] !== undefined);
  const best = pick ? free.reduce<YahtzeeCategory | null>((b, k) => (b === null || (view.preview[k] ?? 0) > (view.preview[b] ?? 0) ? k : b), null) : null;
  const upper = view.upper[seat];
  const cell = (k: YahtzeeCategory) => <Cell key={k} k={k} scored={sc[k]} preview={seat === view.turn ? view.preview[k] : undefined} canPick={pick} best={best === k && (view.preview[k] ?? 0) > 0} onPick={() => onPick(k)} />;
  const players = Array.from({ length: view.players }, (_, i) => i);
  return (
    <View style={[styles.sheet, { maxWidth: width > 700 ? 640 : undefined }]}>
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <Row gap={6}>
          <SeatAvatar seat={seat} name={names[seat]} size={24} />
          <T size={14} weight="800">
            {seat === me ? 'La tua scheda' : `Scheda di ${names[seat]}`}
          </T>
        </Row>
        <Row gap={8}>
          <T size={20} weight="800" color={colors.accent}>
            {view.totals[seat]}
            <T size={11} weight="700" color={colors.muted}>
              {' pt'}
            </T>
          </T>
          {view.players > 1 && (
            <Pressable accessibilityRole="button" accessibilityLabel="Tutti i punti" onPress={() => setCompare(true)} style={styles.compareBtn}>
              <T size={12} weight="800" color={colors.accent}>
                📋 Tutti
              </T>
            </Pressable>
          )}
        </Row>
      </Row>
      <Row gap={8} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 5 }}>
          {YAHTZEE_CATEGORIES.slice(0, 6).map(cell)}
          <View style={styles.bonus} accessibilityLabel={`Bonus: ${upper} su 63`}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T size={11} weight="800" color={colors.muted}>
                Bonus +35
              </T>
              <T size={11} weight="800" color={upper >= 63 ? colors.success : colors.muted}>
                {upper >= 63 ? '✓ preso' : `${upper}/63`}
              </T>
            </Row>
            <View style={styles.bonusTrack}>
              <View style={{ width: `${Math.min(1, upper / 63) * 100}%`, height: '100%', borderRadius: 999, backgroundColor: upper >= 63 ? colors.success : colors.accent }} />
            </View>
          </View>
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          {YAHTZEE_CATEGORIES.slice(6).map(cell)}
        </View>
      </Row>
      {view.bonus[seat] ? (
        <T size={12} weight="800" color={colors.success} center>
          Bonus Yahtzee +{view.bonus[seat]}
        </T>
      ) : null}

      <Modal visible={compare} transparent animationType="fade" onRequestClose={() => setCompare(false)}>
        <Pressable style={styles.scrim} onPress={() => setCompare(false)}>
          <Pressable style={styles.compareCard} onPress={() => {}}>
            <T size={20} weight="900">
              Tutti i punti
            </T>
            <ScrollView style={{ maxHeight: 520 }}>
              <Row gap={0} style={{ paddingVertical: 6 }}>
                <View style={{ flex: 1.4 }} />
                {players.map((p) => (
                  <View key={p} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                    <SeatAvatar seat={p} name={names[p]} size={26} />
                    <T size={11} weight="800" center lines={1} color={p === view.turn ? seatColors[p % seatColors.length] : colors.text}>
                      {p === me ? 'Tu' : names[p]}
                    </T>
                  </View>
                ))}
              </Row>
              {YAHTZEE_CATEGORIES.map((k) => (
                <Row key={k} gap={0} style={styles.compareRow}>
                  <T size={13} style={{ flex: 1.4 }} lines={1}>
                    {SHORT[k]}
                  </T>
                  {players.map((p) => (
                    <T key={p} size={14} weight="800" center style={{ flex: 1 }} color={view.scores[p][k] === undefined ? colors.dim : colors.text}>
                      {view.scores[p][k] === undefined ? '–' : view.scores[p][k] === 0 ? '✗' : view.scores[p][k]}
                    </T>
                  ))}
                </Row>
              ))}
              <Row gap={0} style={styles.compareRow}>
                <T size={13} color={colors.muted} style={{ flex: 1.4 }}>
                  Bonus
                </T>
                {players.map((p) => (
                  <T key={p} size={12} center style={{ flex: 1 }} color={colors.muted}>
                    {view.upper[p] >= 63 ? '+35' : `${view.upper[p]}/63`}
                  </T>
                ))}
              </Row>
              <Row gap={0} style={[styles.compareRow, { borderTopWidth: 2 }]}>
                <T size={15} weight="800" style={{ flex: 1.4 }}>
                  Totale
                </T>
                {players.map((p) => (
                  <T key={p} size={17} weight="800" center style={{ flex: 1 }} color={colors.accent}>
                    {view.totals[p]}
                  </T>
                ))}
              </Row>
            </ScrollView>
            <Button small kind="ghost" color={colors.muted} label="Chiudi" onPress={() => setCompare(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { alignSelf: 'center', width: '100%', gap: 6, padding: 8, marginHorizontal: 0, borderRadius: 18, backgroundColor: '#12052BD9', borderWidth: 3, borderColor: colors.line },
  cell: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: '#FFFFFF10', borderWidth: 2, borderColor: 'transparent' },
  cellDone: { backgroundColor: '#00000033' },
  cellHot: { backgroundColor: colors.accent, borderColor: colors.line },
  cellBest: { boxShadow: `0px 0px 0px 3px ${colors.accent2}` },
  cellZero: { borderColor: '#FFFFFF33', borderStyle: 'dashed' },
  bonus: { gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12, backgroundColor: '#FFFFFF10' },
  bonusTrack: { height: 8, borderRadius: 999, backgroundColor: '#00000055', overflow: 'hidden' },
  compareBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface2 },
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 },
  compareCard: { width: '100%', maxWidth: 560, gap: 10, padding: 18, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 3, borderColor: colors.line },
  compareRow: { borderTopWidth: 1, borderColor: colors.line, minHeight: 32, alignItems: 'center' },
  player: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingLeft: 4, paddingRight: 10, borderRadius: 999, backgroundColor: 'rgba(18,5,43,0.55)' },
  holdTag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: colors.accent, borderWidth: 1.5, borderColor: colors.line },
  rolls: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: '#12052BB3' },
  rollDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.line, backgroundColor: '#FFFFFF33' },
});
