import { advanceTime, applyMove, ballo, BALLO_FESTA_MS, BALLO_KILL_MS, BALLO_LIGHTS_MS, BALLO_SKIP, type BalloState, battaglia, botMove, colorwars, hLine, mosaico, MOSAICO_IDS, MOSAICO_PIECES, mosaicoLeft, mosaicoMoves, mosaicoShape, NAVALE_FLEET, puntielinee, randomFleet, shipCells, vLine, mrwhite, sameWord, burracoKind, BURRACO_RULES, checkMeld, captureOptions, damaMoves, primieraScore, scacchi, scoreFor, setteValue, unoDeck, type Card, type ChessState } from '../src';

const it = (suit: string, rank: number): Card => ({ id: `it-${suit}${rank}`, deck: 'it', suit, rank });

function eq(a: unknown, b: unknown, msg: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: atteso ${JSON.stringify(b)}, ottenuto ${JSON.stringify(a)}`);
}

const sq = (name: string) => (8 - Number(name[1])) * 8 + (name.charCodeAt(0) - 97);
function chess(moves: string[]): ChessState {
  let s = scacchi.setup({ players: 2, seed: 1 });
  for (const m of moves) s = applyMove(scacchi, s, s.turn, { from: sq(m.slice(0, 2)), to: sq(m.slice(2, 4)) });
  return s;
}

export const checks: { name: string; fn: () => void }[] = [
  {
    name: 'scacchi: matto del barbiere al contrario (matto dell’imbecille)',
    fn: () => eq(scacchi.result(chess(['f2f3', 'e7e5', 'g2g4', 'd8h4']))?.summary, 'Scacco matto', 'esito'),
  },
  {
    name: 'scacchi: arrocco corto',
    fn: () => {
      const s = chess(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'e1g1']);
      eq([s.board[sq('g1')], s.board[sq('f1')]], ['K', 'R'], 're e torre');
    },
  },
  {
    name: 'scacchi: presa al passo',
    fn: () => {
      const s = chess(['e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6']);
      eq(s.board[sq('d5')], null, 'pedone preso');
    },
  },
  {
    name: 'dama: presa obbligatoria',
    fn: () => {
      const board = Array(64).fill(null);
      board[5 * 8 + 2] = { owner: 0, king: false };
      board[4 * 8 + 3] = { owner: 1, king: false };
      board[6 * 8 + 7] = { owner: 0, king: false };
      const moves = damaMoves(board, 0);
      eq(moves.map((m) => m.captured.length), [1], 'solo la presa');
    },
  },
  {
    name: 'dama: la pedina non mangia la dama',
    fn: () => {
      const board = Array(64).fill(null);
      board[5 * 8 + 2] = { owner: 0, king: false };
      board[4 * 8 + 3] = { owner: 1, king: true };
      eq(damaMoves(board, 0).some((m) => m.captured.length), false, 'nessuna presa');
    },
  },
  {
    name: 'sette e mezzo: la matta vale quanto serve',
    fn: () => eq(setteValue([it('d', 10), it('c', 5)]), 7, 'valore'),
  },
  {
    name: 'burraco: pulito e sporco',
    fn: () => {
      const fr = (suit: string, rank: number, n = 0): Card => ({ id: `fr${n}-${suit}${rank}`, deck: 'fr', suit, rank });
      const run = [3, 4, 5, 6, 7, 8, 9].map((r) => fr('h', r));
      eq(burracoKind(checkMeld(run, BURRACO_RULES)!), 'pulito', 'scala naturale');
      const dirty = [...run.slice(0, 6), fr('s', 2)];
      eq(burracoKind(checkMeld(dirty, BURRACO_RULES)!), 'sporco', 'con pinella');
      const pinellaNatural = [fr('h', 1), fr('h', 2), ...[3, 4, 5, 6, 7].map((r) => fr('h', r, 1))];
      eq(burracoKind(checkMeld(pinellaNatural, BURRACO_RULES)!), 'pulito', 'pinella al suo posto');
    },
  },
  { name: 'uno: 108 carte', fn: () => eq(unoDeck().length, 108, 'mazzo') },
  { name: 'yahtzee: scala grande', fn: () => eq(scoreFor('scala', [2, 3, 4, 5, 6]), 40, 'punti') },
  {
    name: 'scopa: la carta uguale ha la precedenza sulla somma',
    fn: () => {
      const opts = captureOptions([it('d', 3), it('c', 4), it('s', 7)], it('b', 7));
      eq(opts.map((o) => o.map((c) => c.id)), [['it-s7']], 'prese');
    },
  },
  {
    name: 'scopa: prese per somma',
    fn: () => {
      const opts = captureOptions([it('d', 3), it('c', 4), it('s', 2), it('b', 5)], it('b', 7));
      eq(opts.length, 2, 'numero di prese'); // 3+4, 2+5
    },
  },
  {
    name: 'scopa: primiera',
    fn: () => eq(primieraScore([it('d', 7), it('c', 6), it('s', 1), it('b', 10)]), 21 + 18 + 16 + 10, 'primiera'),
  },
  {
    name: 'mr. white: indovina la parola anche senza accenti e articolo',
    fn: () => {
      eq([sameWord('il caffe', 'Caffè'), sameWord('Lenti a contatto', 'lenti-a-contatto'), sameWord('', 'Tè'), sameWord('tè', 'Te')], [true, true, false, true], 'confronto');
    },
  },
  {
    name: 'mr. white: eliminato e indovina, vince da solo',
    fn: () => {
      let s = mrwhite.setup({ players: 5, seed: 3 });
      s = applyMove(mrwhite, s, 0, { type: 'setup', undercover: true, shared: true });
      eq([s.roles.filter((r) => r === 'mrwhite').length, s.roles.filter((r) => r === 'undercover').length], [1, 1], 'ruoli');
      for (let p = 0; p < 5; p++) s = applyMove(mrwhite, s, p, { type: 'seen' });
      eq(s.roles[s.starter] !== 'mrwhite', true, 'Mr. White non parla per primo');
      eq(mrwhite.view(s, s.holder).myWord, null, 'col telefono sul tavolo la parola non si vede');
      s = applyMove(mrwhite, s, s.holder, { type: 'toVote' });
      const white = s.roles.indexOf('mrwhite');
      s = applyMove(mrwhite, s, s.holder, { type: 'eliminate', target: white });
      eq(mrwhite.activePlayers(s), [white], 'tocca a Mr. White indovinare');
      s = applyMove(mrwhite, s, white, { type: 'guess', word: s.words.civile.toUpperCase() });
      eq(mrwhite.result(s)?.winners, [white], 'vincitore');
    },
  },
  {
    name: 'mr. white: parità al voto, si rivota fra i pari merito',
    fn: () => {
      let s = mrwhite.setup({ players: 4, seed: 9 });
      s = applyMove(mrwhite, s, 0, { type: 'setup', undercover: true, shared: false });
      eq(s.undercover, false, 'con 4 giocatori niente Undercover');
      for (let p = 0; p < 4; p++) s = applyMove(mrwhite, s, p, { type: 'seen' });
      s = applyMove(mrwhite, s, s.starter, { type: 'toVote' });
      for (const [p, t] of [[0, 1], [1, 0], [2, 1], [3, 0]]) s = applyMove(mrwhite, s, p, { type: 'vote', target: t });
      eq([s.phase, s.runoff, mrwhite.activePlayers(s)], ['vote', [0, 1], [2, 3]], 'ballottaggio');
    },
  },
  {
    name: 'mosaico: 21 pezzi diversi per 89 quadretti',
    fn: () => {
      eq(MOSAICO_IDS.length, 21, 'pezzi');
      eq(mosaicoLeft(MOSAICO_IDS), 89, 'quadretti');
      const forms = new Set(MOSAICO_IDS.map((id) => {
        const all = [false, true].flatMap((f) => [0, 1, 2, 3].map((r) => JSON.stringify(mosaicoShape(id, r, f)))).sort();
        return all[0];
      }));
      eq(forms.size, 21, 'nessun pezzo è un altro girato');
    },
  },
  {
    name: 'mosaico: griglia e angoli per giocatori',
    fn: () => {
      eq(mosaico.setup({ players: 2, seed: 1 }).size, 14, 'in due');
      eq(mosaico.setup({ players: 3, seed: 1 }).size, 17, 'in tre');
      eq(mosaico.setup({ players: 4, seed: 1 }).size, 20, 'in quattro');
      eq(mosaico.setup({ players: 4, seed: 1 }).starts, [380, 0, 19, 399], 'angoli');
    },
  },
  {
    name: 'mosaico: primo pezzo sull’angolo, poi solo spigoli e mai lati',
    fn: () => {
      let s = mosaico.setup({ players: 2, seed: 1 });
      const m = (piece: string, x: number, y: number) => ({ piece, rot: 0, flip: false, x, y });
      const throws = (seat: number, mv: ReturnType<typeof m>, msg: string) => {
        let ok = false;
        try {
          applyMove(mosaico, s, seat, mv);
        } catch {
          ok = true;
        }
        if (!ok) throw new Error(msg);
      };
      throws(0, m('i1', 5, 5), 'primo pezzo lontano dall’angolo');
      s = applyMove(mosaico, s, 0, m('i1', 0, 13));
      s = applyMove(mosaico, s, 1, m('i1', 13, 0));
      throws(0, m('i1', 1, 13), 'tocca per un lato');
      throws(0, m('i1', 5, 5), 'non tocca niente');
      throws(0, m('i1', 2, 11), 'pezzo già giocato');
      s = applyMove(mosaico, s, 0, m('i2', 1, 12));
      eq(s.board[12 * 14 + 1], 0, 'spigolo valido');
      eq(s.turn, 1, 'turno');
      throws(1, m('i2', 12, 1), 'un pezzo che tocca il suo angolo per un lato non va bene') ;
    },
  },
  {
    name: 'mosaico: chi non può muovere passa, a fine partita meno quadretti vince',
    fn: () => {
      let s = mosaico.setup({ players: 2, seed: 5 });
      // Il posto 1 è chiuso in un angolo: la casella sullo spigolo è presa, quelle di lato non si possono usare.
      s = applyMove(mosaico, s, 0, { piece: 'i1', rot: 0, flip: false, x: 0, y: 13 });
      s.board[14 + 12] = 0;
      s = applyMove(mosaico, s, 1, { piece: 'i1', rot: 0, flip: false, x: 13, y: 0 });
      eq(mosaicoMoves(s, 1).length, 0, 'il posto 1 non ha mosse');
      s = applyMove(mosaico, s, 0, botMove(mosaico, s, 0));
      eq([s.turn, s.stuck[1]], [0, true], 'il posto 1 passa e tocca ancora a 0');
      while (!mosaico.result(s)) s = applyMove(mosaico, s, 0, botMove(mosaico, s, 0));
      const r = mosaico.result(s)!;
      eq([r.winners, r.lowWins, r.scores![1]], [[0], true, 88], 'vince chi ha meno quadretti');
    },
  },
  {
    name: 'mosaico: il computer gioca il pezzo più grande valido',
    fn: () => {
      const s = mosaico.setup({ players: 2, seed: 3 });
      eq(MOSAICO_PIECES[mosaico.bot!(s, 0).piece].length, 5, 'primo pezzo da 5');
    },
  },
  {
    name: 'punti e linee: chi chiude colora e rigioca, chi no passa la mano',
    fn: () => {
      let s = puntielinee.setup({ players: 2, seed: 1 });
      eq([s.lines.length, s.boxes.length], [40, 16], 'griglia 5×5 punti');
      s = applyMove(puntielinee, s, 0, { line: hLine(5, 0, 0) });
      eq(s.turn, 1, 'linea senza chiudere: turno all’altro');
      s = applyMove(puntielinee, s, 1, { line: hLine(5, 1, 0) });
      s = applyMove(puntielinee, s, 0, { line: vLine(5, 0, 0) });
      s = applyMove(puntielinee, s, 1, { line: vLine(5, 0, 1) });
      eq([s.boxes[0], s.turn], [1, 1], 'chi chiude rigioca');
    },
  },
  {
    name: 'punti e linee: griglia a scelta solo prima di iniziare',
    fn: () => {
      let s = puntielinee.setup({ players: 3, seed: 1 });
      s = applyMove(puntielinee, s, 0, { dots: 6 });
      eq([s.boxes.length, s.turn], [25, 0], 'griglia 6×6');
      s = applyMove(puntielinee, s, 0, { line: 0 });
      let refused = false;
      try {
        applyMove(puntielinee, s, 1, { dots: 4 });
      } catch {
        refused = true;
      }
      eq(refused, true, 'a partita iniziata non si cambia');
    },
  },
  {
    name: 'punti e linee: il computer chiude se può ed evita il terzo lato',
    fn: () => {
      let s = puntielinee.setup({ players: 2, seed: 2 });
      s = { ...s, lines: [...s.lines] };
      const closing = vLine(5, 0, 1);
      for (const l of [hLine(5, 0, 0), hLine(5, 1, 0), vLine(5, 0, 0)]) s.lines[l] = 0;
      eq(puntielinee.bot!(JSON.parse(JSON.stringify(s)), 1), { line: closing }, 'chiude il quadrato');
      s = puntielinee.setup({ players: 2, seed: 2 });
      for (const l of [hLine(5, 0, 0), hLine(5, 1, 0)]) s.lines[l] = 0;
      for (let i = 0; i < 30; i++) {
        s.rng = i;
        const { line } = puntielinee.bot!(JSON.parse(JSON.stringify(s)), 1) as { line: number };
        if (line === vLine(5, 0, 0) || line === vLine(5, 0, 1)) throw new Error('ha dato il terzo lato');
      }
    },
  },
  {
    name: 'color wars: si parte da 3 punti, a 4 esplode e conquista a catena',
    fn: () => {
      let s = colorwars.setup({ players: 3, seed: 1 });
      s = applyMove(colorwars, s, 0, { cell: 12 });
      s = applyMove(colorwars, s, 1, { cell: 13 });
      s = applyMove(colorwars, s, 2, { cell: 0 });
      eq([s.cells[12], s.cells[13]], [{ o: 0, v: 3 }, { o: 1, v: 3 }], 'celle da 3');
      s = applyMove(colorwars, s, 0, { cell: 12 });
      // Il centro esplode e la vicina diventa 4: esplode anche lei.
      eq(s.chain.frames.length, 3, 'passi della catena (partenza + 2 esplosioni)');
      eq(s.chain.frames[1].boom, [12], 'prima esplosione');
      eq(s.chain.frames[2].boom, [13], 'seconda esplosione');
      eq(s.cells.some((c) => c?.o === 1), false, 'il posto 1 non ha più celle');
      eq(s.turn, 2, 'tocca al posto 2');
      s = colorwars.setup({ players: 2, seed: 1 });
      s = applyMove(colorwars, s, 0, { cell: 12 });
      s = applyMove(colorwars, s, 1, { cell: 13 });
      s = applyMove(colorwars, s, 0, { cell: 12 });
      eq(colorwars.result(s)?.winners, [0], 'resta da solo: ha vinto');
    },
  },
  {
    name: 'color wars: i punti mandati fuori griglia si perdono, chi è fuori non gioca più',
    fn: () => {
      let s = colorwars.setup({ players: 3, seed: 1 });
      s = applyMove(colorwars, s, 0, { cell: 0 });
      s = applyMove(colorwars, s, 1, { cell: 1 });
      s = applyMove(colorwars, s, 2, { cell: 24 });
      s = applyMove(colorwars, s, 0, { cell: 0 });
      // L'angolo esplode, la cella 1 passa a 0 e arriva a 4, esplode anche lei: il posto 1 è fuori.
      eq(s.cells.some((c) => c?.o === 1), false, 'posto 1 senza celle');
      eq(s.turn, 2, 'il turno salta chi è fuori');
      eq(colorwars.result(s), null, 'si continua');
    },
  },
  {
    name: 'battaglia navale: chi guarda non vede le navi altrui finché non affonda',
    fn: () => {
      let s = battaglia.setup({ players: 2, seed: 1 });
      const fleet = [{ x: 0, y: 0, len: 5, h: true }, { x: 0, y: 1, len: 4, h: true }, { x: 0, y: 2, len: 3, h: true }, { x: 0, y: 3, len: 3, h: true }, { x: 0, y: 4, len: 2, h: true }];
      s = applyMove(battaglia, s, 0, { type: 'place', ships: fleet });
      eq(battaglia.activePlayers(s), [1], 'manca il posto 1');
      s = applyMove(battaglia, s, 1, { type: 'place', ships: fleet.map((f) => ({ ...f, y: f.y + 5 })) });
      eq(s.phase, 'battle', 'si parte');
      const peek = JSON.stringify(battaglia.view(s, 0));
      eq(peek.includes('"y":5'), false, 'il posto 0 non vede la flotta del posto 1');
      eq(JSON.stringify(battaglia.view(s, null)).includes('"len"'), false, 'lo schermo non vede nessuna flotta');
      eq(peek.includes('rng'), false, 'niente semi nella vista');
      s = applyMove(battaglia, s, 0, { type: 'shot', cell: 99 });
      eq([s.last?.outcome, s.turn], ['acqua', 1], 'acqua');
      s = applyMove(battaglia, s, 1, { type: 'shot', cell: 40 });
      eq(s.last?.outcome, 'colpito', 'colpito');
      s = applyMove(battaglia, s, 0, { type: 'shot', cell: 98 });
      s = applyMove(battaglia, s, 1, { type: 'shot', cell: 41 });
      eq([s.last?.outcome, s.last?.len], ['affondato', 2], 'affondato');
      eq(battaglia.view(s, 1).seas[0].sunk.length, 1, 'la nave affondata si vede');
    },
  },
  {
    name: 'battaglia navale: flotte non valide rifiutate, a caso sempre valide',
    fn: () => {
      const s = battaglia.setup({ players: 2, seed: 1 });
      const bad = [{ x: 0, y: 0, len: 5, h: true }, { x: 0, y: 0, len: 4, h: true }, { x: 0, y: 2, len: 3, h: true }, { x: 0, y: 3, len: 3, h: true }, { x: 0, y: 4, len: 2, h: true }];
      let refused = false;
      try {
        applyMove(battaglia, s, 0, { type: 'place', ships: bad });
      } catch {
        refused = true;
      }
      eq(refused, true, 'sovrapposte');
      for (let i = 0; i < 50; i++) {
        let r = i * 1000 + 1;
        const f = randomFleet(() => (r = (r * 16807) % 2147483647) / 2147483647);
        eq(f.map((x) => x.len), NAVALE_FLEET, 'flotta');
        eq(new Set(f.flatMap(shipCells)).size, 17, 'nessuna sovrapposizione');
      }
    },
  },
  {
    name: 'battaglia navale: il computer insiste dove ha colpito',
    fn: () => {
      let s = battaglia.setup({ players: 2, seed: 4 });
      const fleet = [{ x: 0, y: 0, len: 5, h: true }, { x: 0, y: 2, len: 4, h: true }, { x: 0, y: 4, len: 3, h: true }, { x: 0, y: 6, len: 3, h: true }, { x: 0, y: 8, len: 2, h: true }];
      s = applyMove(battaglia, s, 0, { type: 'place', ships: fleet });
      s = applyMove(battaglia, s, 1, battaglia.bot!(JSON.parse(JSON.stringify(s)), 1));
      s = applyMove(battaglia, s, 0, { type: 'shot', cell: 0 });
      s.shots[1].push(41);
      const next = battaglia.bot!(JSON.parse(JSON.stringify(s)), 1) as { cell: number };
      eq([31, 51, 40, 42].includes(next.cell), true, 'spara accanto al colpo a segno');
    },
  },
  ...balloChecks(),
];

function balloStart(players: number, seed = 1): BalloState {
  let s = ballo.setup({ players, seed });
  for (let p = 0; p < players; p++) s = applyMove(ballo, s, p, { type: 'seen' });
  return s;
}
const later = (s: BalloState, ms: number) => advanceTime(ballo, s, ms);
const guestsOf = (s: BalloState) => Array.from({ length: s.players }, (_, p) => p).filter((p) => !s.traitors.includes(p));
function refused(fn: () => unknown, msg: string) {
  let ok = false;
  try {
    fn();
  } catch {
    ok = true;
  }
  if (!ok) throw new Error(msg);
}
function voteOut(s: BalloState, target: number): BalloState {
  for (let p = 0; p < s.players; p++) if (!s.out[p]) s = applyMove(ballo, s, p, { type: 'ready' });
  for (let p = 0; p < s.players; p++) if (!s.out[p]) s = applyMove(ballo, s, p, { type: 'vote', target });
  return s;
}

function balloChecks(): { name: string; fn: () => void }[] {
  return [
    {
      name: 'ballo: 1 traditore fino a 6 giocatori, 2 da 7; chi guarda non vede i ruoli altrui',
      fn: () => {
        eq(ballo.setup({ players: 6, seed: 2 }).traitors.length, 1, 'in sei');
        eq(ballo.setup({ players: 7, seed: 2 }).traitors.length, 2, 'in sette');
        const s = balloStart(7);
        const g = guestsOf(s)[0];
        eq(ballo.view(s, g).traitors, [], 'l’invitato non vede i traditori');
        eq(ballo.view(s, s.traitors[0]).traitors, s.traitors, 'i traditori si conoscono');
        eq([ballo.view(s, null).role, ballo.view(s, null).task, ballo.view(s, null).traitors], [null, null, []], 'lo schermo non vede ruoli né compiti');
        const peek = JSON.stringify(ballo.view(s, g));
        eq(peek.includes('rng'), false, 'niente semi nella vista');
      },
    },
    {
      name: 'ballo: i compiti degli invitati e dei fantasmi riempiono la barra, quelli del traditore no',
      fn: () => {
        let s = balloStart(4);
        const [a, b] = guestsOf(s);
        const t = s.traitors[0];
        s = applyMove(ballo, s, t, { type: 'task', n: s.tasks[t].n });
        eq(s.bar, 0, 'compito finto');
        const n = s.tasks[a].n;
        s = applyMove(ballo, s, a, { type: 'task', n });
        s = applyMove(ballo, s, a, { type: 'task', n });
        eq(s.bar, 1, 'il doppio invio conta una volta');
        s = later(s, 15_000);
        s = applyMove(ballo, s, t, { type: 'kill', target: b });
        s = applyMove(ballo, s, b, { type: 'task', n: s.tasks[b].n });
        eq(s.bar, 2, 'il fantasma continua a contare');
        while (!ballo.result(s)) s = applyMove(ballo, s, a, { type: 'task', n: s.tasks[a].n });
        eq([ballo.result(s)?.winners, s.winner], [guestsOf(s), 'invitati'], 'barra piena');
      },
    },
    {
      name: 'ballo: smascherare ha la ricarica, la vittima lo sa subito, gli altri alla riunione',
      fn: () => {
        let s = balloStart(5);
        const t = s.traitors[0];
        const [a, b, c] = guestsOf(s);
        refused(() => applyMove(ballo, s, t, { type: 'kill', target: a }), 'appena iniziata non si può');
        refused(() => applyMove(ballo, later(s, 15_000), a, { type: 'kill', target: b }), 'solo il traditore');
        s = later(s, 15_000);
        s = applyMove(ballo, s, t, { type: 'kill', target: a });
        eq([ballo.view(s, a).out[a], ballo.view(s, b).out[a], ballo.view(s, null).out[a], ballo.view(s, t).out[a]], [true, false, false, true], 'chi lo sa');
        eq(ballo.activePlayers(s).length, 5, 'dai presenti non si capisce chi è fuori');
        refused(() => applyMove(ballo, s, t, { type: 'kill', target: b }), 'ricarica');
        refused(() => applyMove(ballo, s, a, { type: 'meeting' }), 'il fantasma non chiama riunioni');
        s = later(s, BALLO_KILL_MS);
        s = applyMove(ballo, s, b, { type: 'meeting' });
        eq([s.phase, s.meeting], ['discussione', { caller: b, victims: [a] }], 'riunione');
        eq(ballo.view(s, c).out[a], true, 'ora lo sanno tutti');
        s = voteOut(s, BALLO_SKIP);
        eq(s.phase, 'esito', 'si passa all’esito');
        s = later(s, 6_000);
        eq(s.phase, 'festa', 'nuova festa');
        refused(() => applyMove(ballo, s, b, { type: 'meeting' }), 'una riunione a testa');
      },
    },
    {
      name: 'ballo: luci spente 10 s, due invitati insieme le riaccendono, il traditore no',
      fn: () => {
        let s = balloStart(5);
        const t = s.traitors[0];
        const [a, b] = guestsOf(s);
        refused(() => applyMove(ballo, s, a, { type: 'lights' }), 'solo il traditore');
        s = applyMove(ballo, s, t, { type: 'lights' });
        refused(() => applyMove(ballo, s, a, { type: 'task', n: s.tasks[a].n }), 'compiti bloccati');
        refused(() => applyMove(ballo, s, t, { type: 'lights' }), 'una volta per festa');
        s = applyMove(ballo, s, a, { type: 'relight' });
        s = applyMove(ballo, s, t, { type: 'relight' });
        eq(s.lightsUntil > 0, true, 'il tocco del traditore non conta');
        s = later(s, 3_000);
        s = applyMove(ballo, s, b, { type: 'relight' });
        eq(s.lightsUntil > 0, true, 'troppo distanti');
        s = later(s, 1_000);
        s = applyMove(ballo, s, a, { type: 'relight' });
        eq(s.lightsUntil, 0, 'riaccese');
        s = applyMove(ballo, s, a, { type: 'task', n: s.tasks[a].n });
        let d = balloStart(5);
        d = applyMove(ballo, d, d.traitors[0], { type: 'lights' });
        d = later(d, BALLO_LIGHTS_MS);
        eq(d.lightsUntil, 0, 'dopo 10 s tornano da sole');
      },
    },
    {
      name: 'ballo: a fine festa riunione, il più votato esce, in parità nessuno; il traditore fuori fa vincere gli invitati',
      fn: () => {
        let s = balloStart(4);
        const t = s.traitors[0];
        const [a, b, c] = guestsOf(s);
        s = later(s, BALLO_FESTA_MS);
        eq([s.phase, s.meeting?.caller], ['discussione', null], 'riunione a fine festa');
        s = later(s, 60_000);
        eq(s.phase, 'voto', 'dopo 60 s si vota');
        s = applyMove(ballo, s, a, { type: 'vote', target: b });
        s = applyMove(ballo, s, b, { type: 'vote', target: a });
        s = later(s, 30_000);
        eq([s.phase, s.outcome?.seat], ['esito', null], 'chi non vota salta: nessuno esce');
        s = later(s, 6_000);
        s = applyMove(ballo, s, c, { type: 'meeting' });
        s = voteOut(s, t);
        eq([s.outcome?.seat, s.outcome?.traitor, ballo.result(s)], [t, true, null], 'si scopre prima dell’esito');
        s = later(s, 6_000);
        eq(ballo.result(s)?.winners, [a, b, c], 'vincono gli invitati');
      },
    },
    {
      name: 'ballo: i traditori vincono se sono tanti quanti gli invitati',
      fn: () => {
        let s = balloStart(4);
        const t = s.traitors[0];
        const [a, b] = guestsOf(s);
        s = later(s, 15_000);
        s = applyMove(ballo, s, t, { type: 'kill', target: a });
        s = later(s, BALLO_KILL_MS);
        eq(ballo.result(s), null, 'ancora due invitati');
        s = applyMove(ballo, s, t, { type: 'kill', target: b });
        eq([ballo.result(s)?.winners, ballo.view(s, null).traitors], [[t], [t]], 'vince il traditore, e si scopre');
      },
    },
  ];
}
