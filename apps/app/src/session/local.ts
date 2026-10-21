import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSettings } from '../ui/settings';
import { applyMove, assignAvatars, botMove, getGame, narrate, newSeed, type Game, type LastAction, type Seat } from '@giochi/engine';

export interface SeatConfig {
  name: string;
  bot: boolean;
  /** Maschera scelta come avatar (id). */
  avatar?: string;
}

export interface MatchConfig {
  gameId: string;
  seats: SeatConfig[];
  options?: Record<string, unknown>;
}

/**
 * Giochi che si giocano tra amici sullo stesso dispositivo: quelli a vista e quelli con pochi
 * passaggi di telefono (Sette e mezzo: ognuno fa la sua mano intera; Rigori: un tocco a testa;
 * Mr. White: si passa solo per guardare la parola, poi si gioca a voce).
 * Gli altri hanno carte segrete a ogni turno: sullo stesso dispositivo solo contro il computer.
 */
const PASS_AND_PLAY = new Set(['setteemezzo', 'football', 'mrwhite']);
export function canPassAndPlay(meta: { id: string; hiddenInfo?: boolean; maxPlayers: number }) {
  return meta.maxPlayers >= 2 && (!meta.hiddenInfo || PASS_AND_PLAY.has(meta.id));
}

/** Configurazione della prossima partita locale, passata dalla scheda del gioco allo schermo di gioco. */
let pending: MatchConfig | null = null;
export const setPendingMatch = (c: MatchConfig) => (pending = c);
export const getPendingMatch = () => pending;

const BOT_DELAY = 1300;

/**
 * Partita su un solo dispositivo: le regole girano qui, i computer muovono da soli
 * e, se ci sono carte segrete e più persone, il telefono va passato fra un turno e l'altro.
 */
export function useLocalMatch(config: MatchConfig) {
  const game = getGame(config.gameId) as Game;
  const [state, setState] = useState(() => game.setup({ players: config.seats.length, seed: newSeed(), options: config.options }));
  const [error, setError] = useState<string | null>(null);
  // L'ultima mossa raccontata ("Pulcinella gioca 7 di denari"), per seguire cosa fanno gli altri.
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const tell = (before: unknown, after: unknown, seat: Seat, move: unknown) => {
    const text = narrate(config.gameId, before, after, seat, move);
    if (text) setLastAction((a) => ({ seat, text, n: (a?.n ?? 0) + 1 }));
  };
  const humans = useMemo(() => config.seats.flatMap((s, i) => (s.bot ? [] : [i])), [config.seats]);
  const isBot = useCallback((seat: Seat) => config.seats[seat]?.bot ?? false, [config.seats]);
  const result = game.result(state);
  const active = result ? [] : game.activePlayers(state);
  const activeHuman = active.find((s) => !isBot(s));
  const [me, setMe] = useState<Seat>(humans[0] ?? 0);
  /** Chi ha il telefono in mano: con le carte segrete serve la conferma prima di mostrarle. */
  const [revealed, setRevealed] = useState<Seat | null>(humans.length === 1 ? humans[0] : null);
  const needsHandoff = game.meta.hiddenInfo && humans.length > 1;

  useEffect(() => {
    if (activeHuman !== undefined && activeHuman !== me) setMe(activeHuman);
  }, [activeHuman, me]);

  // I computer muovono uno alla volta, con una pausa per far vedere la giocata.
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    if (result) return;
    const bot = active.find(isBot);
    if (bot === undefined) return;
    const timer = setTimeout(() => {
      const current = stateRef.current;
      if (!game.activePlayers(current).includes(bot)) return;
      const move = botMove(game, current, bot, getSettings().botLevel);
      const next = applyMove(game, current, bot, move);
      tell(current, next, bot, move);
      setState(next);
    }, game.pause?.(state) ?? BOT_DELAY);
    return () => clearTimeout(timer);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const showHandoff = needsHandoff && !result && activeHuman !== undefined && revealed !== activeHuman;
  const viewer: Seat | null = needsHandoff ? (showHandoff ? null : revealed) : me;

  const play = useCallback(
    (move: unknown) => {
      if (viewer === null) return;
      try {
        const next = applyMove(game, stateRef.current, viewer, move);
        tell(stateRef.current, next, viewer, move);
        stateRef.current = next;
        setState(next);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [game, viewer],
  );

  const restart = useCallback(() => {
    setState(game.setup({ players: config.seats.length, seed: newSeed(), options: config.options }));
    setError(null);
    setLastAction(null);
    setRevealed(humans.length === 1 ? humans[0] : null);
  }, [game, config, humans]);

  return {
    game,
    state,
    view: game.view(state, needsHandoff && result ? null : viewer),
    me: viewer,
    myTurn: viewer !== null && active.includes(viewer),
    active,
    result,
    lastAction,
    error,
    clearError: () => setError(null),
    play,
    restart,
    names: config.seats.map((s) => s.name),
    avatars: assignAvatars(config.seats),
    handoffTo: showHandoff ? activeHuman! : null,
    confirmHandoff: () => setRevealed(activeHuman ?? null),
  };
}
