/**
 * I computer sono i mostrini di Tavolata: dieci creature, una per elemento.
 * Il nome è quello che compare al tavolo; l'app li mostra con le loro immagini (assets/mostrini).
 */
export interface BotCharacter {
  id: string;
  name: string;
  trait: string;
  level: 'facile' | 'medio' | 'difficile' | 'imprevedibile';
}

/**
 * I 10 mostrini, uno per elemento (22/11/2026).
 * Fanno da computer e da avatar.
 */
export const BOT_CHARACTERS: BotCharacter[] = [
  { id: 'bobo', name: 'Bobo', trait: 'Una goccia d\'acqua: guarda solo le sue carte', level: 'facile' },
  { id: 'otto', name: 'Otto', trait: 'Pittore a inchiostro, si distrae a disegnare', level: 'facile' },
  { id: 'zap', name: 'Zap', trait: 'Un cane fulmine: gioca in un lampo, a volte troppo', level: 'medio' },
  { id: 'gelo', name: 'Gelo', trait: 'Di ghiaccio: freddo e calmo, non si scompone', level: 'medio' },
  { id: 'gnaf', name: 'Gnaf', trait: 'Fatto di terra e muschio: brontola ma gioca benissimo', level: 'difficile' },
  { id: 'bit', name: 'Bit', trait: 'Fa i conti più veloce di tutti', level: 'difficile' },
  { id: 'ombra', name: 'Ombra', trait: 'Viene dal buio: ti segue e ricorda ogni carta', level: 'difficile' },
  { id: 'dado', name: 'Dado', trait: 'Il coniglio fortunato: si affida alla sorte', level: 'imprevedibile' },
  { id: 'morso', name: 'Morso', trait: 'Pianta carnivora: ha fame di punti, morde tutto', level: 'imprevedibile' },
  { id: 'fio', name: 'Fiò', trait: 'Una fiammella: si accende subito, gioca fortissimo', level: 'imprevedibile' },
];

/** Ritrova un mostrino dal suo id (per l'avatar scelto da chi gioca). */
export const characterById = (id: string | null | undefined) => (id ? BOT_CHARACTERS.find((b) => b.id === id) : undefined);

/** Sceglie `n` mostrini diversi a caso, così ogni partita ha facce nuove. */
export function pickBots(n: number, random: () => number = Math.random, exclude: (string | null | undefined)[] = []): BotCharacter[] {
  // I mostrini già scelti da chi gioca restano a loro: i computer ne prendono altri.
  const ex = exclude.map((e) => characterById(e)?.id);
  const taken = BOT_CHARACTERS.filter((b) => !ex.includes(b.id));
  const pool = taken.length ? [...taken] : [...BOT_CHARACTERS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return Array.from({ length: n }, (_, i) => pool[i % pool.length]);
}

/** Ritrova il mostrino dal nome mostrato al tavolo (anche "Nome 🤖" per chi ha lasciato il posto). */
export function botByName(name: string): BotCharacter | undefined {
  // Il nome può avere aggiunte come " " o " 🤝": basta che inizi col nome del mostrino.
  return BOT_CHARACTERS.find((b) => name === b.name || name.startsWith(`${b.name} `));
}

/**
 * Un mostrino per ogni posto: i computer hanno il loro, chi gioca tiene quello scelto (se libera)
 * e chi non ha scelto ne riceve una rimasta libera. Così al tavolo ognuno ha la sua icona.
 */
export function assignAvatars(seats: { name: string; bot: boolean; avatar?: string | null }[]): string[] {
  const used = new Set<string>();
  const out: (string | null)[] = seats.map(() => null);
  // Prima i computer (il loro mostrino è il loro nome), poi le scelte delle persone.
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
