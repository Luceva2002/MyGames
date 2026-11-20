/**
 * I computer sono i mostrini di Tavolata (stile Morbido): creature tonde, una per colore.
 * Il nome è quello che compare al tavolo; l'app li disegna in codice (ui/morbido).
 */
export interface BotCharacter {
  id: string;
  name: string;
  trait: string;
  level: 'facile' | 'medio' | 'difficile' | 'imprevedibile';
}

/** I 12 mostrini scelti da Luca il 20/11/2026, tre per difficoltà. Fanno da computer e da avatar. */
export const BOT_CHARACTERS: BotCharacter[] = [
  { id: 'bobo', name: 'Bobo', trait: 'Guarda solo le sue carte', level: 'facile' },
  { id: 'ugo', name: 'Ugo', trait: 'Abbraccia tutti, anche le carte sbagliate', level: 'facile' },
  { id: 'lulu', name: 'Lulù', trait: 'Porta fortuna, a lei soprattutto', level: 'facile' },
  { id: 'zuzu', name: 'Zuzu', trait: 'Sente le carte prima di vederle', level: 'medio' },
  { id: 'pim', name: 'Pim', trait: 'Piccolo, veloce, sfacciato', level: 'medio' },
  { id: 'bolla', name: 'Bolla', trait: 'Leggera, galleggia fino alla fine', level: 'medio' },
  { id: 'gnaf', name: 'Gnaf', trait: 'Brontola ma gioca benissimo', level: 'difficile' },
  { id: 'tic', name: 'Tic', trait: 'Rigido, segue le regole', level: 'difficile' },
  { id: 'trio', name: 'Trio', trait: 'Vede tutto, anche quello che nascondi', level: 'difficile' },
  { id: 'lola', name: 'Lola', trait: 'Sogna e gioca a caso', level: 'imprevedibile' },
  { id: 'mimi', name: 'Mimì', trait: 'Sparisce e ricompare con la carta giusta', level: 'imprevedibile' },
  { id: 'fio', name: 'Fiò', trait: 'Si accende subito, gioca fortissimo', level: 'imprevedibile' },
];

/**
 * Le maschere di prima, salvate nelle impostazioni o mandate da un'app non aggiornata:
 * ognuna diventa il mostrino con la stessa difficoltà, così nessuno resta senza avatar.
 */
export const LEGACY_CHARACTERS: Record<string, string> = {
  pulcinella: 'bobo', forzuto: 'ugo', colombina: 'zuzu', arlecchina: 'pim', medico: 'bolla',
  rosaura: 'gnaf', pantalone: 'tic', arlecchino: 'trio', capitano: 'lola', giullare: 'fio',
};

/** Ritrova un mostrino dal suo id (per l'avatar scelto da chi gioca), anche dal nome di una vecchia maschera. */
export const characterById = (id: string | null | undefined) => {
  const real = id ? LEGACY_CHARACTERS[id] ?? id : id;
  return BOT_CHARACTERS.find((b) => b.id === real);
};

/** Sceglie `n` maschere diverse a caso, così ogni partita ha facce nuove. */
export function pickBots(n: number, random: () => number = Math.random, exclude: (string | null | undefined)[] = []): BotCharacter[] {
  // Le maschere già scelte da chi gioca restano a loro: i computer ne prendono altre.
  const ex = exclude.map((e) => characterById(e)?.id);
  const taken = BOT_CHARACTERS.filter((b) => !ex.includes(b.id));
  const pool = taken.length ? [...taken] : [...BOT_CHARACTERS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return Array.from({ length: n }, (_, i) => pool[i % pool.length]);
}

/** Ritrova la maschera dal nome mostrato al tavolo (anche "Nome 🤖" per chi ha lasciato il posto). */
export function botByName(name: string): BotCharacter | undefined {
  // Il nome può avere aggiunte come " " o " 🤝": basta che inizi col nome della maschera.
  return BOT_CHARACTERS.find((b) => name === b.name || name.startsWith(`${b.name} `));
}

/**
 * Una maschera per ogni posto: i computer hanno la loro, chi gioca tiene quella scelta (se libera)
 * e chi non ha scelto ne riceve una rimasta libera. Così al tavolo ognuno ha la sua icona.
 */
export function assignAvatars(seats: { name: string; bot: boolean; avatar?: string | null }[]): string[] {
  const used = new Set<string>();
  const out: (string | null)[] = seats.map(() => null);
  // Prima i computer (la loro maschera è il loro nome), poi le scelte delle persone.
  for (const bots of [true, false]) {
    seats.forEach((s, i) => {
      if (s.bot !== bots) return;
      const id = s.bot ? botByName(s.name)?.id : characterById(s.avatar)?.id;
      if (id && !used.has(id)) {
        used.add(id);
        out[i] = id;
      }
    });
  }
  const first = out;
  const free = BOT_CHARACTERS.map((c) => c.id).filter((id) => !used.has(id));
  return first.map((id, i) => id ?? free.shift() ?? BOT_CHARACTERS[i % BOT_CHARACTERS.length].id);
}
