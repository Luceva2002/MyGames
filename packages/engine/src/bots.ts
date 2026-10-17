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

/** Gli 8 protagonisti scelti da Luca (SPEC-carnevale-semplice.md §9). */
export const BOT_CHARACTERS: BotCharacter[] = [
  { id: 'pulcinella', name: 'Pulcinella', trait: 'Pigro ma fortunato', level: 'facile' },
  { id: 'colombina', name: 'Colombina', trait: 'Calcola tutto', level: 'medio' },
  { id: 'giullare', name: 'Giullare', trait: 'Gioca per lo spettacolo, rischia', level: 'imprevedibile' },
  { id: 'arlecchina', name: 'Arlecchina', trait: 'Veloce e sfacciata', level: 'medio' },
  { id: 'arlecchino', name: 'Arlecchino', trait: 'Elegante, ti legge le carte in faccia', level: 'difficile' },
  { id: 'pantalone', name: 'Pantalone', trait: 'Avaro, non spreca mai una carta buona', level: 'difficile' },
  { id: 'medico', name: 'Medico', trait: 'Silenzioso, aspetta il momento giusto', level: 'medio' },
  { id: 'forzuto', name: 'Forzuto', trait: 'Tutto istinto, gioca forte', level: 'facile' },
];

/** Sceglie `n` maschere diverse a caso, così ogni partita ha facce nuove. */
export function pickBots(n: number, random: () => number = Math.random): BotCharacter[] {
  const pool = [...BOT_CHARACTERS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return Array.from({ length: n }, (_, i) => pool[i % pool.length]);
}

/** Ritrova la maschera dal nome mostrato al tavolo (anche "Nome 🤖" per chi ha lasciato il posto). */
export function botByName(name: string): BotCharacter | undefined {
  // Il nome può avere aggiunte come " 🤖" o " 🤝": basta che inizi col nome della maschera.
  return BOT_CHARACTERS.find((b) => name === b.name || name.startsWith(`${b.name} `));
}
