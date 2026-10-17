import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { UNO_COLORS as COLORS, unoLastText, type Card, type UnoMove, type UnoView } from '@giochi/engine';
import { Banner, Felt, Hand, Opponents, othersOf, PlayerBadge, turnText, useCardWidth, type BoardProps } from './common';
import { DeckPile, PlayingCard, UNO_COLORS } from '../ui/cards';
import { Button, Row, T, tap } from '../ui/kit';
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

  return (
    <View style={{ flex: 1 }}>
      <Opponents>
        {othersOf(view.players, me).map((seat) => (
          <PlayerBadge key={seat} seat={seat} name={names[seat]} active={view.turn === seat} cards={view.handCounts[seat]} deck="uno">
            {view.handCounts[seat] === 1 && (
              <T size={13} weight="900" color={colors.danger}>
                UNO!
              </T>
            )}
          </PlayerBadge>
        ))}
      </Opponents>
      <Felt table="blue" style={{ borderColor: '#0E1226' }}>
        <Row gap={big ? 40 : 24}>
          <Pressable
            disabled={!myTurn || !!view.drawn}
            onPress={() => {
              tap();
              onMove({ type: 'draw' });
            }}
            style={{ alignItems: 'center', gap: 6 }}
          >
            <DeckPile count={view.deckCount} width={big ? 110 : 76} deck="uno" />
            {myTurn && !view.drawn && (
              <T size={13} weight="800" color={colors.accent}>
                Pesca
              </T>
            )}
          </Pressable>
          <View style={{ padding: 8, borderRadius: 18, borderWidth: 5, borderColor: UNO_COLORS[view.color] }}>
            <PlayingCard card={view.top} width={big ? 120 : 86} chosenColor={view.top.suit === 'w' ? view.color : undefined} />
          </View>
        </Row>
        <T size={big ? 30 : 20} color="#ffffff88">
          {view.direction === 1 ? '↻' : '↺'}
        </T>
        {view.last && (
          <T size={big ? 20 : 14} color="#ffffffcc" center>
            {unoLastText(view.last, names)}
          </T>
        )}
      </Felt>
      <Banner text={turnText(myTurn, names, view.turn, me)} tone={myTurn ? 'turn' : 'info'} />
      {me !== null && (
        <>
          <Hand cards={view.hand} width={handWidth} playable={myTurn ? view.playable : undefined} onPress={myTurn ? playCard : undefined} />
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
    </View>
  );
}
