import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { RoleId } from '@giochi/engine';
import { Place } from './morbido/draw';
import { MOSTRINI } from './morbido/shapes';
import { font } from './theme';

/**
 * Le carte di Lupus nello stile Pop, disegnate in codice: tarocchi semplici su fondo notte,
 * un mostrino per ruolo dentro un cerchio del suo colore, il numero in alto e il nome in basso.
 */
const NIGHT = '#1A1C2E';
const CREAM = '#F4F1E8';

const ROLE_CARD: Record<RoleId, { name: string; num: string; who: string[]; color: string }> = {
  lupo: { name: 'Il Lupo', num: 'I', who: ['gnaf'], color: '#FF4F8B' },
  villico: { name: 'Il Villico', num: 'II', who: ['bobo'], color: '#1FA67A' },
  veggente: { name: 'La Veggente', num: 'III', who: ['ombra'], color: '#FFC933' },
  medium: { name: 'Il Medium', num: 'IV', who: ['gelo'], color: '#5B3FE0' },
  guardia: { name: 'La Guardia', num: 'V', who: ['rocco'], color: '#3D7BFF' },
  indemoniato: { name: "L'Indemoniato", num: 'VI', who: ['fio'], color: '#2B2E36' },
  gufo: { name: 'Il Gufo', num: 'VII', who: ['bit'], color: '#FF4F8B' },
  criceto: { name: 'Il Criceto Mannaro', num: 'VIII', who: ['dado'], color: '#B07CFF' },
  massone: { name: 'I Massoni', num: 'IX', who: ['otto', 'spino'], color: '#2EC4B6' },
};

/** Stelline a quattro punte, sempre negli stessi posti. */
const star = (x: number, y: number, r: number) => `M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`;
const STARS = [star(16, 30, 3), star(84, 26, 2.4), star(20, 100, 2.2), star(82, 104, 3), star(50, 22, 1.8)];

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Rect x={0} y={0} width={100} height={150} rx={9} fill={NIGHT} />
      <Rect x={4} y={4} width={92} height={142} rx={6} fill="none" stroke={CREAM} strokeWidth={0.8} opacity={0.5} />
      {STARS.map((d, i) => (
        <Path key={i} d={d} fill={CREAM} opacity={0.75} />
      ))}
      {children}
    </>
  );
}

export function LupusCard({ role, width }: { role: RoleId | 'retro'; width: number }) {
  const label = role === 'retro' ? 'Carta coperta' : `Carta del ruolo ${ROLE_CARD[role].name}`;
  if (role === 'retro') {
    return (
      <Svg width={width} height={width * 1.5} viewBox="0 0 100 150" accessibilityLabel={label}>
        <Frame>
          <Circle cx={50} cy={68} r={30} fill="#FFC933" />
          <Circle cx={62} cy={60} r={26} fill={NIGHT} />
          <SvgText x={50} y={130} fontSize={13} fontFamily={font.display} textAnchor="middle" fill="#FFC933">
            LUPUS
          </SvgText>
        </Frame>
      </Svg>
    );
  }
  const c = ROLE_CARD[role];
  const name = c.name.toUpperCase();
  // Il nome sta sempre nella fascia: si rimpicciolisce se è lungo.
  const fs = Math.min(8.5, 76 / (name.length * 0.78));
  return (
    <Svg width={width} height={width * 1.5} viewBox="0 0 100 150" accessibilityLabel={label}>
      <Frame>
        <SvgText x={50} y={18} fontSize={8} fontFamily={font.display} textAnchor="middle" fill={CREAM}>
          {c.num}
        </SvgText>
        <Circle cx={50} cy={68} r={34} fill={c.color} />
        {c.who.length === 1 ? (
          <Place parts={MOSTRINI[c.who[0]].parts} cx={50} cy={72} size={66} />
        ) : (
          <>
            <Place parts={MOSTRINI[c.who[0]].parts} cx={34} cy={76} size={50} />
            <Place parts={MOSTRINI[c.who[1]].parts} cx={66} cy={76} size={50} />
          </>
        )}
        <Rect x={9} y={117} width={82} height={21} rx={5} fill={CREAM} />
        <SvgText x={50} y={127.5 + fs * 0.36} fontSize={fs} fontFamily={font.display} textAnchor="middle" fill={NIGHT}>
          {name}
        </SvgText>
      </Frame>
    </Svg>
  );
}
