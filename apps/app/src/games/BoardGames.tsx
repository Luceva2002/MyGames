import { useEffect, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import type { ChessMove, ChessView, DamaMove, DamaPlan, DamaState } from '@giochi/engine';
import { Banner, turnText, type BoardProps } from './common';
import { Button, Row, SeatDot, T, tap } from '../ui/kit';
import { TableBg } from '../ui/tables';
import { colors } from '../ui/theme';

function useBoardSize() {
  const { width, height } = useWindowDimensions();
  return Math.floor(Math.min(width - 24, height - 230, 640) / 8) * 8;
}

/** Ordine delle caselle a schermo: chi gioca col nero vede la scacchiera girata. */
function squares(flip: boolean) {
  const list = Array.from({ length: 64 }, (_, i) => i);
  return flip ? list.reverse() : list;
}

function PlayersLine({ names, labels, turn }: { names: string[]; labels: [string, string]; turn: number }) {
  return (
    <Row gap={20} style={{ justifyContent: 'center' }}>
      {[0, 1].map((p) => (
        <Row key={p} gap={6} style={{ opacity: turn === p ? 1 : 0.6 }}>
          <SeatDot seat={p} />
          <T weight="800">
            {names[p]} {labels[p]}
          </T>
        </Row>
      ))}
    </Row>
  );
}

/* ------------------------------ DAMA ------------------------------ */

export function DamaBoard({ view, me, names, myTurn, onMove }: BoardProps<DamaState & { moves: DamaPlan[] }, DamaMove>) {
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
    <TableBg table="wood" scrim={0.35} style={{ alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <PlayersLine names={names} labels={['⚪', '⚫']} turn={view.turn} />
      <View style={{ width: size + 12, height: size + 12, flexDirection: 'row', flexWrap: 'wrap', borderWidth: 6, borderColor: '#4E342E' }}>
        {squares(me === 1).map((sq) => {
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
              style={{ width: cell, height: cell, backgroundColor: dark ? (wasLast ? '#8D6E3F' : '#6D4C41') : '#EFD9B4', alignItems: 'center', justifyContent: 'center' }}
            >
              {p && (
                <View
                  style={{
                    width: cell * 0.78,
                    height: cell * 0.78,
                    borderRadius: cell,
                    backgroundColor: p.owner === 0 ? '#F5F5F0' : '#1E1E1E',
                    borderWidth: sel === sq ? 4 : 2,
                    borderColor: sel === sq ? colors.accent : movable.has(sq) ? '#FFC94A88' : p.owner === 0 ? '#BDB6A6' : '#555',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {p.king && <T size={cell * 0.42} color={p.owner === 0 ? '#B8860B' : '#FFD54F'}>♛</T>}
                </View>
              )}
              {isTarget && <View style={{ position: 'absolute', width: cell * 0.3, height: cell * 0.3, borderRadius: cell, backgroundColor: colors.accent }} />}
            </Pressable>
          );
        })}
      </View>
      <Banner text={turnText(myTurn, names, view.turn, me)} tone={myTurn ? 'turn' : 'info'} />
      {myTurn && view.moves.some((m) => m.captured.length) && <T color={colors.accent}>Devi mangiare!</T>}
    </TableBg>
  );
}

/* ----------------------------- SCACCHI ----------------------------- */

const GLYPH: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const glyph = (p: string) => GLYPH[p.toLowerCase()] + '︎';

function Piece({ p, size }: { p: string; size: number }) {
  const white = p === p.toUpperCase();
  return (
    <T
      size={size}
      color={white ? '#FFFFFF' : '#111111'}
      style={{
        lineHeight: size * 1.15,
        textShadowColor: white ? '#000' : '#fff8',
        textShadowRadius: white ? 2 : 1,
        textShadowOffset: { width: 0, height: 0 },
      }}
    >
      {glyph(p)}
    </T>
  );
}

export function ScacchiBoard({ view, me, names, myTurn, onMove }: BoardProps<ChessView, ChessMove>) {
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
    <TableBg table="wood" scrim={0.35} style={{ alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <PlayersLine names={names} labels={['(bianco)', '(nero)']} turn={view.turn} />
      <T size={20} color={colors.muted}>{view.captured[me === 1 ? 0 : 1].map(glyph).join('')} </T>
      <View style={{ width: size + 8, height: size + 8, flexDirection: 'row', flexWrap: 'wrap', borderWidth: 4, borderColor: '#4E342E' }}>
        {squares(me === 1).map((sq) => {
          const light = (Math.floor(sq / 8) + (sq % 8)) % 2 === 0;
          const p = view.board[sq];
          const last = view.last && (view.last.from === sq || view.last.to === sq);
          let bg = light ? '#F0D9B5' : '#B58863';
          if (last) bg = light ? '#F6EB8A' : '#D2B34C';
          if (sel === sq) bg = colors.accent;
          if (view.check && sq === king) bg = '#E57373';
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
                <View style={{ position: 'absolute', width: p ? cell * 0.9 : cell * 0.28, height: p ? cell * 0.9 : cell * 0.28, borderRadius: cell, borderWidth: p ? 4 : 0, borderColor: '#2E7D32aa', backgroundColor: p ? 'transparent' : '#2E7D32aa' }} />
              )}
            </Pressable>
          );
        })}
      </View>
      <T size={20} color={colors.muted}>{view.captured[me === 1 ? 1 : 0].map(glyph).join('')} </T>
      <Banner text={view.check && myTurn ? 'Scacco! Tocca a te' : turnText(myTurn, names, view.turn, me)} tone={myTurn ? 'turn' : 'info'} />
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
                style={{ width: 70, height: 70, borderRadius: 14, backgroundColor: '#ECEFF4', alignItems: 'center', justifyContent: 'center' }}
              >
                <Piece p={view.turn === 0 ? k.toUpperCase() : k} size={52} />
              </Pressable>
            ))}
          </Row>
          <Button small kind="ghost" color={colors.text} label="Annulla" onPress={() => setPromo(null)} />
        </View>
      )}
    </TableBg>
  );
}
