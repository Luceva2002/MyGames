import { applyMove, mrwhite, sameWord, burracoKind, BURRACO_RULES, checkMeld, captureOptions, damaMoves, primieraScore, scacchi, scoreFor, setteValue, unoDeck, type Card, type ChessState } from '../src';

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
];
