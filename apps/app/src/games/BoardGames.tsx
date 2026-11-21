import { useEffect, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import type { ChessMove, ChessView, DamaMove, DamaPlan, DamaState } from '@giochi/engine';
import { Banner, Opponents, PlayerBadge, seatsFrom, turnText, useSharedScreen, type BoardProps } from './common';
import { Button, Row, T, tap } from '../ui/kit';
import { TableBg } from '../ui/tables';
import { colors } from '../ui/theme';

function useBoardSize() {
  const { width, height } = useWindowDimensions();
  // Lascia spazio a barra in alto, giocatori, catture e cartello del turno.
  return Math.floor(Math.min(width - 72, height - 380, 620) / 8) * 8;
}

/** Colori della scacchiera Pop: crema e viola pieno, cornice quasi nera senza contorni spessi. */
const SQ_LIGHT = '#F4F1E8';
const SQ_DARK = '#5B3FE0';
const SQ_LAST_LIGHT = '#FFE08A';
const SQ_LAST_DARK = '#8C74F0';

function BoardFrame({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <View style={{ padding: 8, borderRadius: 18, backgroundColor: colors.line, boxShadow: `0px 10px 26px rgba(0,0,0,0.4)` }}>
      <View style={{ width: size, height: size, flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1.5, borderColor: colors.line, borderRadius: 6, overflow: 'hidden', boxSizing: 'content-box' } as object}>{children}</View>
    </View>
  );
}

/** Ordine delle caselle a schermo: chi gioca col nero vede la scacchiera girata. */
function squares(flip: boolean) {
  const list = Array.from({ length: 64 }, (_, i) => i);
  return flip ? list.reverse() : list;
}

/* ------------------------------ DAMA ------------------------------ */

/** Pedina della dama: disco crema o carbone col contorno sottile e un'ombra morbida; la dama ha la corona. */
function Disc({ white, king, size, selected, movable }: { white: boolean; king: boolean; size: number; selected: boolean; movable: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size,
        backgroundColor: white ? '#FFFBEE' : '#17181C',
        borderWidth: Math.max(1.5, size * 0.045),
        borderColor: selected ? colors.accent : colors.line,
        boxShadow: `0px 6px 16px rgba(0,0,0,0.35)${movable && !selected ? `, 0px 0px 0px ${size * 0.06}px ${colors.accent}` : ''}`,
        transform: [{ translateY: selected ? -size * 0.1 : 0 }],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ position: 'absolute', width: size * 0.62, height: size * 0.62, borderRadius: size, borderWidth: Math.max(1.5, size * 0.05), borderColor: white ? '#E8DFC2' : '#3A3D46' }} />
      {king && <T size={size * 0.46} color={white ? colors.accent2 : colors.accent}>♛</T>}
    </View>
  );
}

export function DamaBoard({ view, me, names, myTurn, onMove }: BoardProps<DamaState & { moves: DamaPlan[] }, DamaMove>) {
  const shared = useSharedScreen();
  // Sullo stesso schermo la scacchiera resta ferma: il bianco è sempre in basso.
  const side = shared ? 0 : me;
  const size = useBoardSize();
  const cell = size / 8;
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => setSel(null), [view.turn]);
  const movable = new Set(myTurn ? view.moves.map((m) => m.path[0]) : []);
  const targets = sel === null ? [] : view.moves.filter((m) => m.path[0] === sel);
  const targetEnds = new Map(targets.map((m) => [m.path[m.path.length - 1], m]));

  const press = (sq: number) => {
    if (!myTurn) return;
    const plan = targetEnds.get(sq);
    if (plan) {
      onMove({ path: plan.path });
      setSel(null);
    } else if (movable.has(sq)) setSel(sq);
    else setSel(null);
  };

  return (
    <TableBg table="teal">
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 44 }}>
      <Opponents>
        {seatsFrom(2, side).map((seat) => (
          <PlayerBadge key={seat} seat={seat} isMe={!shared && seat === me} name={`${names[seat]} ${seat === 0 ? '⚪' : '⚫'}`} active={view.turn === seat} score={12 - view.board.filter((p) => p && p.owner !== seat).length} scoreLabel="mangiate" />
        ))}
      </Opponents>
      <BoardFrame size={size}>
        {squares(side === 1).map((sq) => {
          const dark = (Math.floor(sq / 8) + (sq % 8)) % 2 === 1;
          const p = view.board[sq];
          const isTarget = targetEnds.has(sq);
          const wasLast = view.last?.includes(sq);
          return (
            <Pressable
              key={sq}
              onPress={() => {
                tap();
                press(sq);
              }}
              style={{ width: cell, height: cell, backgroundColor: dark ? (wasLast ? SQ_LAST_DARK : SQ_DARK) : SQ_LIGHT, alignItems: 'center', justifyContent: 'center' }}
            >
              {p && <Disc white={p.owner === 0} king={p.king} size={cell * 0.76} selected={sel === sq} movable={movable.has(sq)} />}
              {isTarget && <View style={{ position: 'absolute', width: cell * 0.34, height: cell * 0.34, borderRadius: cell, backgroundColor: colors.accent3, borderWidth: 1.5, borderColor: colors.line }} />}
            </Pressable>
          );
        })}
      </BoardFrame>
      <Banner text={shared ? `Tocca a ${names[view.turn]}` : turnText(myTurn, names, view.turn, me)} tone={myTurn ? 'turn' : 'info'} />
      {myTurn && view.moves.some((m) => m.captured.length) && <T color={colors.accent}>Devi mangiare!</T>}
      </View>
    </TableBg>
  );
}

/* ----------------------------- SCACCHI ----------------------------- */

const GLYPH: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const glyph = (p: string) => GLYPH[p.toLowerCase()] + '︎';

/**
 * Pezzo degli scacchi col contorno spesso del Carnevale: il simbolo pieno ripetuto sotto, spostato
 * tutto intorno, fa da bordo. Bianchi crema col bordo inchiostro, neri inchiostro col bordo giallo.
 */
function Piece({ p, size }: { p: string; size: number }) {
  const white = p === p.toUpperCase();
  const ch = glyph(p);
  const o = Math.max(1.5, size * 0.05);
  const box = { width: size * 1.1, height: size * 1.2 };
  const text = (color: string, dx: number, dy: number, key: string) => (
    <Text key={key} style={{ position: 'absolute', left: dx, top: dy, width: box.width, fontSize: size, lineHeight: box.height, color, textAlign: 'center' }}>
      {ch}
    </Text>
  );
  const edge = white ? colors.line : colors.accent;
  const offsets = [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, o], [-o, o], [o, -o]];
  return (
    <View style={box}>
      {text('#0D0E1155', 0, size * 0.08, 'shadow')}
      {offsets.map(([dx, dy], i) => text(edge, dx, dy, `e${i}`))}
      {text(white ? '#FFFBEE' : '#17181C', 0, 0, 'fill')}
    </View>
  );
}

export function ScacchiBoard({ view, me, names, myTurn, onMove }: BoardProps<ChessView, ChessMove>) {
  const shared = useSharedScreen();
  // Sullo stesso schermo la scacchiera resta ferma: il bianco è sempre in basso.
  const side = shared ? 0 : me;
  const size = useBoardSize();
  const cell = size / 8;
  const [sel, setSel] = useState<number | null>(null);
  const [promo, setPromo] = useState<ChessMove | null>(null);
  useEffect(() => setSel(null), [view.turn]);
  const mine = (sq: number) => myTurn && view.legal.some((m) => m.from === sq);
  const targets = new Set(sel === null ? [] : view.legal.filter((m) => m.from === sel).map((m) => m.to));
  const king = view.board.indexOf(view.turn === 0 ? 'K' : 'k');

  const press = (sq: number) => {
    if (!myTurn) return;
    if (sel !== null && targets.has(sq)) {
      const options = view.legal.filter((m) => m.from === sel && m.to === sq);
      if (options.length > 1) setPromo({ from: sel, to: sq });
      else onMove(options[0]);
      setSel(null);
    } else setSel(mine(sq) ? sq : null);
  };

  return (
    <TableBg table="teal">
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 44 }}>
      <Opponents>
        {seatsFrom(2, side).map((seat) => (
          <PlayerBadge key={seat} seat={seat} isMe={!shared && seat === me} name={`${names[seat]} ${seat === 0 ? '⚪' : '⚫'}`} active={view.turn === seat} score={view.captured[seat === 0 ? 1 : 0].length} scoreLabel="catture" />
        ))}
      </Opponents>
      <T size={20} color={colors.muted}>{view.captured[side === 1 ? 0 : 1].map(glyph).join('')} </T>
      <BoardFrame size={size}>
        {squares(side === 1).map((sq) => {
          const light = (Math.floor(sq / 8) + (sq % 8)) % 2 === 0;
          const p = view.board[sq];
          const last = view.last && (view.last.from === sq || view.last.to === sq);
          let bg = light ? SQ_LIGHT : SQ_DARK;
          if (last) bg = light ? SQ_LAST_LIGHT : SQ_LAST_DARK;
          if (sel === sq) bg = colors.accent;
          if (view.check && sq === king) bg = colors.accent2;
          return (
            <Pressable
              key={sq}
              onPress={() => {
                tap();
                press(sq);
              }}
              style={{ width: cell, height: cell, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}
            >
              {p && <Piece p={p} size={cell * 0.78} />}
              {targets.has(sq) && (
                <View style={{ position: 'absolute', width: p ? cell * 0.92 : cell * 0.32, height: p ? cell * 0.92 : cell * 0.32, borderRadius: cell, borderWidth: p ? 4 : 3, borderColor: p ? colors.accent3 : colors.line, backgroundColor: p ? 'transparent' : colors.accent3 }} />
              )}
            </Pressable>
          );
        })}
      </BoardFrame>
      <T size={20} color={colors.muted}>{view.captured[side === 1 ? 1 : 0].map(glyph).join('')} </T>
      <Banner text={shared ? `${view.check ? 'Scacco! ' : ''}Tocca a ${names[view.turn]}` : view.check && myTurn ? 'Scacco! Tocca a te' : turnText(myTurn, names, view.turn, me)} tone={myTurn ? 'turn' : 'info'} />
      {promo && (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <T size={20} weight="900">
            Promuovi a…
          </T>
          <Row gap={10}>
            {(['q', 'r', 'b', 'n'] as const).map((k) => (
              <Pressable
                key={k}
                onPress={() => {
                  onMove({ ...promo, promo: k });
                  setPromo(null);
                }}
                style={{ width: 76, height: 76, borderRadius: 16, backgroundColor: SQ_DARK, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}
              >
                <Piece p={view.turn === 0 ? k.toUpperCase() : k} size={52} />
              </Pressable>
            ))}
          </Row>
          <Button small kind="ghost" color={colors.text} label="Annulla" onPress={() => setPromo(null)} />
        </View>
      )}
      </View>
    </TableBg>
  );
}
