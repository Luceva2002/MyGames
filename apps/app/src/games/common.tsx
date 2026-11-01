import { Children, createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import type { Card, Seat } from '@giochi/engine';
import { CARD_RATIO, CardBack, CardGhost, cardRatio, PlayingCard } from '../ui/cards';
import { Draggable, type DragPayload } from '../ui/drag';
import { Anchor, FlyIn, handAnchor, PopIn, Pulse } from '../ui/motion';
import { Row, T } from '../ui/kit';
import { SeatAvatar } from '../ui/avatars';
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

/** Lo spazio che resta a una griglia: si misura così sta sempre tutta, senza tagli né scorrimento. */
export function useFit() {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setBox((b) => (b.w === w && b.h === h ? b : { w, h }));
  };
  return { box, onLayout };
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
 * e, sotto, altre informazioni. Chi è di turno ha il nome colorato e la freccia.
 */
export function PlayerBadge({ seat, name, active, score, scoreLabel, isMe, children }: {
  seat: Seat;
  name: string;
  active: boolean;
  /** Il punteggio da mostrare in grande (punti, prese, carte rimaste…). */
  score?: number | string;
  scoreLabel?: string;
  isMe?: boolean;
  children?: ReactNode;
}) {
  // Il turno si vede dalla freccia, non solo dal colore (V-COL-1, V-ST-1).
  return (
    <Pulse active={active}>
      <View
        accessibilityLabel={`${isMe ? 'Tu' : name}${active ? ', è il suo turno' : ''}${score !== undefined ? `, ${score} ${scoreLabel ?? ''}` : ''}`}
        style={[styles.badge, isMe && { backgroundColor: colors.surface2 }]}
      >
        <SeatAvatar seat={seat} name={name} size={44} />
        <View style={{ gap: 1, flexShrink: 1 }}>
          <T size={13} weight="800" lines={1} color={active ? seatColor(seat) : colors.text}>
            {isMe ? 'Tu' : name}
            {active ? '  ▶' : ''}
          </T>
          {score !== undefined && (
            <Row gap={4} style={{ alignItems: 'baseline' }}>
              <T size={28} weight="800" color={colors.accent}>
                {score}
              </T>
              {scoreLabel ? (
                <T size={12} color={colors.muted}>
                  {scoreLabel}
                </T>
              ) : null}
            </Row>
          )}
          {children}
        </View>
      </View>
    </Pulse>
  );
}

export interface SeatInfo {
  seat: Seat;
  name: string;
  active: boolean;
  score?: number | string;
  scoreLabel?: string;
  /** Carte in mano: dall'altro lato del tavolo si vedono coperte. */
  cards?: number;
  deck?: 'it' | 'fr' | 'uno';
  /** Da dove arrivano le carte che pesca: il mazzo, o gli scarti se ha appena preso da lì. */
  drawFrom?: 'deck' | 'discard';
}

/**
 * Le carte coperte di un avversario, a ventaglio vicino al suo posto: quante ne ha in mano si vede
 * a colpo d'occhio. È anche il punto da cui partono le carte che gioca e dove arrivano quelle che pesca.
 */
export function OpponentHand({ seat, cards, deck = 'it', width, max = 10, drawFrom = 'deck' }: { seat: Seat; cards: number; deck?: 'it' | 'fr' | 'uno'; width: number; max?: number; /** Da dove arrivano le carte che pesca. */ drawFrom?: 'deck' | 'discard' }) {
  const n = Math.min(cards, max);
  // Le carte pescate dopo la prima comparsa arrivano dal mazzo, una dopo l'altra.
  const seen = useRef(-1);
  const before = seen.current;
  useEffect(() => void (seen.current = n), [n]);
  const overlap = -width * 0.62;
  return (
    <Anchor id={handAnchor(seat)} style={{ flexDirection: 'row', alignItems: 'center', minHeight: width * cardRatio(deck) }}>
      {Array.from({ length: n }, (_, i) => (
        <FlyIn key={i} from="none" fromAnchor={before >= 0 && i >= before ? drawFrom : undefined} delay={before >= 0 && i >= before ? (i - before) * 220 : 0} style={{ marginLeft: i ? overlap : 0 }}>
          <CardBack width={width} deck={deck} style={{ borderWidth: Math.max(1, width / 16), transform: [{ rotate: `${(i - (n - 1) / 2) * 3}deg` }] }} />
        </FlyIn>
      ))}
      {cards > n && (
        <T size={11} weight="800" color="#ffffffcc">
          {`  +${cards - n}`}
        </T>
      )}
    </Anchor>
  );
}

/** Un avversario seduto dall'altro lato del tavolo: icona, nome e punti in una pillola, sotto le sue carte coperte. */
export function TableSeat({ info, compact }: { info: SeatInfo; compact?: boolean }) {
  const { seat, name, active, score, scoreLabel, cards, deck = 'it', drawFrom } = info;
  const label = `${name}${score !== undefined ? `, ${score} ${scoreLabel ?? ''}` : ''}${cards !== undefined ? `, ${cards} carte` : ''}${active ? ', è il suo turno' : ''}`;
  const hand = cards !== undefined && cards > 0 ? <OpponentHand seat={seat} cards={cards} deck={deck} width={compact ? 18 : 30} max={compact ? 7 : 10} drawFrom={drawFrom} /> : null;
  if (compact) {
    // Sul telefono, con più avversari, stanno tutti su una riga: icona col punteggio, nome, carte in piccolo.
    return (
      <View style={{ flex: 1, maxWidth: 104, minWidth: 0, alignItems: 'center', gap: 4 }} accessibilityLabel={label}>
        <View style={[styles.seatPill, styles.seatPillCompact]}>
          <SeatAvatar seat={seat} name={name} size={24} />
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <T size={10} weight="800" lines={1} color={active ? seatColor(seat) : '#ffffffdd'}>
              {active ? `▶ ${name}` : name}
            </T>
            {score !== undefined && (
              <T size={13} weight="800" color={colors.text} lines={1}>
                {score}
              </T>
            )}
          </View>
        </View>
        {hand}
      </View>
    );
  }
  return (
    <View style={{ alignItems: 'flex-start', gap: 6 }} accessibilityLabel={label}>
      <View style={styles.seatPill}>
        <SeatAvatar seat={seat} name={name} size={30} />
        <View style={{ flexShrink: 1 }}>
          <T size={12} weight="800" lines={1} color={active ? seatColor(seat) : '#ffffffdd'}>
            {active ? `▶ ${name}` : name}
          </T>
          {score !== undefined && (
            <Row gap={4} style={{ alignItems: 'baseline' }}>
              <T size={16} weight="800" color={colors.text}>
                {score}
              </T>
              {scoreLabel ? (
                <T size={11} color="#ffffffaa" lines={1}>
                  {scoreLabel}
                </T>
              ) : null}
            </Row>
          )}
        </View>
      </View>
      {hand ? <View style={{ paddingLeft: 8 }}>{hand}</View> : null}
    </View>
  );
}

/**
 * Gli avversari in fila sul bordo lontano del tavolo. Sul telefono, se sono più d'uno, stanno su una
 * riga sola in formato compatto. A destra resta lo spazio per il bottone del menu.
 */
export function TableTop({ seats }: { seats: SeatInfo[] }) {
  const { width } = useWindowDimensions();
  if (!seats.length) return null;
  if (width < 600 && seats.length > 1) {
    return (
      <View style={{ flexDirection: 'row', gap: 6, alignSelf: 'stretch', paddingTop: 2, paddingRight: MENU_GAP }}>
        {seats.map((s) => (
          <TableSeat key={s.seat} info={s} compact />
        ))}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: 14, alignSelf: 'stretch', paddingTop: 2, paddingRight: MENU_GAP }}>
      {seats.map((s) => (
        <TableSeat key={s.seat} info={s} />
      ))}
    </View>
  );
}

/** Spazio lasciato a destra, in alto, per il bottone tondo del menu della partita. */
export const MENU_GAP = 64;

/**
 * Il mio posto: icona e punti in una pillola discreta, e quando tocca a me lo dice qui. Sul computer
 * sta nell'angolo in basso a destra; sul telefono in una riga sua, subito sopra la mano: il board lo
 * mette prima della mano.
 */
export function MyCorner({ info, note, style, wideOnly }: { info: SeatInfo | null; note?: string; style?: object; wideOnly?: boolean }) {
  const { width } = useWindowDimensions();
  if (!info || (wideOnly && width < 600)) return null;
  const narrow = width < 600;
  return (
    <View pointerEvents="none" style={[narrow ? { alignItems: 'center', gap: 4, zIndex: 20 } : { position: 'absolute', right: 8, bottom: 8, zIndex: 20, alignItems: 'flex-end', gap: 4 }, style]}>
      {note ? (
        <View style={styles.cornerNote}>
          <T size={11} weight="800" center>
            {note}
          </T>
        </View>
      ) : null}
      <Pulse active={info.active}>
        <View style={[styles.seatPill, narrow && { paddingRight: 10 }]} accessibilityLabel={`Tu${info.active ? ', tocca a te' : ''}, ${info.score ?? ''} ${info.scoreLabel ?? ''}`}>
          <SeatAvatar seat={info.seat} name={info.name} size={narrow ? 26 : 30} />
          <View>
            <T size={11} weight="800" color={info.active ? colors.accent : '#ffffffaa'}>
              {info.active ? '▶ Tocca a te' : 'Tu'}
            </T>
            {info.score !== undefined && (
              <Row gap={4} style={{ alignItems: 'baseline' }}>
                <T size={narrow ? 14 : 16} weight="800" color={colors.text}>
                  {info.score}
                </T>
                {info.scoreLabel && !narrow ? (
                  <T size={11} color="#ffffffaa">
                    {info.scoreLabel}
                  </T>
                ) : null}
              </Row>
            )}
          </View>
        </View>
      </Pulse>
    </View>
  );
}

/** Versione compatta del mio posto (icona e punti), per le colonne strette sul telefono. */
export function MyChip({ info }: { info: SeatInfo }) {
  return (
    <Pulse active={info.active}>
      <View style={styles.myChip} accessibilityLabel={`Tu${info.active ? ', tocca a te' : ''}, ${info.score ?? ''} ${info.scoreLabel ?? ''}`}>
        <SeatAvatar seat={info.seat} name={info.name} size={30} />
        <T size={15} weight="800" color={colors.text}>
          {info.score ?? ''}
        </T>
        {info.active && (
          <T size={9} weight="800" color={colors.accent}>
            ▶ Tu
          </T>
        )}
      </View>
    </Pulse>
  );
}

/** I posti visti da chi gioca: prima io (se gioco), poi gli altri nell'ordine del tavolo. */
export function seatsFrom(players: number, me: Seat | null): Seat[] {
  return me === null ? othersOf(players, me) : [me, ...othersOf(players, me)];
}

/**
 * La barra dei punteggi: tutti i giocatori col loro punteggio grande; in due c'è il "VS" in mezzo,
 * e sopra l'obiettivo della partita, così si capisce subito a quanto si sta e quanto manca.
 */
export function Opponents({ children, goal }: { children: ReactNode; goal?: string }) {
  const items = Children.toArray(children);
  const duel = items.length === 2;
  // Sul telefono i due posti riempiono la riga: il VS non ci sta senza uscire dal panno.
  const { width } = useWindowDimensions();
  return (
    <View style={{ alignItems: 'center', alignSelf: 'stretch' }}>
      {goal ? (
        <View style={styles.goal}>
          <T size={12} weight="800" color={colors.onAccent}>
            🏁 {goal}
          </T>
        </View>
      ) : null}
      <ScrollView horizontal contentContainerStyle={[styles.opponents, duel && { alignItems: 'center' }]} showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, maxWidth: '100%' }}>
        {duel ? (
          <>
            {items[0]}
            {width >= 430 && (
              <T size={18} weight="900" color={colors.accent2}>
                VS
              </T>
            )}
            {items[1]}
          </>
        ) : (
          items
        )}
      </ScrollView>
    </View>
  );
}

/**
 * La mano a ventaglio, alla Balatro: le carte si aprono ad arco e si possono toccare o trascinare
 * sul tavolo. `drag` dice cosa porta con sé ogni carta (null: non si trascina adesso).
 */
export function Hand({ cards, width: baseWidth, selected, playable, onPress, drag, onLift }: {
  cards: Card[];
  width: number;
  selected?: string | null;
  playable?: string[];
  onPress?: (card: Card) => void;
  drag?: (card: Card) => DragPayload | null;
  onLift?: (card: Card, lifted: boolean) => void;
}) {
  // Le carte si sovrappongono quanto basta per stare tutte nel panno (bordo del tavolo escluso).
  const { width: screenW } = useWindowDimensions();
  const narrow = screenW < 600;
  const avail = Math.min(screenW, 1000) - (narrow ? 60 : 24);
  // Sul telefono le carte restano grandi abbastanza da leggerle: se sono tante si sovrappongono di più.
  const width = narrow ? Math.max(baseWidth, 54) : baseWidth;
  const n = cards.length;
  const overlap = n > 1 && n * (width + 8) > avail ? Math.max(-width * 0.7, (avail - n * width) / (n - 1)) : 8;
  // Alla prima comparsa le carte arrivano una dopo l'altra, come distribuite; poi solo quelle
  // pescate, dal mazzo se sul tavolo c'è.
  const dealt = useRef(false);
  useEffect(() => void (dealt.current = true), []);
  const seen = useRef(new Set<string>());
  const fresh = cards.filter((c) => !seen.current.has(c.id)).map((c) => c.id);
  useEffect(() => void (seen.current = new Set(cards.map((c) => c.id))));
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
            <FlyIn from="below" fromAnchor="deck" delay={dealt.current ? Math.max(0, fresh.indexOf(c.id)) * 180 : 150 + i * 70} sound="deal">
              <Draggable
                payload={drag && isPlayable ? drag(c) : null}
                ghost={<CardGhost cards={[c]} width={width} />}
                onLift={onLift ? (l) => onLift(c, l) : undefined}
              >
                <PlayingCard card={c} width={width} selected={selected === c.id} dimmed={!isPlayable} onPress={onPress ? () => onPress(c) : undefined} zoomable />
              </Draggable>
            </FlyIn>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Posto sul tavolo dove va una carta o il mazzo (mazzo, scarti, la carta di un giocatore):
 * si vede anche vuoto, così il tavolo dice da solo dove si gioca. `glow` lo accende (turno, vincitore).
 */
export function Slot({ width, ratio = 1.6, label, glow, children, style }: { width: number; ratio?: number; label?: ReactNode; glow?: string; children?: ReactNode; style?: object }) {
  return (
    <View style={[{ alignItems: 'center', gap: 5 }, style]}>
      <View
        style={[
          styles.slot,
          { width, height: width * ratio, borderRadius: Math.max(8, width * 0.1) },
          glow ? { borderColor: `${glow}AA`, borderStyle: 'solid', borderWidth: 2, backgroundColor: `${glow}14` } : null,
        ]}
      >
        {children}
      </View>
      {label ? (
        <View style={{ alignItems: 'center' }}>
          {typeof label === 'string' ? (
            <View style={[styles.slotBadge, glow ? { backgroundColor: glow } : null]}>
              <T size={11} weight="900" color={glow ? colors.onAccent : '#ffffffee'}>
                {label}
              </T>
            </View>
          ) : (
            label
          )}
        </View>
      ) : null}
    </View>
  );
}

/**
 * La carta in cima agli scarti: se l'ha appena scartata un avversario, viaggia dalla sua mano
 * coperta; se torna in cima una carta già vista (qualcuno ha preso quella sopra) resta ferma.
 */
export function PileTop({ id, from, me, children }: { id: string | null; /** Chi l'ha appena scartata. */ from: Seat | null; me: Seat | null; children: ReactNode }) {
  const seen = useRef(new Set(id ? [id] : []));
  const fresh = id !== null && !seen.current.has(id);
  useEffect(() => void (id && seen.current.add(id)), [id]);
  return (
    <FlyIn key={id ?? '-'} from={fresh && from === me ? 'below' : 'none'} fromAnchor={fresh && from !== null && from !== me ? handAnchor(from) : undefined} sound={fresh ? 'card' : undefined}>
      {children}
    </FlyIn>
  );
}

/** Il panno del tavolo con la cornice di legno. */
export function Felt({ children, style }: { children: ReactNode; style?: object }) {
  return (
    // Il tavolo vero è sotto tutta la partita (TableBg nella radice del gioco): qui c'è solo il panno.
    <View style={[styles.feltFrame, styles.felt, style]}>{children}</View>
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

/** Due persone sullo stesso schermo: la scacchiera non ruota e nessuno è «tu». */
export const SharedScreenContext = createContext(false);
export const useSharedScreen = () => useContext(SharedScreenContext);

export function turnText(myTurn: boolean, names: string[], turn: Seat, me: Seat | null) {
  if (myTurn) return 'Tocca a te';
  if (turn === me) return 'Aspetta…';
  return `Tocca a ${names[turn]}`;
}

const styles = StyleSheet.create({
  stickerWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  sticker: { backgroundColor: colors.accent2, borderWidth: 3, borderColor: colors.line, borderRadius: 18, paddingHorizontal: 22, paddingVertical: 10, transform: [{ rotate: '-3deg' }], boxShadow: `0px 6px 0px ${colors.line}` },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingLeft: 6, paddingRight: 12, borderRadius: 18, borderWidth: 3, borderColor: colors.line, minWidth: 120, backgroundColor: colors.surface, boxShadow: `0px 4px 0px ${colors.line}` },
  opponents: { gap: 8, paddingHorizontal: 8, paddingVertical: 8, flexGrow: 1, justifyContent: 'center' },
  // La mano sale un po' sul bordo del tavolo, come le carte tenute in mano sopra il panno.
  hand: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 8, paddingTop: 16, zIndex: 5 },
  feltFrame: { flex: 1, marginHorizontal: 4 },
  felt: { alignItems: 'center', justifyContent: 'flex-start', gap: 10, padding: 8 },
  // I posti al tavolo: pillole scure e trasparenti come la striscia delle mosse, senza bordi.
  seatPill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 3, paddingLeft: 3, paddingRight: 14, borderRadius: 999, backgroundColor: 'rgba(18,5,43,0.55)' },
  seatPillCompact: { gap: 4, paddingRight: 8, alignSelf: 'stretch' },
  cornerNote: { maxWidth: 220, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#12052BCC' },
  myChip: { alignItems: 'center', gap: 2, padding: 4, borderRadius: 14, backgroundColor: 'rgba(18,5,43,0.55)' },
  goal: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 3, borderWidth: 2, borderColor: colors.line, marginTop: 4 },
  slot: { borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(0,0,0,0.22)', alignItems: 'center', justifyContent: 'center' },
  slotBadge: { paddingHorizontal: 7, paddingVertical: 1.5, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  banner: { alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.surface2, marginVertical: 6, borderWidth: 3, borderColor: colors.line, boxShadow: `0px 4px 0px ${colors.line}` },
});

/**
 * Adesivo magenta inclinato al centro per gli eventi ("+1 scopa!", "Settebello"), visibile 1 s (SPEC §9).
 * `eventKey` cambia a ogni nuovo evento; null non mostra niente.
 */
export function EventSticker({ text, eventKey, high }: { text: string | null; eventKey: string | null; /** In alto, per non coprire la griglia dove è appena successo. */ high?: boolean }) {
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    if (!text || !eventKey) return;
    setShown(text);
    const t = setTimeout(() => setShown(null), 1000);
    return () => clearTimeout(t);
  }, [eventKey]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!shown) return null;
  return (
    <View pointerEvents="none" accessibilityLiveRegion="polite" style={[styles.stickerWrap, high && { justifyContent: 'flex-start', paddingTop: 64 }]}>
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
