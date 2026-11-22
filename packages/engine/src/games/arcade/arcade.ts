import { assert, type Game, type GameMeta } from '../../core/types';
import { randomInt, type HasRng } from '../../core/rng';

/**
 * I giochi d'azione da soli (blocchi, snake, frutta, razzo): la partita gira tutta sul
 * dispositivo, a 60 fotogrammi al secondo, e al motore arriva solo il punteggio finale. Così il
 * gioco resta fluido anche in una stanza online, e riepilogo, rivincita e menu sono quelli di sempre.
 */
export interface ArcadeState extends HasRng {
  /** Seme della partita: con lo stesso seme pezzi e ostacoli escono nello stesso ordine. */
  seed: number;
  score: number;
  over: boolean;
  record: boolean;
  /** Riga in più nel riepilogo (es. «12 righe»). */
  note: string;
}

export type ArcadeMove = { type: 'end'; score: number; record?: boolean; note?: string };

export interface ArcadeView {
  seed: number;
  over: boolean;
  score: number;
}

export function arcadeGame(meta: Omit<GameMeta, 'minPlayers' | 'maxPlayers' | 'hiddenInfo'>, unit: string): Game<ArcadeState, ArcadeMove, ArcadeView> {
  return {
    meta: { ...meta, minPlayers: 1, maxPlayers: 1, hiddenInfo: false },
    setup: ({ seed }) => ({ rng: seed, seed: seed % 2147483647, score: 0, over: false, record: false, note: '' }),
    activePlayers: (s) => (s.over ? [] : [0]),
    play(s, _seat, m) {
      assert(m?.type === 'end' && Number.isFinite(m.score) && m.score >= 0, 'Mossa non valida.');
      s.score = Math.floor(m.score);
      s.record = !!m.record && s.score > 0;
      s.note = typeof m.note === 'string' ? m.note.slice(0, 60) : '';
      s.over = true;
    },
    view: (s) => ({ seed: s.seed, over: s.over, score: s.score }),
    result(s) {
      if (!s.over) return null;
      const summary = `${s.score} ${unit}${s.note ? ` · ${s.note}` : ''}`;
      return { winners: [0], scores: [s.score], summary, title: s.record ? '🏆 Nuovo record!' : 'Partita finita!', celebrate: s.record };
    },
    // Serve solo alle prove automatiche: un punteggio qualsiasi.
    bot: (s) => ({ type: 'end', score: randomInt(s, 500) }),
  };
}

/** Generatore deterministico per le partite d'azione, separato dallo stato del motore. */
export function arcadeRng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const coriandoli = arcadeGame(
  {
    id: 'coriandoli',
    name: 'Coriandoli',
    category: 'abilita',
    emoji: '🟪',
    color: '#4D7CFF',
    tagline: 'Incastra i pezzi che cadono e svuota le righe',
    rules: [
      'Dall’alto cadono pezzi colorati: spostali e girali prima che tocchino il fondo.',
      'Quando una riga è piena da parte a parte esplode in coriandoli e lascia spazio.',
      'Più righe insieme valgono molto di più. Ogni 8 righe si sale di livello e si cade più in fretta.',
      'Ogni tanto arriva un coriandolo piccolo da tre: usalo per tappare i buchi.',
      'Telefono: tocca a sinistra o a destra per spostare, tocca al centro per girare, scorri giù per far cadere. Computer: frecce e spazio.',
      'Finisce quando i pezzi arrivano in cima.',
    ],
    minutes: 5,
  },
  'punti',
);

export const serpentina = arcadeGame(
  {
    id: 'serpentina',
    // L'id resta 'serpentina' per non perdere record e partite salvate; il nome è Snake dal 22/11/2026.
    name: 'Snake',
    category: 'abilita',
    emoji: '🐍',
    color: '#4FA663',
    tagline: 'Mangia le mele e allunga il serpente',
    rules: [
      'Guidi un serpente che non si ferma mai: scorri col dito (o usa le frecce) per cambiare direzione.',
      'Ogni mela lo allunga di un pezzo e vale un punto; ogni tanto compare una mela d’oro da 5 che sparisce presto.',
      'Più è lungo, più va veloce.',
      'Se sbatti contro il bordo o contro te stesso, la partita finisce.',
    ],
    minutes: 3,
  },
  'punti',
);

export const frutta = arcadeGame(
  {
    id: 'frutta',
    name: 'Taglia la frutta',
    category: 'abilita',
    emoji: '🍉',
    color: '#9BE15D',
    tagline: 'Un colpo di spada e via: niente petardi!',
    rules: [
      'La frutta salta su dal basso: passaci sopra col dito per tagliarla.',
      'Più frutti con un colpo solo valgono un bonus.',
      'Non toccare i petardi: se ne tagli uno, la partita finisce.',
      'Se lasci cadere tre frutti senza tagliarli, hai perso.',
    ],
    minutes: 2,
  },
  'punti',
);

export const razzo = arcadeGame(
  {
    id: 'razzo',
    name: 'Il razzo di Bobo',
    category: 'abilita',
    emoji: '🚀',
    color: '#FFE14D',
    tagline: 'Tieni premuto per volare tra i fuochi d’artificio',
    rules: [
      'Bobo vola appeso a un razzo: tieni premuto lo schermo (o lo spazio) per salire, lascia per scendere.',
      'Evita le girandole di fuoco e i palloncini scoppiettanti.',
      'Prendi gli zecchini d’oro: ognuno vale 10 metri in più.',
      'Più vai avanti, più si va veloci. Il punteggio sono i metri percorsi.',
    ],
    minutes: 3,
  },
  'metri',
);
