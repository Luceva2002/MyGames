import { useRef, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import type { Card, SolitarioFrom, SolitarioMove, SolitarioTo, SolitarioView } from '@giochi/engine';
import type { BoardProps } from './common';
import { CARD_RATIO, CardBack, PlayingCard } from '../ui/cards';
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

function sameFrom(a: SolitarioFrom | null, b: SolitarioFrom) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function SolitarioBoard({ view, myTurn, onMove }: BoardProps<SolitarioView, SolitarioMove>) {
  const { width } = useWindowDimensions();
  const cw = Math.min(96, (Math.min(width, 900) - 16 - 6 * 8) / 7);
  const ch = cw * CARD_RATIO;
  const [sel, setSel] = useState<SolitarioFrom | null>(null);
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

  const drop = (to: SolitarioTo) => {
    if (!myTurn) return;
    if (sel) onMove({ type: 'move', from: sel, to });
    setSel(null);
  };

  return (
    <TableBg table="green">
      <Row style={{ padding: 8, justifyContent: 'center' }} gap={8}>
        <Pressable
          onPress={() => {
            tap();
            setSel(null);
            onMove({ type: 'draw' });
          }}
        >
          {view.stockCount ? (
            <CardBack width={cw} deck="fr" />
          ) : (
            <View style={{ width: cw, height: ch, borderRadius: cw * 0.1, borderWidth: 2, borderColor: '#ffffff44', alignItems: 'center', justifyContent: 'center' }}>
              <T size={cw * 0.4} color="#ffffff66">
                ↻
              </T>
            </View>
          )}
        </Pressable>
        <View style={{ width: cw * 1.7, height: ch, flexDirection: 'row' }}>
          {view.waste.map((c, i) => {
            const isTop = i === view.waste.length - 1;
            return (
              <View key={c.id} style={{ marginLeft: i ? -cw * 0.75 : 0 }}>
                <PlayingCard card={c} width={cw} selected={isTop && sel?.zone === 'waste'} onPress={isTop ? () => select({ zone: 'waste' }) : undefined} />
              </View>
            );
          })}
        </View>
        <View style={{ width: cw * 0.3 }} />
        {view.foundations.map((f, pile) => {
          const top = f[f.length - 1];
          return (
            <Pressable key={pile} onPress={() => (sel ? drop({ zone: 'foundation', pile }) : top && select({ zone: 'foundation', pile }))}>
              {top ? (
                <PlayingCard card={top} width={cw} selected={sel?.zone === 'foundation' && sel.pile === pile} />
              ) : (
                <View style={{ width: cw, height: ch, borderRadius: cw * 0.1, borderWidth: 2, borderColor: '#ffffff44', alignItems: 'center', justifyContent: 'center' }}>
                  <T size={cw * 0.4} color="#ffffff44">
                    {SUIT_HINT[pile]}
                  </T>
                </View>
              )}
            </Pressable>
          );
        })}
      </Row>
      <ScrollView contentContainerStyle={{ flexDirection: 'row', justifyContent: 'center', gap: 8, padding: 8, paddingBottom: 40 }}>
        {view.tableau.map((pile, p) => (
          <Pressable key={p} onPress={() => drop({ zone: 'tableau', pile: p })} style={{ width: cw, minHeight: ch * 3 }}>
            {pile.length === 0 && <View style={{ width: cw, height: ch, borderRadius: cw * 0.1, borderWidth: 2, borderColor: '#ffffff22' }} />}
            {pile.map((c, i) => {
              const selected = sel?.zone === 'tableau' && sel.pile === p && i >= sel.index;
              const offset = pile[i - 1] ? ch * 0.3 : ch * 0.12;
              return (
                <View key={c?.id ?? `down${p}-${i}`} style={{ marginTop: i ? -ch + offset : 0 }}>
                  {c ? <PlayingCard card={c} width={cw} selected={selected} onPress={() => select({ zone: 'tableau', pile: p, index: i })} /> : <CardBack width={cw} deck="fr" />}
                </View>
              );
            })}
          </Pressable>
        ))}
      </ScrollView>
      <Row style={{ padding: 10, justifyContent: 'space-between' }}>
        <T color={colors.muted}>Mosse: {view.moves}</T>
        {view.stuck && <T color={colors.accent}>Sembra bloccato…</T>}
        <Button small kind="ghost" color={colors.muted} label="Mi arrendo" onPress={() => onMove({ type: 'resign' })} />
      </Row>
    </TableBg>
  );
}
