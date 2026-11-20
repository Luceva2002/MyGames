import { memo, useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Pattern, Rect, Text as SvgText } from 'react-native-svg';
import type { Card } from '@giochi/engine';
import { Place } from './morbido/draw';
import { CAT, INK, PAL, figureParts, figureTint, frColor, frSuit, itSuit, itTilt, type Part, type Role } from './morbido/shapes';
import { font } from './theme';

/**
 * Carte dello stile Morbido (approvato il 20/11/2026), tutte disegnate in codice: carta bianca col
 * contorno scuro morbido, semi pieni contornati, valore e seme solo in alto a sinistra (le carte
 * stanno sempre dritte). Le figure sono i mostrini in costume, il Jolly è Briscola la gatta.
 */

/** Il seme di una carta, nel suo quadrato 100×100. */
export const suitParts = (card: Card): Part[] => (card.deck === 'it' ? itSuit(card.suit) : frSuit(card.suit));
const ink = (card: Card) => (card.deck === 'it' ? INK : frColor(card.suit));
/** Altezza del disegno: la carta è larga 100. */
const unitH = (w: number, h: number) => (100 * h) / w;
/** id validi dentro url(#...) anche quando useId mette i due punti. */
const useSvgId = (p: string) => p + useId().replace(/[^a-zA-Z0-9]/g, '');

/** Disposizione classica dei semi, da 0 a 1 tra la prima e l'ultima riga e tra le due colonne. */
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

/** Valore e seme piccolo nell'angolo in alto a sinistra. */
function Index({ card, color }: { card: Card; color?: string }) {
  const label = valueLabel(card);
  const two = label.length > 1;
  return (
    <G>
      <SvgText x={two ? 6 : 9} y={23} fontFamily={font.card} fontSize={two ? 18 : 21} fill={color ?? ink(card)} letterSpacing={two ? -1 : 0}>
        {label}
      </SvgText>
      {card.suit !== 'j' && <Place parts={suitParts(card)} cx={14.5} cy={34} size={13} tilt={card.deck === 'it' ? itTilt(card.suit) : 0} />}
    </G>
  );
}

export const NumeralFace = memo(function NumeralFace({ card, w, h }: { card: Card; w: number; h: number }) {
  const H = unitH(w, h);
  const it = card.deck === 'it';
  const pip = suitParts(card);
  const tilt = it ? itTilt(card.suit) : 0;
  const r = card.rank;
  return (
    <Svg width={w} height={h} viewBox={`0 0 100 ${H}`} style={StyleSheet.absoluteFill}>
      {r === 1 ? (
        <Place parts={pip} cx={50} cy={it ? H / 2 : H / 2 + 2} size={it ? 64 : card.suit === 's' ? 60 : 56} tilt={tilt} />
      ) : (
        (PIPS[r] ?? []).map(([px, py], i) =>
          it ? (
            <Place key={i} parts={pip} cx={33 + px * 34} cy={32 + py * (H - 64)} size={r <= 3 ? 27 : 23} tilt={tilt} />
          ) : (
            // Nelle francesi la metà bassa è capovolta, come nei mazzi veri.
            <Place key={i} parts={pip} cx={34 + px * 32} cy={26 + py * (H - 50)} size={r <= 3 ? 22 : r <= 7 ? 18 : 17} flip={py > 0.5} />
          ),
        )
      )}
      <Index card={card} />
    </Svg>
  );
});

const FIG_ROLE: Record<'fr' | 'it', Record<number, Role>> = { fr: { 11: 'J', 12: 'Q', 13: 'K' }, it: { 8: 'J', 9: 'H', 10: 'K' } };
const IT_NAME: Record<Role, string> = { J: 'FANTE', H: 'CAVALLO', K: 'RE', Q: 'REGINA' };

/** Figure e Jolly: il mostrino in una finestra tinta del colore del seme, col nome nelle napoletane. */
export const FigureFace = memo(function FigureFace({ card, w, h }: { card: Card; w: number; h: number }) {
  const H = unitH(w, h);
  const clip = useSvgId('fig');
  const joker = card.suit === 'j';
  const deck = card.deck === 'it' ? 'it' : 'fr';
  const role = FIG_ROLE[deck][card.rank] ?? 'K';
  const band = joker || deck === 'it';
  const tint = joker ? '#FFF1CF' : figureTint(deck, card.suit);
  // I due Jolly si distinguono dal colore della stella.
  const star = Number(card.id.slice(-1)) % 2 ? PAL.black : PAL.red;
  return (
    <Svg width={w} height={h} viewBox={`0 0 100 ${H}`} style={StyleSheet.absoluteFill}>
      <Defs>
        <ClipPath id={clip}>
          <Rect x={8} y={8} width={84} height={H - 16} rx={6} />
        </ClipPath>
      </Defs>
      <Rect x={8} y={8} width={84} height={H - 16} rx={6} fill={tint} />
      <G clipPath={`url(#${clip})`}>
        {joker ? <Place parts={CAT} cx={50} cy={H - 57} size={98} /> : <Place parts={figureParts(deck, card.suit, role)} cx={50} cy={deck === 'it' ? H - 91 : H - 65} size={deck === 'it' ? 100 : 98} />}
        {band && <Rect x={8} y={H - 34} width={84} height={26} fill="#FFFFFF" opacity={0.92} />}
      </G>
      <Rect x={8} y={8} width={84} height={H - 16} rx={6} fill="none" stroke={INK} strokeWidth={1.4} />
      {band && (
        <SvgText x={50} y={H - 16} textAnchor="middle" fontFamily={font.card} fontSize={12} letterSpacing={1.4} fill={INK}>
          {joker ? 'JOLLY' : IT_NAME[role]}
        </SvgText>
      )}
      {!joker && <Place parts={suitParts(card)} cx={81} cy={deck === 'it' ? 25 : 24} size={deck === 'it' ? 16 : 15} tilt={deck === 'it' ? itTilt(card.suit) : 0} />}
      <Index card={card} color={joker ? star : undefined} />
    </Svg>
  );
});

/** Dorso: rosso a pois, al centro il muso di Briscola in un tondo. */
export const BackFace = memo(function BackFace({ w, h }: { w: number; h: number }) {
  const H = unitH(w, h);
  const dots = useSvgId('dots');
  const clip = useSvgId('cat');
  return (
    <Svg width={w} height={h} viewBox={`0 0 100 ${H}`} style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern id={dots} width={12} height={12} patternUnits="userSpaceOnUse">
          <Circle cx={3} cy={3} r={1.8} fill="#FFFFFF" opacity={0.5} />
          <Circle cx={9} cy={9} r={1.8} fill="#FFFFFF" opacity={0.5} />
        </Pattern>
        <ClipPath id={clip}>
          <Circle cx={50} cy={H / 2} r={19} />
        </ClipPath>
      </Defs>
      <Rect x={7} y={7} width={86} height={H - 14} rx={6} fill={PAL.red} />
      <Rect x={7} y={7} width={86} height={H - 14} rx={6} fill={`url(#${dots})`} />
      <Rect x={7} y={7} width={86} height={H - 14} rx={6} fill="none" stroke={INK} strokeWidth={1.2} />
      {/* Sotto i 30 px il muso non si legge: resta solo il tondo. */}
      <Circle cx={50} cy={H / 2} r={19} fill="#FFF1CF" />
      {w >= 30 && (
        <G clipPath={`url(#${clip})`}>
          <Place parts={CAT} cx={50} cy={H / 2 + 6} size={46} />
        </G>
      )}
      <Circle cx={50} cy={H / 2} r={19} fill="none" stroke={INK} strokeWidth={1.8} />
    </Svg>
  );
});

/**
 * Indice grande per le carte strette e sovrapposte (le colonne del solitario sul telefono):
 * valore e seme grandi in una fascia in alto, leggibili anche quando si vede solo la cima.
 */
export function BigIndex({ card, w }: { card: Card; w: number }) {
  const fs = w * 0.4;
  const pip = w * 0.34;
  return (
    <View pointerEvents="none" style={[styles.bigIndex, { height: w * 0.5, paddingHorizontal: w * 0.07, borderTopLeftRadius: w * 0.1, borderTopRightRadius: w * 0.1 }]}>
      <Text style={{ color: ink(card), fontFamily: font.card, fontSize: fs, lineHeight: fs * 1.1, includeFontPadding: false }}>{valueLabel(card)}</Text>
      <Svg width={pip} height={pip} viewBox="0 0 100 100">
        <Place parts={suitParts(card)} cx={50} cy={50} size={100} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  bigIndex: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#2A2D3422' },
});
