import { useEffect, useMemo, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from './settings';
import { colors } from './theme';

const CONFETTI_COLORS = [colors.accent, colors.accent2, colors.accent3, '#FFFFFF', '#8B5CF6'];

/** Un coriandolo: cade ondeggiando e girando, poi ricomincia dall'alto. */
function Piece({ x, delay, duration, color, w, h, drift, height }: { x: number; delay: number; duration: number; color: string; w: number; h: number; drift: number; height: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.linear }), 2, false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const anim = useAnimatedStyle(() => ({
    opacity: t.value > 0 && t.value < 0.98 ? 1 : 0,
    transform: [
      { translateX: x + Math.sin(t.value * Math.PI * 4) * drift },
      { translateY: -30 + t.value * (height + 60) },
      { rotate: `${t.value * 900}deg` },
      { scaleX: Math.cos(t.value * Math.PI * 6) },
    ],
  }));
  return <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: w, height: h, borderRadius: 2, backgroundColor: color, borderWidth: 1, borderColor: colors.line }, anim]} />;
}

/** Pioggia di coriandoli per festeggiare: con il movimento ridotto non c'è. */
export function Confetti({ count = 60, onTop }: { count?: number; /** Sopra tutto (durante il cartello) o dietro al riepilogo. */ onTop?: boolean }) {
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: Math.random() * width,
        delay: Math.random() * 900 + (i % 3) * 120,
        duration: 2200 + Math.random() * 1600,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        w: 8 + Math.random() * 6,
        h: 12 + Math.random() * 8,
        drift: 10 + Math.random() * 24,
      })),
    [count, width],
  );
  if (reduced) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, overflow: 'hidden', zIndex: onTop ? 45 : 0 }}>
      {pieces.map((p, i) => (
        <Piece key={i} {...p} height={height} />
      ))}
    </View>
  );
}

/** Il cartello della vittoria: entra con un piccolo salto, poi respira piano finché resta a schermo. */
export function Bounce({ children, big }: { children: ReactNode; big?: boolean }) {
  const reduced = useReducedMotion();
  const s = useSharedValue(reduced ? 1 : 0.3);
  useEffect(() => {
    if (reduced) return;
    s.value = withSequence(withSpring(1, { damping: 7, stiffness: 160 }), withRepeat(withSequence(withTiming(big ? 1.06 : 1.02, { duration: 700 }), withTiming(1, { duration: 700 })), -1, false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={anim}>{children}</Animated.View>;
}
