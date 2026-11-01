import type { Game, GameMeta } from './core/types';
import { tris } from './games/tris';
import { scopa } from './games/scopa';
import { briscola } from './games/briscola';
import { tresette } from './games/tresette';
import { setteemezzo } from './games/setteemezzo';
import { uno } from './games/uno';
import { dama } from './games/dama';
import { scacchi } from './games/scacchi';
import { yahtzee } from './games/yahtzee';
import { solitario } from './games/solitario';
import { scala40 } from './games/scala40';
import { burraco } from './games/burraco';
import { machiavelli } from './games/machiavelli';
import { freccette } from './games/freccette';
import { football } from './games/football';
import { biliardo } from './games/biliardo';
import { lupus } from './games/lupus/lupus';
import { mrwhite } from './games/mrwhite/mrwhite';
import { mosaico } from './games/mosaico';
import { puntielinee } from './games/puntielinee';
import { colorwars } from './games/colorwars';
import { battaglia } from './games/battaglia';

/** Giochi giocabili, nell'ordine in cui compaiono nel catalogo. */
// Ordine della home: tipi di gioco alternati, così le carte non stanno tutte all'inizio.
export const GAMES: Game[] = [scopa, mrwhite, battaglia, uno, freccette, scacchi, briscola, yahtzee, mosaico, lupus, burraco, colorwars, dama, setteemezzo, biliardo, puntielinee, scala40, tris, tresette, football, machiavelli, solitario];

export function getGame(id: string): Game | undefined {
  return GAMES.find((g) => g.meta.id === id);
}

export type CatalogStatus = 'ready' | 'soon' | 'external';

export interface CatalogEntry {
  meta: GameMeta;
  status: CatalogStatus;
  /** Per i giochi che vivono in un'app a parte. */
  note?: string;
}

export function catalog(): CatalogEntry[] {
  return GAMES.map((g): CatalogEntry => ({ meta: g.meta, status: 'ready' }));
}
