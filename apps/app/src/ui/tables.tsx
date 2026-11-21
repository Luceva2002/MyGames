import { useState, type ReactNode } from 'react';
import { ImageBackground, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { createContext, useContext } from 'react';
import { shellColors } from './theme';

/** Vero dentro i tavoli Pop: i posti al tavolo diventano bollini bianchi. */
export const MorbidoFelt = createContext(false);
export const useMorbidoFelt = () => useContext(MorbidoFelt);

/** Sfondi in foto: restano solo per Biliardo e Freccette, che hanno ambienti loro. */
export const TABLES = {
  teal: require('../../assets/tables/felt-teal.jpg'),
  pub: require('../../assets/tables/pub.jpg'),
  billiard: require('../../assets/tables/billiard-room.jpg'),
} satisfies Record<string, ImageSourcePropType>;

/**
 * I tavoli Pop disegnati in codice: un panno con la luce morbida al centro e un bordo quasi nero,
 * senza contorni spessi né borchie. Il colore del panno cambia col tipo di gioco, così i tavoli si alternano.
 */
const FELTS = {
  /** Giochi di carte. */
  morbido: ['#2C6D55', '#17402F'],
  /** Tavolieri, dadi e giochi da soli. */
  teal: ['#2B3F86', '#1A2655'],
  /** Taglia la frutta. */
  wood: ['#4B358F', '#281C55'],
  /** Lupus, Mr. White e il Razzo: la notte. */
  night: ['#25214F', '#0F0E24'],
  /** Lupus di giorno. */
  day: ['#2F6E8F', '#173B4F'],
} as const;

/** `morbido`, `teal`, `wood`, `night` e `day` sono disegnati in codice; gli altri sono foto. */
export type TableName = keyof typeof TABLES | keyof typeof FELTS;

function PopTable({ felt, sky, children, style }: { felt: readonly [string, string]; sky?: 'moon' | 'sun'; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const rim = size.w < 500 ? 10 : 14;
  const radius = Math.min(48, Math.max(24, Math.min(size.w, size.h) * 0.08));
  const inner = Math.max(12, radius - rim);
  const id = 'felt' + felt[0].slice(1);
  return (
    <View style={[{ flex: 1, padding: 6, backgroundColor: shellColors.bg }, style]}>
      <View
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        style={{ flex: 1, borderRadius: radius, backgroundColor: '#0D0E11', padding: rim, boxShadow: '0px 12px 30px rgba(0,0,0,0.45)' }}
      >
        <View style={{ flex: 1, borderRadius: inner, overflow: 'hidden' }}>
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id={id} cx="50%" cy="42%" r="70%">
                <Stop offset="0" stopColor={felt[0]} />
                <Stop offset="1" stopColor={felt[1]} />
              </RadialGradient>
            </Defs>
            <Rect x={0} y={0} width={100} height={100} fill={`url(#${id})`} />
          </Svg>
          {sky && (
            // Luna o sole in alto a destra, appena accennati: non devono disturbare i testi.
            <View pointerEvents="none" style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: sky === 'moon' ? '#FFC933' : '#FFE9A8', opacity: 0.1 }} />
          )}
          <MorbidoFelt.Provider value={true}>{children}</MorbidoFelt.Provider>
        </View>
      </View>
    </View>
  );
}

export function TableBg({ table, children, style, scrim = 0, rounded }: {
  table: TableName;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  scrim?: number;
  rounded?: boolean;
}) {
  if (table in FELTS) {
    const t = table as keyof typeof FELTS;
    return <PopTable felt={FELTS[t]} sky={t === 'night' ? 'moon' : t === 'day' ? 'sun' : undefined} style={style}>{children}</PopTable>;
  }
  return (
    <ImageBackground
      source={TABLES[table as keyof typeof TABLES]}
      resizeMode="cover"
      style={[{ flex: 1, overflow: 'hidden' }, rounded && { borderRadius: 18 }, style]}
      // Senza misure esplicite l'immagine resta grande quanto il file e si vede solo un angolo:
      // la stiriamo a coprire tutto il riquadro.
      imageStyle={[{ width: '100%', height: '100%' }, rounded && { borderRadius: 18 }]}
      accessibilityIgnoresInvertColors
    >
      {scrim > 0 && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: `rgba(0,0,0,${scrim})` }} />}
      {children}
    </ImageBackground>
  );
}
