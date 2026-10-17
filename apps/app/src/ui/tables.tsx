import type { ReactNode } from 'react';
import { ImageBackground, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

/** Tavoli da gioco generati con Higgsfield (assets/tables). */
export const TABLES = {
  // Un solo tavolo per tutti i giochi di carte: velluto viola del Carnevale (spec §5).
  green: require('../../assets/tables/carnevale.jpg'),
  blue: require('../../assets/tables/carnevale.jpg'),
  carnevale: require('../../assets/tables/carnevale.jpg'),
  /** Panno verde vero, per il biliardo. */
  felt: require('../../assets/tables/felt-green.jpg'),
  wood: require('../../assets/tables/wood.jpg'),
  pub: require('../../assets/tables/pub.jpg'),
  stadium: require('../../assets/tables/stadium.jpg'),
  billiard: require('../../assets/tables/billiard-room.jpg'),
  night: require('../../assets/tables/lupus-night.jpg'),
  day: require('../../assets/tables/lupus-day.jpg'),
} satisfies Record<string, ImageSourcePropType>;

export type TableName = keyof typeof TABLES;

/**
 * Sfondo del tavolo. `scrim` scurisce l'immagine quando sopra ci sono testi,
 * così il contrasto resta leggibile (V-CON-2).
 */
export function TableBg({ table, children, style, scrim = 0, rounded }: {
  table: TableName;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  scrim?: number;
  rounded?: boolean;
}) {
  return (
    <ImageBackground
      source={TABLES[table]}
      resizeMode="cover"
      style={[{ flex: 1, overflow: 'hidden' }, rounded && { borderRadius: 18 }, style]}
      imageStyle={rounded ? { borderRadius: 18 } : undefined}
      accessibilityIgnoresInvertColors
    >
      {scrim > 0 && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: `rgba(0,0,0,${scrim})` }} />}
      {children}
    </ImageBackground>
  );
}
