/**
 * Forme dello stile Morbido (approvato da Luca il 20/11/2026): semi, mostrini, Briscola e costumi
 * delle figure. Ogni forma vive in un quadrato 100×100 ed è una lista di parti: le forme piene hanno
 * il contorno scuro morbido, i dettagli (occhi, bocche, guance) no. Le disegna Parts in draw.tsx.
 * Originali in design: scratchpad mostrini.html, pubblicato su claude.ai.
 */

export const INK = '#2A2D34';
export const PAL = { paper: '#FFFFFF', red: '#E5484D', black: '#2A2D34', gold: '#F5B83D', blue: '#3E7BD6', green: '#3FA66B', brown: '#B5773F', cheek: '#F2878A' };

export interface Part {
  d?: string;
  fill?: string;
  /** Dettaglio senza contorno: riempito, oppure solo tratto se ha `stroke`. */
  detail?: boolean;
  stroke?: string;
  w?: number;
  op?: number;
  /** Gruppo spostato, scalato e ruotato attorno al centro del suo quadrato. */
  group?: Part[];
  x?: number;
  y?: number;
  s?: number;
  r?: number;
}

export const circ = (cx: number, cy: number, r: number) => `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
export const ell = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
/** Schiarisce (f > 1) o scurisce (f < 1) un colore. */
export function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1)))));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

// ---------- semi ----------
export const HEART = 'M50 88 C22 68 8 52 10 34 C12 18 26 10 38 12 C44 13 48 17 50 22 C52 17 56 13 62 12 C74 10 88 18 90 34 C92 52 78 68 50 88 Z';
export const DIAMOND = 'M50 6 Q56 6 60 12 L82 44 Q86 50 82 56 L60 88 Q56 94 50 94 Q44 94 40 88 L18 56 Q14 50 18 44 L40 12 Q44 6 50 6 Z';
export const SPADE = 'M50 6 C40 24 12 38 12 58 C12 72 24 80 36 78 C42 77 46 74 48 70 C47 80 43 88 36 94 H64 C57 88 53 80 52 70 C54 74 58 77 64 78 C76 80 88 72 88 58 C88 38 60 24 50 6 Z';
export const CLUB = 'M50 8 C61 8 69 17 69 28 C69 33 67 37 64 40 C67 38 70 37 73 37 C84 37 92 46 92 57 C92 68 84 76 73 76 C64 76 57 71 55 63 C56 76 60 86 66 93 H34 C40 86 44 76 45 63 C43 71 36 76 27 76 C16 76 8 68 8 57 C8 46 16 37 27 37 C30 37 33 38 36 40 C33 37 31 33 31 28 C31 17 39 8 50 8 Z';

/** Semi francesi coi codici del motore: h cuori, d quadri, c fiori, s picche. */
export const frColor = (s: string) => (s === 'h' || s === 'd' ? PAL.red : PAL.black);
export const frSuit = (s: string): Part[] => [{ d: ({ h: HEART, d: DIAMOND, s: SPADE, c: CLUB } as Record<string, string>)[s], fill: frColor(s) }];

/** Semi napoletani: d denari, c coppe, s spade, b bastoni. */
export function itSuit(s: string): Part[] {
  switch (s) {
    case 'd':
      return [{ d: circ(50, 50, 40), fill: PAL.gold }, { d: circ(50, 50, 26), fill: shade(PAL.gold, 1.35) }, { d: circ(50, 50, 12), fill: PAL.red }];
    case 'c':
      return [
        { d: 'M28 93 C28 83 39 78 50 78 C61 78 72 83 72 93 Z', fill: PAL.gold }, { d: 'M45 58 H55 V80 H45 Z', fill: PAL.gold }, { d: circ(50, 69, 7), fill: PAL.red },
        { d: 'M20 12 H80 C80 44 68 59 50 62 C32 59 20 44 20 12 Z', fill: PAL.gold }, { d: 'M21.5 22 H78.5 C78 26 77.4 29.5 76.5 32 H23.5 C22.6 29.5 22 26 21.5 22 Z', fill: PAL.red },
      ];
    case 's':
      return [{ d: 'M43 66 V16 L50 3 L57 16 V66 Z', fill: PAL.blue }, { d: 'M28 62 H72 Q72 72 64 72 H36 Q28 72 28 62 Z', fill: PAL.gold }, { d: 'M45 72 H55 V87 H45 Z', fill: PAL.red }, { d: circ(50, 91, 6.5), fill: PAL.gold }];
    default: {
      const knot = shade(PAL.brown, 0.65);
      return [
        { d: 'M60 34 C66 24 76 23 81 27 C76 35 68 38 60 34 Z', fill: PAL.green }, { d: 'M42 96 L36 34 C33 13 40 4 50 4 C60 4 67 13 64 34 L58 96 Z', fill: PAL.brown },
        { d: circ(47, 22, 3.4), fill: knot, detail: true }, { d: circ(54, 46, 3.4), fill: knot, detail: true }, { d: circ(48, 72, 3), fill: knot, detail: true },
      ];
    }
  }
}
export const itMain = (s: string) => ({ d: PAL.gold, c: PAL.red, s: PAL.blue, b: PAL.green } as Record<string, string>)[s];
/** I bastoni stanno inclinati, come nelle napoletane. */
export const itTilt = (s: string) => (s === 'b' ? -18 : 0);

// ---------- tratti del viso ----------
const E = (x: number, y: number, r = 2.8): Part[] => [{ d: circ(x, y, r), fill: INK, detail: true }, { d: circ(x + r * 0.38, y - r * 0.38, r * 0.34), fill: '#FFFFFF', detail: true }];
const CH = (x: number, y: number, r = 4.2): Part[] => [{ d: circ(x, y, r), fill: PAL.cheek, detail: true, op: 0.5 }];
const SM = (x: number, y: number, w = 5, c = INK): Part => ({ d: `M${x - w} ${y} Q${x} ${y + w * 0.8} ${x + w} ${y}`, stroke: c, w: 1.2, detail: true });

// ---------- i mostrini ----------
export interface Mostrino {
  /** Il colore del mostrino: fondo dell'avatar e corpo. */
  tone: string;
  /** Dove poggia la corona (in alto sulla testa). */
  top: number;
  parts: Part[];
}

const m = (tone: string, top: number, parts: (t: string) => Part[]): Mostrino => ({ tone, top, parts: parts(tone) });

export const MOSTRINI: Record<string, Mostrino> = {
  bobo: m('#3E7BD6', 27, (t) => [{ d: 'M22 72 C18 46 30 27 50 27 C70 27 82 46 78 72 C76 86 62 90 50 90 C38 90 24 86 22 72 Z', fill: t }, { d: circ(50, 52, 11), fill: '#FFFFFF' }, ...E(51, 53, 5), SM(50, 70, 6), ...CH(32, 66), ...CH(68, 66)]),
  zuzu: m('#F28BB0', 24, (t) => [{ d: 'M50 28 V12', stroke: INK, w: 2, detail: true }, { d: circ(50, 10, 4.5), fill: PAL.gold }, { d: 'M28 90 C24 60 30 26 50 26 C70 26 76 60 72 90 Z', fill: t }, ...E(42, 50), ...E(58, 50), { d: 'M44 60 Q50 68 56 60 Z', fill: '#FFFFFF' }, ...CH(35, 57), ...CH(65, 57)]),
  gnaf: m('#3FA66B', 34, (t) => [{ d: 'M30 40 L24 18 L42 32 Z', fill: '#FFF4E6' }, { d: 'M70 40 L76 18 L58 32 Z', fill: '#FFF4E6' }, { d: ell(50, 62, 32, 26), fill: t }, ...E(40, 56), ...E(60, 56), { d: 'M38 44 L46 48 M62 44 L54 48', stroke: INK, w: 1.6, detail: true }, { d: 'M42 70 Q50 66 58 70', stroke: INK, w: 1.3, detail: true }, { d: 'M45 69 L46 73 L48 69 Z', fill: '#FFFFFF' }]),
  pim: m('#F5B83D', 30, (t) => [{ d: 'M50 22 C60 34 80 62 78 76 C76 88 64 92 50 92 C36 92 24 88 22 76 C20 62 40 34 50 22 Z', fill: t }, ...E(42, 64), ...E(58, 64), SM(50, 73, 4), ...CH(36, 71), ...CH(64, 71)]),
  lola: m('#9C7BD1', 30, (t) => [
    ...[[34, 40, 12], [50, 33, 13], [66, 40, 12]].map(([x, y, r]) => ({ d: circ(x, y, r), fill: t })),
    { d: 'M22 74 C20 52 30 40 50 40 C70 40 80 52 78 74 C76 86 62 90 50 90 C38 90 24 86 22 74 Z', fill: t },
    { d: 'M38 58 Q42 54 46 58', stroke: INK, w: 1.5, detail: true }, { d: 'M54 58 Q58 54 62 58', stroke: INK, w: 1.5, detail: true }, SM(50, 68, 4), ...CH(35, 66), ...CH(65, 66),
  ]),
  tic: m('#F08A3C', 30, (t) => [{ d: 'M24 36 Q24 30 30 30 H70 Q76 30 76 36 V84 Q76 90 70 90 H30 Q24 90 24 84 Z', fill: t }, { d: 'M24 44 H76', stroke: shade(t, 0.75), w: 1.6, detail: true }, ...E(41, 58), ...E(59, 58), { d: 'M44 70 H56', stroke: INK, w: 1.4, detail: true }, { d: 'M47 70 H50 V74 H47 Z', fill: '#FFFFFF' }]),
  ugo: m('#B5773F', 30, (t) => [
    { d: 'M24 86 L20 74 L24 66 L18 56 L26 50 L22 40 L32 38 L32 28 L42 32 L50 24 L58 32 L68 28 L68 38 L78 40 L74 50 L82 56 L76 66 L80 74 L76 86 Z', fill: t },
    { d: 'M30 50 C34 40 66 40 70 50 C64 46 36 46 30 50 Z', fill: shade(t, 0.72), detail: true }, ...E(42, 58), ...E(58, 58), { d: ell(50, 68, 5, 3.4), fill: '#F28B9B', detail: true }, ...CH(34, 64), ...CH(66, 64),
  ]),
  mimi: m('#F4F1EA', 26, (t) => [{ d: 'M24 88 V52 C24 34 36 26 50 26 C64 26 76 34 76 52 V88 L67 82 L59 88 L50 82 L41 88 L33 82 Z', fill: t }, ...E(42, 52), ...E(58, 52), { d: ell(50, 63, 3.5, 4.5), fill: INK, detail: true }, ...CH(34, 59), ...CH(66, 59)]),
  trio: m('#2FB3A3', 28, (t) => [
    { d: 'M22 70 C20 44 32 28 50 28 C68 28 80 44 78 70 C76 84 64 88 50 88 C36 88 24 84 22 70 Z', fill: t },
    ...[[38, 52], [50, 46], [62, 52]].flatMap(([x, y]) => [{ d: circ(x, y, 6.2), fill: '#FFFFFF' }, ...E(x + 0.5, y + 0.5, 3)]),
    { d: 'M42 68 Q50 74 58 68', stroke: INK, w: 1.3, detail: true },
  ]),
  lulu: m('#E5484D', 30, (t) => [
    { d: 'M38 34 L32 22', stroke: INK, w: 2, detail: true }, { d: 'M62 34 L68 22', stroke: INK, w: 2, detail: true }, { d: circ(31, 20, 3.5), fill: INK }, { d: circ(69, 20, 3.5), fill: INK },
    { d: ell(50, 62, 30, 28), fill: t }, ...[[30, 52, 4.5], [70, 52, 4.5], [34, 74, 4], [66, 74, 4], [50, 82, 3.5]].map(([x, y, r]) => ({ d: circ(x, y, r), fill: INK, detail: true })),
    { d: ell(50, 60, 14, 12), fill: '#FFF4E6' }, ...E(45, 58, 2.4), ...E(55, 58, 2.4), SM(50, 64, 3),
  ]),
  fio: m('#FF8A65', 30, (t) => [
    { d: 'M50 16 C54 30 66 30 64 44 C70 40 72 34 70 28 C82 40 84 60 78 72 C72 86 62 90 50 90 C38 90 28 86 22 72 C16 58 22 44 30 38 C30 46 34 50 38 50 C34 36 42 26 50 16 Z', fill: t },
    { d: 'M50 54 C56 60 62 66 60 76 C58 84 42 84 40 76 C38 66 44 60 50 54 Z', fill: '#FFD24A', detail: true }, ...E(42, 60), ...E(58, 60), { d: 'M45 68 Q50 72 55 68', stroke: INK, w: 1.2, detail: true },
  ]),
  bolla: m('#9AD0F5', 26, (t) => [{ d: circ(50, 58, 31), fill: t }, { d: 'M30 46 Q34 34 46 30', stroke: '#FFFFFF', w: 3, detail: true }, { d: circ(66, 40, 3), fill: '#FFFFFF', detail: true }, ...E(42, 58), ...E(58, 58), { d: ell(50, 68, 4, 2.6), fill: INK, detail: true }, ...CH(34, 65), ...CH(66, 65)]),
};

/** Briscola, la gatta di casa: seduta, con la coda attorno. È la mascotte e il Jolly. */
export const CAT: Part[] = (() => {
  const o = '#F0A04B';
  const d = '#C9762B';
  return [
    { d: 'M70 102 C88 102 97 86 91 72 C89 69 85 70 86 74 C89 84 82 93 70 93 Z', fill: o },
    { d: 'M24 106 C22 82 32 66 50 66 C68 66 78 82 76 106 Z', fill: o }, { d: 'M40 106 C40 88 44 80 50 80 C56 80 60 88 60 106 Z', fill: '#FFF4E6' },
    { d: 'M28 40 L30 13 L47 27 Z', fill: o }, { d: 'M72 40 L70 13 L53 27 Z', fill: o },
    { d: 'M32 33 L33 20 L41 27 Z', fill: '#F6B5B5', detail: true }, { d: 'M68 33 L67 20 L59 27 Z', fill: '#F6B5B5', detail: true },
    { d: circ(50, 46, 23), fill: o },
    { d: 'M44 24 L45 31 M50 23 V31 M56 24 L55 31', stroke: d, w: 2, detail: true },
    { d: 'M38 57 C38 50 62 50 62 57 C62 64 55 66 50 63 C45 66 38 64 38 57 Z', fill: '#FFF4E6' },
    { d: 'M47 54 H53 L50 58 Z', fill: '#F28B8B', detail: true },
    { d: 'M39 46 Q42 43 45 46', stroke: INK, w: 1.6, detail: true }, { d: 'M55 46 Q58 43 61 46', stroke: INK, w: 1.6, detail: true },
    { d: 'M50 58 V61 M46 62 Q50 64 50 61 Q50 64 54 62', stroke: INK, w: 1.1, detail: true },
    { d: 'M36 57 L22 54 M36 60 L23 62 M64 57 L78 54 M64 60 L77 62', stroke: INK, w: 1, detail: true },
    { d: circ(34, 54, 3.6), fill: PAL.cheek, detail: true, op: 0.5 }, { d: circ(66, 54, 3.6), fill: PAL.cheek, detail: true, op: 0.5 },
  ];
})();

// ---------- costumi delle figure ----------
const mitt = (x: number, y: number, skin: string): Part => ({ d: `M${x - 6} ${y} C${x - 6} ${y - 6} ${x + 6} ${y - 6} ${x + 6} ${y} C${x + 6} ${y + 6} ${x - 6} ${y + 6} ${x - 6} ${y} Z`, fill: skin });
const scepter = (skin: string, suit: Part[]): Part[] => [{ d: 'M72.5 66 H76.5 V112 H72.5 Z', fill: PAL.gold }, { group: suit, x: 64, y: 47, s: 0.21 }, mitt(74.5, 94, skin)];
const flower = (skin: string, suit: Part[]): Part[] => [{ d: 'M72 112 C72 100 74 92 72 82', stroke: '#3F8F55', w: 2.4, detail: true }, { d: 'M72 96 C78 90 84 92 85 95 C80 99 76 99 72 96 Z', fill: '#5DBB76' }, { group: suit, x: 62, y: 63, s: 0.2 }, mitt(72, 100, skin)];
const shield = (col: string, suit: Part[]): Part[] => [{ d: 'M12 82 H40 V94 C40 104 32 110 26 112 C20 110 12 104 12 94 Z', fill: '#FFFFFF' }, { d: 'M12 82 H40 V86 H12 Z', fill: col }, { group: suit, x: 18.5, y: 88, s: 0.15 }];
const holds = (skin: string, suit: Part[], at = { x: 60, y: 66, s: 0.26 }): Part[] => [{ group: suit, ...at }, mitt(73, 96, skin)];
const HORSE = (col: string): Part[] => [
  { d: 'M66 20 C80 26 90 44 90 64 L92 112 L84 112 L82 62 C82 44 76 28 66 20 Z', fill: col },
  { d: 'M70 112 L66 62 C60 56 52 52 40 54 C30 56 22 58 16 54 C10 50 10 40 16 34 C24 26 36 20 48 18 L50 7 L58 16 L64 7 L66 20 C76 28 82 44 82 62 L84 112 Z', fill: PAL.brown },
  { d: 'M9 46 C9 38 17 33 25 35 C31 37 34 45 32 51 C30 58 20 60 14 56 C10.5 54 9 50 9 46 Z', fill: shade(PAL.brown, 1.5) },
  { d: 'M38 23 C42 21 46 23 44 29 L31 41 C28 36 33 28 38 23 Z', fill: '#FFFFFF', detail: true, op: 0.85 },
  { d: 'M27 36 L52 47 M50 29 V54', stroke: col, w: 2.6, detail: true },
  { d: circ(47, 32, 3.6), fill: INK, detail: true }, { d: circ(48.2, 30.8, 1.2), fill: '#FFFFFF', detail: true },
  { d: circ(15, 45.5, 1.9), fill: INK, detail: true }, { d: 'M13 53.5 Q19 57 26 53.5', stroke: INK, w: 1.1, detail: true },
];
const crownAt = (top: number): Part[] => [{ group: [{ d: 'M30 33 L28 12 L39 22 L50 8 L61 22 L72 12 L70 33 Z', fill: PAL.gold }, { d: 'M30 28 H70 V33 H30 Z', fill: shade(PAL.gold, 0.85) }, { d: circ(50, 22, 2.6), fill: PAL.red, detail: true }], x: 20, y: top - 22, s: 0.6 }];
const tiaraAt = (top: number): Part[] => [{ group: [{ d: 'M36 31 L39 18 L44 24 L50 14 L56 24 L61 18 L64 31 Z', fill: PAL.gold }, { d: circ(50, 25, 2), fill: PAL.red, detail: true }], x: 18, y: top - 19.6, s: 0.64 }];
const capAt = (top: number): Part[] => [{ group: [{ d: 'M67 26 C77 11 89 7 95 9 C89 19 81 27 71 32 Z', fill: PAL.gold }, { d: 'M30 35 C30 21 40 16 52 17 C64 18 72 24 72 35 Z', fill: '#FFFFFF' }, { d: 'M30 31 H72 V35 H30 Z', fill: PAL.red }], x: 12, y: top - 27, s: 0.76 }];
const mantle = (col: string): Part[] => [{ d: 'M14 106 C16 90 30 86 50 88 C70 86 84 90 86 106 Z', fill: col }, { d: 'M24 96 C34 90 44 92 50 94 C56 92 66 90 76 96 C66 100 56 99 50 100 C44 99 34 100 24 96 Z', fill: '#FFFFFF' }];

export type Role = 'K' | 'Q' | 'J' | 'H';

/** Chi interpreta ogni figura (scelte nella pagina dei mostrini). */
export const FIGURES: Record<'fr' | 'it', Record<string, Record<string, string>>> = {
  fr: { K: { h: 'bobo', d: 'gnaf', c: 'tic', s: 'ugo' }, Q: { h: 'lulu', d: 'pim', c: 'lola', s: 'zuzu' }, J: { h: 'fio', d: 'bolla', c: 'trio', s: 'mimi' } },
  it: { K: { d: 'gnaf', c: 'bobo', s: 'tic', b: 'ugo' }, H: { d: 'pim', c: 'lulu', s: 'zuzu', b: 'lola' }, J: { d: 'bolla', c: 'fio', s: 'trio', b: 'mimi' } },
};

/** Il mostrino vestito da figura, col suo seme in mano. */
export function figureParts(deck: 'fr' | 'it', suit: string, role: Role): Part[] {
  const id = FIGURES[deck][role]?.[suit] ?? 'bobo';
  const c = MOSTRINI[id];
  const pip = deck === 'it' ? itSuit(suit) : frSuit(suit);
  const col = deck === 'it' ? itMain(suit) : suit === 'h' || suit === 'd' ? PAL.red : PAL.blue;
  if (role === 'K') return [...mantle(col), ...c.parts, ...crownAt(c.top), ...(deck === 'it' ? holds(c.tone, pip) : scepter(c.tone, pip))];
  if (role === 'Q') return [...c.parts, ...tiaraAt(c.top), ...flower(c.tone, pip)];
  if (role === 'J') return [...c.parts, ...capAt(c.top), ...(deck === 'it' ? holds(c.tone, pip) : shield(col, pip))];
  return [{ group: [...c.parts, ...capAt(c.top), ...holds(c.tone, pip, { x: 62, y: 70, s: 0.2 })], x: 17, y: 4, s: 0.84 }, { group: HORSE(col), x: -8, y: 38, s: 0.62 }];
}
/** Colore della finestra della figura: tinta chiara del seme. */
export const figureTint = (deck: 'fr' | 'it', suit: string) => (deck === 'it' ? shade(itMain(suit), 1.8) : shade(suit === 'h' || suit === 'd' ? PAL.red : '#8A93A6', 1.82));
