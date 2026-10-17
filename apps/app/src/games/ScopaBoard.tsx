import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { captureOptions, cardName, teamOf, type ScopaMove, type ScopaView } from '@giochi/engine';
import { Banner, EventSticker, Felt, Hand, Opponents, othersOf, PlayerBadge, turnText, useCardWidth, type BoardProps } from './common';
import { CardsSummaryTable, teamLabel } from './summary';
import { DeckPile, PlayingCard } from '../ui/cards';
import { Button, Row, T } from '../ui/kit';
import { colors } from '../ui/theme';

export function ScopaBoard({ view, me, names, myTurn, onMove }: BoardProps<ScopaView, ScopaMove>) {
  const [selected, setSelected] = useState<string | null>(null);
  const handWidth = useCardWidth(3, 100);
  const tableWidth = useCardWidth(Math.max(view.table.length, 5), 76);
  useEffect(() => setSelected(null), [view.turn, view.phase]);

  const card = view.hand.find((c) => c.id === selected);
  const options = card ? captureOptions(view.table, card) : [];
  const highlighted = new Set(options.flat().map((c) => c.id));
  const teams = view.teamScores.length;

  if (view.phase !== 'play' && view.report) {
    return (
      <View style={{ flex: 1, padding: 16, gap: 16, justifyContent: 'center' }}>
        <T size={24} weight="900" center>
          {view.phase === 'over' ? 'Partita finita' : 'Fine della mano'}
        </T>
        <CardsSummaryTable
          columns={Array.from({ length: teams }, (_, t) => teamLabel(t, view.players, names))}
          rows={[
            ['Carte', view.report.map((r) => String(r.cards))],
            ['Denari', view.report.map((r) => String(r.denari))],
            ['Settebello', view.report.map((r) => (r.settebello ? '✓' : ''))],
            ['Primiera', view.report.map((r) => String(r.primiera))],
            ['Scope', view.report.map((r) => String(r.scope))],
            ['Punti mano', view.report.map((r) => `+${r.points}`)],
            ['Totale', view.teamScores.map(String)],
          ]}
        />
        {view.phase === 'handEnd' &&
          (myTurn ? <Button label="Prossima mano" onPress={() => onMove({ type: 'next' })} /> : <Banner text={`${names[0]} dà le carte…`} />)}
      </View>
    );
  }

  const last = view.lastPlay;
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
          <PlayerBadge key={seat} seat={seat} name={names[seat] + (view.players === 4 && me !== null && teamOf(seat, 4) === teamOf(me, 4) ? ' 🤝' : '')} active={view.turn === seat} cards={view.handCounts[seat]}>
            <T size={12} color={colors.muted}>
              prese {view.capturedCounts[seat]}
              {view.scope[seat] ? `  🧹${view.scope[seat]}` : ''}
            </T>
          </PlayerBadge>
        ))}
      </Opponents>
      <Felt>
        <Row style={{ position: 'absolute', top: 10, left: 12 }}>
          <DeckPile count={view.deckCount} width={34} />
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, maxWidth: 6 * (tableWidth + 8) }}>
          {view.table.map((c) => (
            <PlayingCard key={c.id} card={c} width={tableWidth} selected={highlighted.has(c.id)} dimmed={!!card && options.length > 0 && !highlighted.has(c.id)} />
          ))}
          {view.table.length === 0 && <T color="#ffffff99">Tavolo vuoto</T>}
        </View>
        {last && (
          <T size={14} color="#ffffffcc" center>
            {names[last.seat]} ha giocato {cardName(last.card)}
            {last.taken.length ? ` e preso ${last.taken.length} ${last.taken.length === 1 ? 'carta' : 'carte'}` : ''}
            {last.scopa ? '  🧹 SCOPA!' : ''}
          </T>
        )}
      </Felt>
      <EventSticker
        eventKey={last ? `${last.seat}-${last.card.id}` : null}
        text={last?.scopa ? '+1 scopa!' : last && [last.card, ...last.taken].some((c) => c.suit === 'd' && c.rank === 7) && last.taken.length ? 'Settebello!' : null}
      />
      <Banner text={turnText(myTurn, names, view.turn, me)} tone={myTurn ? 'turn' : 'info'} />
      {me !== null && (
        <>
          <Hand cards={view.hand} width={handWidth} selected={selected} onPress={myTurn ? (c) => setSelected(c.id === selected ? null : c.id) : undefined} />
          <View style={{ minHeight: 64, padding: 8, gap: 8, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
            {card && options.length === 0 && <Button small label="Cala la carta" onPress={() => onMove({ type: 'play', card: card.id })} />}
            {card &&
              options.map((opt) => (
                <Button
                  key={opt.map((c) => c.id).join()}
                  small
                  label={`Prendi ${opt.map((c) => c.rank).join(' + ')}${opt.length === view.table.length ? ' 🧹' : ''}`}
                  onPress={() => onMove({ type: 'play', card: card.id, take: opt.map((c) => c.id) })}
                />
              ))}
            {!card && myTurn && <T color={colors.muted}>Scegli una carta</T>}
          </View>
        </>
      )}
    </View>
  );
}
