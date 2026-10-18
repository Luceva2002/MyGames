import { useState, type ReactNode } from 'react';
import { ImageBackground, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

/** Tavoli da gioco eleganti e puliti, senza bordi invasivi. */
export const TABLES = {
  /** Tavolo delle carte: velluto turchese scuro col bordo dorato, nella sala del Carnevale. */
  teal: require('../../assets/tables/table-teal.jpg'),
  // Tavolo delle carte: velluto viola elegante, tono su tono con l'app
  purple: require('../../assets/tables/felt-purple.jpg'),
  // Tavolo delle carte: classico panno verde da gioco
  green: require('../../assets/tables/felt-green.jpg'),
  blue: require('../../assets/tables/felt-blue.jpg'),
  carnevale: require('../../assets/tables/felt-purple.jpg'),
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

/** Versioni verticali per i telefoni */
const PORTRAIT: Partial<Record<TableName, ImageSourcePropType>> = {
  teal: require('../../assets/tables/table-teal-v.jpg'),
  purple: require('../../assets/tables/felt-purple-v.jpg'),
  green: require('../../assets/tables/felt-green-v.jpg'),
  blue: require('../../assets/tables/felt-blue.jpg'),
  carnevale: require('../../assets/tables/felt-purple-v.jpg'),
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
  const framed = table === 'teal';
  return (
    <ImageBackground
      source={(tall && PORTRAIT[table]) || TABLES[table]}
      onLayout={(e) => setTall(e.nativeEvent.layout.height > e.nativeEvent.layout.width * 1.15)}
      resizeMode={framed ? 'stretch' : 'cover'}
      // Il tavolo col bordo dorato si vede sempre intero; il contenuto sta dentro il bordo.
      style={[{ flex: 1, overflow: 'hidden' }, rounded && !framed && { borderRadius: 18 }, framed && { padding: '4.5%' }, style]}
      // Senza misure esplicite l'immagine resta grande quanto il file (1344×752) e si vede solo
      // l'angolo in alto a sinistra del tavolo: la stiriamo a coprire tutto il riquadro.
      imageStyle={[{ width: '100%', height: '100%' }, rounded && !framed && { borderRadius: 18 }]}
      accessibilityIgnoresInvertColors
    >
      {scrim > 0 && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: `rgba(0,0,0,${scrim})` }} />}
      {children}
    </ImageBackground>
  );
}
