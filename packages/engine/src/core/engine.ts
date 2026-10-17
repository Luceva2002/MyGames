import type { Game, Seat } from './types';

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

/** Mossa del computer. Il bot lavora su una copia: può consumare numeri casuali senza toccare la partita. */
export function botMove<S, M>(game: Game<S, M>, state: S, seat: Seat): M {
  if (!game.bot) throw new Error(`${game.meta.id}: nessun computer disponibile`);
  return game.bot(clone(state), seat);
}

/** Fa muovere i computer finché tocca a un umano o la partita finisce. Restituisce gli stati intermedi. */
export function runBots<S, M>(game: Game<S, M>, state: S, isBot: (seat: Seat) => boolean, maxSteps = 500): S[] {
  const steps: S[] = [];
  let current = state;
  for (let i = 0; i < maxSteps; i++) {
    if (game.result(current) || !game.bot) break;
    const botSeat = game.activePlayers(current).find(isBot);
    if (botSeat === undefined) break;
    current = applyMove(game, current, botSeat, botMove(game, current, botSeat));
    steps.push(current);
  }
  return steps;
}

/** Simula una partita intera con soli computer: usata nei test. */
export function simulate<S, M>(game: Game<S, M>, players: number, seed: number, options?: unknown, maxSteps = 5000) {
  let state = game.setup({ players, seed, options });
  let steps = 0;
  while (!game.result(state)) {
    if (steps++ > maxSteps) throw new Error(`${game.meta.id}: partita troppo lunga (seed ${seed})`);
    const active = game.activePlayers(state);
    if (active.length === 0) throw new Error(`${game.meta.id}: nessun giocatore attivo (seed ${seed})`);
    const seat = active[0];
    game.view(state, seat);
    state = applyMove(game, state, seat, botMove(game, state, seat));
  }
  game.view(state, null);
  return { state, result: game.result(state)!, steps };
}
