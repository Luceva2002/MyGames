import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { cancelAnimation, SlideOutDown, SlideOutUp, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from './settings';
import { sfx, type Sfx } from './sound';

/**
 * Piccole animazioni da videogioco per il tavolo: le carte arrivano "lanciate" da chi le gioca,
 * i cartelli saltano fuori con un rimbalzo, il proprio turno pulsa. Col movimento ridotto restano
 * solo dissolvenze brevi (P-MOTION-4).
 */

const SPRING = { damping: 13, stiffness: 170, mass: 0.8 };

/** La carta entra volando: da sotto se l'ho giocata io, da sopra se arriva da un avversario. */
export function FlyIn({ from = 'above', fromX = 0, delay = 0, leave, sound, children, style }: {
  from?: 'above' | 'below' | 'none';
  /** Spostamento orizzontale di partenza (es. dal mazzo a sinistra verso la mano). */
  fromX?: number;
  delay?: number;
  /** Quando sparisce vola via: verso il basso se la prendo io, verso l'alto se la prende un avversario. */
  leave?: 'up' | 'down';
  /** Suono quando la carta arriva (si posa sul tavolo, viene distribuita). */
  sound?: Sfx;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const dy = from === 'above' ? -140 : from === 'below' ? 160 : 0;
  const p = useSharedValue(0);
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = withDelay(delay, withTiming(1, { duration: reduced ? 180 : 120 }));
    p.value = reduced ? 1 : withDelay(delay, withSpring(1, SPRING));
    if (!sound) return;
    const t = setTimeout(() => sfx(sound), delay + 90);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const anim = useAnimatedStyle(() => {
    const k = 1 - p.value;
    return {
      opacity: o.value,
      transform: [{ translateX: fromX * k }, { translateY: dy * k }, { scale: 1 + 0.25 * k }, { rotate: `${(from === 'below' ? 10 : fromX ? -25 : -10) * k}deg` }],
    };
  });
  const exiting = !leave || reduced ? undefined : (leave === 'up' ? SlideOutUp : SlideOutDown).duration(320);
  return (
    <Animated.View style={[style, anim]} exiting={exiting}>
      {children}
    </Animated.View>
  );
}

/** Il cartello compare secco: un attimo di scala, senza rimbalzi né rotazioni (Luca: meno movimento). */
export function PopIn({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const s = useSharedValue(reduced ? 1 : 0.9);
  const o = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    s.value = withTiming(1, { duration: 140 });
    o.value = withTiming(1, { duration: 110 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const anim = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: s.value }] }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/**
 * Quando arriva il proprio turno il riquadro fa un piccolo scatto e poi resta fermo: il turno si
 * legge dal bordo colorato, senza pulsare di continuo.
 */
export function Pulse({ active, children, style }: { active: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (!active || reduced) {
      s.value = withTiming(1, { duration: 120 });
      return;
    }
    s.value = withSequence(withTiming(1.05, { duration: 90 }), withTiming(1, { duration: 140 }));
    return () => cancelAnimation(s);
  }, [active, reduced, s]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}
