import { createContext, useContext } from 'react';
import { Image, Text, View, type ImageSourcePropType } from 'react-native';
import { botByName, characterById } from '@giochi/engine';
import { colors, OUTLINE, seatColor, seatSymbol } from './theme';

/** Le 16 maschere, sprite trasparenti a figura intera (design-proposte/pronti/bots e bots-trasparenti). */
export const BOT_ART: Record<string, ImageSourcePropType> = {
  arlecchina: require('../../assets/bots/arlecchina.png'),
  arlecchino: require('../../assets/bots/arlecchino.png'),
  colombina: require('../../assets/bots/colombina.png'),
  forzuto: require('../../assets/bots/forzuto.png'),
  giullare: require('../../assets/bots/giullare.png'),
  medico: require('../../assets/bots/medico.png'),
  pantalone: require('../../assets/bots/pantalone.png'),
  pulcinella: require('../../assets/bots/pulcinella.png'),
  balanzone: require('../../assets/bots/balanzone.png'),
  brighella: require('../../assets/bots/brighella.png'),
  capitano: require('../../assets/bots/capitano.png'),
  gianduja: require('../../assets/bots/gianduja.png'),
  meneghino: require('../../assets/bots/meneghino.png'),
  rosaura: require('../../assets/bots/rosaura.png'),
  stenterello: require('../../assets/bots/stenterello.png'),
  tartaglia: require('../../assets/bots/tartaglia.png'),
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
  balanzone: 283 / 752,
  brighella: 284 / 752,
  capitano: 336 / 752,
  gianduja: 313 / 752,
  meneghino: 269 / 752,
  rosaura: 289 / 752,
  stenterello: 293 / 752,
  tartaglia: 313 / 752,
};

/** Ritratti tondi delle maschere (testa e spalle), generati con Higgsfield (design-proposte/raw7/avatar). */
const PORTRAIT: Record<string, ImageSourcePropType> = {
  arlecchina: require('../../assets/avatars/arlecchina.jpg'),
  arlecchino: require('../../assets/avatars/arlecchino.jpg'),
  balanzone: require('../../assets/avatars/balanzone.jpg'),
  brighella: require('../../assets/avatars/brighella.jpg'),
  capitano: require('../../assets/avatars/capitano.jpg'),
  colombina: require('../../assets/avatars/colombina.jpg'),
  forzuto: require('../../assets/avatars/forzuto.jpg'),
  gianduja: require('../../assets/avatars/gianduja.jpg'),
  giullare: require('../../assets/avatars/giullare.jpg'),
  medico: require('../../assets/avatars/medico.jpg'),
  meneghino: require('../../assets/avatars/meneghino.jpg'),
  pantalone: require('../../assets/avatars/pantalone.jpg'),
  pulcinella: require('../../assets/avatars/pulcinella.jpg'),
  rosaura: require('../../assets/avatars/rosaura.jpg'),
  stenterello: require('../../assets/avatars/stenterello.jpg'),
  tartaglia: require('../../assets/avatars/tartaglia.jpg'),
};

/** La maschera di ogni posto al tavolo (scelta da chi gioca o del computer), data dalla partita. */
export const SeatAvatars = createContext<(string | null)[]>([]);

/** L'avatar di un posto: la maschera scelta, quella del computer o, se manca, il simbolo del posto. */
export function SeatAvatar({ seat, name, size }: { seat: number; name: string; size: number }) {
  const avatars = useContext(SeatAvatars);
  const id = avatars[seat] ?? botByName(name)?.id;
  if (id && PORTRAIT[id]) return <CharacterAvatar id={id} size={size} seat={seat} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface2, borderWidth: OUTLINE, borderColor: seatColor(seat), alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: seatColor(seat), fontSize: size * 0.45, fontWeight: '900' }}>{seatSymbol(seat)}</Text>
    </View>
  );
}

/** Tondo con testa e busto della maschera, per il tavolo. Restituisce null per i giocatori umani. */
export function BotAvatar({ name, size, seat }: { name: string; size: number; seat?: number }) {
  const bot = botByName(name);
  if (!bot) return null;
  return <CharacterAvatar id={bot.id} size={size} seat={seat} />;
}

/** Tondo con testa e busto di una maschera, scelta per id. */
export function CharacterAvatar({ id, size, seat }: { id: string; size: number; seat?: number }) {
  const ch = characterById(id);
  if (!ch || !PORTRAIT[id]) return null;
  return (
    <View
      accessibilityLabel={ch.name}
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
      <Image source={PORTRAIT[id]} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
    </View>
  );
}

/** La maschera a figura intera, per lobby e risultati (sfondo trasparente). */
export function BotFigure({ name, height }: { name: string; height: number }) {
  const bot = botByName(name);
  if (!bot) return null;
  return <Image accessibilityLabel={bot.name} source={BOT_ART[bot.id]} style={{ height, width: height * ASPECT[bot.id] }} />;
}
