import type { Seat } from './core/types';
import { cardName, type Card } from './cards/cards';

/**
 * Racconto di una mossa, per far capire agli altri cosa ha appena fatto chi ha giocato
 * ("gioca 7 di denari e prende 2 carte"). Il nome di chi muove lo aggiunge chi mostra il testo;
 * gli altri giocatori citati sono segnaposto %vN, come in UNO. null: niente da raccontare.
 */
export interface LastAction {
  seat: Seat;
  text: string;
  /** Cambia a ogni mossa, anche se il testo è uguale. */
  n: number;
  /** Le carte scoperte coinvolte (giocata, prese, calate, scartata), da mostrare in grande. */
  cards?: Card[];
}

/** Le carte che tutti vedono in questa mossa, nell'ordine: prima quella giocata, poi le prese. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function narrateCards(gameId: string, before: any, move: any): Card[] {
  const ids: string[] = [];
  if (gameId === 'scopa' && move.type === 'play') ids.push(move.card, ...(move.take ?? []));
  else if ((gameId === 'briscola' || gameId === 'tresette') && move.card) ids.push(move.card);
  else if (gameId === 'uno' && move.type === 'play') ids.push(move.card);
  else if ((gameId === 'scala40' || gameId === 'burraco') && (move.type === 'meld' || move.type === 'attach')) ids.push(...move.cards);
  else if ((gameId === 'scala40' || gameId === 'burraco') && move.type === 'discard') ids.push(move.card);
  else if ((gameId === 'scala40' || gameId === 'burraco') && move.type === 'draw' && move.source === 'discard') {
    const pile = before.discard;
    const top = Array.isArray(pile) ? pile[pile.length - 1] : null;
    if (top?.id) ids.push(top.id);
  }
  return ids.map((id) => findCard(before, id)).filter((c): c is Card => !!c).slice(0, 8);
}

/** Cerca una carta per id in tutto lo stato (mani, tavolo, mazzo…). */
function findCard(node: unknown, id: string, depth = 0): Card | null {
  if (!node || typeof node !== 'object' || depth > 6) return null;
  const o = node as Record<string, unknown>;
  if (o.id === id && typeof o.deck === 'string') return o as unknown as Card;
  for (const v of Array.isArray(node) ? node : Object.values(o)) {
    const c = findCard(v, id, depth + 1);
    if (c) return c;
  }
  return null;
}

const UNO_COLOR: Record<string, string> = { r: 'rosso', g: 'verde', b: 'blu', y: 'giallo' };
function nameOf(card: Card | null): string {
  if (!card) return 'una carta';
  if (card.deck !== 'uno') return cardName(card);
  if (card.suit === 'w') return card.rank === 14 ? 'un +4' : 'un jolly';
  const what = card.rank <= 9 ? String(card.rank) : card.rank === 10 ? 'salta' : card.rank === 11 ? 'cambia giro' : '+2';
  return `${what} ${UNO_COLOR[card.suit]}`;
}
const cards = (before: unknown, ids: string[]) => ids.map((id) => nameOf(findCard(before, id))).join(', ');
const PIECES: Record<string, string> = { p: 'il pedone', n: 'il cavallo', b: "l'alfiere", r: 'la torre', q: 'la donna', k: 'il re' };
const CELLS = ['in alto a sinistra', 'in alto al centro', 'in alto a destra', 'a sinistra', 'al centro', 'a destra', 'in basso a sinistra', 'in basso al centro', 'in basso a destra'];
const YAHTZEE_NAMES: Record<string, string> = {
  uno: 'Uno', due: 'Due', tre: 'Tre', quattro: 'Quattro', cinque: 'Cinque', sei: 'Sei',
  tris: 'Tris', poker: 'Poker', full: 'Full', scalina: 'Scala di 4', scala: 'Scala di 5', yahtzee: 'Yahtzee', chance: 'Chance',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function narrate(gameId: string, before: any, after: any, seat: Seat, move: any): string | null {
  switch (gameId) {
    case 'scopa': {
      if (move.type !== 'play') return null;
      let t = `gioca ${nameOf(findCard(before, move.card))}`;
      if (move.take?.length) t += ` e prende ${cards(before, move.take)}`;
      if ((after.scope?.[seat] ?? 0) > (before.scope?.[seat] ?? 0)) t += ' — SCOPA!';
      return t;
    }
    case 'briscola':
    case 'tresette':
      return move.card ? `gioca ${nameOf(findCard(before, move.card))}` : null;
    case 'setteemezzo':
      if (move.type === 'bet') return `punta ${move.amount}`;
      if (move.type === 'hit') return after.status?.[seat] === 'bust' ? 'chiede carta e sballa' : 'chiede carta';
      if (move.type === 'stand') return 'sta';
      return null;
    case 'uno':
      if (move.type === 'draw') return 'pesca una carta';
      if (move.type === 'pass') return 'passa';
    {
      // Il motore di UNO racconta già l'effetto ("salta %v2", "fa pescare 2 a %v3"): lo aggiungo alla carta.
      const extra: string = after.last?.seat === seat ? after.last.text.replace(/^gioca\s*/, '') : '';
      return `gioca ${nameOf(findCard(before, move.card))}${extra ? (extra.startsWith('e ') || extra.startsWith('—') ? ` ${extra}` : ` e ${extra}`) : ''}`;
    }
    case 'scala40':
    case 'burraco':
      if (move.type === 'draw') return move.source === 'discard' ? 'prende lo scarto' : 'pesca dal mazzo';
      if (move.type === 'open') return `apre con ${move.melds.length} ${move.melds.length === 1 ? 'combinazione' : 'combinazioni'}`;
      if (move.type === 'meld') return `cala ${cards(before, move.cards)}`;
      if (move.type === 'attach') return `attacca ${cards(before, move.cards)}`;
      if (move.type === 'discard') return `scarta ${nameOf(findCard(before, move.card))}`;
      return null;
    case 'machiavelli':
      if (move.type === 'draw') return 'pesca e passa';
      return 'cala e risistema il tavolo';
    case 'tris':
      return `segna ${CELLS[move.cell] ?? 'una casella'}`;
    case 'dama': {
      const taken = (before.board?.filter((p: unknown) => p).length ?? 0) - (after.board?.filter((p: unknown) => p).length ?? 0);
      return taken > 0 ? `mangia ${taken === 1 ? 'una pedina' : `${taken} pedine`}` : 'muove una pedina';
    }
    case 'scacchi': {
      const piece: string | null = before.board?.[move.from] ?? null;
      const target: string | null = before.board?.[move.to] ?? null;
      let t = `muove ${PIECES[piece?.toLowerCase() ?? ''] ?? 'un pezzo'}`;
      if (target) t += ` e mangia ${PIECES[target.toLowerCase()] ?? 'un pezzo'}`;
      if (move.promo) t += ' e promuove';
      return t;
    }
    case 'yahtzee':
      if (move.type === 'roll') return `tira i dadi: ${after.dice?.join(' ')}`;
      return `segna ${after.scores?.[seat]?.[move.category] ?? 0} punti in ${YAHTZEE_NAMES[move.category] ?? move.category}`;
    case 'biliardo':
      return move.type === 'shoot' && after.lastShot ? after.lastShot.text : move.type === 'place' ? 'sposta la bianca' : null;
    case 'freccette': {
      const darts: { label: string }[] = after.lastTurn?.seat === seat && after.darts?.length === 0 ? after.lastTurn.darts : after.darts ?? [];
      const d = darts[darts.length - 1];
      return d ? `colpisce ${d.label}${after.lastTurn?.seat === seat && after.lastTurn.bust ? ' e sballa' : ''}` : 'tira';
    }
    case 'football': {
      const k = after.kicks?.length > (before.kicks?.length ?? 0) ? after.kicks[after.kicks.length - 1] : null;
      if (!k) return move.dive ? 'sceglie dove tuffarsi' : 'sceglie dove tirare';
      return k.outcome === 'gol' ? 'GOL!' : k.outcome === 'parata' ? 'parata!' : k.outcome === 'palo' ? 'palo!' : 'tiro fuori';
    }
    default:
      return null;
  }
}
