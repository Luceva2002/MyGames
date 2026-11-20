import { Fragment, type ReactNode } from 'react';
import { G, Path, Text as SvgText } from 'react-native-svg';
import { INK, type Part } from './shapes';

/**
 * Disegna una lista di parti dello stile Morbido. `scale` è quanto è grande il quadrato 100×100
 * rispetto al disegno che lo contiene: serve a tenere il contorno dello stesso spessore ovunque.
 */
export function drawParts(parts: Part[], scale: number, key = 'p'): ReactNode[] {
  const sw = 1.1 / scale;
  return parts.map((p, i) => {
    const k = `${key}-${i}`;
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
