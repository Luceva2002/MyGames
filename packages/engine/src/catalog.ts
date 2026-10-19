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

/** Giochi giocabili, nell'ordine in cui compaiono nel catalogo. */
export const GAMES: Game[] = [scopa, briscola, tresette, setteemezzo, scala40, burraco, machiavelli, uno, solitario, dama, scacchi, yahtzee, freccette, biliardo, football, tris, lupus, mrwhite];

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

/** Giochi annunciati ma non ancora giocabili: compaiono nel catalogo come "in arrivo". */
export const UPCOMING: CatalogEntry[] = [];

export function catalog(): CatalogEntry[] {
  const ready = GAMES.map((g): CatalogEntry => ({ meta: g.meta, status: 'ready' }));
  return [...ready, ...UPCOMING.filter((u) => !GAMES.some((g) => g.meta.id === u.meta.id))];
}
