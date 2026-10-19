import { useRef, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import type { Card, SolitarioFrom, SolitarioMove, SolitarioTo, SolitarioView } from '@giochi/engine';
import type { BoardProps } from './common';
import { CARD_RATIO, CardBack, CardGhost, DeckPile, NoCardZoom, PlayingCard } from '../ui/cards';
import { Draggable, DropZone, type DragPayload } from '../ui/drag';
import { Button, Row, T, tap } from '../ui/kit';
import { TableBg } from '../ui/tables';
import { colors } from '../ui/theme';

const SUIT_HINT = ['♥', '♦', '♣', '♠'];

function foundationFor(view: SolitarioView, card: Card): number | null {
  for (let i = 0; i < 4; i++) {
    const f = view.foundations[i];
    const top = f[f.length - 1];
    if (top ? top.suit === card.suit && top.rank === card.rank - 1 : card.rank === 1) return i;
  }
  return null;
}

const red = (c: Card) => c.suit === 'h' || c.suit === 'd';

/** Le stesse regole del motore, per illuminare solo le pile dove la carta può davvero andare. */
function fitsFoundation(view: SolitarioView, pile: number, card: Card) {
  const top = view.foundations[pile].at(-1);
  return top ? top.suit === card.suit && top.rank === card.rank - 1 : card.rank === 1;
}
function fitsTableau(view: SolitarioView, pile: number, card: Card) {
  const p = view.tableau[pile];
  if (!p.length) return card.rank === 13;
  const top = p[p.length - 1];
  return !!top && red(top) !== red(card) && top.rank === card.rank + 1;
}

function sameFrom(a: SolitarioFrom | null, b: SolitarioFrom) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function SolitarioBoard({ view, myTurn, onMove }: BoardProps<SolitarioView, SolitarioMove>) {
  const { width } = useWindowDimensions();
  // Il tavolo ha il bordo dorato (circa 9% della larghezza): le 7 colonne devono starci dentro.
  // Sul telefono le sette colonne usano tutta la larghezza del panno; sotto i 60 px le carte mostrano
  // valore e seme grandi in cima, così si leggono anche impilate.
  const cw = Math.min(96, width < 700 ? (width - 60 - 6 * 4) / 7 : (Math.min(width, 900) * 0.9 - 12 - 6 * 6) / 7);
  const compact = cw < 60;
  const ch = cw * CARD_RATIO;
  const [sel, setSel] = useState<SolitarioFrom | null>(null);
  const [lift, setLift] = useState<{ pile: number; index: number } | null>(null);
  const lastTap = useRef<{ key: string; at: number }>({ key: '', at: 0 });

  const cardAt = (from: SolitarioFrom): Card | null => {
    if (from.zone === 'waste') return view.waste[view.waste.length - 1] ?? null;
    if (from.zone === 'foundation') return view.foundations[from.pile].at(-1) ?? null;
    return view.tableau[from.pile][from.index] ?? null;
  };

  const select = (from: SolitarioFrom) => {
    if (!myTurn) return;
    const key = JSON.stringify(from);
    const now = Date.now();
    const card = cardAt(from);
    // Doppio tocco: manda la carta sulla base giusta.
    if (card && lastTap.current.key === key && now - lastTap.current.at < 400) {
      const isTop = from.zone !== 'tableau' || from.index === view.tableau[from.pile].length - 1;
      const f = isTop ? foundationFor(view, card) : null;
      if (f !== null) {
        onMove({ type: 'move', from, to: { zone: 'foundation', pile: f } });
        setSel(null);
        lastTap.current = { key: '', at: 0 };
        return;
      }
    }
    lastTap.current = { key, at: now };
    if (sel && !sameFrom(sel, from) && from.zone === 'tableau') {
      drop({ zone: 'tableau', pile: from.pile });
      return;
    }
    setSel(sameFrom(sel, from) ? null : card ? from : null);
  };

  // Trascinamento: la carta (o la scala di carte dalla colonna) porta con sé da dove arriva.
  const dragOf = (from: SolitarioFrom, cards: Card[]): DragPayload | null => (myTurn ? { kind: 'sol', ids: cards.map((c) => c.id), data: from } : null);
  const firstCard = (p: DragPayload) => cardAt(p.data as SolitarioFrom);
  const dropMove = (to: SolitarioTo) => (p: DragPayload) => {
    setSel(null);
    onMove({ type: 'move', from: p.data as SolitarioFrom, to });
  };

  const drop = (to: SolitarioTo) => {
    if (!myTurn) return;
    if (sel) onMove({ type: 'move', from: sel, to });
    setSel(null);
  };

  return (
    <TableBg table="teal">
      {/* Nel solitario ogni tocco sposta le carte: niente lente. */}
      <NoCardZoom.Provider value>
      <Row style={{ padding: 4, paddingTop: 8, justifyContent: 'center' }} gap={compact ? 4 : 6}>
        <Pressable
          onPress={() => {
            tap();
            setSel(null);
            onMove({ type: 'draw' });
          }}
        >
          {view.stockCount ? (
            <DeckPile count={view.stockCount} width={cw} deck="fr" />
          ) : (
            <View style={{ width: cw, height: ch, borderRadius: cw * 0.1, borderWidth: 2, borderColor: '#ffffff44', alignItems: 'center', justifyContent: 'center' }}>
              <T size={cw * 0.4} color="#ffffff66">
                ↻
              </T>
            </View>
          )}
        </Pressable>
        <View style={{ width: cw * (compact ? 1.45 : 1.7), height: ch, flexDirection: 'row' }}>
          {view.waste.map((c, i) => {
            const isTop = i === view.waste.length - 1;
            return (
              <View key={c.id} style={{ marginLeft: i ? -cw * (compact ? 0.78 : 0.75) : 0 }}>
                <Draggable payload={isTop ? dragOf({ zone: 'waste' }, [c]) : null} ghost={<CardGhost cards={[c]} width={cw} />}>
                  <PlayingCard card={c} width={cw} compact={compact} selected={isTop && sel?.zone === 'waste'} onPress={isTop ? () => select({ zone: 'waste' }) : undefined} />
                </Draggable>
              </View>
            );
          })}
        </View>
        <View style={{ width: cw * (compact ? 0.05 : 0.3) }} />
        {view.foundations.map((f, pile) => {
          const top = f[f.length - 1];
          return (
            <DropZone
              key={pile}
              id={`f-${pile}`}
              radius={cw * 0.1}
              inset={3}
              accepts={(p) => p.kind === 'sol' && p.ids.length === 1 && !!firstCard(p) && fitsFoundation(view, pile, firstCard(p)!)}
              onDrop={dropMove({ zone: 'foundation', pile })}
            >
            <Pressable onPress={() => (sel ? drop({ zone: 'foundation', pile }) : top && select({ zone: 'foundation', pile }))}>
              {top ? (
                <Draggable payload={dragOf({ zone: 'foundation', pile }, [top])} ghost={<CardGhost cards={[top]} width={cw} />}>
                  <PlayingCard card={top} width={cw} compact={compact} selected={sel?.zone === 'foundation' && sel.pile === pile} />
                </Draggable>
              ) : (
                <View style={{ width: cw, height: ch, borderRadius: cw * 0.1, borderWidth: 2, borderColor: '#ffffff44', alignItems: 'center', justifyContent: 'center' }}>
                  <T size={cw * 0.4} color="#ffffff44">
                    {SUIT_HINT[pile]}
                  </T>
                </View>
              )}
            </Pressable>
            </DropZone>
          );
        })}
      </Row>
      <ScrollView contentContainerStyle={{ flexDirection: 'row', justifyContent: 'center', gap: width < 700 ? 4 : 6, padding: 4, paddingBottom: 40 }}>
        {view.tableau.map((pile, p) => (
          <DropZone
            key={p}
            id={`p-${p}`}
            radius={cw * 0.1}
            inset={3}
            accepts={(d) => {
              const from = d.data as SolitarioFrom;
              const c = d.kind === 'sol' ? firstCard(d) : null;
              return !!c && !(from.zone === 'tableau' && from.pile === p) && fitsTableau(view, p, c);
            }}
            onDrop={dropMove({ zone: 'tableau', pile: p })}
          >
          <Pressable onPress={() => drop({ zone: 'tableau', pile: p })} style={{ width: cw, minHeight: ch * 3 }}>
            {pile.length === 0 && <View style={{ width: cw, height: ch, borderRadius: cw * 0.1, borderWidth: 2, borderColor: '#ffffff22' }} />}
            {pile.map((c, i) => {
              const selected = sel?.zone === 'tableau' && sel.pile === p && i >= sel.index;
              const offset = pile[i - 1] ? ch * (compact ? 0.36 : 0.3) : ch * 0.12;
              return (
                <View key={c?.id ?? `down${p}-${i}`} style={[{ marginTop: i ? -ch + offset : 0 }, lift?.pile === p && i > lift.index && { opacity: 0.25 }]}>
                  {c ? (
                    <Draggable payload={dragOf({ zone: 'tableau', pile: p, index: i }, pile.slice(i) as Card[])} ghost={<StackGhost cards={pile.slice(i) as Card[]} width={cw} offset={ch * 0.3} />} onLift={(l) => setLift(l ? { pile: p, index: i } : null)}>
                      <PlayingCard card={c} width={cw} compact={compact} selected={selected} onPress={() => select({ zone: 'tableau', pile: p, index: i })} />
                    </Draggable>
                  ) : (
                    <CardBack width={cw} deck="fr" />
                  )}
                </View>
              );
            })}
          </Pressable>
          </DropZone>
        ))}
      </ScrollView>
      </NoCardZoom.Provider>
      <Row style={{ padding: 10, justifyContent: 'space-between' }}>
        <T color={colors.muted}>Mosse: {view.moves}</T>
        {view.stuck && <T color={colors.accent}>Sembra bloccato…</T>}
        <Button small kind="ghost" color={colors.muted} label="Mi arrendo" onPress={() => onMove({ type: 'resign' })} />
      </Row>
    </TableBg>
  );
}

/** Una scala di carte della colonna, trascinata tutta insieme. */
function StackGhost({ cards, width, offset }: { cards: Card[]; width: number; offset: number }) {
  return (
    <View>
      {cards.map((c, i) => (
        <View key={c.id} style={{ marginTop: i ? -width * CARD_RATIO + offset : 0 }}>
          <PlayingCard card={c} width={width} sway={false} />
        </View>
      ))}
    </View>
  );
}
