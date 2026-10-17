import type { Seat } from '../core/types';
import type { Card } from './cards';

/** Squadre: in quattro giocano 0+2 contro 1+3, altrimenti ognuno per sé. */
export function teamOf(seat: Seat, players: number): number {
  return players === 4 ? seat % 2 : seat;
}

export function teamCount(players: number): number {
  return players === 4 ? 2 : players;
}

export function teamSeats(team: number, players: number): Seat[] {
  return Array.from({ length: players }, (_, s) => s).filter((s) => teamOf(s, players) === team);
}

/** Valore di primiera di una carta. */
export const PRIMIERA: Record<number, number> = { 7: 21, 6: 18, 1: 16, 5: 15, 4: 14, 3: 13, 2: 12, 8: 10, 9: 10, 10: 10 };

export function primieraScore(cards: Card[]): number {
  let total = 0;
  for (const suit of ['d', 'c', 's', 'b']) {
    const best = Math.max(0, ...cards.filter((c) => c.suit === suit).map((c) => PRIMIERA[c.rank]));
    total += best;
  }
  return total;
}

/** Ordine di presa di briscola: asso, tre, re, cavallo, fante, 7..2. */
export const BRISCOLA_STRENGTH: Record<number, number> = { 1: 10, 3: 9, 10: 8, 9: 7, 8: 6, 7: 5, 6: 4, 5: 3, 4: 2, 2: 1 };
export const BRISCOLA_POINTS: Record<number, number> = { 1: 11, 3: 10, 10: 4, 9: 3, 8: 2 };

/** Ordine di presa del tresette: tre, due, asso, re, cavallo, fante, 7..4. */
export const TRESETTE_STRENGTH: Record<number, number> = { 3: 10, 2: 9, 1: 8, 10: 7, 9: 6, 8: 5, 7: 4, 6: 3, 5: 2, 4: 1 };
/** Punti del tresette in terzi: l'asso vale 1, tre/due/figure 1/3. */
export const TRESETTE_THIRDS: Record<number, number> = { 1: 3, 2: 1, 3: 1, 8: 1, 9: 1, 10: 1 };

/** Chi vince la presa: carta più forte del seme dominante (briscola se presente, altrimenti quello d'uscita). */
export function trickWinner(plays: { seat: Seat; card: Card }[], strength: Record<number, number>, trump?: string): Seat {
  const lead = plays[0].card.suit;
  let best = plays[0];
  for (const p of plays.slice(1)) {
    const bestTrump = trump !== undefined && best.card.suit === trump;
    const pTrump = trump !== undefined && p.card.suit === trump;
    if (pTrump && !bestTrump) best = p;
    else if (pTrump === bestTrump && p.card.suit === best.card.suit && strength[p.card.rank] > strength[best.card.rank]) best = p;
    else if (!pTrump && !bestTrump && p.card.suit === lead && best.card.suit !== lead) best = p;
  }
  return best.seat;
}
