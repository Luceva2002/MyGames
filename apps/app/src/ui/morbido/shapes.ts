/**
 * Forme delle carte (stile Morbido, approvato da Luca il 20/11/2026): semi, mostrini e costumi delle figure.
 * Ogni forma vive in un quadrato 100×100 ed è una lista di parti: le forme piene hanno il contorno scuro,
 * i dettagli no; i mostrini sono le loro immagini (assets/mostrini). Le disegna drawParts in draw.tsx.
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
  /** Testo (un numero, una lettera) centrato in (tx, ty), alto `ts`. */
  t?: string;
  tx?: number;
  ty?: number;
  ts?: number;
  /** Immagine di un mostrino (per id), messa in (x, y) con lato `s`. */
  img?: string;
}

export const circ = (cx: number, cy: number, r: number) => `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
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

// ---------- i mostrini ----------
export interface Mostrino {
  /** Il colore del fondo della sua tessera: fondo dell'avatar e colore delle mani nei costumi. */
  tone: string;
  /** Dove comincia la testa (in alto), per la corona e i cappelli delle figure. */
  top: number;
  /** Il centro della testa in orizzontale (non sempre al centro del disegno). */
  hx: number;
  parts: Part[];
}

/**
 * I dieci mostrini del 22/11/2026, uno per elemento, scelti da Luca come immagine (assets/mostrini):
 * stanno nel riquadro 10..90 del quadrato 100×100, coi piedi in basso.
 */
const m = (id: string, tone: string, top: number, hx = 50): Mostrino => ({ tone, top, hx, parts: [{ img: id, x: 10, y: 12, s: 80 }] });

export const MOSTRINI: Record<string, Mostrino> = {
  bobo: m('bobo', '#56B1E0', 36, 59), // acqua
  otto: m('otto', '#E592A7', 34), // inchiostro
  zap: m('zap', '#F2BD4D', 33, 64), // fulmine
  gelo: m('gelo', '#8CD3EE', 44), // ghiaccio
  gnaf: m('gnaf', '#4FA663', 36), // terra
  ombra: m('ombra', '#7660A7', 31), // buio
  bit: m('bit', '#3AC3B9', 38), // elettronica
  dado: m('dado', '#F7F2DF', 46), // fortuna
  morso: m('morso', '#DB3A45', 34, 57), // pianta carnivora
  fio: m('fio', '#F07F3B', 46), // fuoco
};

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
  fr: { K: { h: 'bobo', d: 'gnaf', c: 'bit', s: 'ombra' }, Q: { h: 'otto', d: 'gelo', c: 'dado', s: 'zap' }, J: { h: 'fio', d: 'morso', c: 'otto', s: 'gelo' } },
  it: { K: { d: 'gnaf', c: 'bobo', s: 'bit', b: 'ombra' }, H: { d: 'gelo', c: 'otto', s: 'zap', b: 'dado' }, J: { d: 'zap', c: 'fio', s: 'ombra', b: 'morso' } },
};

/** Il mostrino vestito da figura, col suo seme in mano. */
export function figureParts(deck: 'fr' | 'it', suit: string, role: Role): Part[] {
  const id = FIGURES[deck][role]?.[suit] ?? 'bobo';
  const c = MOSTRINI[id];
  const pip = deck === 'it' ? itSuit(suit) : frSuit(suit);
  const col = deck === 'it' ? itMain(suit) : suit === 'h' || suit === 'd' ? PAL.red : PAL.blue;
  // Corona e cappelli vanno sul centro della testa di ognuno.
  const on = (p: Part[]): Part => ({ group: p, x: c.hx - 50 });
  if (role === 'K') return [...mantle(col), ...c.parts, on(crownAt(c.top)), ...(deck === 'it' ? holds(c.tone, pip) : scepter(c.tone, pip))];
  if (role === 'Q') return [...c.parts, on(tiaraAt(c.top)), ...flower(c.tone, pip)];
  if (role === 'J') return [...c.parts, on(capAt(c.top)), ...(deck === 'it' ? holds(c.tone, pip) : shield(col, pip))];
  return [{ group: [...c.parts, on(capAt(c.top)), ...holds(c.tone, pip, { x: 62, y: 70, s: 0.2 })], x: 17, y: 4, s: 0.84 }, { group: HORSE(col), x: -8, y: 38, s: 0.62 }];
}
/** Colore della finestra della figura: tinta chiara del seme. */
export const figureTint = (deck: 'fr' | 'it', suit: string) => (deck === 'it' ? shade(itMain(suit), 1.8) : shade(suit === 'h' || suit === 'd' ? PAL.red : '#8A93A6', 1.82));
