import { useId } from 'react';
import Svg, { ClipPath, Defs, G, Rect } from 'react-native-svg';
import { Circle } from 'react-native-svg';
import { Place } from './morbido/draw';
import { GAME_ICONS } from './morbido/icons';
import { INK } from './morbido/shapes';

/** L'icona di un gioco disegnata in codice (stile Morbido): oggetto del gioco, fondo pieno, angoli arrotondati. */
export function GameArt({ id, size }: { id: string; size: number }) {
  const clip = 'gi' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const icon = GAME_ICONS[id] ?? { bg: '#8A93A6', parts: [] };
  // Il contorno resta di circa 2,5 px a ogni misura.
  const sw = Math.max(2, Math.min(4, (2.6 * 100) / size));
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <ClipPath id={clip}>
          <Rect x={2} y={2} width={96} height={96} rx={24} />
        </ClipPath>
      </Defs>
      <Rect x={2} y={2} width={96} height={96} rx={24} fill={icon.bg} />
      <G clipPath={`url(#${clip})`}>
        <Circle cx={80} cy={16} r={30} fill="#FFFFFF" opacity={0.14} />
        <Place parts={icon.parts} cx={50} cy={50} size={70} />
      </G>
      <Rect x={2} y={2} width={96} height={96} rx={24} fill="none" stroke={INK} strokeWidth={sw} />
    </Svg>
  );
}
