import type { Card } from './cards';

/** Regole delle combinazioni (scale e tris) per la famiglia del ramino: scala 40, burraco, machiavelli. */
export interface MeldRules {
  isWild(c: Card): boolean;
  /** Quante matte al massimo per combinazione. */
  maxWild: number;
  /** Tris: carte dello stesso valore di semi tutti diversi (scala 40, machiavelli) o semi liberi (burraco). */
  setDistinctSuits: boolean;
  setMax: number;
  /** Un 2 dello stesso seme può stare al suo posto naturale in scala (le pinelle del burraco). */
  wildCanBeNatural?(c: Card): boolean;
}

export interface Meld {
  kind: 'set' | 'run';
  /** Carte in ordine di esposizione. */
  cards: Card[];
  /** Valore rappresentato da ogni carta (1..14, 14 = asso alto), utile per le matte. */
  ranks: number[];
}

export const NO_WILD: MeldRules = { isWild: () => false, maxWild: 0, setDistinctSuits: true, setMax: 4 };

function checkSet(naturals: Card[], wilds: Card[], rules: MeldRules): Meld | null {
  if (!naturals.length) return null;
  const rank = naturals[0].rank;
  if (naturals.some((c) => c.rank !== rank)) return null;
  if (rules.setDistinctSuits && new Set(naturals.map((c) => c.suit)).size !== naturals.length) return null;
  const n = naturals.length + wilds.length;
  if (n < 3 || n > rules.setMax) return null;
  const cards = [...naturals, ...wilds];
  return { kind: 'set', cards, ranks: cards.map(() => rank) };
}

function checkRun(naturals: Card[], wilds: Card[]): Meld | null {
  if (!naturals.length) return null;
  const suit = naturals[0].suit;
  if (naturals.some((c) => c.suit !== suit)) return null;
  const total = naturals.length + wilds.length;
  if (total < 3) return null;
  for (const aceHigh of [false, true]) {
    const placed = naturals.map((c) => ({ c, r: c.rank === 1 && aceHigh ? 14 : c.rank })).sort((a, b) => a.r - b.r);
    if (new Set(placed.map((p) => p.r)).size !== placed.length) continue;
    const lo = placed[0].r;
    const hi = placed[placed.length - 1].r;
    const gaps = hi - lo + 1 - placed.length;
    if (gaps > wilds.length) continue;
    const extra = wilds.length - gaps;
    const maxRank = aceHigh ? 14 : 13;
    // Le matte avanzate vanno in cima se c'è posto, altrimenti in fondo.
    const up = Math.min(extra, maxRank - hi);
    const down = extra - up;
    if (lo - down < 1) continue;
    const start = lo - down;
    const end = hi + up;
    const free = [...wilds];
    const cards: Card[] = [];
    const ranks: number[] = [];
    for (let r = start; r <= end; r++) {
      const nat = placed.find((p) => p.r === r);
      cards.push(nat ? nat.c : free.pop()!);
      ranks.push(r);
    }
    return { kind: 'run', cards, ranks };
  }
  return null;
}

/** Controlla se le carte formano una combinazione valida; restituisce la combinazione ordinata. */
export function checkMeld(cards: Card[], rules: MeldRules): Meld | null {
  if (cards.length < 3) return null;
  const wildIdx = cards.flatMap((c, i) => (rules.isWild(c) ? [i] : []));
  // Proviamo prima con tutte le matte come matte, poi lasciando "naturali" quelle che possono esserlo (pinelle).
  const variants: number[][] = [wildIdx];
  if (rules.wildCanBeNatural) for (const i of wildIdx) if (rules.wildCanBeNatural(cards[i])) variants.push(wildIdx.filter((j) => j !== i));
  for (const asWild of variants) {
    const wilds = asWild.map((i) => cards[i]);
    const naturals = cards.filter((_, i) => !asWild.includes(i));
    if (wilds.length > rules.maxWild) continue;
    if (wilds.length >= naturals.length) continue;
    const meld = checkRun(naturals, wilds) ?? checkSet(naturals, wilds, rules);
    if (meld) return meld;
  }
  return null;
}

/** Punti di una carta come la conta la scala 40 quando apre (asso 11 nei tris e in alto, 1 in basso). */
export function scala40Value(rank: number): number {
  if (rank === 1) return 1;
  if (rank === 14) return 11;
  return Math.min(rank, 10);
}

export function meldPoints40(meld: Meld): number {
  if (meld.kind === 'set') return meld.ranks.reduce((t, r) => t + (r === 1 ? 11 : Math.min(r, 10)), 0);
  return meld.ranks.reduce((t, r) => t + scala40Value(r), 0);
}

/**
 * Trova combinazioni nella mano (per i computer): candidati semplici e poi la scelta di gruppi
 * disgiunti che massimizza il punteggio.
 */
export function findMelds(hand: Card[], rules: MeldRules, score: (m: Meld) => number = (m) => m.cards.length): Meld[] {
  const wilds = hand.filter((c) => rules.isWild(c));
  const naturals = hand.filter((c) => !rules.isWild(c));
  const candidates: Meld[] = [];
  const tryAdd = (cards: Card[]) => {
    const m = checkMeld(cards, rules);
    if (m) candidates.push(m);
  };
  // Tris
  const byRank = new Map<number, Card[]>();
  for (const c of naturals) byRank.set(c.rank, [...(byRank.get(c.rank) ?? []), c]);
  for (const group of byRank.values()) {
    const pool = rules.setDistinctSuits ? [...new Map(group.map((c) => [c.suit, c])).values()] : group;
    if (pool.length >= 3) tryAdd(pool.slice(0, rules.setMax));
    if (pool.length === 4) for (let i = 0; i < 4; i++) tryAdd(pool.filter((_, j) => j !== i));
    if (pool.length >= 2 && wilds.length) tryAdd([...pool.slice(0, Math.min(pool.length, rules.setMax - 1)), wilds[0]]);
  }
  // Scale
  const bySuit = new Map<string, Card[]>();
  for (const c of naturals) bySuit.set(c.suit, [...(bySuit.get(c.suit) ?? []), c]);
  for (const group of bySuit.values()) {
    for (const aceHigh of [false, true]) {
      const ranked = new Map<number, Card>();
      for (const c of group) ranked.set(c.rank === 1 && aceHigh ? 14 : c.rank, c);
      const keys = [...ranked.keys()].sort((a, b) => a - b);
      for (let i = 0; i < keys.length; i++) {
        const run: Card[] = [ranked.get(keys[i])!];
        let usedWild = false;
        for (let r = keys[i] + 1; r <= 14; r++) {
          if (ranked.has(r)) {
            run.push(ranked.get(r)!);
          } else if (!usedWild && wilds.length && ranked.has(r + 1)) {
            run.push(wilds[0]);
            usedWild = true;
          } else break;
          if (run.length >= 3) tryAdd([...run]);
        }
        if (run.length === 2 && wilds.length) tryAdd([...run, wilds[0]]);
      }
    }
  }
  // Scelta dei gruppi senza carte in comune.
  candidates.sort((a, b) => score(b) - score(a));
  let best: Meld[] = [];
  let bestScore = 0;
  let budget = 20000;
  const walk = (i: number, used: Set<string>, chosen: Meld[], total: number) => {
    if (--budget < 0) return;
    if (total > bestScore) {
      bestScore = total;
      best = [...chosen];
    }
    for (let j = i; j < Math.min(candidates.length, 40); j++) {
      const m = candidates[j];
      if (m.cards.some((c) => used.has(c.id))) continue;
      m.cards.forEach((c) => used.add(c.id));
      chosen.push(m);
      walk(j + 1, used, chosen, total + score(m));
      chosen.pop();
      m.cards.forEach((c) => used.delete(c.id));
    }
  };
  walk(0, new Set(), [], 0);
  return best;
}
