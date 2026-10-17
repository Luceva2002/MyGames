import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { Card, Seat } from '@giochi/engine';
import { CARD_RATIO, CardBack, CardGhost, cardRatio, PlayingCard } from '../ui/cards';
import { Draggable, type DragPayload } from '../ui/drag';
import { FlyIn, PopIn, Pulse } from '../ui/motion';
import { Row, T } from '../ui/kit';
import { SeatAvatar } from '../ui/avatars';
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

/**
 * Il posto di un giocatore nella barra dei punteggi: la sua maschera, il nome, il punteggio grande
 * e, sotto, le carte in mano o altre informazioni. Chi è di turno pulsa col bordo del suo colore.
 */
export function PlayerBadge({ seat, name, active, cards, deck = 'it', score, scoreLabel, isMe, children }: {
  seat: Seat;
  name: string;
  active: boolean;
  cards?: number;
  deck?: 'it' | 'fr' | 'uno';
  /** Il punteggio da mostrare in grande (punti, prese, carte rimaste…). */
  score?: number | string;
  scoreLabel?: string;
  isMe?: boolean;
  children?: ReactNode;
}) {
  // Il turno si vede dal bordo colorato e dalla freccia, non solo dal colore (V-COL-1, V-ST-1).
  return (
    <Pulse active={active}>
      <View
        accessibilityLabel={`${isMe ? 'Tu' : name}${active ? ', è il suo turno' : ''}${score !== undefined ? `, ${score} ${scoreLabel ?? ''}` : ''}${cards !== undefined ? `, ${cards} carte` : ''}`}
        style={[styles.badge, isMe && { backgroundColor: colors.surface2 }, active && { borderColor: seatColor(seat), boxShadow: `0px 4px 0px ${seatColor(seat)}` }]}
      >
        <SeatAvatar seat={seat} name={name} size={44} />
        <View style={{ gap: 1, flexShrink: 1 }}>
          <T size={13} weight="800" lines={1} color={active ? seatColor(seat) : colors.text}>
            {isMe ? 'Tu' : name}
            {active ? '  ▶' : ''}
          </T>
          {score !== undefined && (
            <Row gap={4} style={{ alignItems: 'baseline' }}>
              <T size={24} weight="900" color={colors.accent}>
                {score}
              </T>
              {scoreLabel ? (
                <T size={12} color={colors.muted}>
                  {scoreLabel}
                </T>
              ) : null}
            </Row>
          )}
          {cards !== undefined && cards > 0 && !isMe && (
            <View style={{ flexDirection: 'row', height: 22, alignItems: 'center' }}>
              {Array.from({ length: Math.min(cards, 8) }, (_, i) => (
                <CardBack key={i} width={13} deck={deck} style={{ marginLeft: i ? -8 : 0, borderWidth: 0.5 }} />
              ))}
              <T size={12} color={colors.muted}>{`  ${cards}`}</T>
            </View>
          )}
          {children}
        </View>
      </View>
    </Pulse>
  );
}

/** I posti visti da chi gioca: prima io (se gioco), poi gli altri nell'ordine del tavolo. */
export function seatsFrom(players: number, me: Seat | null): Seat[] {
  return me === null ? othersOf(players, me) : [me, ...othersOf(players, me)];
}

export function Opponents({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal contentContainerStyle={styles.opponents} showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
      {children}
    </ScrollView>
  );
}

/**
 * La mano a ventaglio, alla Balatro: le carte si aprono ad arco e si possono toccare o trascinare
 * sul tavolo. `drag` dice cosa porta con sé ogni carta (null: non si trascina adesso).
 */
export function Hand({ cards, width, selected, playable, onPress, drag, onLift }: {
  cards: Card[];
  width: number;
  selected?: string | null;
  playable?: string[];
  onPress?: (card: Card) => void;
  drag?: (card: Card) => DragPayload | null;
  onLift?: (card: Card, lifted: boolean) => void;
}) {
  // Le carte si sovrappongono quanto basta per stare tutte nello schermo.
  const { width: screenW } = useWindowDimensions();
  const avail = Math.min(screenW, 1000) - 24;
  const n = cards.length;
  const overlap = n > 1 && n * (width + 8) > avail ? Math.max(-width * 0.7, (avail - n * width) / (n - 1)) : 8;
  // Alla prima comparsa le carte arrivano una dopo l'altra, come distribuite; poi solo quelle pescate.
  const dealt = useRef(false);
  useEffect(() => void (dealt.current = true), []);
  const mid = (cards.length - 1) / 2;
  const step = Math.min(5, 28 / Math.max(cards.length, 1));
  const arc = (k: number) => k * k * step * 0.25;
  return (
    <View style={[styles.hand, { minHeight: width * (cards[0] ? cardRatio(cards[0].deck) : CARD_RATIO) + 28, paddingBottom: 6 + arc(mid) }]}>
      {cards.map((c, i) => {
        const off = i - mid;
        const isPlayable = playable ? playable.includes(c.id) : true;
        return (
          <View key={c.id} style={{ marginLeft: i ? overlap : 0, transform: [{ translateY: arc(off) }, { rotate: `${off * step}deg` }] }}>
            <FlyIn from="above" delay={dealt.current ? 0 : i * 80} sound="deal">
              <Draggable
                payload={drag && isPlayable ? drag(c) : null}
                ghost={<CardGhost cards={[c]} width={width} />}
                onLift={onLift ? (l) => onLift(c, l) : undefined}
              >
                <PlayingCard card={c} width={width} selected={selected === c.id} dimmed={!isPlayable} onPress={onPress ? () => onPress(c) : undefined} />
              </Draggable>
            </FlyIn>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Posto tratteggiato sul tavolo dove va una carta (mazzo, scarti, la carta di un giocatore):
 * si vede anche vuoto, così il tavolo dice da solo dove si gioca. `glow` lo accende (turno, vincitore).
 */
export function Slot({ width, ratio = 1.8, label, glow, children, style }: { width: number; ratio?: number; label?: ReactNode; glow?: string; children?: ReactNode; style?: object }) {
  return (
    <View style={[{ alignItems: 'center', gap: 4 }, style]}>
      <View style={[styles.slot, { width, height: width * ratio, borderRadius: width * 0.1 }, glow ? { borderColor: glow, borderStyle: 'solid', backgroundColor: '#FFFFFF14' } : null]}>{children}</View>
      {label ? <View style={{ alignItems: 'center' }}>{typeof label === 'string' ? <T size={11} weight="800" color="#ffffffcc">{label}</T> : label}</View> : null}
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
    <Pulse active={tone === 'turn'} style={{ alignSelf: 'center' }}>
      <View style={[styles.banner, tone === 'turn' && { backgroundColor: colors.accent }]} accessibilityLiveRegion="polite">
        <T size={16} weight="800" color={tone === 'turn' ? colors.onAccent : colors.text} center>
          {tone === 'turn' ? '▶ ' : ''}
          {text}
        </T>
      </View>
    </Pulse>
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
  badge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingLeft: 6, paddingRight: 12, borderRadius: 18, borderWidth: 3, borderColor: colors.line, minWidth: 120, backgroundColor: colors.surface, boxShadow: `0px 4px 0px ${colors.line}` },
  opponents: { gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  hand: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 8, paddingTop: 16 },
  feltFrame: { flex: 1, margin: 8, borderRadius: 26, borderWidth: 3, borderColor: colors.line, overflow: 'hidden', backgroundColor: colors.felt, boxShadow: `0px 6px 0px ${colors.line}` },
  felt: { padding: 12, alignItems: 'center', justifyContent: 'center', gap: 12 },
  slot: { borderWidth: 2.5, borderStyle: 'dashed', borderColor: '#FFFFFF66', backgroundColor: '#00000022', alignItems: 'center', justifyContent: 'center' },
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
      <PopIn key={eventKey ?? ''}>
        <View style={styles.sticker}>
          <T size={30} weight="900" color="#FFFFFF" center>
            {shown}
          </T>
        </View>
      </PopIn>
    </View>
  );
}
