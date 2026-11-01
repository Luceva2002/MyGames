import type { Game, Seat } from './types';
import { levelMove, type BotLevel } from '../difficulty';

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Applica una mossa senza toccare lo stato originale. */
export function applyMove<S, M>(game: Game<S, M>, state: S, seat: Seat, move: M): S {
  if (game.result(state)) throw new Error('La partita è finita.');
  if (!game.activePlayers(state).includes(seat)) throw new Error('Non è il tuo turno.');
  const next = clone(state);
  game.play(next, seat, move);
  return next;
}

/** Fa passare il tempo nei giochi che ne hanno bisogno, senza toccare lo stato originale. */
export function advanceTime<S, M>(game: Game<S, M>, state: S, ms: number): S {
  if (!game.advance || game.result(state)) return state;
  const next = clone(state);
  game.advance(next, ms);
  return next;
}

/** Mossa del computer. Il bot lavora su una copia: può consumare numeri casuali senza toccare la partita. */
export function botMove<S, M>(game: Game<S, M>, state: S, seat: Seat, level: BotLevel = 'difficile'): M {
  if (!game.bot) throw new Error(`${game.meta.id}: nessun computer disponibile`);
  return levelMove(game, state, seat, level, () => game.bot!(clone(state), seat));
}

/** Simula una partita intera con soli computer: usata nei test. */
export function simulate<S, M>(game: Game<S, M>, players: number, seed: number, options?: unknown, maxSteps = 5000) {
  let state = game.setup({ players, seed, options });
  let steps = 0;
  while (!game.result(state)) {
    if (steps++ > maxSteps) throw new Error(`${game.meta.id}: partita troppo lunga (seed ${seed})`);
    // Nei giochi in tempo reale il tempo scorre fra una mossa e l'altra e tutti possono muovere.
    if (game.advance) {
      state = advanceTime(game, state, 400);
      if (game.result(state)) break;
    }
    const active = game.activePlayers(state);
    if (active.length === 0 && game.advance) continue;
    if (active.length === 0) throw new Error(`${game.meta.id}: nessun giocatore attivo (seed ${seed})`);
    const seat = game.advance ? active[steps % active.length] : active[0];
    game.view(state, seat);
    state = applyMove(game, state, seat, botMove(game, state, seat));
  }
  game.view(state, null);
  return { state, result: game.result(state)!, steps };
}
