import { createContext, memo, useContext, useEffect, useState, type ReactNode } from 'react';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Image, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { CARD_BACKS, CARD_FACES } from './deckArt';
import { BigIndex, CardCorners, NumeralFace } from './suits';
import Svg, { Path } from 'react-native-svg';
import { cardName, type Card } from '@giochi/engine';
import { tapAllowed } from './drag';
import { focusRing, tap } from './kit';
import { useReducedMotion } from './settings';
import { colors } from './theme';

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

/** Dondolio leggero delle carte a riposo sul tavolo (±1.2°, 3 s), spento con il movimento ridotto. */
function Sway({ id, enabled, children }: { id: string; enabled: boolean; children: React.ReactNode }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!enabled) {
      t.value = 0;
      return;
    }
    let h = 0;
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 1000;
    t.value = withDelay((h % 30) * 100, withRepeat(withSequence(withTiming(1, { duration: 1500 }), withTiming(-1, { duration: 1500 })), -1, true));
    return () => cancelAnimation(t);
  }, [enabled, id, t]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${t.value * 1.2}deg` }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export const UNO_COLORS: Record<string, string> = { r: '#E53935', g: '#43A047', b: '#1E88E5', y: '#FDD835', w: '#222222' };
const UNO_LABEL: Record<number, string> = { 10: '⊘', 11: '⇄', 12: '+2', 13: '', 14: '+4' };

function UnoFace({ card, w, h, chosenColor }: { card: Card; w: number; h: number; chosenColor?: string }) {
  const bg = UNO_COLORS[card.suit];
  const label = UNO_LABEL[card.rank] ?? String(card.rank);
  const wild = card.suit === 'w';
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: bg, borderRadius: w * 0.1, borderWidth: w * 0.05, borderColor: '#fff' }]}>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <View style={{ width: w * 0.78, height: h * 0.62, borderRadius: w, backgroundColor: '#fff', transform: [{ rotate: '-30deg' }], alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {wild ? (
            <Svg width={w * 0.6} height={w * 0.6} viewBox="0 0 100 100" style={{ transform: [{ rotate: '30deg' }] }}>
              <Path d="M50 50 L50 0 A50 50 0 0 1 100 50 Z" fill={UNO_COLORS.r} />
              <Path d="M50 50 L100 50 A50 50 0 0 1 50 100 Z" fill={UNO_COLORS.b} />
              <Path d="M50 50 L50 100 A50 50 0 0 1 0 50 Z" fill={UNO_COLORS.y} />
              <Path d="M50 50 L0 50 A50 50 0 0 1 50 0 Z" fill={UNO_COLORS.g} />
            </Svg>
          ) : null}
        </View>
      </View>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={{ fontSize: w * (label.length > 1 ? 0.36 : 0.48), fontWeight: '900', color: wild ? '#fff' : bg, textShadowColor: '#000', textShadowRadius: wild ? 4 : 1 }}>{label}</Text>
      </View>
      {chosenColor && (
        <View style={{ position: 'absolute', bottom: h * 0.05, alignSelf: 'center', width: w * 0.3, height: w * 0.3, borderRadius: w, backgroundColor: UNO_COLORS[chosenColor], borderWidth: 2, borderColor: '#fff' }} />
      )}
      <Text style={{ position: 'absolute', left: w * 0.1, top: h * 0.04, color: '#fff', fontWeight: '900', fontSize: w * 0.18 }}>{label}</Text>
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
              <PlayingCard card={card} width={w} sway={false} zoomable={false} />
              <Text style={styles.zoomLabel}>{cardName(card)}</Text>
            </>
          )}
        </Pressable>
      </Modal>
    </CardZoom.Provider>
  );
}

export const PlayingCard = memo(function PlayingCard({ card, width, selected, dimmed, onPress, style, chosenColor, sway, zoomable, compact }: {
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
  /** Dondola a riposo: solo se chiesto (di default le carte stanno ferme, meno movimento sul tavolo). */
  sway?: boolean;
}) {
  const reduced = useReducedMotion();
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
    <Sway id={card.id} enabled={(sway ?? false) && !reduced}>
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
    </Sway>
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
          <PlayingCard card={c} width={width} sway={false} zoomable={false} />
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
  selected: { borderColor: colors.accent, borderWidth: 4 },
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
