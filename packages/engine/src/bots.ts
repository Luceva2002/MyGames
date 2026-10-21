/**
 * I computer sono maschere della commedia dell'arte e del carnevale (stile "Carnevale semplice").
 * Il nome è quello che compare al tavolo; l'app ci associa il ritratto a figura intera.
 */
export interface BotCharacter {
  id: string;
  name: string;
  trait: string;
  level: 'facile' | 'medio' | 'difficile' | 'imprevedibile';
}

/** Le 16 maschere: gli 8 protagonisti scelti da Luca (SPEC §9) e le altre delle figure. Fanno da computer e da avatar. */
export const BOT_CHARACTERS: BotCharacter[] = [
  { id: 'pulcinella', name: 'Pulcinella', trait: 'Pigro ma fortunato', level: 'facile' },
  { id: 'colombina', name: 'Colombina', trait: 'Calcola tutto', level: 'medio' },
  { id: 'giullare', name: 'Giullare', trait: 'Gioca per lo spettacolo, rischia', level: 'imprevedibile' },
  { id: 'arlecchina', name: 'Arlecchina', trait: 'Veloce e sfacciata', level: 'medio' },
  { id: 'arlecchino', name: 'Arlecchino', trait: 'Elegante, ti legge le carte in faccia', level: 'difficile' },
  { id: 'pantalone', name: 'Pantalone', trait: 'Avaro, non spreca mai una carta buona', level: 'difficile' },
  { id: 'medico', name: 'Medico', trait: 'Silenzioso, aspetta il momento giusto', level: 'medio' },
  { id: 'forzuto', name: 'Forzuto', trait: 'Tutto istinto, gioca forte', level: 'facile' },
  // Le altre maschere del Carnevale, disegnate per le figure delle carte.
  { id: 'balanzone', name: 'Balanzone', trait: 'Dottore saccente, ragiona a voce alta', level: 'medio' },
  { id: 'brighella', name: 'Brighella', trait: 'Furbo, ti tende trappole', level: 'difficile' },
  { id: 'capitano', name: 'Capitano', trait: 'Spaccone, attacca sempre', level: 'imprevedibile' },
  { id: 'gianduja', name: 'Gianduja', trait: 'Bonario, gioca sicuro', level: 'facile' },
  { id: 'meneghino', name: 'Meneghino', trait: 'Paziente e preciso', level: 'medio' },
  { id: 'rosaura', name: 'Rosaura', trait: 'Elegante, aspetta la carta perfetta', level: 'difficile' },
  { id: 'stenterello', name: 'Stenterello', trait: 'Chiacchierone, si distrae', level: 'facile' },
  { id: 'tartaglia', name: 'Tartaglia', trait: 'Timido ma sorprendente', level: 'imprevedibile' },
];

/** Ritrova una maschera dal suo id (per l'avatar scelto da chi gioca). */
export const characterById = (id: string | null | undefined) => BOT_CHARACTERS.find((b) => b.id === id);

/** Sceglie `n` maschere diverse a caso, così ogni partita ha facce nuove. */
export function pickBots(n: number, random: () => number = Math.random, exclude: (string | null | undefined)[] = []): BotCharacter[] {
  // Le maschere già scelte da chi gioca restano a loro: i computer ne prendono altre.
  const taken = BOT_CHARACTERS.filter((b) => !exclude.includes(b.id));
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
