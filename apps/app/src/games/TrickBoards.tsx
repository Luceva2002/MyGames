import { View } from 'react-native';
import { cardName, IT_SUIT_NAMES, teamOf, type BriscolaMove, type BriscolaView, type Card, type Seat, type TresetteMove, type TresetteView } from '@giochi/engine';
import { Banner, Felt, Hand, Opponents, othersOf, PlayerBadge, turnText, useCardWidth, type BoardProps } from './common';
import { CardsSummaryTable, teamLabel } from './summary';
import { DeckPile, PlayingCard } from '../ui/cards';
import { Button, Row, SeatDot, T } from '../ui/kit';
import { colors } from '../ui/theme';

/** Le carte giocate nella presa in corso (o nell'ultima, più sbiadita). */
function Trick({ plays, names, width, winner }: { plays: { seat: Seat; card: Card }[]; names: string[]; width: number; winner?: Seat }) {
  return (
    <Row gap={10} wrap style={{ justifyContent: 'center' }}>
      {plays.map((p) => (
        <View key={p.card.id} style={{ alignItems: 'center', gap: 4, opacity: winner !== undefined && winner !== p.seat ? 0.55 : 1 }}>
          <PlayingCard card={p.card} width={width} selected={winner === p.seat} />
          <Row gap={4}>
            <SeatDot seat={p.seat} size={8} />
            <T size={12} color="#ffffffdd">
              {names[p.seat]}
            </T>
          </Row>
        </View>
      ))}
    </Row>
  );
}

function partnerMark(players: number, me: Seat | null, seat: Seat) {
  return players === 4 && me !== null && teamOf(seat, 4) === teamOf(me, 4) ? ' 🤝' : '';
}

export function BriscolaBoard({ view, me, names, myTurn, onMove }: BoardProps<BriscolaView, BriscolaMove>) {
  const handWidth = useCardWidth(3, 100);
  const trickWidth = useCardWidth(5, 80);
  const showLast = view.trick.length === 0 && view.lastTrick;
  return (
    <View style={{ flex: 1 }}>
      <Opponents>
        {othersOf(view.players, me).map((seat) => (
          <PlayerBadge key={seat} seat={seat} name={names[seat] + partnerMark(view.players, me, seat)} active={view.turn === seat} cards={view.handCounts[seat]}>
            <T size={12} color={colors.muted}>prese {view.capturedCounts[seat] / view.players}</T>
          </PlayerBadge>
        ))}
      </Opponents>
      <Felt>
        <Row style={{ position: 'absolute', top: 10, left: 12 }} gap={12}>
          {view.deckCount > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <PlayingCard card={view.trump} width={me === null ? 64 : 44} />
              <DeckPile count={view.deckCount - 1} width={me === null ? 50 : 34} />
            </View>
          ) : null}
          <T size={13} color="#ffffffcc">Briscola: {IT_SUIT_NAMES[view.trump.suit]}</T>
        </Row>
        {view.teamPoints ? (
          <CardsSummaryTable
            columns={view.teamPoints.map((_, t) => teamLabel(t, view.players, names))}
            rows={[['Punti', view.teamPoints.map(String)]]}
          />
        ) : showLast ? (
          <>
            <Trick plays={view.lastTrick!.plays} names={names} width={trickWidth} winner={view.lastTrick!.winner} />
            <T size={14} color="#ffffffcc">Ha preso {names[view.lastTrick!.winner]}</T>
          </>
        ) : (
          <Trick plays={view.trick} names={names} width={trickWidth} />
        )}
      </Felt>
      {!view.teamPoints && <Banner text={turnText(myTurn, names, view.turn, me)} tone={myTurn ? 'turn' : 'info'} />}
      {me !== null && <Hand cards={view.hand} width={handWidth} onPress={myTurn ? (c) => onMove({ card: c.id }) : undefined} />}
      <View style={{ height: 12 }} />
    </View>
  );
}

export function TresetteBoard({ view, me, names, myTurn, onMove }: BoardProps<TresetteView, TresetteMove>) {
  const handWidth = useCardWidth(Math.max(view.hand.length, 5), 80);
  const trickWidth = useCardWidth(5, 76);
  const showLast = view.trick.length === 0 && view.lastTrick;
  const teams = view.teamScores.length;
  if (view.phase !== 'play') {
    return (
      <View style={{ flex: 1, padding: 16, gap: 16, justifyContent: 'center' }}>
        <T size={24} weight="900" center>
          {view.phase === 'over' ? 'Partita finita' : 'Fine della mano'}
        </T>
        <CardsSummaryTable
          columns={Array.from({ length: teams }, (_, t) => teamLabel(t, view.players, names))}
          rows={[
            ['Punti mano', (view.handPoints ?? []).map((p) => `+${p}`)],
            ['Totale', view.teamScores.map(String)],
          ]}
        />
        {view.phase === 'handEnd' && (myTurn ? <Button label="Prossima mano" onPress={() => onMove({ type: 'next' })} /> : <Banner text={`${names[0]} dà le carte…`} />)}
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <Row style={{ justifyContent: 'center', paddingTop: 4 }} gap={16}>
        {view.teamScores.map((p, t) => (
          <T key={t} size={14} weight="700" color={colors.muted}>
            {teamLabel(t, view.players, names)}: <T weight="900">{p}</T>
          </T>
        ))}
        <T size={14} color={colors.dim}>a {view.target}</T>
      </Row>
      <Opponents>
        {othersOf(view.players, me).map((seat) => (
          <PlayerBadge key={seat} seat={seat} name={names[seat] + partnerMark(view.players, me, seat)} active={view.turn === seat} cards={view.handCounts[seat]} />
        ))}
      </Opponents>
      <Felt>
        {view.deckCount > 0 && (
          <View style={{ position: 'absolute', top: 10, left: 12 }}>
            <DeckPile count={view.deckCount} width={34} />
          </View>
        )}
        {showLast ? (
          <>
            <Trick plays={view.lastTrick!.plays} names={names} width={trickWidth} winner={view.lastTrick!.winner} />
            <T size={14} color="#ffffffcc">Ha preso {names[view.lastTrick!.winner]}</T>
          </>
        ) : (
          <Trick plays={view.trick} names={names} width={trickWidth} />
        )}
        {view.lastDraw.length > 0 && view.players === 2 && (
          <T size={13} color="#ffffffaa" center>
            Pescate: {view.lastDraw.map((d) => `${names[d.seat]} ${cardName(d.card)}`).join(', ')}
          </T>
        )}
      </Felt>
      <Banner text={turnText(myTurn, names, view.turn, me)} tone={myTurn ? 'turn' : 'info'} />
      {me !== null && <Hand cards={view.hand} width={handWidth} playable={myTurn ? view.playable : undefined} onPress={myTurn ? (c) => onMove({ type: 'play', card: c.id }) : undefined} />}
      <View style={{ height: 12 }} />
    </View>
  );
}
