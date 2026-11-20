import { createContext, useContext } from 'react';

/**
 * Token del design system, stile "Carnevale semplice" (docs/SPEC-carnevale-semplice.md).
 * Contrasti sul fondo `bg` #2A0E5C: text 15:1, muted 10:1, dim 6:1, accent 13:1 (V-CON-1).
 * Sul giallo il testo è sempre `onAccent`, mai bianco.
 */
export const colors = {
  bg: '#2A0E5C',
  surface: '#3A1680',
  surface2: '#4A22A0',
  brand: '#6B2BD9',
  /** Il viola dell'illustrazione della copertina: dietro al QR e alle maschere. */
  cover: '#591ED2',
  line: '#12052B',
  text: '#FFFFFF',
  muted: '#D9CCF5',
  dim: '#B9A6E6',
  accent: '#FFE14D',
  onAccent: '#12052B',
  accent2: '#FF2E88',
  accent3: '#19D3C5',
  danger: '#FF8FA3',
  success: '#7CF0B0',
  focus: '#FFFFFF',
  felt: '#3A1680',
  feltDark: '#2A0E5C',
  scrim: '#12052BCC',
};

/**
 * Il guscio dell'app nello stile Pop (scelto da Luca il 21/11/2026): fondo grigio carbone tranquillo,
 * superfici appena più chiare, niente contorni spessi né ombre piene. I colori pieni stanno solo
 * nelle icone dei giochi, che si alternano, e nel giallo delle cose importanti.
 * Stesse chiavi di `colors`, così le schermate passano da una tavolozza all'altra senza altri cambi.
 * I tavoli dei giochi non ancora ridisegnati restano su `colors`.
 */
export const shellColors: typeof colors = {
  bg: '#16171B',
  surface: '#202228',
  surface2: '#2A2D35',
  brand: '#5B3FE0',
  cover: '#16171B',
  line: '#33363F',
  text: '#F4F5F7',
  muted: '#B4B9C2',
  dim: '#8E94A0',
  accent: '#FFC933',
  onAccent: '#17181C',
  accent2: '#FF4F8B',
  accent3: '#1FA67A',
  danger: '#FF6B7A',
  success: '#3FD39A',
  focus: '#FFC933',
  felt: '#2C6D55',
  feltDark: '#17402F',
  scrim: '#0D0E11D9',
};

/** Ombra del guscio Pop: morbida e larga, mai piena. */
export const SOFT = '0px 8px 22px rgba(0,0,0,0.32)';

/** I colori pieni delle tessere Pop: si alternano nelle icone dei giochi e nei posti. */
export const POP_TILES = ['#5B3FE0', '#FF4F8B', '#1FA67A', '#3D7BFF', '#FF8A3D', '#2B2E36'] as const;

/** Colore di ogni categoria: è lo sfondo delle copertine e dei filtri in home (palette brand-alt, SPEC §7 e §9). */
export const CATEGORY_COLORS = { carte: '#19D3C5', tavolo: '#6B2BD9', dadi: '#FFE14D', abilita: '#FF2E88', party: '#12052B' } as const;

/** Contorno spesso e ombra piena verso il basso, senza sfocatura (forme del Carnevale). */
export const OUTLINE = 3;
export const shadow = (y: number) => ({ boxShadow: `0px ${y}px 0px ${colors.line}` }) as const;

/**
 * Identità dei giocatori: colore della palette Okabe-Ito (sicura per i daltonici) più un simbolo,
 * sempre insieme al nome (P-ID-1, P-ID-2). Il blu scuro Okabe-Ito è schiarito: sul viola non si leggeva (V-CON-1).
 */
export const seatColors = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#CC79A7', '#D55E00', '#9AD0F5', '#C9C9C9', '#E69F00', '#56B4E9'];
export const seatColor = (seat: number) => seatColors[seat % seatColors.length];

/** Bagel Fat One per titoli, punteggi e cartelli; Nunito per testi e bottoni. */
export const font = {
  display: 'BagelFatOne_400Regular',
  body: 'Nunito_500Medium',
  /** Fredoka per valori e nomi sulle carte dello stile Morbido. */
  card: 'Fredoka_600SemiBold',
  bold: 'Nunito_800ExtraBold',
};

/** Caratteri del guscio Pop: Outfit per tutto, più pieno per titoli e punteggi. Fredoka resta sulle carte. */
export const shellFont: typeof font = {
  display: 'Outfit_800ExtraBold',
  body: 'Outfit_500Medium',
  bold: 'Outfit_700Bold',
  card: 'Fredoka_600SemiBold',
};

/** La tavolozza di dove si trova un componente: il guscio Pop o il tavolo di un gioco. */
export interface Palette {
  colors: typeof colors;
  font: typeof font;
  shell: boolean;
}
export const SHELL: Palette = { colors: shellColors, font: shellFont, shell: true };
export const TABLE: Palette = { colors, font, shell: false };
export const PaletteContext = createContext<Palette>(TABLE);
export const usePalette = () => useContext(PaletteContext);

export const radius = { s: 10, m: 18, l: 26 };
export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24 };

/** Dimensioni minime (V-IN-1, V-TXT-2). */
export const MIN_TOUCH = 48;
export const MIN_TEXT = 12;
/** Su TV i testi crescono e non scendono sotto 24 px (V-TXT-1). */
export const TV_SCALE = 1.6;
export const TV_MIN_TEXT = 24;

/** Durate delle transizioni (V-MO-1). */
export const motion = { fast: 150, base: 250, slow: 400 };
