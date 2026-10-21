import { createContext, useContext, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Impostazioni di accessibilità (P-A11Y): valgono per l'app e per tutti i giochi. */
export interface Settings {
  /** 0 normale, 1 grande, 2 molto grande. */
  textSize: 0 | 1 | 2;
  /** null = segue il sistema operativo. */
  reduceMotion: boolean | null;
  haptics: boolean;
  /** Effetti sonori nei giochi. */
  sound: boolean;
  /** La maschera scelta come proprio personaggio (id), null se non scelta. */
  avatar: string | null;
  /** Bordi e testi più marcati. */
  highContrast: boolean;
  /** Bravura del computer nelle partite su questo dispositivo. */
  botLevel: 'facile' | 'normale' | 'difficile';
}

const KEY = 'tavolata.settings';
export const DEFAULT_SETTINGS: Settings = { textSize: 0, reduceMotion: null, haptics: true, sound: true, avatar: null, highContrast: false, botLevel: 'normale' };
export const TEXT_SCALE = [1, 1.18, 1.36] as const;

let current: Settings = DEFAULT_SETTINGS;
let osReduceMotion = false;
const listeners = new Set<(s: Settings) => void>();

AsyncStorage.getItem(KEY)
  .then((raw) => {
    if (raw) setSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) });
  })
  .catch(() => {});
AccessibilityInfo.isReduceMotionEnabled?.()
  .then((v) => {
    osReduceMotion = v;
    listeners.forEach((l) => l({ ...current }));
  })
  .catch(() => {});

export function getSettings() {
  return current;
}

export function setSettings(next: Settings) {
  current = next;
  AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  listeners.forEach((l) => l(next));
}

export function useSettings(): Settings {
  const [s, set] = useState(current);
  useEffect(() => {
    listeners.add(set);
    set(current);
    return () => {
      listeners.delete(set);
    };
  }, []);
  return s;
}

/** Movimento ridotto: la scelta dell'utente, altrimenti quella del sistema (P-MOTION-4). */
export function useReducedMotion(): boolean {
  const s = useSettings();
  return s.reduceMotion ?? osReduceMotion;
}

/** Schermo condiviso (TV): testi e numeri più grandi e margini di sicurezza (P-TV-1, P-TV-2). */
export const TvContext = createContext(false);
export const useIsTv = () => useContext(TvContext);
