import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { Card } from '@giochi/engine';
import { CARD_RATIO, CardGhost, PlayingCard } from '../ui/cards';
import { Draggable, DropZone, type DragPayload } from '../ui/drag';
import { Row, T, tap } from '../ui/kit';
import { colors } from '../ui/theme';

type SortMode = 'seme' | 'valore';
const SUIT_ORDER: Record<string, number> = { h: 0, d: 1, c: 2, s: 3, j: 4 };

export function sortCards(cards: Card[], mode: SortMode): Card[] {
  return [...cards].sort((a, b) =>
    mode === 'seme' ? SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit] || a.rank - b.rank : a.rank - b.rank || SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit],
  );
}

/** Mano con selezione multipla, a ventaglio su due righe se serve. */
export function MultiHand({ cards, selected, onToggle, width, highlight, draggable, dropHere }: {
  cards: Card[];
  selected: string[];
  onToggle?: (id: string) => void;
  width: number;
  highlight?: string | null;
  /** Le carte si trascinano: una carta scelta porta con sé tutte le scelte. */
  draggable?: boolean;
  /** La mano accetta carte trascinate (pescare dal mazzo, riprendere dal tavolo). */
  dropHere?: { accepts: (p: DragPayload) => boolean; onDrop: (p: DragPayload) => boolean | void };
}) {
  const [mode, setMode] = useState<SortMode>('seme');
  const sorted = useMemo(() => sortCards(cards, mode), [cards, mode]);
  return (
    <View style={{ gap: 4 }}>
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: 12 }}>
        <T size={13} color={colors.muted}>
          {cards.length} carte{selected.length ? ` · ${selected.length} selezionate` : ''}
        </T>
        <Pressable
          onPress={() => {
            tap();
            setMode(mode === 'seme' ? 'valore' : 'seme');
          }}
        >
          <T size={13} weight="800" color={colors.accent}>
            Ordina per {mode === 'seme' ? 'valore' : 'seme'}
          </T>
        </Pressable>
      </Row>
      <DropZone id="hand" accepts={dropHere?.accepts ?? (() => false)} onDrop={dropHere?.onDrop ?? (() => false)} radius={14}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 8, paddingTop: width * 0.2, rowGap: 6 }}>
          {sorted.map((c, i) => {
            const group = selected.includes(c.id) ? sorted.filter((x) => selected.includes(x.id)) : [c];
            return (
              <Draggable
                key={c.id}
                style={{ marginLeft: i ? -width * 0.42 : 0 }}
                payload={draggable ? { kind: 'hand', ids: group.map((x) => x.id) } : null}
                ghost={<CardGhost cards={group} width={width} />}
              >
                <PlayingCard
                  card={c}
                  width={width}
                  selected={selected.includes(c.id) || highlight === c.id}
                  onPress={onToggle ? () => onToggle(c.id) : undefined}
                />
              </Draggable>
            );
          })}
        </View>
      </DropZone>
    </View>
  );
}

/** Una combinazione in tavola: carte sovrapposte; ci si attaccano le carte toccandola o trascinandocele sopra. */
export function MeldRow({ cards, width, onPress, color, label, active, invalid, selected, onCardPress, dropId, accepts, onDrop, dragCard }: {
  cards: Card[];
  width: number;
  onPress?: () => void;
  color?: string;
  label?: string;
  active?: boolean;
  invalid?: boolean;
  selected?: string[];
  onCardPress?: (id: string) => void;
  /** Zona di rilascio per le carte trascinate. */
  dropId?: string;
  accepts?: (p: DragPayload) => boolean;
  onDrop?: (p: DragPayload) => boolean | void;
  /** Le carte della combinazione si possono trascinare via (Machiavelli). */
  dragCard?: (id: string) => DragPayload | null;
}) {
  const body = (
    <Pressable
      disabled={!onPress}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={{
        padding: 6,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: invalid ? colors.danger : active ? colors.accent : color ?? '#ffffff22',
        backgroundColor: '#00000022',
        gap: 2,
      }}
    >
      <View style={{ flexDirection: 'row', minHeight: width * CARD_RATIO }}>
        {cards.map((c, i) => {
          const p = dragCard?.(c.id) ?? null;
          const group = p ? cards.filter((x) => p.ids.includes(x.id)) : [c];
          return (
            <Draggable key={c.id} style={{ marginLeft: i ? -width * 0.55 : 0 }} payload={p} ghost={<CardGhost cards={group} width={width} />}>
              <PlayingCard card={c} width={width} selected={selected?.includes(c.id)} onPress={onCardPress ? () => onCardPress(c.id) : undefined} />
            </Draggable>
          );
        })}
      </View>
      {label ? (
        <T size={11} weight="800" color={color ?? colors.muted}>
          {label}
        </T>
      ) : null}
    </Pressable>
  );
  if (!dropId || !accepts || !onDrop) return body;
  return (
    <DropZone id={dropId} accepts={accepts} onDrop={onDrop} radius={12} inset={3}>
      {body}
    </DropZone>
  );
}

export function TableArea({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 10, justifyContent: 'center' }}>
      {children}
    </ScrollView>
  );
}
