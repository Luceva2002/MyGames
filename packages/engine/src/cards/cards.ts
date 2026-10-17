import { shuffle, type HasRng } from '../core/rng';

/**
 * Un solo formato di carta per tutti i mazzi.
 * - napoletane: suit d/c/s/b (denari, coppe, spade, bastoni), rank 1..10 (8 fante, 9 cavallo, 10 re)
 * - francesi: suit h/d/c/s (cuori, quadri, fiori, picche), rank 1..13; jolly con suit 'j' e rank 0
 * - uno: suit r/g/b/y o 'w' per le carte jolly, rank 0..9, 10 salta, 11 inverti, 12 +2, 13 cambia colore, 14 +4
 */
export type DeckKind = 'it' | 'fr' | 'uno';

export interface Card {
  /** Identificativo unico nella partita, anche con più mazzi. */
  id: string;
  deck: DeckKind;
  suit: string;
  rank: number;
}

export const IT_SUITS = ['d', 'c', 's', 'b'] as const;
export const IT_SUIT_NAMES: Record<string, string> = { d: 'denari', c: 'coppe', s: 'spade', b: 'bastoni' };
export const IT_RANK_NAMES: Record<number, string> = { 1: 'asso', 8: 'fante', 9: 'cavallo', 10: 're' };

export const FR_SUITS = ['h', 'd', 'c', 's'] as const;
export const FR_SUIT_SYMBOLS: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠', j: '★' };
export const FR_RANK_LABELS: Record<number, string> = { 0: 'J', 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

export const UNO_COLORS = ['r', 'g', 'b', 'y'] as const;
export const UNO_SKIP = 10;
export const UNO_REVERSE = 11;
export const UNO_DRAW2 = 12;
export const UNO_WILD = 13;
export const UNO_WILD4 = 14;

export function italianDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of IT_SUITS) for (let rank = 1; rank <= 10; rank++) cards.push({ id: `it-${suit}${rank}`, deck: 'it', suit, rank });
  return cards;
}

export function frenchDeck(opts: { copies?: number; jokersPerDeck?: number } = {}): Card[] {
  const copies = opts.copies ?? 1;
  const jokers = opts.jokersPerDeck ?? 0;
  const cards: Card[] = [];
  for (let copy = 0; copy < copies; copy++) {
    for (const suit of FR_SUITS) for (let rank = 1; rank <= 13; rank++) cards.push({ id: `fr${copy}-${suit}${rank}`, deck: 'fr', suit, rank });
    for (let j = 0; j < jokers; j++) cards.push({ id: `fr${copy}-j${j}`, deck: 'fr', suit: 'j', rank: 0 });
  }
  return cards;
}

export function unoDeck(): Card[] {
  const cards: Card[] = [];
  let n = 0;
  for (const suit of UNO_COLORS) {
    cards.push({ id: `uno-${n++}`, deck: 'uno', suit, rank: 0 });
    for (let rank = 1; rank <= UNO_DRAW2; rank++) {
      cards.push({ id: `uno-${n++}`, deck: 'uno', suit, rank });
      cards.push({ id: `uno-${n++}`, deck: 'uno', suit, rank });
    }
  }
  for (let i = 0; i < 4; i++) {
    cards.push({ id: `uno-${n++}`, deck: 'uno', suit: 'w', rank: UNO_WILD });
    cards.push({ id: `uno-${n++}`, deck: 'uno', suit: 'w', rank: UNO_WILD4 });
  }
  return cards;
}

export function shuffled(s: HasRng, cards: Card[]): Card[] {
  return shuffle(s, cards);
}

export function deal(deck: Card[], players: number, perPlayer: number): Card[][] {
  const hands: Card[][] = Array.from({ length: players }, () => []);
  for (let i = 0; i < perPlayer; i++) for (let p = 0; p < players; p++) {
    const card = deck.pop();
    if (card) hands[p].push(card);
  }
  return hands;
}

/** Toglie una carta dalla mano per id; restituisce la carta o undefined. */
export function takeCard(hand: Card[], id: string): Card | undefined {
  const i = hand.findIndex((c) => c.id === id);
  return i < 0 ? undefined : hand.splice(i, 1)[0];
}

export function cardName(card: Card): string {
  if (card.deck === 'it') return `${IT_RANK_NAMES[card.rank] ?? card.rank} di ${IT_SUIT_NAMES[card.suit]}`;
  if (card.deck === 'fr') return card.suit === 'j' ? 'jolly' : `${FR_RANK_LABELS[card.rank] ?? card.rank}${FR_SUIT_SYMBOLS[card.suit]}`;
  return `${card.suit}${card.rank}`;
}

