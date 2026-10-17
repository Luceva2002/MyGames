import { assert, type Game, type Seat } from '../../core/types';
import { pick, shuffle, type HasRng } from '../../core/rng';
import { ROLE_ORDER, ROLES, type RoleId, type Team } from './roles';

/**
 * Lupus in Tabula dentro Tavolata. Regole e ruoli sono quelli dell'app Lupus
 * (~/Desktop/Lavori/MyApps/lupus/src/game/engine.ts), riscritti sull'interfaccia comune
 * dei giochi: ogni telefono vede solo il proprio ruolo e le proprie scelte.
 */
export interface LupusSettings {
  roleCounts: Record<RoleId, number>;
  revealRoleOnDeath: boolean;
  guardSelfProtect: boolean;
  guardSameTwice: boolean;
  firstNightKill: boolean;
}

export type DeathCause = 'lupi' | 'veggente' | 'rogo';

export interface LupusState extends HasRng {
  players: number;
  roles: RoleId[];
  alive: boolean[];
  settings: LupusSettings;
  phase: 'reveal' | 'night' | 'day' | 'ended';
  round: number;
  seen: boolean[];
  /** Scelte della notte per posto: -1 = nessuno. */
  nightChoices: Record<number, number>;
  /** Quello che la Veggente ha scoperto, notte per notte. */
  visions: { round: number; target: Seat; wolf: boolean }[];
  lastGuarded: Seat | null;
  lastLynched: Seat | null;
  morning: { deaths: { seat: Seat; cause: DeathCause }[]; owl: Seat | null } | null;
  votes: Record<number, number>;
  lastVote: { target: Seat | null; tally: Record<number, number> } | null;
  winner: Team | null;
}

export type LupusMove = { type: 'seen' } | { type: 'night'; target: Seat | null } | { type: 'vote'; target: Seat | null };

export type NightPrompt =
  | { kind: 'choose'; title: string; instruction: string; options: Seat[]; info?: string }
  | { kind: 'info'; title: string; text: string }
  | { kind: 'sleep'; title: string; text: string };

export interface LupusPlayerView {
  alive: boolean;
  /** Ruolo visibile: il proprio, quello dei compagni che si conoscono, dei morti (se si rivela) o tutti a fine partita. */
  role: RoleId | null;
  hasVoted: boolean;
  hasChosen: boolean;
}

export interface LupusView {
  phase: LupusState['phase'];
  round: number;
  me: Seat | null;
  myRole: RoleId | null;
  teammates: Seat[];
  players: LupusPlayerView[];
  prompt: NightPrompt | null;
  myChoice: number | undefined;
  myVote: number | undefined;
  visions: LupusState['visions'];
  morning: LupusState['morning'];
  lastVote: LupusState['lastVote'];
  lastLynched: Seat | null;
  winner: Team | null;
  seenCount: number;
}

const seats = (s: LupusState) => Array.from({ length: s.players }, (_, i) => i);
const aliveSeats = (s: LupusState) => seats(s).filter((p) => s.alive[p]);
const isWolf = (s: LupusState, p: Seat) => s.roles[p] === 'lupo';

/** Distribuzione equilibrata dei ruoli, la stessa dell'app Lupus. */
export function suggestedCounts(n: number): Record<RoleId, number> {
  const c = Object.fromEntries(ROLE_ORDER.map((r) => [r, 0])) as Record<RoleId, number>;
  c.lupo = n <= 5 ? 1 : n <= 8 ? 2 : n <= 12 ? 3 : Math.floor(n / 4);
  c.veggente = 1;
  if (n >= 6) c.guardia = 1;
  if (n >= 7) c.medium = 1;
  if (n >= 9) c.indemoniato = 1;
  if (n >= 10) c.gufo = 1;
  if (n >= 11) c.massone = 2;
  if (n >= 13) c.criceto = 1;
  const special = ROLE_ORDER.reduce((t, r) => (r === 'villico' ? t : t + c[r]), 0);
  c.villico = Math.max(0, n - special);
  return c;
}

function teammatesOf(s: LupusState, p: Seat): Seat[] {
  if (!ROLES[s.roles[p]].knowsTeammates) return [];
  return seats(s).filter((o) => o !== p && s.roles[o] === s.roles[p]);
}

export function nightPrompt(s: LupusState, p: Seat): NightPrompt {
  const others = aliveSeats(s).filter((o) => o !== p);
  const firstNight = s.round === 1;
  const sleeping = (text = 'Dormi sonni tranquilli: stanotte non hai niente da fare.'): NightPrompt => ({ kind: 'sleep', title: 'Dormi', text });
  switch (s.roles[p]) {
    case 'lupo': {
      const pack = aliveSeats(s).filter((o) => isWolf(s, o) && o !== p);
      const info = pack.length ? `branco:${pack.join(',')}` : 'Sei l’unico Lupo.';
      if (firstNight && !s.settings.firstNightKill) return { kind: 'info', title: 'I Lupi si riconoscono', text: 'Stanotte non si caccia.' };
      return {
        kind: 'choose',
        title: 'Scegli la vittima',
        instruction: 'Chi sbranate stanotte? Se il branco non è d’accordo vince la scelta più votata.',
        options: others.filter((o) => !isWolf(s, o)),
        info,
      };
    }
    case 'veggente':
      return { kind: 'choose', title: 'Scruta un’anima', instruction: 'Scegli un giocatore: scoprirai se è un Lupo.', options: others };
    case 'guardia': {
      let opts = aliveSeats(s);
      if (!s.settings.guardSelfProtect) opts = opts.filter((o) => o !== p);
      if (!s.settings.guardSameTwice && s.lastGuarded !== null) opts = opts.filter((o) => o !== s.lastGuarded);
      return { kind: 'choose', title: 'Proteggi qualcuno', instruction: 'Se i Lupi attaccano chi scegli, sopravvive.', options: opts };
    }
    case 'gufo':
      return { kind: 'choose', title: 'Indica un sospetto', instruction: 'Chi scegli sarà accusato domani mattina.', options: others };
    case 'medium':
      if (s.lastLynched === null) return sleeping('Nessuno è stato mandato al rogo: gli spiriti tacciono.');
      return { kind: 'info', title: 'Gli spiriti parlano', text: `rogo:${s.lastLynched}:${isWolf(s, s.lastLynched) ? 1 : 0}` };
    case 'massone':
      if (firstNight) return { kind: 'info', title: 'La loggia si riunisce', text: 'loggia' };
      return sleeping();
    default:
      return sleeping();
  }
}

const needsChoice = (s: LupusState, p: Seat) => s.alive[p] && nightPrompt(s, p).kind === 'choose';

function computeWinner(s: LupusState): Team | null {
  const alive = aliveSeats(s);
  const wolves = alive.filter((p) => isWolf(s, p)).length;
  let winner: Team | null = null;
  if (wolves === 0) winner = 'villaggio';
  else if (wolves >= alive.length - wolves) winner = 'lupi';
  if (winner && alive.some((p) => s.roles[p] === 'criceto')) winner = 'criceto';
  return winner;
}

function checkWinner(s: LupusState) {
  const w = computeWinner(s);
  if (w) {
    s.winner = w;
    s.phase = 'ended';
  }
}

function plurality(s: LupusState, votes: number[]): Seat | null {
  const valid = votes.filter((v) => v >= 0);
  if (!valid.length) return null;
  const tally = new Map<number, number>();
  for (const v of valid) tally.set(v, (tally.get(v) ?? 0) + 1);
  const best = Math.max(...tally.values());
  return pick(s, [...tally.entries()].filter(([, n]) => n === best).map(([k]) => k));
}

function resolveNight(s: LupusState) {
  const byRole = (role: RoleId) => aliveSeats(s).filter((p) => s.roles[p] === role && p in s.nightChoices).map((p) => s.nightChoices[p]);
  const victim = plurality(s, byRole('lupo'));
  const guarded = byRole('guardia').find((v) => v >= 0) ?? null;
  const seen = byRole('veggente').find((v) => v >= 0) ?? null;
  const owl = byRole('gufo').find((v) => v >= 0) ?? null;
  const deaths: { seat: Seat; cause: DeathCause }[] = [];
  if (victim !== null && victim !== guarded && s.roles[victim] !== 'criceto') deaths.push({ seat: victim, cause: 'lupi' });
  if (seen !== null && s.roles[seen] === 'criceto' && !deaths.some((d) => d.seat === seen)) deaths.push({ seat: seen, cause: 'veggente' });
  for (const d of deaths) s.alive[d.seat] = false;
  s.lastGuarded = guarded;
  s.morning = { deaths, owl: owl !== null && s.alive[owl] ? owl : null };
  s.nightChoices = {};
  s.votes = {};
  s.phase = 'day';
  checkWinner(s);
}

function resolveVote(s: LupusState) {
  const tally: Record<number, number> = {};
  for (const v of Object.values(s.votes)) if (v >= 0) tally[v] = (tally[v] ?? 0) + 1;
  const entries = Object.entries(tally);
  let target: Seat | null = null;
  if (entries.length) {
    const best = Math.max(...entries.map(([, n]) => n));
    const top = entries.filter(([, n]) => n === best);
    // In parità non si manda nessuno al rogo, come nell'app Lupus.
    if (top.length === 1) target = Number(top[0][0]);
  }
  if (target !== null) s.alive[target] = false;
  s.lastVote = { target, tally };
  s.lastLynched = target;
  s.round++;
  s.morning = null;
  s.votes = {};
  s.phase = 'night';
  checkWinner(s);
  if (s.phase === 'night' && !aliveSeats(s).some((p) => needsChoice(s, p))) resolveNight(s);
}

function afterNightChoice(s: LupusState) {
  if (aliveSeats(s).every((p) => !needsChoice(s, p) || p in s.nightChoices)) resolveNight(s);
}

export const lupus: Game<LupusState, LupusMove, LupusView> = {
  meta: {
    id: 'lupus',
    name: 'Lupus',
    category: 'party',
    minPlayers: 4,
    maxPlayers: 20,
    emoji: '🐺',
    color: '#34495E',
    tagline: 'Lupi contro villaggio, ruoli segreti sul telefono',
    rules: [
      'Ognuno riceve un ruolo segreto: guardalo sul tuo telefono senza farlo vedere.',
      'Di notte i Lupi scelgono una vittima, la Veggente scruta, la Guardia protegge, il Gufo accusa.',
      'Di giorno si discute a voce e poi si vota in segreto chi mandare al rogo. In parità non muore nessuno.',
      'Il villaggio vince se elimina tutti i Lupi; i Lupi vincono quando sono tanti quanti gli altri. Il Criceto Mannaro vince da solo se arriva vivo alla fine.',
    ],
    hiddenInfo: true,
    minutes: 30,
  },
  setup({ players, seed }) {
    const s = {
      rng: seed,
      players,
      alive: Array(players).fill(true),
      settings: { roleCounts: suggestedCounts(players), revealRoleOnDeath: true, guardSelfProtect: false, guardSameTwice: false, firstNightKill: true },
      phase: 'reveal',
      round: 1,
      seen: Array(players).fill(false),
      nightChoices: {},
      visions: [],
      lastGuarded: null,
      lastLynched: null,
      morning: null,
      votes: {},
      lastVote: null,
      winner: null,
    } as unknown as LupusState;
    const deck: RoleId[] = [];
    for (const r of ROLE_ORDER) for (let i = 0; i < s.settings.roleCounts[r]; i++) deck.push(r);
    s.roles = shuffle(s, deck);
    return s;
  },
  activePlayers(s) {
    if (s.phase === 'reveal') return seats(s).filter((p) => !s.seen[p]);
    if (s.phase === 'night') return aliveSeats(s).filter((p) => needsChoice(s, p) && !(p in s.nightChoices));
    if (s.phase === 'day') return aliveSeats(s).filter((p) => !(p in s.votes));
    return [];
  },
  play(s, seat, move) {
    if (move.type === 'seen') {
      assert(s.phase === 'reveal', 'I ruoli sono già stati guardati.');
      s.seen[seat] = true;
      if (s.seen.every(Boolean)) {
        s.phase = 'night';
        afterNightChoice(s);
      }
      return;
    }
    if (move.type === 'night') {
      assert(s.phase === 'night', 'Non è notte.');
      const prompt = nightPrompt(s, seat);
      assert(prompt.kind === 'choose', 'Stanotte non hai niente da scegliere.');
      assert(move.target === null || prompt.options.includes(move.target), 'Scelta non valida.');
      s.nightChoices[seat] = move.target ?? -1;
      if (s.roles[seat] === 'veggente' && move.target !== null) s.visions.push({ round: s.round, target: move.target, wolf: isWolf(s, move.target) });
      afterNightChoice(s);
      return;
    }
    assert(s.phase === 'day', 'Si vota solo di giorno.');
    assert(s.alive[seat], 'I morti non votano.');
    assert(move.target === null || (s.alive[move.target] && move.target !== seat), 'Voto non valido.');
    s.votes[seat] = move.target ?? -1;
    if (aliveSeats(s).every((p) => p in s.votes)) resolveVote(s);
  },
  view(s, me) {
    const ended = s.phase === 'ended';
    const mates = me === null ? [] : teammatesOf(s, me);
    return {
      phase: s.phase,
      round: s.round,
      me,
      myRole: me === null ? null : s.roles[me],
      teammates: mates,
      players: seats(s).map((p) => ({
        alive: s.alive[p],
        role: ended || p === me || mates.includes(p) || (!s.alive[p] && s.settings.revealRoleOnDeath) ? s.roles[p] : null,
        hasVoted: p in s.votes,
        hasChosen: s.seen[p] && s.phase === 'reveal',
      })),
      prompt: me !== null && s.phase === 'night' && s.alive[me] ? nightPrompt(s, me) : null,
      myChoice: me === null ? undefined : s.nightChoices[me],
      myVote: me === null ? undefined : s.votes[me],
      visions: me !== null && s.roles[me] === 'veggente' ? s.visions : [],
      morning: s.morning,
      lastVote: s.lastVote,
      lastLynched: s.lastLynched,
      winner: s.winner,
      seenCount: s.seen.filter(Boolean).length,
    };
  },
  result(s) {
    if (!s.winner) return null;
    const winners = seats(s).filter((p) => ROLES[s.roles[p]].team === s.winner);
    return { winners, summary: `Vince ${s.winner === 'villaggio' ? 'il villaggio' : s.winner === 'lupi' ? 'il branco dei Lupi' : 'il Criceto Mannaro'}` };
  },
  bot(s, seat) {
    if (s.phase === 'reveal') return { type: 'seen' };
    if (s.phase === 'night') {
      const prompt = nightPrompt(s, seat);
      return { type: 'night', target: prompt.kind === 'choose' && prompt.options.length ? pick(s, prompt.options) : null };
    }
    // Di giorno: la Veggente accusa un Lupo scoperto, i Lupi non votano i compagni, gli altri seguono il Gufo o tirano a caso.
    const options = aliveSeats(s).filter((p) => p !== seat && !(isWolf(s, seat) && isWolf(s, p)));
    const known = s.roles[seat] === 'veggente' ? s.visions.find((v) => v.wolf && s.alive[v.target])?.target : undefined;
    const owl = s.morning?.owl ?? undefined;
    const target = known ?? (owl !== undefined && options.includes(owl) ? owl : options.length ? pick(s, options) : null);
    return { type: 'vote', target };
  },
  pause: () => 900,
};

export { ROLES, ROLE_ORDER } from './roles';
export type { RoleId, Team } from './roles';
