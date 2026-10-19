import { Pressable, useWindowDimensions, View } from 'react-native';
import type { TrisMove, TrisState } from '@giochi/engine';
import { Banner, turnText, type BoardProps } from './common';
import { T, tap } from '../ui/kit';
import { TableBg } from '../ui/tables';
import { colors, seatColors } from '../ui/theme';

const SYMBOL = ['✕', '◯'];

export function TrisBoard({ view, me, names, myTurn, onMove }: BoardProps<TrisState, TrisMove>) {
  const { width, height } = useWindowDimensions();
  const size = Math.min(width - 48, height - 260, 480);
  const cell = size / 3;
  return (
    <TableBg table="wood" scrim={0.35} style={{ alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <View style={{ flexDirection: 'row', gap: 24 }}>
        {[0, 1].map((seat) => (
          <T key={seat} size={18} weight="800" color={seatColors[seat]}>
            {SYMBOL[seat]} {names[seat]}
          </T>
        ))}
      </View>
      <Banner
        text={view.winLine ? `Tris di ${names[view.board[view.winLine[0]]!]}` : view.board.every((c) => c !== null) ? 'Pareggio' : turnText(myTurn, names, view.turn, me)}
        tone={myTurn && !view.winLine ? 'turn' : 'info'}
      />
      <View style={{ width: size, height: size, flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.line, gap: 6, borderRadius: 18, padding: 6 }}>
        {view.board.map((owner, i) => {
          const winning = view.winLine?.includes(i);
          return (
            <Pressable
              key={i}
              disabled={!myTurn || owner !== null}
              onPress={() => {
                tap();
                onMove({ cell: i });
              }}
              style={({ pressed }) => ({
                width: cell - 8,
                height: cell - 8,
                borderRadius: 12,
                backgroundColor: winning ? colors.surface2 : pressed ? colors.surface2 : colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              {owner !== null && (
                <T size={cell * 0.55} weight="900" color={seatColors[owner]} style={{ lineHeight: cell * 0.7 }}>
                  {SYMBOL[owner]}
                </T>
              )}
            </Pressable>
          );
        })}
      </View>
    </TableBg>
  );
}
