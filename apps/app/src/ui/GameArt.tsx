import { Image, View, type ImageSourcePropType } from 'react-native';

/**
 * Le icone dei giochi: le copertine di Tavolata ricolorate nello stile Pop (21/11/2026).
 * I fondi pieni si alternano tra dodici colori Pop (POP_TILES in theme.ts), scelti perché due vicini
 * non siano mai uguali e il fondo non sia del colore del disegno.
 */
const ART: Record<string, ImageSourcePropType> = {
  scopa: require('../../assets/games/scopa.jpg'),
  mrwhite: require('../../assets/games/mrwhite.jpg'),
  coriandoli: require('../../assets/games/coriandoli.jpg'),
  battaglia: require('../../assets/games/battaglia.jpg'),
  uno: require('../../assets/games/uno.jpg'),
  frutta: require('../../assets/games/frutta.jpg'),
  freccette: require('../../assets/games/freccette.jpg'),
  scacchi: require('../../assets/games/scacchi.jpg'),
  memory: require('../../assets/games/memory.jpg'),
  briscola: require('../../assets/games/briscola.jpg'),
  yahtzee: require('../../assets/games/yahtzee.jpg'),
  serpentina: require('../../assets/games/serpentina.jpg'),
  mosaico: require('../../assets/games/mosaico.jpg'),
  lupus: require('../../assets/games/lupus.jpg'),
  sudoku: require('../../assets/games/sudoku.jpg'),
  burraco: require('../../assets/games/burraco.jpg'),
  colorwars: require('../../assets/games/colorwars.jpg'),
  razzo: require('../../assets/games/razzo.jpg'),
  dama: require('../../assets/games/dama.jpg'),
  ballo: require('../../assets/games/ballo.jpg'),
  raddoppia: require('../../assets/games/raddoppia.jpg'),
  setteemezzo: require('../../assets/games/setteemezzo.jpg'),
  biliardo: require('../../assets/games/biliardo.jpg'),
  puntielinee: require('../../assets/games/puntielinee.jpg'),
  scala40: require('../../assets/games/scala40.jpg'),
  tris: require('../../assets/games/tris.jpg'),
  tresette: require('../../assets/games/tresette.jpg'),
  machiavelli: require('../../assets/games/machiavelli.jpg'),
  solitario: require('../../assets/games/solitario.jpg'),
};

/** L'icona di un gioco: quadrata, angoli arrotondati come un'app, senza contorno. */
export function GameArt({ id, size }: { id: string; size: number }) {
  const src = ART[id];
  const r = Math.round(size * 0.24);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, borderRadius: r, overflow: 'hidden', backgroundColor: '#2B2E36' }}>
      {src ? <Image source={src} style={{ width: size, height: size }} resizeMode="cover" /> : null}
    </View>
  );
}
