import { Fragment, type ReactNode } from 'react';
import { G, Image as SvgImage, Path, Text as SvgText } from 'react-native-svg';
import { INK, type Part } from './shapes';

/**
 * Disegna una lista di parti dello stile Morbido. `scale` è quanto è grande il quadrato 100×100
 * rispetto al disegno che lo contiene: serve a tenere il contorno dello stesso spessore ovunque.
 */
/** Le immagini dei mostrini (scontornate dalla tavola di Luca del 22/11/2026). */
const MOSTRO_ART: Record<string, number> = {
  bobo: require('../../../assets/mostrini/bobo.png'),
  otto: require('../../../assets/mostrini/otto.png'),
  zap: require('../../../assets/mostrini/zap.png'),
  gelo: require('../../../assets/mostrini/gelo.png'),
  gnaf: require('../../../assets/mostrini/gnaf.png'),
  ombra: require('../../../assets/mostrini/ombra.png'),
  bit: require('../../../assets/mostrini/bit.png'),
  dado: require('../../../assets/mostrini/dado.png'),
  morso: require('../../../assets/mostrini/morso.png'),
  fio: require('../../../assets/mostrini/fio.png'),
};

export function drawParts(parts: Part[], scale: number, key = 'p'): ReactNode[] {
  const sw = 1.1 / scale;
  return parts.map((p, i) => {
    const k = `${key}-${i}`;
    if (p.img) {
      return <SvgImage key={k} href={MOSTRO_ART[p.img]} x={p.x ?? 0} y={p.y ?? 0} width={p.s ?? 100} height={p.s ?? 100} preserveAspectRatio="xMidYMid meet" />;
    }
    if (p.group) {
      const t = `translate(${p.x ?? 0} ${p.y ?? 0}) scale(${p.s ?? 1})${p.r ? ` rotate(${p.r} 50 50)` : ''}`;
      return <G key={k} transform={t}>{drawParts(p.group, scale * (p.s ?? 1), k)}</G>;
    }
    if (p.t !== undefined) {
      return (
        <SvgText key={k} x={p.tx} y={(p.ty ?? 0) + (p.ts ?? 10) * 0.36} fontSize={p.ts} fontFamily="Fredoka_700Bold" textAnchor="middle" fill={p.fill ?? INK}>
          {p.t}
        </SvgText>
      );
    }
    if (p.detail) {
      return p.stroke ? (
        <Path key={k} d={p.d} fill="none" stroke={p.stroke} strokeWidth={(p.w ?? 1) / scale} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <Path key={k} d={p.d} fill={p.fill} opacity={p.op ?? 1} />
      );
    }
    return <Path key={k} d={p.d} fill={p.fill} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />;
  });
}

/** Mette un disegno 100×100 al centro (cx, cy) con lato `size`, eventualmente inclinato. */
export function Place({ parts, cx, cy, size, tilt, flip }: { parts: Part[]; cx: number; cy: number; size: number; tilt?: number; flip?: boolean }) {
  const t = `translate(${cx - size / 2} ${cy - size / 2}) scale(${size / 100})${flip ? ' rotate(180 50 50)' : ''}${tilt ? ` rotate(${tilt} 50 50)` : ''}`;
  return <G transform={t}><Fragment>{drawParts(parts, size / 100)}</Fragment></G>;
}
