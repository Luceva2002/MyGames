import type { ImageSourcePropType } from 'react-native';

/** Copertine dei giochi, generate con Higgsfield (assets/games). */
export const GAME_ART: Record<string, ImageSourcePropType> = {
  scopa: require('../../assets/games/scopa.jpg'),
  briscola: require('../../assets/games/briscola.jpg'),
  tresette: require('../../assets/games/tresette.jpg'),
  setteemezzo: require('../../assets/games/setteemezzo.jpg'),
  scala40: require('../../assets/games/scala40.jpg'),
  burraco: require('../../assets/games/burraco.jpg'),
  machiavelli: require('../../assets/games/machiavelli.jpg'),
  uno: require('../../assets/games/uno.jpg'),
  solitario: require('../../assets/games/solitario.jpg'),
  dama: require('../../assets/games/dama.jpg'),
  scacchi: require('../../assets/games/scacchi.jpg'),
  yahtzee: require('../../assets/games/yahtzee.jpg'),
  freccette: require('../../assets/games/freccette.jpg'),
  biliardo: require('../../assets/games/biliardo.jpg'),
  football: require('../../assets/games/football.jpg'),
  tris: require('../../assets/games/tris.jpg'),
  lupus: require('../../assets/games/lupus.jpg'),
  // Mr. White: maschera bianca (volto) disegnata in codice con PIL nello stile delle altre copertine.
  mrwhite: require('../../assets/games/mrwhite.jpg'),
  // Disegnate in codice con PIL, come Mr. White.
  mosaico: require('../../assets/games/mosaico.jpg'),
  puntielinee: require('../../assets/games/puntielinee.jpg'),
  colorwars: require('../../assets/games/colorwars.jpg'),
  battaglia: require('../../assets/games/battaglia.jpg'),
  ballo: require('../../assets/games/ballo.jpg'),
};

export const HERO = require('../../assets/images/hero.jpg') as ImageSourcePropType;
