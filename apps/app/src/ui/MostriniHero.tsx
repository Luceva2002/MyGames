import Svg, { Ellipse, G, Rect } from 'react-native-svg';
import { drawParts } from './morbido/draw';
import { CAT, INK, MOSTRINI, frSuit, itSuit } from './morbido/shapes';

/** L'illustrazione della copertina (stile Morbido): i mostrini attorno al tavolo, Briscola davanti. Disegno 400×300. */
export function MostriniHero({ width, height }: { width: number; height: number }) {
  const who = (id: string, x: number, y: number, s: number) => (
    <G transform={`translate(${x} ${y}) scale(${s})`}>{drawParts(MOSTRINI[id].parts, s, id)}</G>
  );
  return (
    <Svg width={width} height={height} viewBox="0 0 400 300" accessibilityLabel="I mostrini attorno al tavolo con Briscola">
      <Ellipse cx={200} cy={200} rx={170} ry={70} fill="#2B7553" stroke={INK} strokeWidth={4} />
      <Ellipse cx={200} cy={196} rx={150} ry={56} fill="#3A8C64" />
      <G transform="translate(150 150) rotate(-12)">
        <Rect width={40} height={58} rx={5} fill="#FFFFFF" stroke={INK} strokeWidth={2.5} />
        <G transform="translate(8 14) scale(.25)">{drawParts(frSuit('h'), 0.25, 'c1')}</G>
      </G>
      <G transform="translate(205 158) rotate(9)">
        <Rect width={40} height={58} rx={5} fill="#FFFFFF" stroke={INK} strokeWidth={2.5} />
        <G transform="translate(8 14) scale(.25)">{drawParts(itSuit('d'), 0.25, 'c2')}</G>
      </G>
      {who('bobo', 20, 70, 1.1)}
      {who('lulu', 118, 20, 1)}
      {who('fio', 240, 18, 1)}
      {who('gnaf', 300, 76, 1.05)}
      <G transform="translate(170 196) scale(.95)">{drawParts(CAT, 0.95, 'cat')}</G>
    </Svg>
  );
}
