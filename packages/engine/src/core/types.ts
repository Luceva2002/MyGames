/** Posto al tavolo: 0..n-1. */
export type Seat = number;

export type Category = 'carte' | 'tavolo' | 'dadi' | 'abilita' | 'party';

export interface GameMeta {
  id: string;
  name: string;
  category: Category;
  minPlayers: number;
  maxPlayers: number;
  /** Emoji usata come icona nel catalogo. */
  emoji: string;
  /** Colore d'accento della scheda nel catalogo. */
  color: string;
  tagline: string;
  /** Regole in breve, mostrate nella scheda del gioco. */
  rules: string[];
  /** Se ci sono carte o ruoli segreti: sullo stesso dispositivo serve passare il telefono. */
  hiddenInfo: boolean;
  /** Durata indicativa in minuti. */
  minutes: number;
  /** Numeri di giocatori ammessi, se non sono tutti quelli fra min e max (es. solo 2 o 4). */
  playerCounts?: number[];
  /** Solo persone: il computer non sa giocarci (es. indizi detti a voce). */
  humansOnly?: boolean;
  /** Solo nelle stanze online, ognuno col suo telefono: niente partita su un dispositivo solo. */
  onlineOnly?: boolean;
}

export function playerCounts(meta: GameMeta): number[] {
  return meta.playerCounts ?? Array.from({ length: meta.maxPlayers - meta.minPlayers + 1 }, (_, i) => meta.minPlayers + i);
}

export interface GameResult {
  /** Posti vincitori (vuoto = pareggio). */
  winners: Seat[];
  /** Punteggio finale per posto, se ha senso. */
  scores?: number[];
  /** Nel punteggio vince chi ne ha meno: il riepilogo mette prima lui. */
  lowWins?: boolean;
  summary: string;
  /** Titolo del riepilogo al posto di «Hai vinto!», per i giochi da soli a punteggio («Nuovo record!»). */
  title?: string;
  /** Festa grande a fine partita anche senza un vincitore fra più persone (record, puzzle risolto). */
  celebrate?: boolean;
}

export interface SetupContext<O = unknown> {
  players: number;
  seed: number;
  options?: O;
}

/**
 * Regole di un gioco. `play` lavora su una copia dello stato e la può modificare;
 * chi chiama usa sempre `applyMove`, che clona prima.
 */
export interface Game<S = any, M = any, V = any, O = any> {
  meta: GameMeta;
  setup(ctx: SetupContext<O>): S;
  /** Chi deve muovere adesso. */
  activePlayers(state: S): Seat[];
  /** Applica la mossa sullo stato (già clonato). Lancia IllegalMove se non è valida. */
  play(state: S, seat: Seat, move: M): void;
  /** Cosa vede un giocatore (o il tavolo condiviso, con seat = null). */
  view(state: S, seat: Seat | null): V;
  result(state: S): GameResult | null;
  /** Mossa scelta dal computer. */
  bot?(state: S, seat: Seat): M;
  /** Quanto aspettare (ms) prima che il computer muova, es. per finire un'animazione. */
  pause?(state: S): number;
  /** Per i giochi in tempo reale: fa passare il tempo (sullo stato già clonato) e fa scadere fasi e azioni. */
  advance?(state: S, ms: number): void;
  /** Fra quanti ms scade la prossima cosa, così chi ospita la partita sa quando chiamare `advance`. */
  nextEvent?(state: S): number | null;
}

export class IllegalMove extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalMove';
  }
}

export function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new IllegalMove(message);
}
