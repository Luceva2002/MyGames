import { useMemo, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import type { Card } from '@giochi/engine';
import { CARD_RATIO, CardGhost, PlayingCard } from '../ui/cards';
import { Draggable, DropZone, type DragPayload } from '../ui/drag';
import { Row, T, tap } from '../ui/kit';
import { colors } from '../ui/theme';
import { TableBg } from '../ui/tables';
import { useIsTv } from '../ui/settings';

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
  // Ogni carta lascia vedere almeno metà di sé (valore e semi); se non ci stanno, si va su due file.
  const { width: screenW } = useWindowDimensions();
  const avail = Math.min(screenW, 1000) - 24;
  const perRow = Math.max(2, Math.floor((avail - width) / (width * 0.5)) + 1);
  const nRows = Math.max(1, Math.ceil(sorted.length / perRow));
  const per = Math.ceil(sorted.length / nRows);
  const rows = Array.from({ length: nRows }, (_, r) => sorted.slice(r * per, (r + 1) * per));
  const stepOf = (k: number) => (k > 1 ? Math.min(width + 6, (avail - width) / (k - 1)) : width);
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
        <View style={{ paddingHorizontal: 8, paddingTop: width * 0.2, gap: 8 }}>
          {rows.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row', justifyContent: 'center' }}>
          {row.map((c, i) => {
            const group = selected.includes(c.id) ? sorted.filter((x) => selected.includes(x.id)) : [c];
            return (
              <Draggable
                key={c.id}
                style={{ marginLeft: i ? stepOf(row.length) - width : 0 }}
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
          ))}
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

/** Larghezza di mazzo e scarti: grandi e ben visibili, anche sul telefono. */
export function usePileWidth() {
  const { width } = useWindowDimensions();
  const tv = useIsTv();
  return tv ? 96 : Math.round(Math.max(52, Math.min(76, width * 0.15)));
}

/**
 * Il tavolo dei giochi a combinazioni: velluto viola pulito, a sinistra una colonna con mazzo e
 * scarti grandi (la carta scoperta si vede bene), a destra le combinazioni calate.
 */
export function CardTable({ piles, count = 1, top, children }: { piles: (width: number) => React.ReactNode; count?: number; top?: React.ReactNode; children: React.ReactNode }) {
  const base = usePileWidth();
  const [h, setH] = useState(0);
  // Le pile si rimpiccioliscono solo se il tavolo è troppo basso per contenerle una sopra l'altra.
  const fit = h ? Math.min(base, (h - 20 - count * 34 - (count - 1) * 14) / count / 1.5) : base;
  const w = Math.max(36, Math.round(fit));
  return (
    <TableBg table="teal" style={{ marginHorizontal: 4, flexDirection: 'row' }}>
      <View onLayout={(e) => setH(e.nativeEvent.layout.height)} style={{ paddingVertical: 10, paddingHorizontal: 10, gap: 14, alignItems: 'center', justifyContent: 'center', borderRightWidth: 2, borderRightColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(0,0,0,0.18)' }}>{piles(w)}</View>
      <View style={{ flex: 1, paddingTop: top ? 4 : 0 }}>
        {top}
        {children}
      </View>
    </TableBg>
  );
}
