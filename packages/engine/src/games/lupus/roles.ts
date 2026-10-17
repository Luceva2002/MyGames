// Ruoli copiati dall'app Lupus in Tabula (~/Desktop/Lavori/MyApps/lupus/src/game/roles.ts).
export type RoleId =
  | 'lupo'
  | 'villico'
  | 'veggente'
  | 'medium'
  | 'guardia'
  | 'indemoniato'
  | 'gufo'
  | 'criceto'
  | 'massone';

export type Team = 'villaggio' | 'lupi' | 'criceto';

export interface RoleDef {
  id: RoleId;
  name: string;
  plural: string;
  team: Team;
  /** Short line shown under the card. */
  tagline: string;
  /** Full rules text shown on the card and in the role guide. */
  description: string;
  /** How many of this role a game can have. */
  min: number;
  max: number;
  /** Teammates who see each other when the cards are revealed. */
  knowsTeammates: boolean;
}

export const ROLES: Record<RoleId, RoleDef> = {
  lupo: {
    id: 'lupo',
    name: 'Lupo',
    plural: 'Lupi',
    team: 'lupi',
    tagline: 'Di notte sbrana un abitante del villaggio.',
    description:
      'Ogni notte i Lupi si risvegliano insieme e scelgono una vittima da sbranare. Di giorno fingono di essere innocui villici. Vincono quando sono tanti quanti gli altri giocatori vivi.',
    min: 1,
    max: 6,
    knowsTeammates: true,
  },
  villico: {
    id: 'villico',
    name: 'Villico',
    plural: 'Villici',
    team: 'villaggio',
    tagline: 'Un semplice abitante, armato solo del suo intuito.',
    description:
      'Non ha poteri speciali. Di giorno discute e vota per mandare al rogo chi sospetta essere un Lupo. Vince con il villaggio quando tutti i Lupi sono morti.',
    min: 0,
    max: 30,
    knowsTeammates: false,
  },
  veggente: {
    id: 'veggente',
    name: 'Veggente',
    plural: 'Veggenti',
    team: 'villaggio',
    tagline: 'Ogni notte scruta l’anima di un giocatore.',
    description:
      'Ogni notte indica un giocatore e scopre se è un Lupo oppure no. Se scruta il Criceto Mannaro, lo uccide. L’Indemoniato le appare come un normale umano.',
    min: 0,
    max: 1,
    knowsTeammates: false,
  },
  medium: {
    id: 'medium',
    name: 'Medium',
    plural: 'Medium',
    team: 'villaggio',
    tagline: 'Parla con chi è stato mandato al rogo.',
    description:
      'Ogni notte scopre se il giocatore eliminato dal voto del giorno precedente era un Lupo oppure no.',
    min: 0,
    max: 1,
    knowsTeammates: false,
  },
  guardia: {
    id: 'guardia',
    name: 'Guardia',
    plural: 'Guardie',
    team: 'villaggio',
    tagline: 'Veglia nella notte su un abitante.',
    description:
      'Ogni notte sceglie un giocatore da proteggere: se i Lupi lo attaccano, sopravvive. Le regole su sé stessa e sul proteggere due volte la stessa persona si scelgono nelle impostazioni.',
    min: 0,
    max: 1,
    knowsTeammates: false,
  },
  indemoniato: {
    id: 'indemoniato',
    name: 'Indemoniato',
    plural: 'Indemoniati',
    team: 'lupi',
    tagline: 'Un umano che tifa per i Lupi.',
    description:
      'È un umano ma gioca dalla parte dei Lupi e vince con loro. La Veggente lo vede come umano e non sa chi siano i Lupi: deve scoprirlo e aiutarli senza farsi notare.',
    min: 0,
    max: 1,
    knowsTeammates: false,
  },
  gufo: {
    id: 'gufo',
    name: 'Gufo',
    plural: 'Gufi',
    team: 'villaggio',
    tagline: 'Indica chi finirà sul banco degli accusati.',
    description:
      'Ogni notte indica un giocatore che il mattino dopo sarà automaticamente tra gli accusati della votazione.',
    min: 0,
    max: 1,
    knowsTeammates: false,
  },
  criceto: {
    id: 'criceto',
    name: 'Criceto Mannaro',
    plural: 'Criceti Mannari',
    team: 'criceto',
    tagline: 'Gioca solo per sé stesso.',
    description:
      'I Lupi non possono ucciderlo, ma muore se la Veggente lo scruta o se viene votato. Se è ancora vivo quando la partita finisce, vince lui da solo.',
    min: 0,
    max: 1,
    knowsTeammates: false,
  },
  massone: {
    id: 'massone',
    name: 'Massone',
    plural: 'Massoni',
    team: 'villaggio',
    tagline: 'Conosce gli altri membri della loggia.',
    description:
      'I Massoni si conoscono tra loro fin dall’inizio: sanno di potersi fidare l’uno dell’altro. Giocano con il villaggio.',
    min: 0,
    max: 3,
    knowsTeammates: true,
  },
};

export const ROLE_ORDER: RoleId[] = [
  'lupo',
  'villico',
  'veggente',
  'medium',
  'guardia',
  'gufo',
  'massone',
  'indemoniato',
  'criceto',
];

export const TEAM_NAMES: Record<Team, string> = {
  villaggio: 'Villaggio',
  lupi: 'Lupi',
  criceto: 'Criceto Mannaro',
};
