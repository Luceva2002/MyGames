import { Pressable, StyleSheet, View } from 'react-native';
import type { Card, Seat, SetteMove, SetteView } from '@giochi/engine';
import { EventSticker, othersOf, type BoardProps } from './common';
import { CardBack, PlayingCard } from '../ui/cards';
import { SeatAvatar } from '../ui/avatars';
import { Button, Row, T, tap } from '../ui/kit';
import { FlyIn, Pulse } from '../ui/motion';
import { TableBg } from '../ui/tables';
import { colors, seatColor } from '../ui/theme';

const fmt = (v: number) => (v % 1 ? `${Math.floor(v) || ''}½` : String(v));

/** Le carte di un posto: coperte quelle segrete, lanciate sul tavolo quando arrivano. */
function HandRow({ cards, width, mine }: { cards: (Card | null)[]; width: number; mine?: boolean }) {
  return (
    <Row gap={0} style={{ minHeight: width * 1.8 }}>
      {cards.map((c, i) => (
        <FlyIn key={c?.id ?? `back${i}`} from={mine ? 'above' : 'above'} sound="deal" style={{ marginLeft: i ? -width * (mine ? 0.3 : 0.45) : 0 }}>
          {c ? <PlayingCard card={c} width={width} sway={false} /> : <CardBack width={width} />}
        </FlyIn>
      ))}
    </Row>
  );
}

/** Quanto manca a 7½: una barra che si riempie e diventa rossa se si sballa. */
function TotalMeter({ total, bust, big }: { total: number | null; bust: boolean; big?: boolean }) {
  if (total === null) return null;
  const pct = Math.min(1, total / 7.5);
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <T size={big ? 40 : 20} weight="900" color={bust ? colors.danger : total === 7.5 ? colors.success : colors.accent}>
        {fmt(total)}
        <T size={big ? 16 : 12} weight="800" color={colors.muted}>
          {' / 7½'}
        </T>
      </T>
      <View style={[styles.meter, { width: big ? 160 : 90 }]}>
        <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 999, backgroundColor: bust ? colors.danger : total >= 6 ? colors.success : colors.accent }} />
      </View>
      {bust && (
        <T size={12} weight="900" color={colors.danger}>
          SBALLATO
        </T>
      )}
    </View>
  );
}

/** Un avversario dall'altro lato del tavolo: icona, fiche, puntata e carte. */
function SeatBox({ view, seat, name }: { view: SetteView; seat: Seat; name: string }) {
  const active = view.phase === 'play' && view.turn === seat;
  const banker = seat === view.banker;
  const delta = view.deltas?.[seat] ?? 0;
  return (
    <Pulse active={active}>
      <View style={[styles.seat, active && { borderColor: seatColor(seat), boxShadow: `0px 0px 14px ${seatColor(seat)}` }]}>
        <Row gap={6}>
          <SeatAvatar seat={seat} name={name} size={34} />
          <View style={{ flexShrink: 1 }}>
            <T size={13} weight="800" lines={1}>
              {name}
              {banker ? ' 🏦' : ''}
            </T>
            <T size={12} weight="800" color={colors.accent}>
              🪙 {view.chips[seat]}
              {!banker && view.bets[seat] !== null ? `  · punta ${view.bets[seat]}` : ''}
            </T>
          </View>
        </Row>
        <HandRow cards={view.hands[seat]} width={30} />
        <Row gap={6}>
          {view.totals[seat] !== null && (
            <T size={13} weight="900" color={view.status[seat] === 'bust' ? colors.danger : colors.text}>
              {view.status[seat] === 'bust' ? `sballato (${fmt(view.totals[seat]!)})` : fmt(view.totals[seat]!)}
            </T>
          )}
          {view.status[seat] === 'stood' && view.phase === 'play' && (
            <T size={12} color={colors.muted}>
              sta
            </T>
          )}
          {delta !== 0 && (
            <T size={14} weight="900" color={delta > 0 ? colors.success : colors.danger}>
              {delta > 0 ? `+${delta}` : delta} 🪙
            </T>
          )}
        </Row>
      </View>
    </Pulse>
  );
}

/**
 * Sette e mezzo al tavolo: banco e avversari dall'altro lato con le loro carte (coperta la prima),
 * al centro il mazzo, in basso la mia mano grande con il totale verso 7½ e le puntate a fiche.
 */
export function SetteBoard({ view, me, names, myTurn, onMove }: BoardProps<SetteView, SetteMove>) {
  const needBet = view.phase === 'bet' && me !== null && me !== view.banker && view.bets[me] === null;
  const mine = me !== null;
  const iAmBanker = me === view.banker;
  const myDelta = me !== null ? view.deltas?.[me] ?? 0 : 0;
  let hint = '';
  if (view.phase === 'bet') hint = needBet ? 'Quanto punti?' : iAmBanker ? 'Sei il banco: aspetta le puntate' : 'Si punta…';
  else if (view.phase === 'play') hint = myTurn ? (iAmBanker ? 'Tocca a te, banco: carta o stai?' : 'Carta o stai?') : `Tocca a ${names[view.turn]}`;
  else hint = 'Conti fatti';

  return (
    <TableBg table="teal">
      <View style={{ flex: 1, padding: 8, gap: 8 }}>
        <Row style={{ justifyContent: 'space-between', paddingHorizontal: 18 }}>
          <T size={13} weight="800" color="#ffffffcc">
            Mano {view.round + 1} di {view.totalRounds}
          </T>
          <T size={13} weight="800" color="#ffffffcc">
            🏦 Banco: {iAmBanker ? 'tu' : names[view.banker]}
          </T>
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {othersOf(view.players, me).map((p) => (
            <SeatBox key={p} view={view} seat={p} name={names[p]} />
          ))}
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <View>
            <CardBack width={52} style={{ position: 'absolute', left: 4, top: 4 }} />
            <CardBack width={52} style={{ position: 'absolute', left: 2, top: 2 }} />
            <CardBack width={52} />
          </View>
          <T size={14} weight="800" color="#ffffffcc" center>
            {hint}
          </T>
        </View>

        {mine && (
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Row gap={16} style={{ alignItems: 'flex-end' }}>
              <HandRow cards={view.hands[me!]} width={72} mine />
              <TotalMeter total={view.totals[me!]} bust={view.status[me!] === 'bust'} big />
            </Row>
            <T size={14} weight="900" color={colors.accent}>
              🪙 {view.chips[me!]} fiche{!iAmBanker && view.bets[me!] !== null ? `  · puntata ${view.bets[me!]}` : ''}
              {iAmBanker ? '  · sei il banco 🏦' : ''}
            </T>
          </View>
        )}

        <View style={{ minHeight: 76, justifyContent: 'center', alignItems: 'center' }}>
          {needBet && (
            <Row gap={10} wrap style={{ justifyContent: 'center' }}>
              {Array.from({ length: view.maxBet }, (_, i) => i + 1).map((n) => (
                <Pressable
                  key={n}
                  accessibilityRole="button"
                  accessibilityLabel={`Punta ${n}`}
                  onPress={() => {
                    tap();
                    onMove({ type: 'bet', amount: n });
                  }}
                  style={(state) => [styles.chip, { transform: [{ translateY: state.pressed ? 3 : 0 }] }]}
                >
                  <T size={22} weight="900" color={colors.onAccent}>
                    {n}
                  </T>
                </Pressable>
              ))}
            </Row>
          )}
          {view.phase === 'play' && myTurn && (
            <Row gap={12}>
              <Button label="Carta" icon="➕" onPress={() => onMove({ type: 'hit' })} style={{ minWidth: 140 }} />
              <Button label="Sto" icon="✋" kind="ghost" color={colors.text} onPress={() => onMove({ type: 'stand' })} style={{ minWidth: 140 }} />
            </Row>
          )}
          {view.phase === 'reveal' && myTurn && <Button label="Prossima mano" onPress={() => onMove({ type: 'next' })} />}
        </View>
      </View>
      <EventSticker eventKey={view.deltas && me !== null ? `r${view.round}` : null} text={myDelta > 0 ? `+${myDelta} 🪙` : myDelta < 0 ? `${myDelta} 🪙` : null} />
    </TableBg>
  );
}

const styles = StyleSheet.create({
  seat: { padding: 8, gap: 6, borderRadius: 16, backgroundColor: '#12052BB3', borderWidth: 2.5, borderColor: '#FFFFFF22', minWidth: 150 },
  meter: { height: 10, borderRadius: 999, backgroundColor: '#12052B88', borderWidth: 2, borderColor: colors.line, overflow: 'hidden' },
  chip: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.accent, borderWidth: 4, borderColor: colors.line, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', boxShadow: `0px 4px 0px ${colors.line}` },
});
