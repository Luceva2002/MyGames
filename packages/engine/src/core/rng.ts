/**
 * Generatore pseudo-casuale deterministico (mulberry32) il cui stato vive dentro lo stato di gioco,
 * così server e client ottengono lo stesso risultato dalla stessa partita.
 */
export interface HasRng {
  rng: number;
}

export function random(s: HasRng): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomInt(s: HasRng, maxExclusive: number): number {
  return Math.floor(random(s) * maxExclusive);
}

export function shuffle<T>(s: HasRng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(s, i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function pick<T>(s: HasRng, items: readonly T[]): T {
  return items[randomInt(s, items.length)];
}

export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
