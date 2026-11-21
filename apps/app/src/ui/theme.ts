import { createContext, useContext } from 'react';

/**
 * Colori dei tavoli dei giochi, stile Pop (21/11/2026): gli stessi del guscio, con un contorno quasi
 * nero (`line`) per pedine, pezzi e caselle, sottile e senza ombre piene.
 * Sul fondo carbone: text 16:1, muted 9:1, accent 12:1. Sul giallo il testo è sempre `onAccent`.
 */
export const colors = {
  bg: '#16171B',
  surface: '#202228',
  surface2: '#2A2D35',
  brand: '#5B3FE0',
  /** Fondo della copertina e dei riquadri del QR. */
  cover: '#16171B',
  line: '#0D0E11',
  text: '#F4F5F7',
  muted: '#B4B9C2',
  dim: '#8E94A0',
  accent: '#FFC933',
  onAccent: '#17181C',
  accent2: '#FF4F8B',
  accent3: '#2EC4B6',
  danger: '#FF6B7A',
  success: '#3FD39A',
  focus: '#FFC933',
  felt: '#2B3F86',
  feltDark: '#1A2655',
  scrim: '#0D0E11D9',
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
export const CATEGORY_COLORS = { carte: '#1FA67A', tavolo: '#5B3FE0', dadi: '#FFC933', abilita: '#FF4F8B', party: '#2B2E36' } as const;

/** Contorno sottile e ombra morbida dello stile Pop. */
export const OUTLINE = 1.5;
export const shadow = (y: number) => ({ boxShadow: `0px ${y}px ${y * 3}px rgba(0,0,0,0.35)` }) as const;

/**
 * Identità dei giocatori: colore della palette Okabe-Ito (sicura per i daltonici) più un simbolo,
 * sempre insieme al nome (P-ID-1, P-ID-2). Il blu scuro Okabe-Ito è schiarito: sul viola non si leggeva (V-CON-1).
 */
export const seatColors = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#CC79A7', '#D55E00', '#9AD0F5', '#C9C9C9', '#E69F00', '#56B4E9'];
export const seatColor = (seat: number) => seatColors[seat % seatColors.length];

/** Caratteri di tutta l'app, guscio e tavoli: Outfit, più pieno per titoli e punteggi. Fredoka resta sulle carte. */
export const font = {
  display: 'Outfit_800ExtraBold',
  body: 'Outfit_500Medium',
  /** Fredoka per valori e nomi sulle carte dello stile Morbido. */
  card: 'Fredoka_600SemiBold',
  bold: 'Outfit_700Bold',
};
export const shellFont: typeof font = font;

/** La tavolozza di dove si trova un componente: il guscio Pop o il tavolo di un gioco. */
export interface Palette {
  colors: typeof colors;
  font: typeof font;
  shell: boolean;
}
export const SHELL: Palette = { colors: shellColors, font: shellFont, shell: true };
export const TABLE: Palette = { colors, font: shellFont, shell: true };
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
