import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { getSettings, useReducedMotion } from './settings';
import { sfx } from './sound';
import { colors } from './theme';

/**
 * Trascinamento delle carte, con mouse e dita (alla Balatro): la carta presa segue il dito
 * inclinandosi con la velocità, le zone che la accettano si illuminano, quella sotto il dito
 * si gonfia. Lasciata fuori da una zona torna a posto con una molla. Il tocco resta valido.
 */

export interface DragPayload {
  /** Che cosa si trascina, per le zone: 'hand', 'table', 'waste', 'stock'… */
  kind: string;
  ids: string[];
  /** Dati in più per chi riceve (per esempio da quale pila del solitario arriva). */
  data?: unknown;
}

type Rect = { x: number; y: number; w: number; h: number };

interface Zone {
  ref: React.RefObject<View | null>;
  accepts: (p: DragPayload) => boolean;
  /** false: la mossa non è partita (serve una scelta in più), la carta torna in mano. */
  onDrop: (p: DragPayload) => boolean | void;
  rect?: Rect;
}

interface Active {
  payload: DragPayload;
  origin: Rect;
  grab: { x: number; y: number };
  onSettle: (dropped: boolean) => void;
}

interface DragApi {
  register: (id: string, zone: Zone) => () => void;
  start: (a: Active, ghost: ReactNode) => void;
  move: (x: number, y: number, vx: number) => void;
  end: (x: number, y: number) => void;
}

const ApiCtx = createContext<DragApi | null>(null);
const StateCtx = createContext<{ payload: DragPayload | null; hover: string | null }>({ payload: null, hover: null });

export const useDragState = () => useContext(StateCtx);

function haptic(kind: 'pick' | 'hover' | 'drop') {
  if (!getSettings().haptics) return;
  if (kind === 'drop') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  else if (kind === 'pick') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  else Haptics.selectionAsync().catch(() => {});
}

function measure(ref: React.RefObject<View | null>): Promise<Rect | undefined> {
  return new Promise((resolve) => {
    const v = ref.current;
    if (!v) return resolve(undefined);
    v.measureInWindow((x, y, w, h) => resolve({ x, y, w, h }));
  });
}

/** Contenitore della partita: disegna sopra tutto la carta trascinata. */
export function DragProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const zones = useRef(new Map<string, Zone>());
  const active = useRef<Active | null>(null);
  const hoverRef = useRef<string | null>(null);
  const layerRef = useRef<View>(null);
  const layer = useRef<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const [ghost, setGhost] = useState<ReactNode>(null);
  const [state, setState] = useState<{ payload: DragPayload | null; hover: string | null }>({ payload: null, hover: null });

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const rot = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);

  // La zona più piccola sotto il dito vince: una combinazione dentro il tavolo batte il tavolo.
  const hitTest = useCallback((px: number, py: number, p: DragPayload) => {
    let best: string | null = null;
    let bestArea = Infinity;
    zones.current.forEach((z, id) => {
      const r = z.rect;
      if (!r || px < r.x || px > r.x + r.w || py < r.y || py > r.y + r.h || !z.accepts(p)) return;
      if (r.w * r.h < bestArea) {
        best = id;
        bestArea = r.w * r.h;
      }
    });
    return best as string | null;
  }, []);

  const finish = useCallback((dropped: boolean) => {
    const a = active.current;
    active.current = null;
    hoverRef.current = null;
    setGhost(null);
    setState({ payload: null, hover: null });
    a?.onSettle(dropped);
  }, []);

  const api = useMemo<DragApi>(
    () => ({
      register(id, zone) {
        zones.current.set(id, zone);
        return () => {
          if (zones.current.get(id) === zone) zones.current.delete(id);
        };
      },
      start(a, node) {
        if (active.current) finish(false);
        active.current = a;
        haptic('pick');
        sfx('pick');
        measure(layerRef).then((r) => r && (layer.current = r));
        // Le zone si misurano a ogni presa: il tavolo può essersi spostato o ingrandito.
        zones.current.forEach((z) => measure(z.ref).then((r) => (z.rect = r)));
        x.value = a.origin.x - layer.current.x;
        y.value = a.origin.y - layer.current.y;
        rot.value = 0;
        opacity.value = 1;
        scale.value = reduced ? 1.05 : withSpring(1.12, { damping: 12, stiffness: 260 });
        setGhost(node);
        setState({ payload: a.payload, hover: null });
      },
      move(px, py, vx) {
        const a = active.current;
        if (!a) return;
        x.value = px - a.grab.x - layer.current.x;
        y.value = py - a.grab.y - layer.current.y;
        if (!reduced) rot.value = withSpring(Math.max(-14, Math.min(14, vx / 90)), { damping: 18, stiffness: 180 });
        const best = hitTest(px, py, a.payload);
        if (best !== hoverRef.current) {
          hoverRef.current = best;
          if (best) {
            haptic('hover');
            sfx('hover');
          }
          setState({ payload: a.payload, hover: best });
        }
      },
      end(px, py) {
        const a = active.current;
        if (!a) return;
        // Il punto di rilascio decide, anche se il dito è arrivato lì in un solo salto.
        const id = hitTest(px, py, a.payload);
        const zone = id ? zones.current.get(id) : undefined;
        const played = zone ? zone.onDrop(a.payload) !== false : false;
        const token = a;
        const settle = (ok: boolean, ms: number) => setTimeout(() => active.current === token && finish(ok), ms);
        if (played && zone?.rect) {
          haptic('drop');
          const r = zone.rect;
          // Vola verso il centro della zona e sparisce: la carta vera comparirà lì.
          const t = { duration: 140 };
          x.value = withTiming(r.x + r.w / 2 - a.origin.w / 2 - layer.current.x, t);
          y.value = withTiming(r.y + r.h / 2 - a.origin.h / 2 - layer.current.y, t);
          rot.value = withTiming(0, t);
          scale.value = withTiming(0.85, t);
          opacity.value = withTiming(0, { duration: 160 });
          settle(true, 170);
        } else {
          const tx = a.origin.x - layer.current.x;
          const ty = a.origin.y - layer.current.y;
          rot.value = withTiming(0, { duration: 160 });
          scale.value = withTiming(1, { duration: 160 });
          if (reduced) {
            x.value = withTiming(tx, { duration: 120 });
            y.value = withTiming(ty, { duration: 120 });
          } else {
            x.value = withSpring(tx, { damping: 14, stiffness: 220 });
            y.value = withSpring(ty, { damping: 14, stiffness: 220 });
          }
          settle(false, reduced ? 130 : 360);
        }
      },
    }),
    [finish, hitTest, reduced, opacity, rot, scale, x, y],
  );

  const ghostStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${rot.value}deg` }, { scale: scale.value }],
  }));

  return (
    <ApiCtx.Provider value={api}>
      <StateCtx.Provider value={state}>
        <View style={{ flex: 1 }}>
          {children}
          <View ref={layerRef} collapsable={false} pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={() => measure(layerRef).then((r) => r && (layer.current = r))}>
            {ghost && <Animated.View style={[styles.ghost, ghostStyle]}>{ghost}</Animated.View>}
          </View>
        </View>
      </StateCtx.Provider>
    </ApiCtx.Provider>
  );
}

/**
 * Rende trascinabile ciò che contiene. Il tocco sui figli continua a funzionare; subito dopo un
 * trascinamento il tocco viene ignorato, così lasciare la carta dov'era non la seleziona.
 */
export function Draggable({ payload, ghost, children, style, onLift }: {
  /** null: in questo momento non si può trascinare. */
  payload: DragPayload | null;
  /** Che cosa segue il dito; di solito la carta stessa. */
  ghost: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Avvisa quando la carta viene presa (true) e quando torna o viene giocata (false). */
  onLift?: (lifted: boolean) => void;
}) {
  const api = useContext(ApiCtx);
  const [lifted, setLifted] = useState(false);
  const grab = useRef({ x: 0, y: 0 });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const ghostRef = useRef(ghost);
  ghostRef.current = ghost;
  const liftRef = useRef(onLift);
  liftRef.current = onLift;
  useEffect(() => () => void (hideTimer.current && clearTimeout(hideTimer.current)), []);

  const onStart = useCallback(
    (absX: number, absY: number, lx: number, ly: number, w: number, h: number) => {
      const p = payloadRef.current;
      if (!api || !p) return;
      if (hideTimer.current) clearTimeout(hideTimer.current);
      dragGuard.until = Infinity;
      setLifted(true);
      liftRef.current?.(true);
      api.start(
        {
          payload: p,
          origin: { x: absX - lx, y: absY - ly, w, h },
          grab: { x: grab.current.x, y: grab.current.y },
          onSettle: (dropped) => {
            dragGuard.until = Date.now() + 350;
            liftRef.current?.(false);
            // Giocata: resta nascosta finché arriva lo stato nuovo (o torna se la mossa è rifiutata).
            if (dropped) hideTimer.current = setTimeout(() => setLifted(false), 1200);
            else setLifted(false);
          },
        },
        ghostRef.current,
      );
    },
    [api],
  );

  const size = useRef({ w: 0, h: 0 });
  const canDrag = !!payload;
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .enabled(!!api && canDrag)
        .minDistance(8)
        .onBegin((e) => {
          grab.current = { x: e.x, y: e.y };
        })
        .onStart((e) => onStart(e.absoluteX, e.absoluteY, e.x, e.y, size.current.w, size.current.h))
        .onUpdate((e) => api?.move(e.absoluteX, e.absoluteY, e.velocityX))
        .onEnd((e) => api?.end(e.absoluteX, e.absoluteY)),
    [api, canDrag, onStart],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View
        collapsable={false}
        style={[style, lifted && { opacity: 0.25 }]}
        onLayout={(e) => (size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {children}
      </View>
    </GestureDetector>
  );
}

/** Finché è nel futuro, i tocchi sulle carte vengono ignorati (appena finito un trascinamento). */
export const dragGuard = { until: 0 };
export const tapAllowed = () => Date.now() > dragGuard.until;

/** Zona dove si possono lasciare le carte: si illumina quando la carta presa ci può andare. */
export function DropZone({ id, accepts, onDrop, children, style, radius = 18, inset = 0 }: {
  id: string;
  accepts: (p: DragPayload) => boolean;
  onDrop: (p: DragPayload) => boolean | void;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** Quanto il bagliore sborda oltre la zona. */
  inset?: number;
}) {
  const api = useContext(ApiCtx);
  const { payload, hover } = useContext(StateCtx);
  const ref = useRef<View>(null);
  const cb = useRef({ accepts, onDrop });
  cb.current = { accepts, onDrop };
  useEffect(() => api?.register(id, { ref, accepts: (p) => cb.current.accepts(p), onDrop: (p) => cb.current.onDrop(p) }), [api, id]);

  const ok = !!payload && accepts(payload);
  const over = ok && hover === id;
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
      {ok && <ZoneGlow over={over} radius={radius} inset={inset} />}
    </View>
  );
}

function ZoneGlow({ over, radius, inset }: { over: boolean; radius: number; inset: number }) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0.55);
  useEffect(() => {
    if (reduced) return;
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 450 }), withTiming(0.55, { duration: 450 })), -1, true);
    return () => cancelAnimation(pulse);
  }, [pulse, reduced]);
  const anim = useAnimatedStyle(() => ({ opacity: over ? 1 : pulse.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.glow,
        { top: -inset, left: -inset, right: -inset, bottom: -inset, borderRadius: radius },
        over ? styles.glowOver : null,
        anim,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ghost: { position: 'absolute', left: 0, top: 0, zIndex: 1000, filter: 'drop-shadow(0px 18px 14px rgba(0,0,0,0.45))' } as ViewStyle,
  glow: { position: 'absolute', borderWidth: 3, borderStyle: 'dashed', borderColor: colors.accent, backgroundColor: '#FFE14D14' },
  glowOver: { borderStyle: 'solid', borderWidth: 4, backgroundColor: '#FFE14D33', boxShadow: `0px 0px 22px ${colors.accent}` },
});
