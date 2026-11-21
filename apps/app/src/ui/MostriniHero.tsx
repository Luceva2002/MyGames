import Svg, { Ellipse, G, Rect } from 'react-native-svg';
import { drawParts } from './morbido/draw';
import { INK, MOSTRINI, frSuit, itSuit } from './morbido/shapes';

/** L'illustrazione della copertina: Bobo, Fiò e Gnaf attorno al tavolo verde. Disegno 400×300. */
export function MostriniHero({ width, height }: { width: number; height: number }) {
  const who = (id: string, x: number, y: number, s: number) => (
    <G transform={`translate(${x} ${y}) scale(${s})`}>{drawParts(MOSTRINI[id].parts, s, id)}</G>
  );
  return (
    <Svg width={width} height={height} viewBox="0 0 400 300" accessibilityLabel="Bobo, Fiò e Gnaf attorno al tavolo">
      <Ellipse cx={200} cy={200} rx={170} ry={70} fill="#17402F" stroke={INK} strokeWidth={1.5} />
      <Ellipse cx={200} cy={196} rx={150} ry={56} fill="#2C6D55" />
      <G transform="translate(150 150) rotate(-12)">
        <Rect width={40} height={58} rx={5} fill="#FFFFFF" stroke={INK} strokeWidth={1.2} />
        <G transform="translate(8 14) scale(.25)">{drawParts(frSuit('h'), 0.25, 'c1')}</G>
      </G>
      <G transform="translate(205 158) rotate(9)">
        <Rect width={40} height={58} rx={5} fill="#FFFFFF" stroke={INK} strokeWidth={1.2} />
        <G transform="translate(8 14) scale(.25)">{drawParts(itSuit('d'), 0.25, 'c2')}</G>
      </G>
      {who('bobo', 28, 74, 1.1)}
      {who('fio', 150, 6, 1.05)}
      {who('gnaf', 268, 74, 1.1)}
    </Svg>
  );
}
