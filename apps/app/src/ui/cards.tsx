import { createContext, memo, useContext, useState, type ReactNode } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { CARD_BACKS, CARD_FACES } from './deckArt';
import { BigIndex, CardCorners, NumeralFace } from './suits';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { cardName, type Card } from '@giochi/engine';
import { tapAllowed } from './drag';
import { focusRing, tap } from './kit';
import { colors, font } from './theme';

/** Proporzioni reali dei mazzi: piacentine più strette, francesi più larghe. */
export function cardRatio(deck: Card['deck']): number {
  return deck === 'it' ? 1.8 : deck === 'fr' ? 1.45 : 1.55;
}

/** Figura coi personaggi: l'immagine riempie la carta, bollino e seme li aggiunge CardCorners. */
function FigureFace({ card, w, h }: { card: Card; w: number; h: number }) {
  const key = card.suit === 'j' ? `fr-j${Number(card.id.slice(-1)) % 2}` : `${card.deck}-${card.suit}${card.rank}`;
  return (
    <>
      {/* Il personaggio sta un po' più al centro, così gli indici negli angoli restano liberi. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FDFAE8' }]} />
      <Image source={CARD_FACES[key]} style={{ position: 'absolute', left: w * 0.07, top: h * 0.07, width: w * 0.86, height: h * 0.86 }} resizeMode="stretch" />
      <CardCorners card={card} w={w} />
    </>
  );
}

/** I quattro colori di UNO nella palette di Tavolata (carta nera per i jolly). */
export const UNO_COLORS: Record<string, string> = { r: '#FF4D6D', g: '#2FCB7A', b: '#3D8BFF', y: '#FFD23F', w: '#2A1650' };
const UNO_INK = colors.line;
const UNO_CREAM = '#FDFAE8';

/** Simbolo d'azione disegnato in un quadrato 100×100, col tratto nero spesso delle altre carte. */
function UnoAction({ rank, fill }: { rank: number; fill: string }) {
  if (rank === 10)
    // Salta: cerchio sbarrato.
    return (
      <G>
        <Circle cx={50} cy={50} r={30} fill="none" stroke={UNO_INK} strokeWidth={22} />
        <Circle cx={50} cy={50} r={30} fill="none" stroke={fill} strokeWidth={12} />
        <Path d="M29 71 L71 29" stroke={UNO_INK} strokeWidth={22} strokeLinecap="round" />
        <Path d="M29 71 L71 29" stroke={fill} strokeWidth={12} strokeLinecap="round" />
      </G>
    );
  if (rank === 11) {
    // Cambio giro: due frecce che si inseguono.
    const arrow = 'M22 44 C22 26 40 18 58 22 L56 10 L82 28 L54 42 L56 32 C44 30 34 34 34 46 Z';
    return (
      <G stroke={UNO_INK} strokeWidth={6} strokeLinejoin="round" fill={fill}>
        <Path d={arrow} />
        <Path d={arrow} transform="rotate(180 50 50)" />
      </G>
    );
  }
  return null;
}

/**
 * Carte di UNO nello stile di Tavolata: corpo colorato col contorno nero spesso, cucitura crema,
 * rombo da Arlecchino al centro col valore (o il simbolo d'azione), indice in alto a sinistra.
 * I jolly sono neri col rombo diviso nei quattro colori.
 */
function UnoFace({ card, w, h, chosenColor }: { card: Card; w: number; h: number; chosenColor?: string }) {
  const wild = card.suit === 'w';
  const fill = UNO_COLORS[card.suit];
  const sw = Math.max(1.5, w * 0.035);
  const r = w * 0.1;
  const cx = w / 2;
  const cy = h / 2;
  const dw = w * 0.36;
  const dh = h * 0.36;
  const lozenge = `M${cx} ${cy - dh} L${cx + dw} ${cy} L${cx} ${cy + dh} L${cx - dw} ${cy} Z`;
  const label = card.rank === 12 ? '+2' : card.rank === 14 ? '+4' : card.rank <= 9 ? String(card.rank) : '';
  const corner = card.rank === 10 ? 'Ø' : card.rank === 11 ? '⇄' : card.rank === 13 ? '★' : label;
  const fs = w * (label.length > 1 ? 0.3 : 0.42);
  const icon = w * 0.42;
  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius: r, overflow: 'hidden' }]}>
      <Svg width={w} height={h}>
        <Rect x={sw / 2} y={sw / 2} width={w - sw} height={h - sw} rx={r} fill={fill} stroke={UNO_INK} strokeWidth={sw} />
        <Rect x={w * 0.08} y={w * 0.08} width={w * 0.84} height={h - w * 0.16} rx={r * 0.7} fill="none" stroke={UNO_CREAM} strokeWidth={sw * 0.45} strokeDasharray={`${w * 0.04} ${w * 0.03}`} opacity={0.85} />
        {wild ? (
          <G stroke={UNO_INK} strokeWidth={sw} strokeLinejoin="round">
            <Path d={`M${cx} ${cy - dh} L${cx + dw} ${cy} L${cx} ${cy} Z`} fill={UNO_COLORS.r} />
            <Path d={`M${cx + dw} ${cy} L${cx} ${cy + dh} L${cx} ${cy} Z`} fill={UNO_COLORS.b} />
            <Path d={`M${cx} ${cy + dh} L${cx - dw} ${cy} L${cx} ${cy} Z`} fill={UNO_COLORS.y} />
            <Path d={`M${cx - dw} ${cy} L${cx} ${cy - dh} L${cx} ${cy} Z`} fill={UNO_COLORS.g} />
          </G>
        ) : (
          <Path d={lozenge} fill={UNO_CREAM} stroke={UNO_INK} strokeWidth={sw} strokeLinejoin="round" />
        )}
        {card.rank === 10 || card.rank === 11 ? (
          <G transform={`translate(${cx - icon / 2} ${cy - icon / 2}) scale(${icon / 100})`}>
            <UnoAction rank={card.rank} fill={fill} />
          </G>
        ) : label ? (
          <G>
            {/* Prima il contorno nero, poi il riempimento sopra: il numero resta pieno e ben delineato. */}
            <SvgText x={cx} y={cy + fs * 0.36} fontSize={fs} fontFamily={font.display} textAnchor="middle" fill={UNO_INK} stroke={UNO_INK} strokeWidth={sw * 1.6} strokeLinejoin="round">
              {label}
            </SvgText>
            <SvgText x={cx} y={cy + fs * 0.36} fontSize={fs} fontFamily={font.display} textAnchor="middle" fill={wild ? '#fff' : fill}>
              {label}
            </SvgText>
          </G>
        ) : null}
        <SvgText x={w * 0.13} y={w * 0.3} fontSize={w * 0.2} fontFamily={font.display} fill={UNO_INK} stroke={UNO_INK} strokeWidth={sw * 1.1} strokeLinejoin="round">
          {corner}
        </SvgText>
        <SvgText x={w * 0.13} y={w * 0.3} fontSize={w * 0.2} fontFamily={font.display} fill={UNO_CREAM}>
          {corner}
        </SvgText>
      </Svg>
      {chosenColor && (
        <View style={{ position: 'absolute', bottom: h * 0.06, alignSelf: 'center', width: w * 0.26, height: w * 0.26, borderRadius: w, backgroundColor: UNO_COLORS[chosenColor], borderWidth: 2, borderColor: UNO_INK }} />
      )}
    </View>
  );
}

export const CARD_RATIO = 1.55;

/** Chi mostra una carta in grande: la fornisce CardZoomLayer, attorno a ogni partita. */
const CardZoom = createContext<((card: Card) => void) | null>(null);
/** Dentro un elemento che si tocca già (una combinazione a cui attaccare carte) il tocco resta suo. */
export const NoCardZoom = createContext(false);

/**
 * Lente per le carte: toccando una carta della mano (o tenendola premuta quando il tocco la gioca)
 * appare grande al centro, per leggerla bene anche su uno schermo piccolo. Un tocco la chiude.
 */
export function CardZoomLayer({ children }: { children: ReactNode }) {
  const [card, setCard] = useState<Card | null>(null);
  const { width, height } = useWindowDimensions();
  const w = card ? Math.min(width * 0.62, (height * 0.6) / cardRatio(card.deck), 320) : 0;
  return (
    <CardZoom.Provider value={setCard}>
      {children}
      <Modal visible={!!card} transparent animationType="fade" onRequestClose={() => setCard(null)}>
        <Pressable style={styles.zoomScrim} onPress={() => setCard(null)} accessibilityLabel="Chiudi la carta">
          {card && (
            <>
              <PlayingCard card={card} width={w} zoomable={false} />
              <Text style={styles.zoomLabel}>{cardName(card)}</Text>
            </>
          )}
        </Pressable>
      </Modal>
    </CardZoom.Provider>
  );
}

export const PlayingCard = memo(function PlayingCard({ card, width, selected, dimmed, onPress, style, chosenColor, zoomable, compact }: {
  card: Card;
  /** Carta stretta e sovrapposta: valore e seme grandi in alto, leggibili anche dalla sola cima. */
  compact?: boolean;
  /**
   * Si può ingrandire: col tocco se il tocco non fa altro, altrimenti tenendola premuta. Di default
   * sì, per ogni carta scoperta di una partita (mano, tavolo, scarti, prese).
   */
  zoomable?: boolean;
  width: number;
  selected?: boolean;
  dimmed?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  chosenColor?: string;
}) {
  const zoomCtx = useContext(CardZoom);
  const blocked = useContext(NoCardZoom);
  // Tocco per ingrandire solo se il tocco non serve ad altro; tenendo premuto si ingrandisce sempre.
  const zoom = (zoomable ?? !blocked) && zoomCtx ? () => zoomCtx(card) : undefined;
  const zoomHold = zoomable !== false && zoomCtx ? () => zoomCtx(card) : undefined;
  const height = width * cardRatio(card.deck);
  const radius = width * 0.1;
  // Numerali disegnati in codice; figure e Jolly sono immagini coi personaggi.
  const numeral = (card.deck === 'it' && card.rank <= 7) || (card.deck === 'fr' && card.suit !== 'j' && card.rank <= 10);
  const face = (
    <View style={[{ width, height }, dimmed && { opacity: 0.62 }, style]}>
      <View
        accessibilityLabel={cardName(card)}
        style={[
          styles.card,
          { width, height, borderRadius: radius },
          card.deck === 'uno' && { backgroundColor: 'transparent' },
          selected && styles.selected,
        ]}
      >
        {numeral && <NumeralFace card={card} w={width} h={height} />}
        {!numeral && card.deck !== 'uno' && <FigureFace card={card} w={width} h={height} />}
        {card.deck === 'uno' && <UnoFace card={card} w={width} h={height} chosenColor={chosenColor} />}
        {compact && card.deck !== 'uno' && card.suit !== 'j' && <BigIndex card={card} w={width} />}
      </View>
    </View>
  );
  if (!onPress && zoom) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${cardName(card)}, tocca per ingrandire`}
        onPress={() => {
          if (!tapAllowed()) return;
          zoom();
        }}
      >
        {face}
      </Pressable>
    );
  }
  if (!onPress) return face;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={cardName(card)}
      accessibilityState={{ selected: !!selected, disabled: !!dimmed }}
      onPress={() => {
        if (!tapAllowed()) return;
        tap();
        onPress();
      }}
      onLongPress={zoomHold}
      delayLongPress={380}
      // Carta scelta: si alza del 14% (spec §4); premuta scende appena (feedback < 100 ms, V-FB-1);
      // col mouse sopra si solleva un poco, come in mano a un giocatore.
      style={(state) => {
        const hovered = (state as { hovered?: boolean }).hovered && !dimmed;
        const dy = selected ? -height * 0.14 : state.pressed ? 3 : hovered ? -height * 0.06 : 0;
        return [{ transform: [{ translateY: dy }], borderRadius: radius, transitionDuration: '120ms', transitionProperty: 'transform' } as ViewStyle, focusRing((state as { focused?: boolean }).focused ?? false)];
      }}
    >
      {face}
    </Pressable>
  );
});

/** Ciò che segue il dito quando si trascinano una o più carte: un piccolo ventaglio. */
export function CardGhost({ cards, width }: { cards: Card[]; width: number }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {cards.map((c, i) => (
        <View key={c.id} style={{ marginLeft: i ? -width * 0.6 : 0, transform: [{ rotate: `${(i - (cards.length - 1) / 2) * 5}deg` }] }}>
          <PlayingCard card={c} width={width} zoomable={false} />
        </View>
      ))}
    </View>
  );
}

export function CardBack({ width, style, deck = 'it' }: { width: number; style?: StyleProp<ViewStyle>; deck?: 'it' | 'fr' | 'uno' }) {
  const height = width * cardRatio(deck);
  return (
    <View accessibilityLabel="Carta coperta" style={[styles.card, { width, height, borderRadius: width * 0.1, borderWidth: Math.max(1, Math.min(3, width / 14)) }, width < 30 && { boxShadow: 'none' }, style]}>
      <Image source={CARD_BACKS[deck]} style={{ position: 'absolute', left: 0, top: 0, width, height }} resizeMode="cover" />
    </View>
  );
}

/** Mazzo coperto con effetto spessore 3D a strati e contatore carte ben visibile. */
export function DeckPile({ count, width, deck = 'it' }: { count: number; width: number; deck?: 'it' | 'fr' | 'uno' }) {
  if (count <= 0) return <View style={{ width, height: width * cardRatio(deck) }} />;
  // Lo spessore del mazzo si vede: più carte, più strati sotto.
  const layers = Math.min(4, Math.ceil(count / 10));
  return (
    <View style={{ paddingRight: layers * 2, paddingBottom: layers * 2 }}>
      {Array.from({ length: layers }, (_, i) => (
        <CardBack key={i} width={width} deck={deck} style={{ position: 'absolute', left: (layers - i) * 2, top: (layers - i) * 2 }} />
      ))}
      <CardBack width={width} deck={deck} />
      <View style={styles.badge}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{count}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  zoomScrim: { flex: 1, backgroundColor: 'rgba(10,3,25,0.82)', alignItems: 'center', justifyContent: 'center', gap: 16 },
  zoomLabel: { color: '#fff', fontSize: 20, fontWeight: '900' },
  // Cornice alla Balatro: crema, contorno spesso, ombra piena più una morbida (spec §4).
  card: {
    backgroundColor: '#FFFDF6',
    borderWidth: 3,
    borderColor: colors.line,
    overflow: 'hidden',
    boxShadow: `0px 5px 0px ${colors.line}, 0px 8px 14px rgba(0,0,0,0.35)`,
  },
  // La carta scelta o prendibile: solo il contorno cambia colore, senza ingrossarsi.
  selected: { borderColor: colors.accent },
  center: { alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', fontWeight: '900', color: '#2B2D42' },
  figure: { backgroundColor: '#F7EBD0', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#D9C08A' },
  badge: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    backgroundColor: '#1E0942',
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 1,
    boxShadow: `0px 3px 0px ${colors.line}`,
    zIndex: 10,
  },
  badgeText: {
    color: colors.accent,
    fontWeight: '900',
    fontSize: 12,
    textAlign: 'center',
  },
});
