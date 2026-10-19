import { assert, type Game, type Seat } from '../../core/types';
import { pick, random, shuffle, type HasRng } from '../../core/rng';
import { WORD_PAIRS } from './words';

/**
 * Mr. White l'impostore, con le regole di Undercover: i civili hanno tutti la stessa parola segreta,
 * Mr. White non ne ha nessuna e deve bluffare. A turno ognuno dice a voce un indizio, poi si vota
 * chi eliminare. Mr. White eliminato può ancora vincere indovinando la parola dei civili.
 * Facoltativo l'Undercover: ha una parola simile e non sa di essere diverso dagli altri.
 */
export type MrWhiteRole = 'civile' | 'undercover' | 'mrwhite';
export type MrWhiteWinner = 'civili' | 'impostori' | 'mrwhite';

export const MRWHITE_ROLES: Record<MrWhiteRole, { name: string; description: string }> = {
  civile: { name: 'Civile', description: 'Hai la parola giusta: scopri chi non ce l’ha.' },
  undercover: { name: 'Undercover', description: 'Avevi una parola simile, ma diversa da quella dei civili.' },
  mrwhite: { name: 'Mr. White', description: 'Non hai nessuna parola: ascolta gli altri e bluffa.' },
};

export interface MrWhiteState extends HasRng {
  players: number;
  phase: 'setup' | 'reveal' | 'clues' | 'vote' | 'guess' | 'ended';
  /** Un solo telefono che gira: si passa per vedere la parola, poi si vota a voce e si tocca una volta. */
  shared: boolean;
  undercover: boolean;
  roles: MrWhiteRole[];
  words: { civile: string; undercover: string };
  alive: boolean[];
  seen: boolean[];
  round: number;
  /** Chi dice il primo indizio in questo giro (mai Mr. White). */
  starter: Seat;
  /** Chi ha il telefono in mano, quando ce n'è uno solo. */
  holder: Seat;
  votes: Record<number, number>;
  /** Ballottaggio fra i pari merito, se il primo voto è finito in parità. */
  runoff: Seat[] | null;
  lastOut: { seat: Seat; role: MrWhiteRole; tally: Record<number, number> | null; random: boolean } | null;
  guess: { seat: Seat; word: string; correct: boolean } | null;
  winner: MrWhiteWinner | null;
}

export type MrWhiteMove =
  | { type: 'setup'; undercover: boolean; shared: boolean }
  | { type: 'seen' }
  | { type: 'toVote' }
  | { type: 'vote'; target: Seat }
  | { type: 'eliminate'; target: Seat }
  | { type: 'guess'; word: string };

export interface MrWhitePlayerView {
  alive: boolean;
  /** Ruolo scoperto: dei giocatori eliminati, o di tutti a fine partita. */
  role: MrWhiteRole | null;
  hasVoted: boolean;
  seen: boolean;
}

export interface MrWhiteView {
  phase: MrWhiteState['phase'];
  round: number;
  me: Seat | null;
  shared: boolean;
  undercover: boolean;
  /** La mia parola, se posso vederla adesso (null per Mr. White o col telefono condiviso sul tavolo). */
  myWord: string | null;
  iAmMrWhite: boolean;
  players: MrWhitePlayerView[];
  /** Ordine degli indizi di questo giro, dal primo che parla. */
  order: Seat[];
  /** Fra chi si vota (tutti i vivi, o i pari merito del ballottaggio). */
  candidates: Seat[];
  runoff: boolean;
  myVote: number | undefined;
  lastOut: MrWhiteState['lastOut'];
  guess: MrWhiteState['guess'];
  winner: MrWhiteWinner | null;
  /** Le parole, svelate a fine partita. */
  words: MrWhiteState['words'] | null;
  seenCount: number;
  /** Quanti Undercover ci sarebbero con l'interruttore acceso (0 = troppo pochi giocatori). */
  undercoverCount: number;
}

const seats = (s: { players: number }) => Array.from({ length: s.players }, (_, i) => i);
const aliveSeats = (s: MrWhiteState) => seats(s).filter((p) => s.alive[p]);
const isImpostor = (s: MrWhiteState, p: Seat) => s.roles[p] !== 'civile';

/** Undercover con l'interruttore acceso: ne servono abbastanza pochi da lasciare i civili in maggioranza. */
export function undercoverCount(players: number): number {
  return players >= 9 ? 2 : players >= 5 ? 1 : 0;
}

/** Confronto della parola di Mr. White: senza maiuscole, accenti, spazi e articoli davanti. */
export function sameWord(a: string, b: string): boolean {
  const norm = (w: string) =>
    w
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/^\s*(il|lo|la|i|gli|le|un|uno|una|l')\s*/, '')
      .replace(/[^a-z0-9]/g, '');
  return norm(a) !== '' && norm(a) === norm(b);
}

/** Ordine degli indizi: dal primo che parla, in senso orario fra i vivi. */
function clueOrder(s: MrWhiteState): Seat[] {
  const alive = aliveSeats(s);
  const i = Math.max(0, alive.indexOf(s.starter));
  return [...alive.slice(i), ...alive.slice(0, i)];
}

/** Il primo a parlare cambia a ogni giro e non è mai Mr. White, che così sente almeno un indizio. */
function chooseStarter(s: MrWhiteState) {
  const options = aliveSeats(s).filter((p) => s.roles[p] !== 'mrwhite');
  s.starter = options.length ? pick(s, options) : aliveSeats(s)[0];
}

function computeWinner(s: MrWhiteState): MrWhiteWinner | null {
  const alive = aliveSeats(s);
  const impostors = alive.filter((p) => isImpostor(s, p)).length;
  if (impostors === 0) return 'civili';
  if (alive.length - impostors <= impostors) return 'impostori';
  return null;
}

function nextRound(s: MrWhiteState) {
  const w = computeWinner(s);
  if (w) {
    s.winner = w;
    s.phase = 'ended';
    return;
  }
  s.round++;
  s.votes = {};
  s.runoff = null;
  chooseStarter(s);
  s.phase = 'clues';
}

function eliminate(s: MrWhiteState, target: Seat, tally: Record<number, number> | null, byChance: boolean) {
  s.alive[target] = false;
  s.lastOut = { seat: target, role: s.roles[target], tally, random: byChance };
  s.votes = {};
  s.runoff = null;
  if (s.roles[target] === 'mrwhite') {
    s.phase = 'guess';
    return;
  }
  nextRound(s);
}

function resolveVote(s: MrWhiteState) {
  const tally: Record<number, number> = {};
  for (const v of Object.values(s.votes)) tally[v] = (tally[v] ?? 0) + 1;
  const best = Math.max(...Object.values(tally));
  const top = Object.keys(tally)
    .map(Number)
    .filter((p) => tally[p] === best);
  if (top.length === 1) return eliminate(s, top[0], tally, false);
  // Prima parità: si rivota solo fra i pari merito. Seconda parità: decide la sorte.
  if (!s.runoff) {
    s.runoff = top.sort((a, b) => a - b);
    s.votes = {};
    return;
  }
  eliminate(s, pick(s, top), tally, true);
}

function candidates(s: MrWhiteState): Seat[] {
  return s.runoff ?? aliveSeats(s);
}

/** Chi può votare: nel ballottaggio i pari merito non votano (se resta qualcuno che può farlo). */
function voters(s: MrWhiteState): Seat[] {
  const alive = aliveSeats(s);
  if (!s.runoff) return alive;
  const others = alive.filter((p) => !s.runoff!.includes(p));
  return others.length ? others : alive;
}

export const mrwhite: Game<MrWhiteState, MrWhiteMove, MrWhiteView> = {
  meta: {
    id: 'mrwhite',
    name: 'Mr. White',
    category: 'party',
    minPlayers: 3,
    maxPlayers: 12,
    emoji: '🕵️',
    color: '#E8E4F0',
    tagline: 'Tutti hanno la parola segreta, tranne l’impostore',
    rules: [
      'Ognuno guarda di nascosto la sua parola: i civili hanno tutti la stessa, Mr. White non ne ha nessuna.',
      'A turno ognuno dice a voce un indizio sulla parola, senza dirla. Mr. White ascolta e bluffa.',
      'Poi si vota chi eliminare. In parità si rivota fra i pari merito.',
      'I civili vincono se eliminano gli impostori. Mr. White eliminato può ancora vincere da solo se indovina la parola.',
      'Con l’Undercover acceso (da 5 giocatori) uno ha una parola simile e non sa di essere diverso: vince con Mr. White se restano in tanti quanti i civili.',
    ],
    hiddenInfo: true,
    minutes: 15,
    humansOnly: true,
  },
  setup({ players, seed }) {
    return {
      rng: seed,
      players,
      phase: 'setup',
      shared: false,
      undercover: false,
      roles: Array(players).fill('civile'),
      words: { civile: '', undercover: '' },
      alive: Array(players).fill(true),
      seen: Array(players).fill(false),
      round: 1,
      starter: 0,
      holder: 0,
      votes: {},
      runoff: null,
      lastOut: null,
      guess: null,
      winner: null,
    };
  },
  activePlayers(s) {
    switch (s.phase) {
      case 'setup':
        return [0];
      case 'reveal': {
        const unseen = seats(s).filter((p) => !s.seen[p]);
        // Col telefono che gira la parola si guarda uno alla volta, nell'ordine dei posti.
        return s.shared ? unseen.slice(0, 1) : unseen;
      }
      case 'clues':
        return [s.shared ? s.holder : s.starter];
      case 'vote':
        return s.shared ? [s.holder] : voters(s).filter((p) => !(p in s.votes));
      case 'guess':
        return [s.lastOut!.seat];
      default:
        return [];
    }
  },
  play(s, seat, move) {
    switch (move.type) {
      case 'setup': {
        assert(s.phase === 'setup', 'La partita è già cominciata.');
        s.shared = move.shared;
        s.undercover = move.undercover && undercoverCount(s.players) > 0;
        const roles: MrWhiteRole[] = Array(s.players).fill('civile');
        roles[0] = 'mrwhite';
        for (let i = 0; i < (s.undercover ? undercoverCount(s.players) : 0); i++) roles[i + 1] = 'undercover';
        s.roles = shuffle(s, roles);
        const pair = pick(s, WORD_PAIRS);
        const flip = random(s) < 0.5;
        s.words = { civile: flip ? pair[1] : pair[0], undercover: flip ? pair[0] : pair[1] };
        s.phase = 'reveal';
        s.holder = seat;
        return;
      }
      case 'seen':
        assert(s.phase === 'reveal', 'Le parole sono già state guardate.');
        s.seen[seat] = true;
        s.holder = seat;
        if (s.seen.every(Boolean)) {
          chooseStarter(s);
          s.phase = 'clues';
        }
        return;
      case 'toVote':
        assert(s.phase === 'clues', 'Non è il momento di votare.');
        s.votes = {};
        s.runoff = null;
        s.phase = 'vote';
        return;
      case 'vote':
        assert(s.phase === 'vote' && !s.shared, 'Qui si vota a voce.');
        assert(candidates(s).includes(move.target) && move.target !== seat, 'Voto non valido.');
        s.votes[seat] = move.target;
        if (voters(s).every((p) => p in s.votes)) resolveVote(s);
        return;
      case 'eliminate':
        assert(s.phase === 'vote' && s.shared, 'Qui ognuno vota sul suo telefono.');
        assert(s.alive[move.target], 'Giocatore già eliminato.');
        eliminate(s, move.target, null, false);
        return;
      case 'guess': {
        assert(s.phase === 'guess', 'Non è il momento di indovinare.');
        const correct = sameWord(move.word, s.words.civile);
        s.guess = { seat, word: move.word.trim().slice(0, 40), correct };
        s.holder = seat;
        if (correct) {
          s.winner = 'mrwhite';
          s.phase = 'ended';
          return;
        }
        nextRound(s);
        return;
      }
    }
  },
  view(s, me) {
    const ended = s.phase === 'ended';
    const role = me === null ? null : s.roles[me];
    // Col telefono condiviso la parola si vede solo quando lo tieni in mano tu: sul tavolo resta nascosta.
    const private_ = !s.shared || s.phase === 'reveal' || s.phase === 'guess' || ended;
    const canSee = me !== null && private_ && s.phase !== 'setup';
    return {
      phase: s.phase,
      round: s.round,
      me,
      shared: s.shared,
      undercover: s.undercover,
      myWord: canSee && role !== 'mrwhite' ? (role === 'undercover' ? s.words.undercover : s.words.civile) : null,
      iAmMrWhite: canSee && role === 'mrwhite',
      players: seats(s).map((p) => ({
        alive: s.alive[p],
        role: ended || !s.alive[p] ? s.roles[p] : null,
        hasVoted: p in s.votes,
        seen: s.seen[p],
      })),
      order: s.phase === 'setup' || s.phase === 'reveal' ? [] : clueOrder(s),
      candidates: candidates(s),
      runoff: s.runoff !== null,
      myVote: me === null ? undefined : s.votes[me],
      lastOut: s.lastOut,
      guess: s.guess,
      winner: s.winner,
      words: ended ? s.words : null,
      seenCount: s.seen.filter(Boolean).length,
      undercoverCount: undercoverCount(s.players),
    };
  },
  result(s) {
    if (!s.winner) return null;
    const winners =
      s.winner === 'mrwhite' ? s.roles.flatMap((r, p) => (r === 'mrwhite' ? [p] : [])) : seats(s).filter((p) => (s.winner === 'civili') === !isImpostor(s, p));
    const summary =
      s.winner === 'mrwhite' ? `Mr. White ha indovinato «${s.words.civile}» e vince!` : s.winner === 'civili' ? `Vincono i civili! La parola era «${s.words.civile}».` : `Vincono gli impostori! La parola era «${s.words.civile}».`;
    return { winners, summary };
  },
  // Computer di riserva (prove automatiche, posti vuoti in una stanza): non dà indizi, vota a caso.
  bot(s, seat) {
    switch (s.phase) {
      case 'setup':
        return { type: 'setup', undercover: random(s) < 0.5, shared: random(s) < 0.5 };
      case 'reveal':
        return { type: 'seen' };
      case 'clues':
        return { type: 'toVote' };
      case 'vote': {
        const options = candidates(s).filter((p) => p !== seat);
        return s.shared ? { type: 'eliminate', target: pick(s, aliveSeats(s)) } : { type: 'vote', target: pick(s, options) };
      }
      default: {
        const words = WORD_PAIRS.flat();
        return { type: 'guess', word: random(s) < 0.1 ? s.words.civile : pick(s, words) };
      }
    }
  },
  pause: () => 900,
};

export { WORD_PAIRS } from './words';
