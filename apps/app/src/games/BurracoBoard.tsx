import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { BURRACO_RULES, checkMeld, teamOf, type BurracoMove, type BurracoView, type Card } from '@giochi/engine';
import { Banner, Opponents, PlayerBadge, seatsFrom, Slot, useCardWidth, type BoardProps } from './common';
import { CardsSummaryTable, teamLabel } from './summary';
import { MeldRow, MultiHand } from './RummyParts';
import { CardBack, DeckPile, PlayingCard } from '../ui/cards';
import { Draggable, DropZone, type DragPayload } from '../ui/drag';
import { Button, Row, T, tap } from '../ui/kit';
import { TableBg } from '../ui/tables';
import { colors } from '../ui/theme';

export function BurracoBoard({ view, me, names, myTurn, onMove }: BoardProps<BurracoView, BurracoMove>) {
  const [selected, setSelected] = useState<string[]>([]);
  const handWidth = useCardWidth(9, 64);
  useEffect(() => setSelected([]), [view.turn, view.phase]);
  const myTeam = me === null ? 0 : teamOf(me, view.players);
  const teams = view.teamScores.length;
  const byId = new Map<string, Card>(view.hand.map((c) => [c.id, c]));
  const selCards = selected.map((id) => byId.get(id)!).filter(Boolean);
  const valid = selCards.length >= 3 && !!checkMeld(selCards, BURRACO_RULES);
  const playing = myTurn && view.phase === 'play';
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const drawing = myTurn && view.phase === 'draw';
  const validMeld = (p: DragPayload) => {
    const cs = p.ids.map((id) => byId.get(id)!).filter(Boolean);
    return p.kind === 'hand' && cs.length >= 3 && !!checkMeld(cs, BURRACO_RULES);
  };

  if (view.phase === 'handEnd' || view.phase === 'over') {
    const r = view.report ?? [];
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <T size={24} weight="900" center>
          {view.phase === 'over' ? 'Partita finita' : 'Fine della mano'}
        </T>
        <CardsSummaryTable
          columns={Array.from({ length: teams }, (_, t) => teamLabel(t, view.players, names))}
          rows={[
            ['Carte calate', r.map((x) => String(x.melded))],
            ['Burrachi', r.map((x) => String(x.burraco))],
            ['Chiusura', r.map((x) => String(x.closing))],
            ['In mano', r.map((x) => String(x.inHand))],
            ['Pozzetto', r.map((x) => (x.noPozzetto ? String(x.noPozzetto) : '✓'))],
            ['Mano', r.map((x) => String(x.total))],
            ['Totale', view.teamScores.map(String)],
          ]}
        />
        {view.phase === 'handEnd' && (myTurn ? <Button label="Prossima mano" onPress={() => onMove({ type: 'next' })} /> : <Banner text="Si rimescola…" />)}
      </ScrollView>
    );
  }

  const meldsOf = (team: number) => view.melds.filter((m) => m.team === team);
  return (
    <View style={{ flex: 1 }}>
      <Opponents>
        {seatsFrom(view.players, me).map((seat) => (
          <PlayerBadge key={seat} seat={seat} isMe={seat === me} name={names[seat] + (me !== null && seat !== me && view.players === 4 && teamOf(seat, 4) === myTeam ? ' 🤝' : '')} active={view.turn === seat} cards={view.handCounts[seat]} deck="fr" score={view.teamScores[teamOf(seat, view.players)]} scoreLabel={view.pozzettoTaken[teamOf(seat, view.players)] ? 'pt · pozzetto ✓' : 'pt'} />
        ))}
      </Opponents>
      <TableBg table="green" rounded style={{ marginHorizontal: 8 }}>
      <DropZone id="table" style={{ flex: 1 }} radius={16} accepts={(p) => playing && validMeld(p)} onDrop={(p) => onMove({ type: 'meld', cards: p.ids })}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 8, gap: 8 }}>
          <Row gap={12}>
            <Pressable
              disabled={!myTurn || view.phase !== 'draw'}
              onPress={() => {
                tap();
                onMove({ type: 'draw', source: 'stock' });
              }}
            >
              <Draggable payload={drawing ? { kind: 'stock', ids: [] } : null} ghost={<CardBack width={40} deck="fr" />}>
                <Slot width={44} ratio={1.45} label="Mazzo">
                  <DeckPile count={view.stockCount} width={40} deck="fr" />
                </Slot>
              </Draggable>
            </Pressable>
            <DropZone id="discard" style={{ flex: 1 }} radius={8} inset={2} accepts={(p) => playing && p.kind === 'hand' && p.ids.length === 1} onDrop={(p) => onMove({ type: 'discard', card: p.ids[0] })}>
              <Draggable
                payload={drawing && view.discard.length ? { kind: 'discard', ids: view.discard.map((c) => c.id) } : null}
                ghost={<View style={{ flexDirection: 'row' }}>{view.discard.slice(-4).map((c, i) => <View key={c.id} style={{ marginLeft: i ? -26 : 0 }}><PlayingCard card={c} width={40} sway={false} /></View>)}</View>}
              >
                <Pressable
                  disabled={!myTurn || view.phase !== 'draw' || !view.discard.length}
                  onPress={() => {
                    tap();
                    onMove({ type: 'draw', source: 'discard' });
                  }}
                  style={{ flexDirection: 'row', flexWrap: 'wrap', minHeight: 58 }}
                >
                  {view.discard.map((c, i) => (
                    <View key={c.id} style={{ marginLeft: i ? -26 : 0 }}>
                      <PlayingCard card={c} width={40} />
                    </View>
                  ))}
                </Pressable>
              </Draggable>
            </DropZone>
          </Row>
          <T size={13} color="#ffffffcc">
            {myTurn ? (view.phase === 'draw' ? 'Pesca o prendi tutti gli scarti' : 'Cala, attacca alle tue combinazioni o scarta') : `Tocca a ${names[view.turn]}`}
            {view.last ? ` · ${names[view.turn]} ${view.last}` : ''}
          </T>
          {Array.from({ length: teams }, (_, t) => (
            <View key={t} style={{ gap: 6 }}>
              <T size={12} weight="800" color="#ffffffaa">
                {t === myTeam && me !== null ? 'Le vostre combinazioni' : teamLabel(t, view.players, names)}
              </T>
              <Row gap={6} wrap>
                {meldsOf(t).map((m) => (
                  <MeldRow
                    key={m.id}
                    cards={m.cards}
                    width={me === null ? 46 : 34}
                    label={m.burraco ? `burraco ${m.burraco}` : undefined}
                    color={m.burraco === 'pulito' ? colors.accent : m.burraco ? '#FF8A65' : undefined}
                    onPress={playing && t === myTeam && selected.length ? () => onMove({ type: 'attach', meld: m.id, cards: selected }) : undefined}
                    active={playing && t === myTeam && selected.length > 0}
                    dropId={`m-${m.id}`}
                    accepts={(p) => playing && t === myTeam && p.kind === 'hand'}
                    onDrop={(p) => onMove({ type: 'attach', meld: m.id, cards: p.ids })}
                  />
                ))}
                {meldsOf(t).length === 0 && <T size={12} color="#ffffff55">—</T>}
              </Row>
            </View>
          ))}
        </ScrollView>
      </DropZone>
      </TableBg>
      {me !== null && (
        <>
          <MultiHand
            cards={view.hand}
            selected={selected}
            onToggle={playing ? toggle : undefined}
            width={handWidth}
            draggable={playing}
            dropHere={{ accepts: (p) => drawing && (p.kind === 'stock' || p.kind === 'discard'), onDrop: (p) => onMove({ type: 'draw', source: p.kind === 'stock' ? 'stock' : 'discard' }) }}
          />
          <Row gap={8} wrap style={{ justifyContent: 'center', padding: 8, minHeight: 60 }}>
            {playing && selected.length >= 3 && <Button small label={valid ? 'Cala' : 'Combinazione non valida'} disabled={!valid} onPress={() => onMove({ type: 'meld', cards: selected })} />}
            {playing && selected.length === 1 && <Button small label="Scarta" color={colors.danger} onPress={() => onMove({ type: 'discard', card: selected[0] })} />}
            {playing && selected.length > 0 && selected.length < 3 && <T size={13} color={colors.muted}>Tocca una vostra combinazione per attaccare</T>}
          </Row>
        </>
      )}
    </View>
  );
}
