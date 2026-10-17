import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { Card, Seat } from '@giochi/engine';
import { CARD_RATIO, CardBack, PlayingCard } from '../ui/cards';
import { PlayerTag, T } from '../ui/kit';
import { TableBg, type TableName } from '../ui/tables';
import { useIsTv } from '../ui/settings';
import { colors, seatColor } from '../ui/theme';

export interface BoardProps<V = any, M = any> {
  view: V;
  /** Chi sta guardando: null è lo schermo condiviso, che non vede le carte di nessuno. */
  me: Seat | null;
  names: string[];
  myTurn: boolean;
  onMove: (move: M) => void;
}

/** Larghezza delle carte in mano in base allo schermo e al numero di carte. */
export function useCardWidth(count: number, max = 92) {
  const { width, height } = useWindowDimensions();
  const tv = useIsTv();
  // Sulla TV le carte sono larghe almeno il 9% dello schermo, per leggerle dal divano (SPEC §9, V-TXT-1).
  if (tv) return Math.max(width * 0.09, Math.min(width * 0.12, (width * 0.9 - (count - 1) * 12) / Math.max(count, 1)));
  const avail = Math.min(width, 1000) - 32;
  const byWidth = (avail - (count - 1) * 8) / Math.max(count, 1);
  const byHeight = (height * 0.2) / CARD_RATIO;
  return Math.max(38, Math.min(max, byWidth, byHeight));
}

/** Ordine dei posti visto da chi gioca: prima gli avversari che seguono, così la disposizione resta naturale. */
export function othersOf(players: number, me: Seat | null): Seat[] {
  const start = me ?? -1;
  return Array.from({ length: players }, (_, i) => (start + 1 + i + players) % players).filter((s) => s !== me);
}

export function PlayerBadge({ seat, name, active, cards, deck = 'it', children }: {
  seat: Seat;
  name: string;
  active: boolean;
  cards?: number;
  deck?: 'it' | 'fr' | 'uno';
  children?: ReactNode;
}) {
  // Il turno si vede dal bordo colorato e dalla freccia, non solo dal colore (V-COL-1, V-ST-1).
  return (
    <View
      accessibilityLabel={`${name}${active ? ', tocca a lui' : ''}${cards !== undefined ? `, ${cards} carte` : ''}`}
      style={[styles.badge, active && { borderColor: seatColor(seat), backgroundColor: colors.surface2 }]}
    >
      <PlayerTag seat={seat} name={name} size={14} suffix={active ? '  ▶' : ''} />
      {cards !== undefined && cards > 0 && (
        <View style={{ flexDirection: 'row', height: 30, alignItems: 'center' }}>
          {Array.from({ length: Math.min(cards, 10) }, (_, i) => (
            <CardBack key={i} width={18} deck={deck} style={{ marginLeft: i ? -11 : 0, borderWidth: 0.5 }} />
          ))}
          <T size={12} color={colors.muted}>{`  ${cards}`}</T>
        </View>
      )}
      {children}
    </View>
  );
}

export function Opponents({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal contentContainerStyle={styles.opponents} showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
      {children}
    </ScrollView>
  );
}

export function Hand({ cards, width, selected, playable, onPress }: {
  cards: Card[];
  width: number;
  selected?: string | null;
  playable?: string[];
  onPress?: (card: Card) => void;
}) {
  const overlap = cards.length * (width + 8) > 980 ? -width * 0.35 : 8;
  return (
    <View style={[styles.hand, { minHeight: width * CARD_RATIO + 20 }]}>
      {cards.map((c, i) => (
        <View key={c.id} style={{ marginLeft: i ? overlap : 0 }}>
          <PlayingCard card={c} width={width} selected={selected === c.id} dimmed={playable ? !playable.includes(c.id) : false} onPress={onPress ? () => onPress(c) : undefined} />
        </View>
      ))}
    </View>
  );
}

/** Il panno del tavolo con la cornice di legno. */
export function Felt({ children, style, table = 'green' }: { children: ReactNode; style?: object; table?: TableName }) {
  return (
    <View style={[styles.feltFrame, style]}>
      <TableBg table={table} style={styles.felt}>
        {children}
      </TableBg>
    </View>
  );
}

export function Banner({ text, tone = 'info' }: { text: string; tone?: 'info' | 'turn' }) {
  // Sulla TV il turno si legge solo nel cartello in alto al centro, per non ripeterlo (spec §5).
  const tv = useIsTv();
  if (tv) return null;
  return (
    <View style={[styles.banner, tone === 'turn' && { backgroundColor: colors.accent }]} accessibilityLiveRegion="polite">
      <T size={16} weight="800" color={tone === 'turn' ? colors.onAccent : colors.text} center>
        {tone === 'turn' ? '▶ ' : ''}
        {text}
      </T>
    </View>
  );
}

export function turnText(myTurn: boolean, names: string[], turn: Seat, me: Seat | null) {
  if (myTurn) return 'Tocca a te';
  if (turn === me) return 'Aspetta…';
  return `Tocca a ${names[turn]}`;
}

const styles = StyleSheet.create({
  stickerWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  sticker: { backgroundColor: colors.accent2, borderWidth: 3, borderColor: colors.line, borderRadius: 18, paddingHorizontal: 22, paddingVertical: 10, transform: [{ rotate: '-6deg' }], boxShadow: `0px 6px 0px ${colors.line}` },
  badge: { padding: 8, borderRadius: 18, borderWidth: 3, borderColor: colors.line, gap: 4, minWidth: 96, backgroundColor: colors.surface },
  opponents: { gap: 8, paddingHorizontal: 12, paddingVertical: 4 },
  hand: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 8, paddingTop: 16 },
  feltFrame: { flex: 1, margin: 8, borderRadius: 26, borderWidth: 3, borderColor: colors.line, overflow: 'hidden', backgroundColor: colors.felt, boxShadow: `0px 6px 0px ${colors.line}` },
  felt: { padding: 12, alignItems: 'center', justifyContent: 'center', gap: 12 },
  banner: { alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.surface2, marginVertical: 6, borderWidth: 3, borderColor: colors.line, boxShadow: `0px 4px 0px ${colors.line}` },
});

/**
 * Adesivo magenta inclinato al centro per gli eventi ("+1 scopa!", "Settebello"), visibile 1,2 s (SPEC §9).
 * `eventKey` cambia a ogni nuovo evento; null non mostra niente.
 */
export function EventSticker({ text, eventKey }: { text: string | null; eventKey: string | null }) {
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    if (!text || !eventKey) return;
    setShown(text);
    const t = setTimeout(() => setShown(null), 1200);
    return () => clearTimeout(t);
  }, [eventKey]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!shown) return null;
  return (
    <View pointerEvents="none" accessibilityLiveRegion="polite" style={styles.stickerWrap}>
      <View style={styles.sticker}>
        <T size={30} weight="900" color="#FFFFFF" center>
          {shown}
        </T>
      </View>
    </View>
  );
}
