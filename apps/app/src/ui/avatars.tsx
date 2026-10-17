import { Image, View, type ImageSourcePropType } from 'react-native';
import { botByName } from '@giochi/engine';
import { colors, OUTLINE, seatColor } from './theme';

/** Gli 8 protagonisti, sprite trasparenti a figura intera (design-proposte/pronti/bots-trasparenti). */
export const BOT_ART: Record<string, ImageSourcePropType> = {
  arlecchina: require('../../assets/bots/arlecchina.png'),
  arlecchino: require('../../assets/bots/arlecchino.png'),
  colombina: require('../../assets/bots/colombina.png'),
  forzuto: require('../../assets/bots/forzuto.png'),
  giullare: require('../../assets/bots/giullare.png'),
  medico: require('../../assets/bots/medico.png'),
  pantalone: require('../../assets/bots/pantalone.png'),
  pulcinella: require('../../assets/bots/pulcinella.png'),
};

/** Larghezza / altezza di ogni sprite (sono alti 752 px e larghi quanto il personaggio). */
const ASPECT: Record<string, number> = {
  arlecchina: 301 / 752,
  arlecchino: 298 / 752,
  colombina: 300 / 752,
  forzuto: 324 / 752,
  giullare: 294 / 752,
  medico: 256 / 752,
  pantalone: 266 / 752,
  pulcinella: 256 / 752,
};

/** Tondo con testa e busto della maschera, per il tavolo. Restituisce null per i giocatori umani. */
export function BotAvatar({ name, size, seat }: { name: string; size: number; seat?: number }) {
  const bot = botByName(name);
  if (!bot) return null;
  // La figura occupa il 14-86% dell'altezza: la finestra mostra testa e busto (circa 16-46%).
  const h = size / 0.3;
  const w = h * ASPECT[bot.id];
  return (
    <View
      accessibilityLabel={`${bot.name}, computer ${bot.level}: ${bot.trait}`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: colors.brand,
        borderWidth: OUTLINE,
        borderColor: seat === undefined ? colors.line : seatColor(seat),
      }}
    >
      <Image source={BOT_ART[bot.id]} style={{ position: 'absolute', width: w, height: h, left: (size - w) / 2 - OUTLINE, top: -h * 0.15 - OUTLINE }} />
    </View>
  );
}

/** La maschera a figura intera, per lobby e risultati (sfondo trasparente). */
export function BotFigure({ name, height }: { name: string; height: number }) {
  const bot = botByName(name);
  if (!bot) return null;
  return <Image accessibilityLabel={bot.name} source={BOT_ART[bot.id]} style={{ height, width: height * ASPECT[bot.id] }} />;
}
