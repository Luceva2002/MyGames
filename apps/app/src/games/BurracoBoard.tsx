import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { BURRACO_RULES, checkMeld, teamOf, type BurracoMove, type BurracoView, type Card } from '@giochi/engine';
import { Banner, Opponents, othersOf, PlayerBadge, useCardWidth, type BoardProps } from './common';
import { CardsSummaryTable, teamLabel } from './summary';
import { MeldRow, MultiHand } from './RummyParts';
import { DeckPile, PlayingCard } from '../ui/cards';
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
      <Row style={{ justifyContent: 'center' }} gap={16}>
        {view.teamScores.map((p, t) => (
          <T key={t} size={13} color={colors.muted}>
            {teamLabel(t, view.players, names)}: <T size={13} weight="900">{p}</T>
            {view.pozzettoTaken[t] ? ' · pozzetto ✓' : ''}
          </T>
        ))}
      </Row>
      <Opponents>
        {othersOf(view.players, me).map((seat) => (
          <PlayerBadge key={seat} seat={seat} name={names[seat] + (me !== null && view.players === 4 && teamOf(seat, 4) === myTeam ? ' 🤝' : '')} active={view.turn === seat} cards={view.handCounts[seat]} deck="fr" />
        ))}
      </Opponents>
      <TableBg table="green" rounded style={{ marginHorizontal: 8 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 8, gap: 8 }}>
          <Row gap={12}>
            <Pressable
              disabled={!myTurn || view.phase !== 'draw'}
              onPress={() => {
                tap();
                onMove({ type: 'draw', source: 'stock' });
              }}
            >
              <DeckPile count={view.stockCount} width={40} deck="fr" />
            </Pressable>
            <Pressable
              disabled={!myTurn || view.phase !== 'draw' || !view.discard.length}
              onPress={() => {
                tap();
                onMove({ type: 'draw', source: 'discard' });
              }}
              style={{ flexDirection: 'row', flex: 1, flexWrap: 'wrap' }}
            >
              {view.discard.map((c, i) => (
                <View key={c.id} style={{ marginLeft: i ? -26 : 0 }}>
                  <PlayingCard card={c} width={40} />
                </View>
              ))}
            </Pressable>
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
                  />
                ))}
                {meldsOf(t).length === 0 && <T size={12} color="#ffffff55">—</T>}
              </Row>
            </View>
          ))}
        </ScrollView>
      </TableBg>
      {me !== null && (
        <>
          <MultiHand cards={view.hand} selected={selected} onToggle={playing ? toggle : undefined} width={handWidth} />
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
