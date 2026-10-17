import { memo, useEffect } from 'react';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { CARD_BACKS, CARD_FACES } from './deckArt';
import Svg, { Path } from 'react-native-svg';
import { cardName, type Card } from '@giochi/engine';
import { focusRing, tap } from './kit';
import { useReducedMotion } from './settings';
import { colors, font } from './theme';

const IT_LABEL: Record<number, string> = { 8: 'F', 9: 'C', 10: 'R' };

/** Proporzioni reali dei mazzi: piacentine più strette, francesi più larghe. */
export function cardRatio(deck: Card['deck']): number {
  return deck === 'it' ? 1.8 : deck === 'fr' ? 1.45 : 1.55;
}

/**
 * Carte piacentine: le piacentine non hanno indici agli angoli, quindi aggiungiamo un piccolo
 * cartellino col valore per leggerle anche quando sono piccole o sovrapposte (V-ST-1).
 */
function ItalianFace({ card, w, h }: { card: Card; w: number; h: number }) {
  return <Image source={CARD_FACES[`it-${card.suit}${card.rank}`]} style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }} resizeMode="stretch" />;
}

/** Bollino magenta col valore, che esce dal bordo in alto a sinistra senza coprire i semi (spec §4). */
function ValueBadge({ card, w }: { card: Card; w: number }) {
  const d = Math.max(20, w * 0.36);
  const label = IT_LABEL[card.rank] ?? String(card.rank);
  return (
    <View pointerEvents="none" style={[styles.valueBadge, { width: d, height: d, borderRadius: d / 2, left: -d * 0.32, top: -d * 0.32 }]}>
      <Text style={{ color: '#fff', fontFamily: font.display, fontSize: d * 0.56, lineHeight: d * 0.7 }}>{label}</Text>
    </View>
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

function FrenchFace({ card, w, h }: { card: Card; w: number; h: number }) {
  const key = card.suit === 'j' ? `fr-j${Number(card.id.slice(-1)) % 2}` : `fr-${card.suit}${card.rank}`;
  return <Image source={CARD_FACES[key]} style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }} resizeMode="stretch" />;
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

export const PlayingCard = memo(function PlayingCard({ card, width, selected, dimmed, onPress, style, chosenColor, sway }: {
  card: Card;
  width: number;
  selected?: boolean;
  dimmed?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  chosenColor?: string;
  /** Dondola a riposo: di default le carte sul tavolo (non toccabili) dondolano, quelle in mano no. */
  sway?: boolean;
}) {
  const reduced = useReducedMotion();
  const height = width * cardRatio(card.deck);
  const radius = width * 0.1;
  const face = (
    <Sway id={card.id} enabled={(sway ?? !onPress) && !reduced}>
      <View style={[{ width, height }, dimmed && { opacity: 0.45 }, style]}>
        <View
          accessibilityLabel={cardName(card)}
          style={[
            styles.card,
            { width, height, borderRadius: radius },
            card.deck === 'uno' && { backgroundColor: 'transparent' },
            selected && styles.selected,
          ]}
        >
          {card.deck === 'it' && <ItalianFace card={card} w={width} h={height} />}
          {card.deck === 'fr' && <FrenchFace card={card} w={width} h={height} />}
          {card.deck === 'uno' && <UnoFace card={card} w={width} h={height} chosenColor={chosenColor} />}
        </View>
        {card.deck === 'it' && <ValueBadge card={card} w={width} />}
      </View>
    </Sway>
  );
  if (!onPress) return face;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={cardName(card)}
      accessibilityState={{ selected: !!selected, disabled: !!dimmed }}
      onPress={() => {
        tap();
        onPress();
      }}
      // Carta scelta: si alza del 14% (spec §4); premuta scende appena (feedback < 100 ms, V-FB-1).
      style={(state) => [{ transform: [{ translateY: selected ? -height * 0.14 : state.pressed ? 3 : 0 }], borderRadius: radius }, focusRing((state as { focused?: boolean }).focused ?? false)]}
    >
      {face}
    </Pressable>
  );
});

export function CardBack({ width, style, deck = 'it' }: { width: number; style?: StyleProp<ViewStyle>; deck?: 'it' | 'fr' | 'uno' }) {
  const height = width * cardRatio(deck);
  return (
    <View accessibilityLabel="Carta coperta" style={[styles.card, { width, height, borderRadius: width * 0.1, borderWidth: Math.max(1, Math.min(3, width / 14)) }, width < 30 && { boxShadow: 'none' }, style]}>
      <Image source={CARD_BACKS[deck]} style={{ position: 'absolute', left: 0, top: 0, width, height }} resizeMode="cover" />
    </View>
  );
}

/** Piccolo mazzo coperto con il numero di carte. */
export function DeckPile({ count, width, deck = 'it' }: { count: number; width: number; deck?: 'it' | 'fr' | 'uno' }) {
  if (count <= 0) return <View style={{ width, height: width * cardRatio(deck) }} />;
  return (
    <View>
      {count > 1 && <CardBack width={width} deck={deck} style={{ position: 'absolute', left: 3, top: 3 }} />}
      <CardBack width={width} deck={deck} />
      <View style={styles.badge}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{count}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Cornice alla Balatro: crema, contorno spesso, ombra piena più una morbida (spec §4).
  card: {
    backgroundColor: '#FFFDF6',
    borderWidth: 3,
    borderColor: colors.line,
    overflow: 'hidden',
    boxShadow: `0px 5px 0px ${colors.line}, 0px 8px 14px rgba(0,0,0,0.35)`,
  },
  selected: { borderColor: colors.accent, borderWidth: 4 },
  valueBadge: { position: 'absolute', backgroundColor: colors.accent2, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', fontWeight: '900', color: '#2B2D42' },
  figure: { backgroundColor: '#F7EBD0', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#D9C08A' },
  badge: { position: 'absolute', right: -6, bottom: -6, backgroundColor: '#000a', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
});
