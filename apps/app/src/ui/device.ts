import { Platform, useWindowDimensions } from 'react-native';

/** Che dispositivo sta usando chi gioca, capito da misure dello schermo e tocco. */
export type DeviceKind = 'phone' | 'tablet' | 'desktop';

const hasTouch = () => {
  if (Platform.OS !== 'web') return true;
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
};

export function useDevice(): DeviceKind {
  const { width, height } = useWindowDimensions();
  const short = Math.min(width, height);
  if (hasTouch()) return short < 600 ? 'phone' : 'tablet';
  return short < 500 ? 'phone' : 'desktop';
}

/**
 * Questo dispositivo fa da tavolo quando si gioca con gli amici? Computer, tablet e TV sì: lo
 * schermo mostra il tavolo e gli amici giocano dal telefono. Dal telefono no: ognuno siede al
 * tavolo e gioca dal suo telefono, senza bisogno di uno schermo comune.
 */
export function useIsTable(): boolean {
  return useDevice() !== 'phone';
}
