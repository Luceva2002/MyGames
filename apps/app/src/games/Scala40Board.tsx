import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { checkMeld, meldPoints40, SCALA40_RULES, type Card, type Scala40Move, type Scala40View } from '@giochi/engine';
import { Banner, Opponents, othersOf, PlayerBadge, useCardWidth, type BoardProps } from './common';
import { CardsSummaryTable } from './summary';
import { MeldRow, MultiHand, TableArea } from './RummyParts';
import { DeckPile, PlayingCard } from '../ui/cards';
import { Button, Row, T, tap } from '../ui/kit';
import { TableBg } from '../ui/tables';
import { colors, seatColors } from '../ui/theme';

export function Scala40Board({ view, me, names, myTurn, onMove }: BoardProps<Scala40View, Scala40Move>) {
  const [selected, setSelected] = useState<string[]>([]);
  const [staged, setStaged] = useState<string[][]>([]);
  const handWidth = useCardWidth(9, 64);
  const meldWidth = me === null ? 52 : 38;
  useEffect(() => {
    setSelected([]);
    setStaged([]);
  }, [view.turn, view.phase]);

  const byId = new Map<string, Card>(view.hand.map((c) => [c.id, c]));
  const stagedIds = staged.flat();
  const handLeft = view.hand.filter((c) => !stagedIds.includes(c.id));
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const selCards = selected.map((id) => byId.get(id)!).filter(Boolean);
  const selMeld = selCards.length >= 3 ? checkMeld(selCards, SCALA40_RULES) : null;
  const stagedPoints = staged.reduce((t, g) => t + meldPoints40(checkMeld(g.map((id) => byId.get(id)!), SCALA40_RULES)!), 0);
  const opened = me !== null && view.opened[me];
  const playing = myTurn && view.phase === 'play';

  if (view.phase === 'roundEnd' || view.phase === 'over') {
    return (
      <View style={{ flex: 1, padding: 16, gap: 16, justifyContent: 'center' }}>
        <T size={24} weight="900" center>
          {view.phase === 'over' ? 'Partita finita' : 'Mano chiusa'}
        </T>
        <CardsSummaryTable
          columns={names}
          rows={[
            ['Questa mano', (view.roundPenalty ?? []).map((p, i) => (view.out[i] && p === 0 ? '—' : `+${p}`))],
            ['Totale', view.scores.map((s, i) => (view.out[i] ? `${s} ✖` : String(s)))],
          ]}
        />
        <T center color={colors.muted}>
          A {view.limit} punti si è fuori.
        </T>
        {view.phase === 'roundEnd' && (myTurn ? <Button label="Prossima mano" onPress={() => onMove({ type: 'next' })} /> : <Banner text="Si rimescola…" />)}
      </View>
    );
  }

  let banner = myTurn ? (view.phase === 'draw' ? 'Pesca dal mazzo o prendi lo scarto' : view.mustUse ? 'Usa la carta presa dagli scarti' : opened ? 'Cala, attacca o scarta' : 'Prepara l’apertura (40 punti) o scarta') : `Tocca a ${names[view.turn]}`;
  if (view.last && !myTurn) banner += ` · ${names[view.turn]} ${view.last}`;

  return (
    <View style={{ flex: 1 }}>
      <Opponents>
        {othersOf(view.players, me).map((seat) => (
          <PlayerBadge key={seat} seat={seat} name={names[seat]} active={view.turn === seat} cards={view.out[seat] ? 0 : view.handCounts[seat]} deck="fr">
            <T size={12} color={colors.muted}>
              {view.out[seat] ? 'eliminato' : `${view.opened[seat] ? '✓ aperto · ' : ''}${view.scores[seat]} pt`}
            </T>
          </PlayerBadge>
        ))}
      </Opponents>
      <TableBg table="green" rounded style={{ margin: 8 }}>
        <Row style={{ padding: 8 }} gap={14}>
          <Pressable
            disabled={!myTurn || view.phase !== 'draw'}
            onPress={() => {
              tap();
              onMove({ type: 'draw', source: 'stock' });
            }}
          >
            <DeckPile count={view.stockCount} width={42} deck="fr" />
          </Pressable>
          <Pressable
            disabled={!myTurn || view.phase !== 'draw' || !view.discardTop}
            onPress={() => {
              tap();
              onMove({ type: 'draw', source: 'discard' });
            }}
          >
            {view.discardTop ? <PlayingCard card={view.discardTop} width={42} /> : <View style={{ width: 42 }} />}
          </Pressable>
          <T size={13} color="#ffffffcc" style={{ flex: 1 }}>
            {banner}
          </T>
        </Row>
        <TableArea>
          {view.melds.map((m) => (
            <MeldRow
              key={m.id}
              cards={m.cards}
              width={meldWidth}
              color={seatColors[m.owner % seatColors.length]}
              onPress={playing && opened && selected.length ? () => onMove({ type: 'attach', meld: m.id, cards: selected }) : undefined}
              active={playing && opened && selected.length > 0}
            />
          ))}
          {view.melds.length === 0 && <T color="#ffffff66">Ancora nessuna combinazione in tavola</T>}
        </TableArea>
      </TableBg>
      {me !== null && (
        <>
          {staged.length > 0 && (
            <View style={{ paddingHorizontal: 8, gap: 6 }}>
              <T size={13} weight="800" color={stagedPoints >= 40 ? colors.success : colors.accent}>
                Apertura: {stagedPoints} punti su 40
              </T>
              <Row gap={6} wrap>
                {staged.map((g, i) => (
                  <MeldRow key={i} cards={g.map((id) => byId.get(id)!)} width={30} onPress={() => setStaged((s) => s.filter((_, j) => j !== i))} label="tocca per togliere" />
                ))}
              </Row>
            </View>
          )}
          <MultiHand cards={handLeft} selected={selected} onToggle={playing ? toggle : undefined} width={handWidth} highlight={view.mustUse} />
          <Row gap={8} wrap style={{ justifyContent: 'center', padding: 8, minHeight: 60 }}>
            {playing && !opened && selected.length >= 3 && (
              <Button small label={selMeld ? `Metti da parte (${meldPoints40(selMeld)} pt)` : 'Combinazione non valida'} disabled={!selMeld} onPress={() => {
                setStaged((s) => [...s, selected]);
                setSelected([]);
              }} />
            )}
            {playing && !opened && staged.length > 0 && (
              <Button small label={`Apri con ${stagedPoints}`} disabled={stagedPoints < 40} color={colors.success} onPress={() => onMove({ type: 'open', melds: staged })} />
            )}
            {playing && opened && selected.length >= 3 && <Button small label="Cala" disabled={!selMeld} onPress={() => onMove({ type: 'meld', cards: selected })} />}
            {playing && selected.length === 1 && !staged.length && <Button small label="Scarta" color={colors.danger} onPress={() => onMove({ type: 'discard', card: selected[0] })} />}
            {playing && opened && selected.length > 0 && selected.length < 3 && <T size={13} color={colors.muted}>Tocca una combinazione per attaccare</T>}
          </Row>
        </>
      )}
    </View>
  );
}
