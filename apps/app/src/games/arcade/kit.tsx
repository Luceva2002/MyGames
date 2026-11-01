import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, T } from '../../ui/kit';
import { colors } from '../../ui/theme';

/**
 * Pezzi comuni ai giochi d'azione da soli: record salvato sul dispositivo, tasti sul computer,
 * ciclo dei fotogrammi, punteggio in alto a sinistra (il menu sta a destra) e cartello di partenza.
 */

/** Sul sito: niente selezione del testo né scorrimento della pagina mentre si trascina il dito. */
export const NO_SELECT = { userSelect: 'none', touchAction: 'none' } as unknown as ViewStyle;

const recordKey = (id: string) => `tavolata.record.${id}`;

/** Il miglior punteggio su questo dispositivo. `lowWins`: vince il numero più basso (mosse, tempo). */
export function useRecord(id: string, lowWins = false) {
  const [best, setBest] = useState<number | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(recordKey(id))
      .then((v) => setBest(v ? Number(v) : null))
      .catch(() => {});
  }, [id]);
  /** Salva il punteggio se è un record e dice se lo è. */
  const submit = (score: number) => {
    const better = score > 0 && (best === null || (lowWins ? score < best : score > best));
    if (better) {
      setBest(score);
      AsyncStorage.setItem(recordKey(id), String(score)).catch(() => {});
    }
    return better;
  };
  return { best, submit };
}

/** Tasti sul computer: la mappa va da `e.key` all'azione. */
export function useKeys(handler: (key: string) => boolean | void, active = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (Platform.OS !== 'web' || !active || typeof window === 'undefined') return;
    const down = (e: KeyboardEvent) => {
      if (ref.current(e.key) === true) e.preventDefault();
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [active]);
}

export function useKeyUp(handler: (key: string) => void, active = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (Platform.OS !== 'web' || !active || typeof window === 'undefined') return;
    const up = (e: KeyboardEvent) => ref.current(e.key);
    window.addEventListener('keyup', up);
    return () => window.removeEventListener('keyup', up);
  }, [active]);
}

/** Chiama `cb(dt)` a ogni fotogramma finché `running`; dt in millisecondi, al massimo 50. */
export function useFrame(cb: (dt: number) => void, running: boolean) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      const dt = last ? Math.min(50, t - last) : 16;
      last = t;
      ref.current(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);
}

/** Punteggio e record, in alto a sinistra dentro il tavolo. */
export function Hud({ score, label = 'punti', best, extra, style }: { score: number | string; label?: string; best: number | null; extra?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[styles.hud, style]}>
      <View style={styles.hudPill}>
        <T size={24} weight="900" color={colors.accent} style={{ lineHeight: 28 }}>
          {score}
        </T>
        <T size={12} weight="800" color="#fff">
          {label}
        </T>
      </View>
      {best !== null || extra ? (
        <View style={[styles.hudPill, styles.hudSmall]}>
          <T size={12} weight="800" color={colors.muted}>
            {[best !== null ? `🏆 ${best}` : null, extra].filter(Boolean).join('  ·  ')}
          </T>
        </View>
      ) : null}
    </View>
  );
}

/** Il cartello prima di partire: come si gioca in due righe e un bottone grande. */
export function StartCard({ title, lines, onStart, label = 'Via!', children }: { title: string; lines: string[]; onStart: () => void; label?: string; children?: ReactNode }) {
  return (
    <View style={styles.cover}>
      <View style={styles.card}>
        <T size={28} weight="900" center>
          {title}
        </T>
        {children}
        {lines.map((l) => (
          <T key={l} size={15} weight="700" color={colors.muted} center>
            {l}
          </T>
        ))}
        <Button label={label} icon="▶" onPress={onStart} style={{ alignSelf: 'stretch', marginTop: 6 }} />
      </View>
    </View>
  );
}

/** Bottone tondo e grande per i comandi sullo schermo (frecce, gira, giù). */
export function PadButton({ icon, label, onPress, onPressIn, size = 64, color = colors.surface2 }: { icon: string; label: string; onPress?: () => void; onPressIn?: () => void; size?: number; color?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={onPressIn}
      hitSlop={6}
      style={({ pressed }) => [styles.pad, { width: size, height: size, borderRadius: size / 2, backgroundColor: color, transform: [{ translateY: pressed ? 3 : 0 }], boxShadow: `0px ${pressed ? 2 : 5}px 0px ${colors.line}` }]}
    >
      <T size={size * 0.42} weight="900" color={color === colors.accent ? colors.onAccent : '#fff'} style={{ lineHeight: size * 0.5 }}>
        {icon}
      </T>
    </Pressable>
  );
}

export type Dir = 'up' | 'down' | 'left' | 'right';

/** Da uno spostamento del dito alla direzione, se è abbastanza lungo. */
export function swipeDir(dx: number, dy: number, min = 24): Dir | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return null;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
}

const styles = StyleSheet.create({
  hud: { position: 'absolute', zIndex: 20, gap: 6, alignItems: 'flex-start' },
  hudPill: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(18,5,43,0.78)', borderWidth: 2, borderColor: colors.line },
  hudSmall: { paddingVertical: 3 },
  cover: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 30, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(18,5,43,0.45)' },
  card: { width: '100%', maxWidth: 360, gap: 10, padding: 22, borderRadius: 26, backgroundColor: colors.surface, borderWidth: 3, borderColor: colors.line, boxShadow: `0px 8px 0px ${colors.line}` },
  pad: { alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.line },
});
