import { createContext, useContext, useId } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G } from 'react-native-svg';
import { botByName, characterById } from '@giochi/engine';
import { Place } from './morbido/draw';
import { MOSTRINI } from './morbido/shapes';
import { colors, OUTLINE, seatColor } from './theme';

/** Il mostrino di ogni posto al tavolo (scelto da chi gioca o del computer), data dalla partita. */
export const SeatAvatars = createContext<(string | null)[]>([]);

/** L'avatar di un posto: il mostrino scelto, quello del computer o, se manca, il simbolo del posto. */
export function SeatAvatar({ seat, name, size }: { seat: number; name: string; size: number }) {
  const avatars = useContext(SeatAvatars);
  const id = avatars[seat] ?? botByName(name)?.id;
  if (id && characterById(id)) return <CharacterAvatar id={id} size={size} seat={seat} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface2, borderWidth: OUTLINE, borderColor: seatColor(seat), alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: seatColor(seat), fontSize: size * 0.45, fontWeight: '900' }}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
    </View>
  );
}

/** Il colore di fondo di ogni mostrino: si riconoscono a colpo d'occhio anche piccoli, nei punteggi e al tavolo. */
export const avatarBg = (id: string) => {
  const ch = characterById(id);
  return ch ? MOSTRINI[ch.id].tone : colors.brand;
};

/** Tondo col mostrino, scelto per id (anche l'id di un personaggio di prima). */
export function CharacterAvatar({ id, size, seat }: { id: string; size: number; seat?: number }) {
  const ch = characterById(id);
  const clip = 'av' + useId().replace(/[^a-zA-Z0-9]/g, '');
  if (!ch) return null;
  return (
    <View
      accessibilityLabel={ch.name}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: avatarBg(ch.id),
        // Nel guscio Pop niente contorno scuro: solo l'anello del colore del posto, quando c'è.
        borderWidth: seat === undefined ? 0 : Math.max(2, Math.round(size * 0.05)),
        borderColor: seat === undefined ? 'transparent' : seatColor(seat),
      }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Defs>
          <ClipPath id={clip}>
            <Circle cx={50} cy={50} r={50} />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#${clip})`}>
          <Place parts={MOSTRINI[ch.id].parts} cx={50} cy={53} size={104} />
        </G>
      </Svg>
    </View>
  );
}

/** Il mostrino intero, per lobby e risultati (sfondo trasparente). */
export function BotFigure({ name, height }: { name: string; height: number }) {
  const bot = botByName(name);
  if (!bot) return null;
  return (
    <Svg accessibilityLabel={bot.name} width={height} height={height} viewBox="0 0 100 100">
      <Place parts={MOSTRINI[bot.id].parts} cx={50} cy={50} size={100} />
    </Svg>
  );
}
