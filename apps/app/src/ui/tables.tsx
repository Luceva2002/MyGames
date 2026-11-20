import { useState, type ReactNode } from 'react';
import { ImageBackground, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { createContext, useContext } from 'react';
import { shellColors } from './theme';

/** Vero dentro il tavolo Morbido: i posti al tavolo diventano bollini bianchi col contorno scuro. */
export const MorbidoFelt = createContext(false);
export const useMorbidoFelt = () => useContext(MorbidoFelt);

/** Sfondi dei giochi. Il tavolo delle carte (teal) è disegnato in codice: qui c'è solo il suo panno. */
export const TABLES = {
  teal: require('../../assets/tables/felt-teal.jpg'),
  /** Panno verde vero, per il biliardo. */
  felt: require('../../assets/tables/felt-green.jpg'),
  wood: require('../../assets/tables/wood.jpg'),
  pub: require('../../assets/tables/pub.jpg'),
  billiard: require('../../assets/tables/billiard-room.jpg'),
  night: require('../../assets/tables/lupus-night.jpg'),
  day: require('../../assets/tables/lupus-day.jpg'),
} satisfies Record<string, ImageSourcePropType>;

/** `morbido` è il tavolo nuovo dei giochi di carte, disegnato in codice (lotto 2). */
export type TableName = keyof typeof TABLES | 'morbido';

/**
 * Sfondo del tavolo. `scrim` scurisce l'immagine quando sopra ci sono testi,
 * così il contrasto resta leggibile (V-CON-2).
 */
/**
 * Il tavolo delle carte disegnato in codice: panno turchese a rombi, bordo dorato con le borchie
 * magenta e contorno nero. Così resta proporzionato a ogni misura dello schermo (niente immagini
 * stirate), e occupa tutto lo spazio fino in fondo, mano compresa.
 */
function FeltTable({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const rim = size.w < 500 ? 12 : 16;
  const radius = Math.min(64, Math.max(28, Math.min(size.w, size.h) * 0.12));
  const studs: { left: number; top: number }[] = [];
  if (size.w) {
    // Borchie lungo i lati dritti del bordo, distanziate in modo uniforme.
    const r = radius + 6;
    const across = Math.max(1, Math.round((size.w - 2 * r) / 140));
    for (let i = 0; i <= across; i++) {
      const x = r + ((size.w - 2 * r) * i) / across;
      studs.push({ left: x, top: rim / 2 + 3 }, { left: x, top: size.h - rim / 2 - 3 });
    }
    const down = Math.max(1, Math.round((size.h - 2 * r) / 140));
    for (let i = 0; i <= down; i++) {
      const y = r + ((size.h - 2 * r) * i) / down;
      studs.push({ left: rim / 2 + 3, top: y }, { left: size.w - rim / 2 - 3, top: y });
    }
  }
  return (
    <View style={[{ flex: 1, padding: 6, backgroundColor: '#2A0E5C' }, style]}>
      <View
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        style={{ flex: 1, borderRadius: radius, backgroundColor: '#FFD23F', borderWidth: 3, borderColor: '#12052B', padding: rim, boxShadow: '0px 6px 0px #12052B, 0px 12px 30px rgba(0,0,0,0.45)' }}
      >
        <ImageBackground
          source={FELT}
          resizeMode="cover"
          style={{ flex: 1, borderRadius: Math.max(12, radius - rim), overflow: 'hidden', borderWidth: 3, borderColor: '#12052B' }}
          imageStyle={{ width: '100%', height: '100%', borderRadius: Math.max(12, radius - rim) }}
          accessibilityIgnoresInvertColors
        >
          {children}
        </ImageBackground>
        {studs.map((p, i) => (
          <View key={i} pointerEvents="none" style={{ position: 'absolute', left: p.left - 3 - 5, top: p.top - 3 - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF2E88', borderWidth: 2, borderColor: '#12052B' }} />
        ))}
      </View>
    </View>
  );
}

const FELT = TABLES.teal;

/**
 * Il tavolo Pop (21/11/2026): panno verde con una luce morbida al centro e un bordo quasi nero,
 * senza contorni spessi né borchie. Stesse misure del tavolo di prima, così
 * menu e posti restano dove sono.
 */
function MorbidoTable({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const rim = size.w < 500 ? 12 : 16;
  const radius = Math.min(48, Math.max(24, Math.min(size.w, size.h) * 0.08));
  const inner = Math.max(12, radius - rim);
  return (
    <View style={[{ flex: 1, padding: 6, backgroundColor: shellColors.bg }, style]}>
      <View
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        style={{ flex: 1, borderRadius: radius, backgroundColor: '#0D0E11', padding: rim, boxShadow: '0px 12px 30px rgba(0,0,0,0.45)' }}
      >
        <View style={{ flex: 1, borderRadius: inner, overflow: 'hidden' }}>
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id="feltLight" cx="50%" cy="42%" r="70%">
                <Stop offset="0" stopColor="#2C6D55" />
                <Stop offset="1" stopColor="#17402F" />
              </RadialGradient>
            </Defs>
            <Rect x={0} y={0} width={100} height={100} fill="url(#feltLight)" />
          </Svg>
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
  if (table === 'teal') return <FeltTable style={style}>{children}</FeltTable>;
  if (table === 'morbido') return <MorbidoTable style={style}>{children}</MorbidoTable>;
  return (
    <ImageBackground
      source={TABLES[table]}
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
