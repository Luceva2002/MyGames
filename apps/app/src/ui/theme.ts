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
 * Il guscio dell'app nello stile Morbido (lotto 2, approvato da Luca il 20/11/2026): fondo chiaro
 * grigio-verde, superfici bianche, contorno scuro morbido e ombra piena corta, come carte e mostrini.
 * Stesse chiavi di `colors`, così le schermate passano da una tavolozza all'altra senza altri cambi.
 * I tavoli dei giochi non ancora ridisegnati restano su `colors`.
 */
export const shellColors: typeof colors = {
  bg: '#F3F5F1',
  surface: '#FFFFFF',
  surface2: '#E9ECE7',
  brand: '#3E7BD6',
  cover: '#F3F5F1',
  line: '#2A2D34',
  text: '#2A2D34',
  muted: '#4F5752',
  dim: '#6B736D',
  accent: '#FFD24A',
  onAccent: '#2A2D34',
  accent2: '#3E7BD6',
  accent3: '#3FA66B',
  danger: '#C93A3F',
  success: '#2E8B57',
  focus: '#2A2D34',
  felt: '#2B7553',
  feltDark: '#1E5C40',
  scrim: '#2A2D34CC',
};

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

/** Caratteri del guscio Morbido: Fredoka per titoli e punteggi, Nunito per testi e bottoni. */
export const shellFont: typeof font = {
  display: 'Fredoka_700Bold',
  body: 'Nunito_500Medium',
  bold: 'Nunito_800ExtraBold',
  card: 'Fredoka_600SemiBold',
};

/** La tavolozza di dove si trova un componente: il guscio chiaro o il tavolo di un gioco. */
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
