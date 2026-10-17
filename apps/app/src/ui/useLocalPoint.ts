import { useRef } from 'react';
import type { GestureResponderEvent, View } from 'react-native';

/**
 * Coordinate di un tocco relative a un elemento. Su web `locationX` dipende da quale figlio
 * riceve il clic, quindi misuriamo l'elemento e usiamo le coordinate di pagina.
 */
export function useLocalPoint<T extends View = View>() {
  const ref = useRef<T>(null);
  const toLocal = (e: GestureResponderEvent, cb: (x: number, y: number) => void) => {
    const { pageX, pageY } = e.nativeEvent;
    const node = ref.current;
    if (!node) return;
    node.measureInWindow((x, y) => cb(pageX - x, pageY - y));
  };
  return { ref, toLocal };
}
