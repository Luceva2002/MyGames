import { createContext, useContext, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, SlideOutDown, SlideOutUp, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from './settings';
import { sfx, type Sfx } from './sound';

/**
 * Le animazioni del tavolo, solo quelle che servono a seguire il gioco: la carta che viaggia da chi
 * la gioca al tavolo, la presa raccolta, la distribuzione e il cambio di turno. Niente rimbalzi,
 * bagliori o movimenti in loop (Luca: semplice e pulito). Col movimento ridotto restano solo
 * dissolvenze brevi (P-MOTION-4).
 */

/** Quanto ci mette una carta a viaggiare da un punto all'altro del tavolo: si segue con l'occhio. */
export const TRAVEL_MS = 600;
/** Un attimo di sosta sul punto di partenza, prima del viaggio. */
export const HOLD_MS = 150;
const TRAVEL_EASING = Easing.inOut(Easing.cubic);

/**
 * Punti del tavolo da cui partono e arrivano le carte: la mano coperta di ogni avversario
 * (`hand-<posto>`), il mazzo (`deck`). Li registra <Anchor>, li usa <FlyIn fromAnchor>.
 */
const Anchors = createContext<Map<string, RefObject<View | null>> | null>(null);

export function AnchorProvider({ children }: { children: ReactNode }) {
  const map = useRef(new Map<string, RefObject<View | null>>()).current;
  return <Anchors.Provider value={map}>{children}</Anchors.Provider>;
}

export const handAnchor = (seat: number) => `hand-${seat}`;

export function Anchor({ id, children, style }: { id: string; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const map = useContext(Anchors);
  const ref = useRef<View>(null);
  useEffect(() => {
    if (!map) return;
    map.set(id, ref);
    return () => {
      if (map.get(id) === ref) map.delete(id);
    };
  }, [map, id]);
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}

type Box = { x: number; y: number; w: number; h: number };
function measure(v: View | null): Promise<Box | null> {
  return new Promise((resolve) => {
    if (!v) return resolve(null);
    v.measureInWindow((x, y, w, h) => resolve(w || h ? { x, y, w, h } : null));
  });
}

/**
 * La carta entra sul tavolo. Con `fromAnchor` viaggia da quel punto (la mano dell'avversario,
 * il mazzo) fino al suo posto, a passo leggibile; altrimenti scivola dentro breve, dall'alto o dal basso.
 */
export function FlyIn({ from = 'above', fromX = 0, fromAnchor, delay = 0, leave, sound, children, style }: {
  from?: 'above' | 'below' | 'none';
  /** Spostamento orizzontale di partenza, se non c'è un punto da cui partire. */
  fromX?: number;
  /** Il punto registrato con <Anchor> da cui parte il viaggio. */
  fromAnchor?: string;
  delay?: number;
  /** Quando sparisce va via: verso il basso se la prendo io, verso l'alto se la prende un avversario. */
  leave?: 'up' | 'down';
  /** Suono quando la carta arriva (si posa sul tavolo, viene distribuita). */
  sound?: Sfx;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const anchors = useContext(Anchors);
  const self = useRef<View>(null);
  const dx = useSharedValue(fromX);
  const dy = useSharedValue(from === 'above' ? -60 : from === 'below' ? 60 : 0);
  const sc = useSharedValue(1);
  const o = useSharedValue(0);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arrive = (ms: number) => {
      if (sound) timer = setTimeout(() => sfx(sound), ms);
    };
    const anchor = fromAnchor ? anchors?.get(fromAnchor)?.current : null;
    if (reduced || !anchor) {
      const ms = reduced ? 180 : 240;
      o.value = withDelay(delay, withTiming(1, { duration: ms }));
      dx.value = withDelay(delay, withTiming(0, { duration: ms, easing: Easing.out(Easing.cubic) }));
      dy.value = withDelay(delay, withTiming(0, { duration: ms, easing: Easing.out(Easing.cubic) }));
      arrive(delay + ms * 0.6);
      return () => clearTimeout(timer);
    }
    Promise.all([measure(self.current), measure(anchor)]).then(([a, b]) => {
      if (!alive) return;
      if (!a || !b) {
        o.value = withDelay(delay, withTiming(1, { duration: 200 }));
        dx.value = 0;
        dy.value = 0;
        return;
      }
      // Parte dal centro del punto di partenza, piccola come le carte coperte, e si apre arrivando.
      dx.value = b.x + b.w / 2 - (a.x + a.w / 2);
      dy.value = b.y + b.h / 2 - (a.y + a.h / 2);
      sc.value = Math.max(0.35, Math.min(1, b.w / Math.max(a.w, 1)));
      const t = { duration: TRAVEL_MS, easing: TRAVEL_EASING };
      o.value = withDelay(delay, withTiming(1, { duration: 120 }));
      dx.value = withDelay(delay + HOLD_MS, withTiming(0, t));
      dy.value = withDelay(delay + HOLD_MS, withTiming(0, t));
      sc.value = withDelay(delay + HOLD_MS, withTiming(1, t));
      arrive(delay + HOLD_MS + TRAVEL_MS - 60);
    });
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const anim = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateX: dx.value }, { translateY: dy.value }, { scale: sc.value }],
  }));
  const exiting = !leave || reduced ? undefined : (leave === 'up' ? SlideOutUp : SlideOutDown).duration(420);
  return (
    <Animated.View ref={self} collapsable={false} style={[style, { zIndex: 50 }, anim]} exiting={exiting}>
      {children}
    </Animated.View>
  );
}

/** Il cartello compare secco: un attimo di dissolvenza, senza rimbalzi né rotazioni. */
export function PopIn({ children, style, pointerEvents }: { children: ReactNode; style?: StyleProp<ViewStyle>; pointerEvents?: 'none' | 'box-none' }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    o.value = withTiming(1, { duration: 140 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={[style, anim]} pointerEvents={pointerEvents}>
      {children}
    </Animated.View>
  );
}

/**
 * Quando arriva il proprio turno il riquadro fa un piccolo scatto e poi resta fermo: il turno si
 * legge dal testo e dal colore, senza pulsare di continuo.
 */
export function Pulse({ active, children, style }: { active: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (!active || reduced) {
      s.value = withTiming(1, { duration: 120 });
      return;
    }
    s.value = withSequence(withTiming(1.04, { duration: 90 }), withTiming(1, { duration: 140 }));
    return () => cancelAnimation(s);
  }, [active, reduced, s]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}
