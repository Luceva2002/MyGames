import { useEffect } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

let next = 0;

/**
 * Schermo sempre acceso durante la partita. Come useKeepAwake di Expo, ma senza errori se si esce
 * prima che il blocco sia attivo (succedeva cambiando pagina in fretta o ricaricando).
 */
export function useStayAwake() {
  useEffect(() => {
    const tag = `tavolata-${next++}`;
    activateKeepAwakeAsync(tag).catch(() => {});
    return () => {
      deactivateKeepAwake(tag).catch(() => {});
    };
  }, []);
}
