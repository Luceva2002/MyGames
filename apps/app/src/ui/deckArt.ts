import type { ImageSourcePropType } from 'react-native';

/**
 * Figure delle carte coi personaggi del Carnevale, generate con Higgsfield (originali in
 * design-proposte/raw7). Le numerali sono disegnate in codice (suits.tsx); bollino e seme
 * negli angoli li aggiunge sempre il codice. Anche i dorsi sono generati con Higgsfield.
 */
export const CARD_FACES: Record<string, ImageSourcePropType> = {
  'it-d8': require('../../assets/cards/it/d8.jpg'),
  'it-d9': require('../../assets/cards/it/d9.jpg'),
  'it-d10': require('../../assets/cards/it/d10.jpg'),
  'it-c8': require('../../assets/cards/it/c8.jpg'),
  'it-c9': require('../../assets/cards/it/c9.jpg'),
  'it-c10': require('../../assets/cards/it/c10.jpg'),
  'it-b8': require('../../assets/cards/it/b8.jpg'),
  'it-b9': require('../../assets/cards/it/b9.jpg'),
  'it-b10': require('../../assets/cards/it/b10.jpg'),
  'it-s8': require('../../assets/cards/it/s8.jpg'),
  'it-s9': require('../../assets/cards/it/s9.jpg'),
  'it-s10': require('../../assets/cards/it/s10.jpg'),
  'fr-h11': require('../../assets/cards/fr/h11.jpg'),
  'fr-h12': require('../../assets/cards/fr/h12.jpg'),
  'fr-h13': require('../../assets/cards/fr/h13.jpg'),
  'fr-d11': require('../../assets/cards/fr/d11.jpg'),
  'fr-d12': require('../../assets/cards/fr/d12.jpg'),
  'fr-d13': require('../../assets/cards/fr/d13.jpg'),
  'fr-c11': require('../../assets/cards/fr/c11.jpg'),
  'fr-c12': require('../../assets/cards/fr/c12.jpg'),
  'fr-c13': require('../../assets/cards/fr/c13.jpg'),
  'fr-s11': require('../../assets/cards/fr/s11.jpg'),
  'fr-s12': require('../../assets/cards/fr/s12.jpg'),
  'fr-s13': require('../../assets/cards/fr/s13.jpg'),
  'fr-j0': require('../../assets/cards/fr/j0.jpg'),
  'fr-j1': require('../../assets/cards/fr/j1.jpg'),
};

export const CARD_BACKS: Record<'it' | 'fr' | 'uno', ImageSourcePropType> = {
  it: require('../../assets/cards/back-it.jpg'),
  fr: require('../../assets/cards/back-fr.jpg'),
  uno: require('../../assets/cards/back-uno.jpg'),
};
