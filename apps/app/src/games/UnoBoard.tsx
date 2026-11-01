import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { UNO_COLORS as COLORS, type Card, type Seat, type UnoMove, type UnoView } from '@giochi/engine';
import { MyCorner, EventSticker, Felt, Hand, othersOf, TableTop, type SeatInfo, useCardWidth, type BoardProps } from './common';
import { CardBack, DeckPile, PlayingCard, UNO_COLORS } from '../ui/cards';
import { Draggable, DropZone } from '../ui/drag';
import { Anchor, FlyIn, handAnchor } from '../ui/motion';
import { Button, Row, T, tap } from '../ui/kit';
import { TableBg } from '../ui/tables';
import { colors } from '../ui/theme';

const COLOR_LABEL: Record<string, string> = { r: 'Rosso', g: 'Verde', b: 'Blu', y: 'Giallo' };

export function UnoBoard({ view, me, names, myTurn, onMove }: BoardProps<UnoView, UnoMove>) {
  const [wild, setWild] = useState<Card | null>(null);
  const handWidth = useCardWidth(Math.max(view.hand.length, 6), 84);
  const big = me === null;
  useEffect(() => setWild(null), [view.turn]);

  const playCard = (c: Card) => {
    if (!view.playable.includes(c.id)) return;
    if (c.suit === 'w') setWild(c);
    else onMove({ type: 'play', card: c.id });
  };

  const uinfo = (seat: Seat): SeatInfo => ({ seat, name: names[seat] + (view.handCounts[seat] === 1 ? ' · UNO!' : ''), active: view.turn === seat, cards: view.handCounts[seat], deck: 'uno', score: view.handCounts[seat], scoreLabel: 'carte' });
  return (
    <TableBg table="teal">
      <DropZone id="table" style={{ flex: 1 }} radius={22} inset={-10} accepts={(p) => myTurn && p.kind === 'hand'} onDrop={(p) => {
        const c = view.hand.find((x) => x.id === p.ids[0]);
        if (c) playCard(c);
      }}>
      <Felt>
        <TableTop seats={othersOf(view.players, me).map(uinfo)} />
        <View style={{ flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Row gap={big ? 40 : 24}>
          <Pressable
            disabled={!myTurn || !!view.drawn}
            onPress={() => {
              tap();
              onMove({ type: 'draw' });
            }}
            style={{ alignItems: 'center', gap: 6 }}
          >
            <Draggable payload={myTurn && !view.drawn ? { kind: 'stock', ids: [] } : null} ghost={<CardBack width={big ? 110 : 76} deck="uno" />}>
              <Anchor id="deck">
                <DeckPile count={view.deckCount} width={big ? 110 : 76} deck="uno" />
              </Anchor>
            </Draggable>
            {myTurn && !view.drawn && (
              <T size={13} weight="800" color={colors.accent}>
                Pesca
              </T>
            )}
          </Pressable>
          <View style={{ alignItems: 'center', gap: 6 }}>
          <View style={{ padding: 8, borderRadius: 18, borderWidth: 5, borderColor: UNO_COLORS[view.color] }}>
            <FlyIn key={view.top.id} from={view.last?.seat === me ? 'below' : 'none'} fromAnchor={view.last && view.last.seat !== me ? handAnchor(view.last.seat) : undefined} sound="card">
              <PlayingCard card={view.top} width={big ? 120 : 86} chosenColor={view.top.suit === 'w' ? view.color : undefined} />
            </FlyIn>
          </View>
            <T size={13} weight="800" color="#ffffffcc">
              Scarti
            </T>
          </View>
        </Row>
        <T size={big ? 30 : 20} color="#ffffff88">
          {view.direction === 1 ? '↻' : '↺'}
        </T>
        </View>
      </Felt>
      </DropZone>
      <EventSticker eventKey={view.last ? view.top.id + view.last.text : null} text={unoSticker(view)} />
      {me !== null && (
        <>
          <DropZone id="hand" radius={18} accepts={(p) => myTurn && !view.drawn && p.kind === 'stock'} onDrop={() => onMove({ type: 'draw' })}>
            <Hand cards={view.hand} width={handWidth} playable={myTurn ? view.playable : undefined} onPress={myTurn ? playCard : undefined} drag={myTurn ? (c) => ({ kind: 'hand', ids: [c.id] }) : undefined} />
          </DropZone>
          <View style={{ minHeight: 60, padding: 8, alignItems: 'center' }}>
            {myTurn && view.drawn && <Button small label="Tieni la carta e passa" onPress={() => onMove({ type: 'pass' })} />}
          </View>
        </>
      )}
      {wild && (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <T size={22} weight="900">
            Scegli il colore
          </T>
          <Row gap={12} wrap style={{ justifyContent: 'center' }}>
            {COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => {
                  tap();
                  onMove({ type: 'play', card: wild.id, color: c });
                  setWild(null);
                }}
                style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: UNO_COLORS[c], alignItems: 'center', justifyContent: 'center' }}
              >
                <T weight="900" color={c === 'y' ? '#222' : '#fff'}>
                  {COLOR_LABEL[c]}
                </T>
              </Pressable>
            ))}
          </Row>
          <Button small kind="ghost" color={colors.text} label="Annulla" onPress={() => setWild(null)} />
        </View>
      )}
      <MyCorner info={me === null ? null : uinfo(me)} />
    </TableBg>
  );
}

/** Cartello per le carte speciali appena giocate: si capisce al volo cosa è successo. */
function unoSticker(view: UnoView): string | null {
  if (!view.last || view.last.text === 'pesca' || view.last.text === 'passa') return null;
  if (view.last.text.includes('UNO!')) return 'UNO!';
  return ({ 10: 'Salta!', 11: 'Giro al contrario!', 12: '+2!', 14: '+4!' } as Record<number, string>)[view.top.rank] ?? null;
}
