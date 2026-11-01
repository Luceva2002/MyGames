import { assert, type Game, type Seat } from '../core/types';
import { randomInt, shuffle, type HasRng } from '../core/rng';

/**
 * Il Ballo Mascherato: una festa di Carnevale con uno o due Traditori fra gli invitati.
 * Si gioca in tempo reale, ognuno col suo telefono: gli invitati fanno compiti veloci che riempiono
 * la barra della festa, i Traditori fingono e smascherano. Alle riunioni si discute a voce e si vota.
 * Il tempo entra solo da `advance`: le regole restano funzioni pure, senza orologi.
 */
export const BALLO_FESTA_MS = 90_000;
export const BALLO_DISCUSS_MS = 60_000;
export const BALLO_VOTE_MS = 30_000;
export const BALLO_OUTCOME_MS = 6_000;
export const BALLO_KILL_MS = 30_000;
export const BALLO_LIGHTS_MS = 10_000;
/** A inizio festa si aspetta un attimo: nessuno viene smascherato appena si riparte. */
const FIRST_KILL_MS = 15_000;
/** Quanto possono distare i due tocchi su "Riaccendi" per contare come insieme. */
export const BALLO_RELIGHT_WINDOW_MS = 2_500;
/** Compiti da fare per ogni invitato (fantasmi compresi) per riempire la barra: circa due feste. */
const TASKS_PER_GUEST = 20;

export const BALLO_TASKS = ['maschere', 'colori', 'vino', 'candele'] as const;
export type BalloTaskKind = (typeof BALLO_TASKS)[number];
export interface BalloTask {
  kind: BalloTaskKind;
  seed: number;
  /** Numero del compito: un doppio tocco o un messaggio in ritardo non contano due volte. */
  n: number;
}

export type BalloPhase = 'roles' | 'festa' | 'discussione' | 'voto' | 'esito' | 'fine';
export type BalloWinner = 'invitati' | 'traditori';
/** Voto per saltare: non esce nessuno. */
export const BALLO_SKIP = -1;

export interface BalloOutcome {
  /** Chi esce (null: nessuno). */
  seat: Seat | null;
  traitor: boolean;
  /** Quanti voti ha preso ciascuno, senza dire chi li ha dati. */
  tally: { target: number; votes: number }[];
}

export interface BalloState extends HasRng {
  players: number;
  phase: BalloPhase;
  traitors: Seat[];
  seen: boolean[];
  /** Tempo di gioco trascorso, in ms. */
  clock: number;
  phaseEnd: number;
  bar: number;
  barGoal: number;
  tasks: BalloTask[];
  /** Chi è fuori davvero. */
  out: boolean[];
  /** Chi è fuori e tutti lo sanno: gli smascherati si annunciano solo alla riunione. */
  announced: boolean[];
  unannounced: Seat[];
  killReady: number[];
  lightsUntil: number;
  lightsUsed: boolean;
  relight: { seat: Seat; at: number } | null;
  meetingUsed: boolean[];
  meeting: { caller: Seat | null; victims: Seat[] } | null;
  ready: boolean[];
  votes: (number | null)[];
  outcome: BalloOutcome | null;
  winner: BalloWinner | null;
  reason: string;
}

export type BalloMove =
  | { type: 'seen' }
  | { type: 'task'; n: number }
  | { type: 'kill'; target: Seat }
  | { type: 'lights' }
  | { type: 'relight' }
  | { type: 'meeting' }
  | { type: 'ready' }
  | { type: 'vote'; target: number };

/** Solo quello che chi guarda può sapere: lo schermo del tavolo (me = null) non vede né ruoli né compiti. */
export interface BalloView {
  players: number;
  phase: BalloPhase;
  /** Tempo che resta alla fase, in ms; null se non c'è un limite. */
  left: number | null;
  bar: number;
  barGoal: number;
  /** Chi risulta fuori a chi guarda. */
  out: boolean[];
  role: 'invitato' | 'traditore' | null;
  /** I traditori si conoscono; a fine partita li vedono tutti. */
  traitors: Seat[];
  task: BalloTask | null;
  killLeft: number;
  lightsLeft: number;
  lightsUsed: boolean;
  meetingUsed: boolean;
  seen: number;
  iSaw: boolean;
  meeting: BalloState['meeting'];
  ready: number;
  iReady: boolean;
  voted: number;
  /** A chi ho dato il voto: lo sa solo chi l'ha dato. */
  myVote: number | null;
  outcome: BalloOutcome | null;
  winner: BalloWinner | null;
  reason: string;
}

export const balloTraitorCount = (players: number) => (players >= 7 ? 2 : 1);

function newTask(s: BalloState, previous: BalloTask | null): BalloTask {
  const kinds = BALLO_TASKS.filter((k) => k !== previous?.kind);
  return { kind: kinds[randomInt(s, kinds.length)], seed: randomInt(s, 2 ** 30), n: (previous?.n ?? 0) + 1 };
}

const isTraitor = (s: BalloState, seat: Seat) => s.traitors.includes(seat);
const seats = (s: BalloState) => Array.from({ length: s.players }, (_, i) => i);

function finish(s: BalloState, winner: BalloWinner, reason: string) {
  s.phase = 'fine';
  s.winner = winner;
  s.reason = reason;
}

function startFesta(s: BalloState) {
  s.phase = 'festa';
  s.phaseEnd = s.clock + BALLO_FESTA_MS;
  s.killReady = s.killReady.map(() => s.clock + FIRST_KILL_MS);
  s.lightsUntil = 0;
  s.lightsUsed = false;
  s.relight = null;
  s.meeting = null;
  s.outcome = null;
}

function startMeeting(s: BalloState, caller: Seat | null) {
  s.meeting = { caller, victims: s.unannounced };
  for (const v of s.unannounced) s.announced[v] = true;
  s.unannounced = [];
  s.lightsUntil = 0;
  s.relight = null;
  s.phase = 'discussione';
  s.phaseEnd = s.clock + BALLO_DISCUSS_MS;
  s.ready = s.ready.map(() => false);
}

function startVote(s: BalloState) {
  s.phase = 'voto';
  s.phaseEnd = s.clock + BALLO_VOTE_MS;
  s.votes = s.votes.map(() => null);
}

/** Il più votato esce; in parità, o se vince "salta", non esce nessuno. Chi non vota salta. */
function endVote(s: BalloState) {
  const counts = new Map<number, number>();
  seats(s).forEach((p) => {
    if (s.out[p]) return;
    const v = s.votes[p] ?? BALLO_SKIP;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  });
  const tally = [...counts].map(([target, votes]) => ({ target, votes })).sort((a, b) => b.votes - a.votes);
  const top = tally[0];
  const clear = !!top && top.target !== BALLO_SKIP && tally[1]?.votes !== top.votes;
  const seat = clear ? top.target : null;
  if (seat !== null) {
    s.out[seat] = true;
    s.announced[seat] = true;
  }
  s.outcome = { seat, traitor: seat !== null && isTraitor(s, seat), tally };
  s.phase = 'esito';
  s.phaseEnd = s.clock + BALLO_OUTCOME_MS;
}

/** Vincono i traditori appena sono almeno quanti gli invitati ancora in gioco. */
function traitorsWin(s: BalloState) {
  const alive = seats(s).filter((p) => !s.out[p]);
  const traitors = alive.filter((p) => isTraitor(s, p)).length;
  return traitors > 0 && traitors >= alive.length - traitors;
}

function endOutcome(s: BalloState) {
  if (s.traitors.every((t) => s.out[t])) return finish(s, 'invitati', 'Tutti i Traditori sono fuori');
  if (traitorsWin(s)) return finish(s, 'traditori', 'I Traditori sono tanti quanti gli invitati');
  startFesta(s);
}

export const ballo: Game<BalloState, BalloMove, BalloView> = {
  meta: {
    id: 'ballo',
    name: 'Il Ballo Mascherato',
    category: 'party',
    minPlayers: 4,
    maxPlayers: 10,
    emoji: '🎭',
    color: '#FF2E88',
    tagline: 'Alla festa si nasconde un Traditore',
    rules: [
      'Ognuno gioca dal suo telefono e guarda il suo ruolo di nascosto. I Traditori sono 1, oppure 2 da 7 giocatori in su, e si conoscono tra loro.',
      'Durante la festa gli invitati fanno compiti veloci che riempiono la barra comune. Barra piena: vincono gli invitati. Anche chi è fuori continua a fare compiti.',
      'Il Traditore ha compiti finti per fingere e due azioni: Smaschera un invitato (ricarica 30 s) e Spegni le luci, una volta per festa: 10 s al buio, a meno che due invitati premano insieme Riaccendi.',
      'Chi viene smascherato lo vede sul telefono e deve stare zitto.',
      'A fine festa, o quando qualcuno preme Riunione (una volta a testa), si scopre chi è fuori, si discute a voce per 60 s e si vota di nascosto. Il più votato esce e si scopre se era un Traditore; in parità non esce nessuno.',
      'Gli invitati vincono anche se tutti i Traditori sono fuori. I Traditori vincono se sono tanti quanti gli invitati rimasti.',
    ],
    hiddenInfo: true,
    minutes: 10,
    humansOnly: true,
    onlineOnly: true,
  },
  setup({ players, seed }) {
    const s: BalloState = {
      rng: seed,
      players,
      phase: 'roles',
      traitors: [],
      seen: Array(players).fill(false),
      clock: 0,
      phaseEnd: 0,
      bar: 0,
      barGoal: (players - balloTraitorCount(players)) * TASKS_PER_GUEST,
      tasks: [],
      out: Array(players).fill(false),
      announced: Array(players).fill(false),
      unannounced: [],
      killReady: Array(players).fill(0),
      lightsUntil: 0,
      lightsUsed: false,
      relight: null,
      meetingUsed: Array(players).fill(false),
      meeting: null,
      ready: Array(players).fill(false),
      votes: Array(players).fill(null),
      outcome: null,
      winner: null,
      reason: '',
    };
    s.traitors = shuffle(s, Array.from({ length: players }, (_, i) => i)).slice(0, balloTraitorCount(players));
    s.tasks = Array.from({ length: players }, () => newTask(s, null));
    return s;
  },
  activePlayers(s) {
    switch (s.phase) {
      case 'roles':
        return seats(s).filter((p) => !s.seen[p]);
      // Tutti a qualsiasi titolo: la lista dei presenti non deve tradire chi è stato smascherato.
      case 'festa':
        return seats(s);
      case 'discussione':
        return seats(s).filter((p) => !s.out[p] && !s.ready[p]);
      case 'voto':
        return seats(s).filter((p) => !s.out[p] && s.votes[p] === null);
      default:
        return [];
    }
  },
  play(s, seat, move) {
    switch (move.type) {
      case 'seen':
        assert(s.phase === 'roles', 'La festa è già iniziata.');
        s.seen[seat] = true;
        if (s.seen.every(Boolean)) startFesta(s);
        return;
      case 'task': {
        assert(s.phase === 'festa', 'La festa è in pausa.');
        assert(s.lightsUntil === 0, 'Le luci sono spente.');
        // Un doppio invio non conta: il compito è già stato consegnato.
        if (move.n !== s.tasks[seat].n) return;
        s.tasks[seat] = newTask(s, s.tasks[seat]);
        if (isTraitor(s, seat)) return;
        s.bar++;
        if (s.bar >= s.barGoal) finish(s, 'invitati', 'La festa è riuscita: barra piena');
        return;
      }
      case 'kill': {
        assert(s.phase === 'festa', 'Si può smascherare solo durante la festa.');
        assert(isTraitor(s, seat) && !s.out[seat], 'Non puoi smascherare.');
        assert(s.clock >= s.killReady[seat], 'Devi aspettare la ricarica.');
        assert(Number.isInteger(move.target) && move.target >= 0 && move.target < s.players && !s.out[move.target] && !isTraitor(s, move.target), 'Scegli un invitato ancora in gioco.');
        s.out[move.target] = true;
        s.unannounced.push(move.target);
        s.killReady[seat] = s.clock + BALLO_KILL_MS;
        if (traitorsWin(s)) finish(s, 'traditori', 'I Traditori sono tanti quanti gli invitati');
        return;
      }
      case 'lights':
        assert(s.phase === 'festa', 'Le luci si spengono solo durante la festa.');
        assert(isTraitor(s, seat) && !s.out[seat], 'Non puoi spegnere le luci.');
        assert(!s.lightsUsed, 'Le hai già spente in questa festa.');
        s.lightsUsed = true;
        s.lightsUntil = s.clock + BALLO_LIGHTS_MS;
        s.relight = null;
        return;
      case 'relight':
        assert(s.phase === 'festa', 'La festa è in pausa.');
        assert(!s.out[seat], 'Sei fuori: non puoi riaccendere.');
        if (s.lightsUntil === 0) return;
        // Il Traditore può premere per fingere, ma il suo tocco non conta.
        if (isTraitor(s, seat)) return;
        if (s.relight && s.relight.seat !== seat && s.clock - s.relight.at <= BALLO_RELIGHT_WINDOW_MS) {
          s.lightsUntil = 0;
          s.relight = null;
        } else s.relight = { seat, at: s.clock };
        return;
      case 'meeting':
        assert(s.phase === 'festa', 'La festa è già in pausa.');
        assert(!s.out[seat], 'Sei fuori: non puoi chiamare la riunione.');
        assert(!s.meetingUsed[seat], 'Hai già chiamato la tua riunione.');
        s.meetingUsed[seat] = true;
        startMeeting(s, seat);
        return;
      case 'ready':
        assert(s.phase === 'discussione' && !s.out[seat], 'Non stai discutendo.');
        s.ready[seat] = true;
        if (seats(s).every((p) => s.out[p] || s.ready[p])) startVote(s);
        return;
      case 'vote':
        assert(s.phase === 'voto' && !s.out[seat], 'Non puoi votare adesso.');
        assert(move.target === BALLO_SKIP || (Number.isInteger(move.target) && move.target >= 0 && move.target < s.players && !s.out[move.target]), 'Si vota solo chi è in gioco.');
        s.votes[seat] = move.target;
        if (seats(s).every((p) => s.out[p] || s.votes[p] !== null)) endVote(s);
        return;
    }
  },
  view(s, me) {
    const traitor = me !== null && isTraitor(s, me);
    const over = s.phase === 'fine';
    const left = (at: number) => Math.max(0, at - s.clock);
    return {
      players: s.players,
      phase: s.phase,
      left: s.phase === 'roles' || over ? null : left(s.phaseEnd),
      bar: s.bar,
      barGoal: s.barGoal,
      out: seats(s).map((p) => s.announced[p] || (s.out[p] && (over || p === me || traitor))),
      role: me === null ? null : traitor ? 'traditore' : 'invitato',
      traitors: traitor || over ? s.traitors : [],
      task: me === null ? null : s.tasks[me],
      killLeft: traitor ? left(s.killReady[me]) : 0,
      lightsLeft: s.lightsUntil ? left(s.lightsUntil) : 0,
      lightsUsed: traitor ? s.lightsUsed : false,
      meetingUsed: me === null ? true : s.meetingUsed[me],
      seen: s.seen.filter(Boolean).length,
      iSaw: me !== null && s.seen[me],
      meeting: s.meeting,
      ready: s.ready.filter(Boolean).length,
      iReady: me !== null && s.ready[me],
      voted: s.votes.filter((v) => v !== null).length,
      myVote: me === null ? null : s.votes[me],
      outcome: s.outcome,
      winner: s.winner,
      reason: s.reason,
    };
  },
  result(s) {
    if (s.winner === null) return null;
    return { winners: seats(s).filter((p) => isTraitor(s, p) === (s.winner === 'traditori')), summary: s.reason };
  },
  // Non si gioca col computer: serve solo alle prove automatiche delle regole.
  bot(s, seat) {
    if (s.phase === 'roles') return { type: 'seen' };
    if (s.phase === 'discussione') return { type: 'ready' };
    if (s.phase === 'voto') {
      const options = [BALLO_SKIP, ...seats(s).filter((p) => !s.out[p])];
      return { type: 'vote', target: options[randomInt(s, options.length)] };
    }
    if (isTraitor(s, seat) && !s.out[seat] && s.clock >= s.killReady[seat]) {
      const targets = seats(s).filter((p) => !s.out[p] && !isTraitor(s, p));
      return { type: 'kill', target: targets[randomInt(s, targets.length)] };
    }
    return { type: 'task', n: s.tasks[seat].n };
  },
  advance(s, ms) {
    s.clock += ms;
    if (s.lightsUntil && s.clock >= s.lightsUntil) {
      s.lightsUntil = 0;
      s.relight = null;
    }
    // Se è passato molto tempo può scadere più di una fase di fila.
    while (s.phase !== 'roles' && s.phase !== 'fine' && s.clock >= s.phaseEnd) {
      if (s.phase === 'festa') startMeeting(s, null);
      else if (s.phase === 'discussione') startVote(s);
      else if (s.phase === 'voto') endVote(s);
      else endOutcome(s);
    }
  },
  nextEvent(s) {
    if (s.phase === 'roles' || s.phase === 'fine') return null;
    return Math.max(0, (s.lightsUntil ? Math.min(s.lightsUntil, s.phaseEnd) : s.phaseEnd) - s.clock);
  },
};
