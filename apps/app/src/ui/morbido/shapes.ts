/**
 * Forme dello stile Morbido (approvato da Luca il 20/11/2026): semi, mostrini e costumi
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
  /** Testo (un numero, una lettera) centrato in (tx, ty), alto `ts`. */
  t?: string;
  tx?: number;
  ty?: number;
  ts?: number;
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
/** Le punte di Spino: quattordici, attorno a un cerchio. */
const SPIKES = (() => {
  const n = 14;
  const pts = Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 ? 24 : 34;
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    return `${(50 + Math.cos(a) * r).toFixed(1)} ${(60 + Math.sin(a) * r * 0.92).toFixed(1)}`;
  });
  return `M${pts.join(' L')} Z`;
})();


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
  // Zap, il fulmine: arrabbiato e velocissimo.
  zap: m('#FFC933', 14, (t) => [
    { d: 'M58 12 L26 56 Q24 60 28 60 H44 L36 90 Q35 94 39 91 L76 46 Q78 42 74 42 H58 L66 16 Q67 11 58 12 Z', fill: t },
    ...E(42, 50, 2.6), ...E(56, 50, 2.6), { d: 'M37 44 L46 47 M61 44 L52 47', stroke: INK, w: 1.6, detail: true }, { d: 'M42 57 Q47 61 52 57', stroke: INK, w: 1.3, detail: true },
  ]),
  // Gelo, la scheggia di ghiaccio: assonnato, batte i denti.
  gelo: m('#9ADCF7', 16, (t) => [
    { d: 'M50 14 Q53 14 55 17 L76 44 Q78 47 77 50 L66 86 Q65 90 61 90 H39 Q35 90 34 86 L23 50 Q22 47 24 44 L45 17 Q47 14 50 14 Z', fill: t },
    { d: 'M36 42 L45 29', stroke: '#FFFFFF', w: 2.6, detail: true }, ...E(42, 58), ...E(58, 58), { d: 'M37 53 Q42 51 47 53 M53 53 Q58 51 63 53', stroke: INK, w: 1.4, detail: true },
    { d: 'M42 70 L45 67 L48 70 L51 67 L54 70 L57 67', stroke: INK, w: 1.2, detail: true },
  ]),
  gnaf: m('#3FA66B', 34, (t) => [{ d: 'M30 40 L24 18 L42 32 Z', fill: '#FFF4E6' }, { d: 'M70 40 L76 18 L58 32 Z', fill: '#FFF4E6' }, { d: ell(50, 62, 32, 26), fill: t }, ...E(40, 56), ...E(60, 56), { d: 'M38 44 L46 48 M62 44 L54 48', stroke: INK, w: 1.6, detail: true }, { d: 'M42 70 Q50 66 58 70', stroke: INK, w: 1.3, detail: true }, { d: 'M45 69 L46 73 L48 69 Z', fill: '#FFFFFF' }]),
  // Rocco, il sasso: sopracciglia pesanti, una crepa in testa.
  rocco: m('#8A8F9C', 32, (t) => [
    { d: 'M18 86 C14 72 20 58 30 52 C30 40 42 32 54 34 C66 30 80 40 80 54 C88 62 88 78 82 86 Z', fill: t },
    { d: 'M62 38 L58 44 L63 48', stroke: shade(t, 0.6), w: 1.3, detail: true }, { d: 'M33 55 L48 59 M67 55 L52 59', stroke: INK, w: 2.4, detail: true },
    ...E(42, 64, 2.5), ...E(58, 64, 2.5), { d: 'M44 75 H56', stroke: INK, w: 1.5, detail: true },
  ]),
  // Spino, il riccio viola: tutto punte e una zanna.
  spino: m('#7A5CFF', 24, (t) => [{ d: SPIKES, fill: t }, ...E(42, 58), ...E(58, 58), { d: 'M43 67 Q50 72 57 67', stroke: INK, w: 1.3, detail: true }, { d: 'M47 68.5 L48.5 73 L50.5 69.5 Z', fill: '#FFFFFF', detail: true }]),
  // Ombra: occhi gialli che brillano al buio.
  ombra: m('#4B3C7A', 22, (t) => [
    { d: 'M22 90 C22 62 24 40 32 30 L36 22 L42 30 C46 28 54 28 58 30 L64 22 L68 30 C76 40 78 62 78 90 L70 82 L62 90 L56 80 L50 90 L44 80 L38 90 L30 82 Z', fill: t },
    { d: 'M34 52 L48 56 L46 61 L35 58 Z', fill: '#FFC933', detail: true }, { d: 'M66 52 L52 56 L54 61 L65 58 Z', fill: '#FFC933', detail: true },
    { d: 'M40 70 L44 73 L48 70 L52 73 L56 70 L60 73', stroke: '#FFFFFF', w: 1.3, detail: true },
  ]),
  // Otto, il polpo: occhioni e un mezzo sorriso furbo.
  otto: m('#FF4F8B', 24, (t) => [
    { d: 'M26 58 C22 72 18 80 24 86 C28 88 32 82 32 74 C34 66 36 62 36 58 Z', fill: t }, { d: 'M38 58 C36 72 36 84 42 88 C46 88 46 80 46 72 V58 Z', fill: t },
    { d: 'M54 58 V72 C54 80 54 88 58 88 C64 84 64 72 62 58 Z', fill: t }, { d: 'M64 58 C64 62 66 66 68 74 C68 82 72 88 76 86 C82 80 78 72 74 58 Z', fill: t },
    { d: 'M24 62 C24 38 36 24 50 24 C64 24 76 38 76 62 Z', fill: t }, ...E(42, 46, 3.4), ...E(58, 46, 3.4), { d: 'M44 55 Q50 58 56 53', stroke: INK, w: 1.3, detail: true },
  ]),
  // Morso: tutto bocca e denti.
  morso: m('#E5484D', 28, (t) => [
    { d: 'M20 66 C18 42 32 28 50 28 C68 28 82 42 80 66 C78 84 64 90 50 90 C36 90 22 84 20 66 Z', fill: t },
    { d: 'M28 56 Q50 52 72 56 Q70 84 50 84 Q30 84 28 56 Z', fill: INK, detail: true }, { d: ell(50, 77, 9, 4.5), fill: '#FF8FA3', detail: true },
    { d: 'M31 56 L35 63 L39 55.2 L43 63 L47 54.8 L51 63 L55 54.8 L59 63 L63 55.2 L67 62 L70 56 Z', fill: '#FFFFFF', detail: true },
    ...E(40, 43, 2.6), ...E(60, 43, 2.6), { d: 'M35 36 L45 38 M55 37 Q60 33 65 36', stroke: INK, w: 1.5, detail: true },
  ]),
  // Bit, il robottino da sala giochi: occhi a pixel sullo schermo.
  bit: m('#2EC4B6', 18, (t) => [
    { d: 'M50 32 V21', stroke: INK, w: 2, detail: true }, { d: circ(50, 18, 4.2), fill: '#FF4F8B' },
    { d: 'M18 50 H24 V64 H18 Z', fill: shade(t, 0.7) }, { d: 'M76 50 H82 V64 H76 Z', fill: shade(t, 0.7) },
    { d: 'M24 40 Q24 32 32 32 H68 Q76 32 76 40 V80 Q76 88 68 88 H32 Q24 88 24 80 Z', fill: t },
    { d: 'M34 42 H66 Q68 42 68 44 V70 Q68 72 66 72 H34 Q32 72 32 70 V44 Q32 42 34 42 Z', fill: '#17181C', detail: true },
    { d: 'M38 50 H44 V56 H38 Z M56 50 H62 V56 H56 Z', fill: '#7ED957', detail: true }, { d: 'M40 62 H44 V64 H56 V62 H60 V66 H40 Z', fill: '#7ED957', detail: true },
  ]),
  // Dado: i pallini agli angoli e l'occhiolino.
  dado: m('#F4F1E8', 26, (t) => [
    { d: 'M24 34 Q24 26 32 26 H68 Q76 26 76 34 V82 Q76 90 68 90 H32 Q24 90 24 82 Z', fill: t },
    ...[[33, 35], [67, 35], [33, 81], [67, 81]].map(([x, y]) => ({ d: circ(x, y, 3.4), fill: '#E5484D', detail: true })),
    ...E(42, 56), { d: 'M54 56 Q58 53 62 56', stroke: INK, w: 1.5, detail: true }, { d: 'M42 66 Q50 74 58 66', stroke: INK, w: 1.3, detail: true },
  ]),
  fio: m('#FF8A65', 30, (t) => [
    { d: 'M50 16 C54 30 66 30 64 44 C70 40 72 34 70 28 C82 40 84 60 78 72 C72 86 62 90 50 90 C38 90 28 86 22 72 C16 58 22 44 30 38 C30 46 34 50 38 50 C34 36 42 26 50 16 Z', fill: t },
    { d: 'M50 54 C56 60 62 66 60 76 C58 84 42 84 40 76 C38 66 44 60 50 54 Z', fill: '#FFD24A', detail: true }, ...E(42, 60), ...E(58, 60), { d: 'M45 68 Q50 72 55 68', stroke: INK, w: 1.2, detail: true },
  ]),
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
  fr: { K: { h: 'bobo', d: 'gnaf', c: 'bit', s: 'rocco' }, Q: { h: 'otto', d: 'gelo', c: 'dado', s: 'zap' }, J: { h: 'fio', d: 'spino', c: 'ombra', s: 'morso' } },
  it: { K: { d: 'gnaf', c: 'bobo', s: 'bit', b: 'rocco' }, H: { d: 'gelo', c: 'otto', s: 'zap', b: 'dado' }, J: { d: 'spino', c: 'fio', s: 'ombra', b: 'morso' } },
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
