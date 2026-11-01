import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { checkMeld, meldPoints40, SCALA40_RULES, type Card, type Scala40Move, type Scala40View , type Seat } from '@giochi/engine';
import { Banner, MyCorner, othersOf, PileTop, Slot, TableTop, useCardWidth, type BoardProps, type SeatInfo } from './common';
import { CardsSummaryTable } from './summary';
import { CardTable, MeldRow, MultiHand, TableArea } from './RummyParts';
import { CardBack, DeckPile, PlayingCard, NoCardZoom } from '../ui/cards';
import { Draggable, DropZone, type DragPayload } from '../ui/drag';
import { Button, Row, T, tap } from '../ui/kit';
import { Anchor } from '../ui/motion';
import { TableBg } from '../ui/tables';
import { colors, seatColors } from '../ui/theme';

export function Scala40Board({ view, me, names, myTurn, onMove }: BoardProps<Scala40View, Scala40Move>) {
  const [selected, setSelected] = useState<string[]>([]);
  const [staged, setStaged] = useState<string[][]>([]);
  const handWidth = useCardWidth(9, 70);
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
  const drawing = myTurn && view.phase === 'draw';
  const meldFrom = (p: DragPayload) => {
    const cs = p.ids.map((id) => byId.get(id)!).filter(Boolean);
    return p.kind === 'hand' && cs.length >= 3 ? checkMeld(cs, SCALA40_RULES) : null;
  };
  // Trascinando: sul tavolo si cala (o si prepara l'apertura), su una combinazione si attacca, sullo scarto si scarta.
  const dropOnTable = (p: DragPayload) => {
    if (opened) return void onMove({ type: 'meld', cards: p.ids });
    setStaged((s) => [...s, p.ids]);
    setSelected([]);
  };

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

  const info = (seat: Seat): SeatInfo => ({ seat, name: names[seat] + (view.out[seat] ? ' · fuori' : view.opened[seat] ? ' · aperto' : ''), active: view.turn === seat, cards: view.out[seat] ? 0 : view.handCounts[seat], deck: 'fr', drawFrom: view.last?.includes('scart') ? 'discard' : 'deck', score: view.scores[seat], scoreLabel: 'punti' });
  return (
    <TableBg table="teal">
      <CardTable
        me={me === null ? null : info(me)}
        top={<TableTop seats={othersOf(view.players, me).map(info)} />}
        count={2}
        piles={(pileW) =>
          <>
            <Pressable
              disabled={!myTurn || view.phase !== 'draw'}
              onPress={() => {
                tap();
                onMove({ type: 'draw', source: 'stock' });
              }}
            >
              <Draggable payload={drawing ? { kind: 'stock', ids: [] } : null} ghost={<CardBack width={pileW} deck="fr" />}>
                <Slot width={pileW + 6} ratio={1.45} label={drawing ? 'PESCA' : `MAZZO · ${view.stockCount}`} glow={drawing ? colors.accent : undefined}>
                  <Anchor id="deck">
                    <DeckPile count={view.stockCount} width={pileW} deck="fr" />
                  </Anchor>
                </Slot>
              </Draggable>
            </Pressable>
            <Pressable
              disabled={!myTurn || view.phase !== 'draw' || !view.discardTop}
              onPress={() => {
                tap();
                onMove({ type: 'draw', source: 'discard' });
              }}
            >
              <DropZone id="discard" radius={8} inset={4} accepts={(p) => playing && p.kind === 'hand' && p.ids.length === 1 && !staged.length} onDrop={(p) => onMove({ type: 'discard', card: p.ids[0] })}>
                <Slot width={pileW + 6} ratio={1.45} label="SCARTI" glow={drawing && view.discardTop ? colors.accent3 : undefined}>
                  <Anchor id="discard" style={StyleSheet.absoluteFill} />
                  {view.discardTop ? (
                    // Quando tocca a me pescare, il tocco prende lo scarto; altrimenti la carta si ingrandisce.
                    <NoCardZoom.Provider value={drawing}>
                      <Draggable payload={drawing ? { kind: 'discard', ids: [view.discardTop.id] } : null} ghost={<PlayingCard card={view.discardTop} width={pileW} />}>
                        <PileTop id={view.discardTop.id} from={(view.turn + view.players - 1) % view.players} me={me}>
                          <PlayingCard card={view.discardTop} width={pileW} />
                        </PileTop>
                      </Draggable>
                    </NoCardZoom.Provider>
                  ) : null}
                </Slot>
              </DropZone>
            </Pressable>
          </>
        }
      >
        <DropZone id="table" style={{ flex: 1 }} radius={16} accepts={(p) => playing && !!meldFrom(p)} onDrop={dropOnTable}>
          <TableArea>
            {view.melds.map((m) => (
              <MeldRow
                key={m.id}
                cards={m.cards}
                width={meldWidth}
                color={seatColors[m.owner % seatColors.length]}
                onPress={playing && opened && selected.length ? () => onMove({ type: 'attach', meld: m.id, cards: selected }) : undefined}
                active={playing && opened && selected.length > 0}
                dropId={`m-${m.id}`}
                accepts={(p) => playing && opened && p.kind === 'hand'}
                onDrop={(p) => onMove({ type: 'attach', meld: m.id, cards: p.ids })}
              />
            ))}
            {view.melds.length === 0 && <T color="#ffffff66">Ancora nessuna combinazione in tavola</T>}
          </TableArea>
        </DropZone>
      </CardTable>
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
          <MultiHand
            cards={handLeft}
            selected={selected}
            onToggle={playing ? toggle : undefined}
            width={handWidth}
            highlight={view.mustUse}
            draggable={playing}
            dropHere={{ accepts: (p) => drawing && (p.kind === 'stock' || p.kind === 'discard'), onDrop: (p) => onMove({ type: 'draw', source: p.kind === 'stock' ? 'stock' : 'discard' }) }}
          />
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
      <MyCorner wideOnly style={{ flexDirection: 'row', gap: 8 }} info={me === null ? null : info(me)} note={myTurn ? banner : undefined} />
    </TableBg>
  );
}
