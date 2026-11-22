import { createContext, useContext } from 'react';

/**
 * Colori dei tavoli dei giochi nello stile Fireship (22/11/2026): fondo quasi nero, crema per i testi, il giallo
 * caldo per le cose importanti e un contorno quasi nero (`line`) per pedine, pezzi e caselle.
 * Sul fondo: text 17:1, muted 9:1, accent 11:1. Sul giallo il testo è sempre `onAccent`.
 */
export const colors = {
  bg: '#0F0E10',
  surface: '#201F21',
  surface2: '#2A292C',
  brand: '#7660A7',
  /** Fondo della copertina e dei riquadri del QR. */
  cover: '#0F0E10',
  line: '#0D0C0E',
  text: '#F7F2DF',
  muted: '#B9B4A6',
  dim: '#8F8A80',
  accent: '#F2BD4D',
  onAccent: '#201F21',
  accent2: '#E592A7',
  accent3: '#4FA663',
  danger: '#E8606A',
  success: '#6CC07F',
  focus: '#F2BD4D',
  felt: '#2B3F86',
  feltDark: '#1A2655',
  scrim: '#0F0E10D9',
};

/**
 * Il guscio dell'app nello stile di fireship.dev (scelto da Luca il 22/11/2026): fondo quasi nero, superfici
 * appena più chiare e senza bordi, colori pieni ma caldi (crema, verde, rosa antico, viola, azzurro, rosso, giallo)
 * e un'ombra piena spostata solo sotto le cose colorate. Stesse chiavi di `colors`.
 */
export const shellColors: typeof colors = {
  ...colors,
  line: '#2A292C',
  felt: '#2C6D55',
  feltDark: '#17402F',
};

/** I sette colori di Fireship, una sola tonalità per colore. */
export const FIRE = { cream: '#F7F2DF', green: '#4FA663', pink: '#E592A7', purple: '#7660A7', sky: '#56B1E0', red: '#DB3A45', yellow: '#F2BD4D', orange: '#F07F3B' } as const;

/** Le superfici del guscio non hanno ombra; le cose colorate hanno l'ombra piena spostata (HARD). */
export const SOFT = '0px 0px 0px rgba(0,0,0,0)';
export const HARD = '6px 6px 0px #2A292C';

/** Contorno sottile dello stile. */
export const OUTLINE = 1.5;
export const shadow = (y: number) => ({ boxShadow: `0px ${y}px ${y * 3}px rgba(0,0,0,0.35)` }) as const;

/**
 * Identità dei giocatori: colore della palette Okabe-Ito (sicura per i daltonici) più un simbolo,
 * sempre insieme al nome (P-ID-1, P-ID-2). Il blu scuro Okabe-Ito è schiarito: sul viola non si leggeva (V-CON-1).
 */
export const seatColors = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#CC79A7', '#D55E00', '#9AD0F5', '#C9C9C9', '#E69F00', '#56B4E9'];
export const seatColor = (seat: number) => seatColors[seat % seatColors.length];

/**
 * Caratteri di tutta l'app: Silkscreen, a pixel da cabinato arcade, per il nome, i titoli e i punteggi (21/11/2026);
 * Space Grotesk per i testi e i bottoni (scelto da Luca il 22/11/2026 al posto di Outfit). Fredoka resta sulle carte.
 * Silkscreen è solo maiuscolo e largo: `T` lo rimpicciolisce un po' (DISPLAY_SCALE).
 */
export const font = {
  display: 'Silkscreen_700Bold',
  body: 'SpaceGrotesk_500Medium',
  /** Fredoka per valori e nomi sulle carte dello stile Morbido. */
  card: 'Fredoka_600SemiBold',
  bold: 'SpaceGrotesk_700Bold',
  /** Space Grotesk pieno (il più pesante che ha), maiuscolo, per le scritte dei bottoni. */
  button: 'SpaceGrotesk_700Bold',
};
export const DISPLAY_SCALE = 0.8;
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
