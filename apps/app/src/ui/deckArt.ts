import type { ImageSourcePropType } from 'react-native';

/**
 * Le carte francesi e napoletane sono tutte disegnate in codice (suits.tsx, stile Morbido).
 * Resta in immagine solo il dorso di UNO, che passa allo stile nuovo col suo lotto.
 */
export const CARD_BACKS: Record<'uno', ImageSourcePropType> = {
  uno: require('../../assets/cards/back-uno.jpg'),
};
