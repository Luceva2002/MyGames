import type { Game, Seat } from './core/types';
import { clone } from './core/engine';
import { damaMoves } from './games/dama';
import { legalMoves } from './games/scacchi';
import { YAHTZEE_CATEGORIES } from './games/yahtzee';
import { mosaicoMoves } from './games/mosaico';

/** Quanto è bravo il computer: si sceglie prima di giocare e vale per tutti i computer al tavolo. */
export type BotLevel = 'facile' | 'normale' | 'difficile';
export const BOT_LEVELS: { id: BotLevel; label: string }[] = [
  { id: 'facile', label: 'Facile' },
  { id: 'normale', label: 'Normale' },
  { id: 'difficile', label: 'Difficile' },
];

/** Quante volte su cento il computer, invece della mossa migliore, ne fa una qualsiasi tra quelle valide. */
const DISTRACTION: Record<BotLevel, number> = { facile: 0.6, normale: 0.25, difficile: 0 };

/**
 * Mosse possibili "a caso" per i giochi che lo permettono. Ognuna viene provata su una copia dello
 * stato: quelle non valide si scartano, quindi qui basta proporre le candidate.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function candidates(gameId: string, s: any, seat: Seat): unknown[] {
  const hand: { id: string }[] = s.hands?.[seat] ?? [];
  switch (gameId) {
    case 'briscola':
      return hand.map((c) => ({ card: c.id }));
    case 'tresette':
    case 'scopa':
      return hand.map((c) => ({ type: 'play', card: c.id }));
    case 'uno':
      return [...hand.map((c) => ({ type: 'play', card: c.id, color: ['r', 'g', 'b', 'y'][Math.floor(Math.random() * 4)] })), { type: 'draw' }];
    case 'setteemezzo':
      return s.phase === 'play' ? [{ type: 'hit' }, { type: 'stand' }] : [];
    case 'tris':
      return (s.board as unknown[]).map((v, i) => (v === null ? { cell: i } : null)).filter(Boolean);
    case 'dama':
      return damaMoves(s.board, s.turn).map((p) => ({ path: p.path }));
    case 'scacchi':
      return legalMoves(s);
    case 'yahtzee':
      if (s.rollsLeft === 3) return [];
      return YAHTZEE_CATEGORIES.filter((k) => s.scores[seat][k] === undefined).map((category) => ({ type: 'score', category }));
    case 'scala40':
    case 'burraco':
      // Da distratto non cala e butta una carta qualsiasi.
      return s.phase === 'play' && !s.mustUse ? hand.map((c) => ({ type: 'discard', card: c.id })) : [];
    case 'machiavelli':
      return [{ type: 'draw' }];
    case 'mosaico':
      return mosaicoMoves(s, seat);
    case 'puntielinee':
      return (s.lines as unknown[]).flatMap((o, line) => (o === null ? [{ line }] : []));
    case 'colorwars':
      // Sulla prima cella una vale l'altra; dopo una qualsiasi delle sue.
      return (s.cells as ({ o: Seat } | null)[]).flatMap((c, cell) => ((s.placed[seat] ? c?.o === seat : c === null) ? [{ cell }] : []));
    case 'battaglia':
      return s.phase === 'battle' ? Array.from({ length: 100 }, (_, cell) => ({ type: 'shot', cell })) : [];
    default:
      return [];
  }
}

/** La mossa del computer secondo il livello scelto. */
export function levelMove<S, M>(game: Game<S, M>, state: S, seat: Seat, level: BotLevel, best: () => M): M {
  if (Math.random() >= DISTRACTION[level]) return best();
  const options = candidates(game.meta.id, state, seat).sort(() => Math.random() - 0.5);
  for (const m of options) {
    try {
      game.play(clone(state), seat, m as M);
      return m as M;
    } catch {
      // Mossa non valida in questo momento: si prova la prossima.
    }
  }
  return best();
}
