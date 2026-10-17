import { useState, type ReactNode } from 'react';
import { ImageBackground, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

/** Tavoli da gioco in stile Carnevale, generati con Higgsfield (assets/tables, originali in design-proposte/raw7/tavoli). */
export const TABLES = {
  // Un solo tavolo per tutti i giochi di carte: velluto viola del Carnevale (spec §5).
  green: require('../../assets/tables/carnevale.jpg'),
  blue: require('../../assets/tables/carnevale.jpg'),
  carnevale: require('../../assets/tables/carnevale.jpg'),
  /** Vassoio dei dadi (Yahtzee). */
  dice: require('../../assets/tables/dice.jpg'),
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

/** Versioni verticali per i telefoni: con quella orizzontale si vedrebbe solo il centro, senza cornice. */
const PORTRAIT: Partial<Record<TableName, ImageSourcePropType>> = {
  green: require('../../assets/tables/carnevale-v.jpg'),
  blue: require('../../assets/tables/carnevale-v.jpg'),
  carnevale: require('../../assets/tables/carnevale-v.jpg'),
};

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
  const [tall, setTall] = useState(false);
  return (
    <ImageBackground
      source={(tall && PORTRAIT[table]) || TABLES[table]}
      onLayout={(e) => setTall(e.nativeEvent.layout.height > e.nativeEvent.layout.width * 1.15)}
      resizeMode="cover"
      style={[{ flex: 1, overflow: 'hidden' }, rounded && { borderRadius: 18 }, style]}
      // Senza misure esplicite l'immagine resta grande quanto il file (1344×752) e si vede solo
      // l'angolo in alto a sinistra del tavolo: la stiriamo a coprire tutto il riquadro.
      imageStyle={[{ width: '100%', height: '100%' }, rounded && { borderRadius: 18 }]}
      accessibilityIgnoresInvertColors
    >
      {scrim > 0 && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: `rgba(0,0,0,${scrim})` }} />}
      {children}
    </ImageBackground>
  );
}
