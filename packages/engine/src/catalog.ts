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
import { biliardo } from './games/biliardo';
import { lupus } from './games/lupus/lupus';
import { mrwhite } from './games/mrwhite/mrwhite';
import { mosaico } from './games/mosaico';
import { puntielinee } from './games/puntielinee';
import { colorwars } from './games/colorwars';
import { battaglia } from './games/battaglia';
import { ballo } from './games/ballo';
import { coriandoli, frutta, razzo, serpentina } from './games/arcade/arcade';
import { raddoppia } from './games/raddoppia';
import { sudoku } from './games/sudoku';
import { memory } from './games/memory';

/** Giochi giocabili, nell'ordine in cui compaiono nel catalogo. */
// Ordine della home: tipi di gioco alternati, così le carte non stanno tutte all'inizio.
export const GAMES: Game[] = [scopa, mrwhite, coriandoli, battaglia, uno, frutta, freccette, scacchi, memory, briscola, yahtzee, serpentina, mosaico, lupus, sudoku, burraco, colorwars, razzo, dama, ballo, raddoppia, setteemezzo, biliardo, puntielinee, scala40, tris, tresette, machiavelli, solitario];

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
