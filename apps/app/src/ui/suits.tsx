import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { Card } from '@giochi/engine';
import { colors, font } from './theme';

/**
 * Carte numerali disegnate in codice nello stile delle figure coi personaggi (Grafiche/carte):
 * carta crema, bollino magenta col valore che esce dall'angolo in alto a sinistra, seme piccolo
 * in alto a destra, semi grandi piatti con contorno nero spesso. Restano nitide a ogni misura.
 */

const INK = colors.line;
const CREAM = '#FDFAE8';
const YELLOW = colors.accent;
const MAGENTA = colors.accent2;
const TURQUOISE = colors.accent3;

/** Un seme disegnato in un quadrato 100×100. */
export function SuitShape({ suit }: { suit: string }) {
  switch (suit) {
    // Denari: moneta gialla con anello e un piccolo rombo magenta al centro.
    case 'd':
      return (
        <G>
          <Circle cx={50} cy={50} r={40} fill={YELLOW} stroke={INK} strokeWidth={6} />
          <Circle cx={50} cy={50} r={25} fill="none" stroke={INK} strokeWidth={4} />
          <Path d="M50 38 L60 50 L50 62 L40 50 Z" fill={MAGENTA} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        </G>
      );
    // Coppe: calice turchese con l'orlo giallo.
    case 'c':
      return (
        <G stroke={INK} strokeWidth={6} strokeLinejoin="round">
          <Path d="M50 62 L50 80" />
          <Path d="M28 92 Q50 74 72 92 Z" fill={YELLOW} />
          <Path d="M20 14 H80 Q80 60 50 64 Q20 60 20 14 Z" fill={TURQUOISE} />
          <Path d="M20 14 H80 Q80 26 78 30 H22 Q20 26 20 14 Z" fill={YELLOW} />
        </G>
      );
    // Spade: lama turchese ed elsa gialla, come nel 10 di spade di Arlecchino.
    case 's':
      return (
        <G stroke={INK} strokeWidth={6} strokeLinejoin="round" transform="rotate(30 50 50)">
          <Path d="M40 64 V18 L50 2 L60 18 V64 Z" fill={TURQUOISE} />
          <Rect x={22} y={62} width={56} height={13} rx={5} fill={YELLOW} />
          <Rect x={43} y={75} width={14} height={13} fill={INK} />
          <Circle cx={50} cy={91} r={7} fill={YELLOW} />
        </G>
      );
    // Bastoni: randello napoletano magenta coi nodi gialli (non il fiore francese).
    case 'b':
      return (
        <G stroke={INK} strokeWidth={6} strokeLinejoin="round" transform="rotate(-25 50 50)">
          <Path d="M66 34 Q86 20 90 36 Q78 44 66 34 Z" fill={TURQUOISE} strokeWidth={4} />
          <Path d="M42 96 L40 72 Q31 67 36 58 L34 42 Q23 37 30 26 Q31 6 50 5 Q69 6 70 26 Q77 37 66 42 L64 58 Q69 67 60 72 L58 96 Z" fill={MAGENTA} />
          <Circle cx={44} cy={28} r={5} fill={YELLOW} strokeWidth={4} />
          <Circle cx={57} cy={50} r={5} fill={YELLOW} strokeWidth={4} />
          <Circle cx={48} cy={78} r={4} fill={YELLOW} strokeWidth={4} />
        </G>
      );
    case 'h':
      return <Path d="M50 88 C20 66 6 48 10 30 C14 12 38 8 50 28 C62 8 86 12 90 30 C94 48 80 66 50 88 Z" fill={MAGENTA} stroke={INK} strokeWidth={6} strokeLinejoin="round" />;
    case 'q':
      return <Path d="M50 6 L84 50 L50 94 L16 50 Z" fill={MAGENTA} stroke={INK} strokeWidth={6} strokeLinejoin="round" />;
    case 'p':
      return (
        <Path
          d="M50 6 C30 30 8 42 10 60 C12 78 34 82 46 68 L40 92 H60 L54 68 C66 82 88 78 90 60 C92 42 70 30 50 6 Z"
          fill={INK}
          stroke={INK}
          strokeWidth={6}
          strokeLinejoin="round"
        />
      );
    case 'f':
      return (
        <G fill={INK}>
          <Path d="M45 58 L38 92 H62 L55 58 Z" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
          <Circle cx={50} cy={28} r={20} />
          <Circle cx={28} cy={60} r={20} />
          <Circle cx={72} cy={60} r={20} />
          <Rect x={36} y={40} width={28} height={22} />
        </G>
      );
    default:
      return null;
  }
}

// Le francesi nel motore usano h/d/c/s come le italiane usano d/c/s/b: le rinomino per non confonderle.
const FR_SUIT: Record<string, string> = { h: 'h', d: 'q', c: 'f', s: 'p' };
export const shapeOf = (card: Card) => (card.deck === 'fr' ? FR_SUIT[card.suit] : card.suit);

/**
 * Disposizione classica dei semi, in coordinate da 0 a 1 dentro la zona centrale della carta
 * (tra le due colonne degli indici). Colonne a 0 e 1, centro a 0.5.
 */
const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.5, 0], [0.5, 1]],
  3: [[0.5, 0], [0.5, 0.5], [0.5, 1]],
  4: [[0, 0], [1, 0], [0, 1], [1, 1]],
  5: [[0, 0], [1, 0], [0.5, 0.5], [0, 1], [1, 1]],
  6: [[0, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
  7: [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
  8: [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0.5, 0.75], [0, 1], [1, 1]],
  9: [[0, 0], [1, 0], [0, 1 / 3], [1, 1 / 3], [0.5, 0.5], [0, 2 / 3], [1, 2 / 3], [0, 1], [1, 1]],
  10: [[0, 0], [1, 0], [0.5, 1 / 6], [0, 1 / 3], [1, 1 / 3], [0, 2 / 3], [1, 2 / 3], [0.5, 5 / 6], [0, 1], [1, 1]],
};

const FR_LABEL: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
export const valueLabel = (card: Card) => (card.suit === 'j' ? '★' : card.deck === 'fr' ? FR_LABEL[card.rank] ?? String(card.rank) : String(card.rank));

/** Indice d'angolo: bollino magenta col valore ben centrato (il seme si legge già al centro della carta). */
function CornerIndex({ card, w }: { card: Card; w: number }) {
  const d = w * 0.21;
  const label = valueLabel(card);
  const fs = d * (label.length > 1 ? 0.5 : 0.62);
  return (
    <View style={{ alignItems: 'center', width: d }}>
      <View style={[styles.badge, { width: d, height: d, borderRadius: d / 2, borderWidth: Math.max(1.5, w * 0.022) }]}>
        <Text style={{ color: '#fff', fontFamily: font.display, fontSize: fs, lineHeight: fs * 1.05, textAlign: 'center', includeFontPadding: false, marginTop: fs * 0.06 }}>{label}</Text>
      </View>
    </View>
  );
}

/** Il valore in alto a sinistra: le carte sono sempre dritte, quindi basta un angolo solo. */
export function CardCorners({ card, w }: { card: Card; w: number }) {
  const m = w * 0.03;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: m, top: m }}>
      <CornerIndex card={card} w={w} />
    </View>
  );
}


/**
 * L'asso, carta speciale: raggiera dorata, medaglione con la cucitura tratteggiata, seme grande al
 * centro, quattro rombi da Arlecchino agli angoli e il nastro "ASSO" in basso. Tutto in codice,
 * nello stesso tratto nero spesso delle altre carte.
 */
function AceArt({ card, w, h }: { card: Card; w: number; h: number }) {
  const cx = w / 2;
  const cy = h * 0.47;
  const r = w * 0.36;
  const rays = 16;
  const pip = w * 0.44;
  const sw = Math.max(1.5, w * 0.025);
  // Il medaglione ha un colore che fa risaltare il seme: turchese sotto l'oro, oro sotto il turchese e il nero, rosa sotto il magenta.
  const shape = shapeOf(card);
  const tint = shape === 'd' ? '#C9F2EE' : shape === 'h' || shape === 'q' ? '#FFF1C2' : shape === 'c' ? '#FFD6E8' : '#FFE7A3';
  const diamond = (x: number, y: number, s: number, fill: string, key: string) => (
    <Path key={key} d={`M${x} ${y - s} L${x + s * 0.7} ${y} L${x} ${y + s} L${x - s * 0.7} ${y} Z`} fill={fill} stroke={INK} strokeWidth={sw * 0.7} strokeLinejoin="round" />
  );
  const ribbonY = h * 0.84;
  const rw = w * 0.5;
  const rh = w * 0.13;
  return (
    <G>
      {Array.from({ length: rays }, (_, i) => {
        const a = (i / rays) * Math.PI * 2;
        const b = a + Math.PI / rays;
        const R = r * 1.55;
        return <Path key={`r${i}`} d={`M${cx} ${cy} L${cx + Math.cos(a) * R} ${cy + Math.sin(a) * R} L${cx + Math.cos(b) * R} ${cy + Math.sin(b) * R} Z`} fill={i % 2 ? '#FFF1C2' : '#FFE08A'} opacity={0.75} />;
      })}
      <Circle cx={cx} cy={cy} r={r} fill={tint} stroke={INK} strokeWidth={sw} />
      <Circle cx={cx} cy={cy} r={r * 0.84} fill="none" stroke={INK} strokeWidth={sw * 0.5} strokeDasharray={`${w * 0.03} ${w * 0.025}`} />
      <G transform={`translate(${cx - pip / 2} ${cy - pip / 2}) scale(${pip / 100})`}>
        <SuitShape suit={shapeOf(card)} />
      </G>
      {diamond(w * 0.82, h * 0.1, w * 0.06, MAGENTA, 'd1')}
      {diamond(w * 0.15, h * 0.72, w * 0.05, TURQUOISE, 'd2')}
      {diamond(w * 0.85, h * 0.72, w * 0.05, YELLOW, 'd3')}
      <Path
        d={`M${cx - rw / 2 - rh * 0.6} ${ribbonY + rh * 0.25} L${cx - rw / 2} ${ribbonY - rh / 2} L${cx + rw / 2} ${ribbonY - rh / 2} L${cx + rw / 2 + rh * 0.6} ${ribbonY + rh * 0.25} L${cx + rw / 2} ${ribbonY + rh / 2} L${cx - rw / 2} ${ribbonY + rh / 2} Z`}
        fill={MAGENTA}
        stroke={INK}
        strokeWidth={sw * 0.8}
        strokeLinejoin="round"
      />
      <SvgText x={cx} y={ribbonY + rh * 0.3} fontSize={rh * 0.82} fontFamily={font.display} fill="#fff" textAnchor="middle" letterSpacing={w * 0.01}>
        ASSO
      </SvgText>
    </G>
  );
}

export const NumeralFace = memo(function NumeralFace({ card, w, h }: { card: Card; w: number; h: number }) {
  const shape = shapeOf(card);
  const pips = PIPS[card.rank] ?? [];
  const ace = card.rank === 1;
  // Semi ben distanziati e centrati; l'asso ha un seme grande al centro della carta.
  const n = pips.length;
  let size = ace ? w * 0.46 : n <= 3 ? w * 0.26 : n <= 6 ? w * 0.23 : n <= 8 ? Math.min(w * 0.21, (h - w * 0.42) / 4.2) : Math.min(w * 0.2, (h - w * 0.42) / 5.2);
  // Le napoletane sono più alte: c'è posto per semi più grandi.
  if (card.deck === 'it' && !ace) size *= 1.2;
  const left = w * 0.3;
  const right = w * 0.7;
  // Margini uguali sopra e sotto: i semi restano centrati nella carta.
  const top = w * 0.21 + size / 2;
  const bottom = h - w * 0.21 - size / 2;
  // Nelle francesi la metà bassa è capovolta, come nei mazzi veri; le napoletane restano dritte.
  const flip = card.deck === 'fr';
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: CREAM }]}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        {ace && <AceArt card={card} w={w} h={h} />}
        {!ace && pips.map(([px, py], i) => {
          const cx = ace ? w / 2 : left + px * (right - left);
          const cy = ace ? h / 2 : top + py * (bottom - top);
          const rot = flip && py > 0.5 ? ` rotate(180 50 50)` : '';
          return (
            <G key={i} transform={`translate(${cx - size / 2} ${cy - size / 2}) scale(${size / 100})${rot}`}>
              <SuitShape suit={shape} />
            </G>
          );
        })}
      </Svg>
      <CardCorners card={card} w={w} />
    </View>
  );
});

/**
 * Indice grande per le carte strette e sovrapposte (le colonne del solitario sul telefono):
 * valore e seme grandi in una fascia in alto, leggibili anche quando si vede solo la cima.
 */
export function BigIndex({ card, w }: { card: Card; w: number }) {
  const red = card.suit === 'h' || card.suit === 'd';
  const fs = w * 0.4;
  const pip = w * 0.34;
  return (
    <View pointerEvents="none" style={[styles.bigIndex, { height: w * 0.5, paddingHorizontal: w * 0.07, borderTopLeftRadius: w * 0.1, borderTopRightRadius: w * 0.1 }]}>
      <Text style={{ color: red ? MAGENTA : INK, fontFamily: font.display, fontSize: fs, lineHeight: fs * 1.1, includeFontPadding: false }}>{valueLabel(card)}</Text>
      <Svg width={pip} height={pip} viewBox="0 0 100 100">
        <SuitShape suit={shapeOf(card)} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  bigIndex: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: CREAM, borderBottomWidth: 1, borderBottomColor: '#12052B22' },
  badge: { backgroundColor: MAGENTA, borderColor: INK, alignItems: 'center', justifyContent: 'center' },
});
