import { ScrollView, View } from 'react-native';
import type { SetteMove, SetteView } from '@giochi/engine';
import { Banner, type BoardProps } from './common';
import { CardBack, PlayingCard } from '../ui/cards';
import { Button, Row, SeatDot, T } from '../ui/kit';
import { colors, seatColors } from '../ui/theme';

const fmt = (v: number) => (v % 1 ? `${Math.floor(v) || ''}½` : String(v));

export function SetteBoard({ view, me, names, myTurn, onMove }: BoardProps<SetteView, SetteMove>) {
  const seats = Array.from({ length: view.players }, (_, i) => i);
  const big = me === null;
  const needBet = view.phase === 'bet' && me !== null && me !== view.banker && view.bets[me] === null;
  let banner = '';
  if (view.phase === 'bet') banner = needBet ? 'Quanto punti?' : 'Si punta…';
  else if (view.phase === 'play') banner = myTurn ? (me === view.banker ? 'Tocca a te, banco' : 'Tocca a te') : `Tocca a ${names[view.turn]}`;
  else banner = 'Conti fatti';

  return (
    <View style={{ flex: 1 }}>
      <Row style={{ justifyContent: 'center', paddingVertical: 6 }} gap={12}>
        <T size={14} color={colors.muted}>
          Mano {view.round + 1} di {view.totalRounds}
        </T>
        <T size={14} weight="800">
          🏦 Banco: {names[view.banker]}
        </T>
      </Row>
      <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 10, justifyContent: 'center' }}>
        {seats.map((p) => {
          const hand = view.hands[p];
          const total = view.totals[p];
          const active = view.phase === 'play' && view.turn === p;
          const w = big ? 64 : p === me ? 58 : 44;
          return (
            <View
              key={p}
              style={{
                backgroundColor: p === view.banker ? '#2E2A1A' : colors.surface,
                borderRadius: 16,
                padding: 10,
                gap: 8,
                minWidth: 150,
                borderWidth: 2,
                borderColor: active ? seatColors[p % seatColors.length] : 'transparent',
              }}
            >
              <Row gap={6}>
                <SeatDot seat={p} />
                <T weight="900" style={{ flex: 1 }}>
                  {names[p]}
                  {p === view.banker ? ' 🏦' : ''}
                </T>
                <T weight="800" color={colors.accent}>
                  🪙 {view.chips[p]}
                </T>
              </Row>
              <Row gap={0} style={{ minHeight: w * 1.55 }}>
                {hand.map((c, i) => (
                  <View key={c?.id ?? `back${i}`} style={{ marginLeft: i ? -w * 0.4 : 0 }}>
                    {c ? <PlayingCard card={c} width={w} /> : <CardBack width={w} />}
                  </View>
                ))}
              </Row>
              <Row gap={8}>
                {p !== view.banker && (
                  <T size={13} color={colors.muted}>
                    puntata {view.bets[p] ?? '…'}
                  </T>
                )}
                {total !== null && (
                  <T size={13} weight="900" color={view.status[p] === 'bust' ? colors.danger : colors.text}>
                    {view.status[p] === 'bust' ? `sballato (${fmt(total)})` : fmt(total)}
                  </T>
                )}
                {view.status[p] === 'stood' && view.phase === 'play' && <T size={13} color={colors.muted}>sta</T>}
                {view.deltas && view.deltas[p] !== 0 && (
                  <T size={15} weight="900" color={view.deltas[p] > 0 ? colors.success : colors.danger}>
                    {view.deltas[p] > 0 ? `+${view.deltas[p]}` : view.deltas[p]}
                  </T>
                )}
              </Row>
            </View>
          );
        })}
      </ScrollView>
      <Banner text={banner} tone={myTurn ? 'turn' : 'info'} />
      <View style={{ padding: 12, gap: 10, minHeight: 80, justifyContent: 'center' }}>
        {needBet && (
          <Row gap={8} style={{ justifyContent: 'center' }} wrap>
            {Array.from({ length: view.maxBet }, (_, i) => i + 1).map((n) => (
              <Button key={n} label={`${n} 🪙`} onPress={() => onMove({ type: 'bet', amount: n })} style={{ minWidth: 64 }} />
            ))}
          </Row>
        )}
        {view.phase === 'play' && myTurn && (
          <Row gap={12} style={{ justifyContent: 'center' }}>
            <Button label="Carta" icon="➕" onPress={() => onMove({ type: 'hit' })} style={{ minWidth: 140 }} />
            <Button label="Sto" icon="✋" kind="ghost" color={colors.text} onPress={() => onMove({ type: 'stand' })} style={{ minWidth: 140 }} />
          </Row>
        )}
        {view.phase === 'reveal' && myTurn && <Button label="Prossima mano" onPress={() => onMove({ type: 'next' })} />}
      </View>
    </View>
  );
}
