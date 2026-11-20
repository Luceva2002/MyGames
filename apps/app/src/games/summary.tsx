import { View } from 'react-native';
import { teamSeats } from '@giochi/engine';
import { T } from '../ui/kit';
import { shellColors as colors } from '../ui/theme';

/** Nome di una squadra: in quattro sono le due persone, altrimenti il giocatore. */
export function teamLabel(team: number, players: number, names: string[]): string {
  return teamSeats(team, players)
    .map((s) => names[s])
    .join(' e ');
}

export function CardsSummaryTable({ columns, rows }: { columns: string[]; rows: [string, string[]][] }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 12, alignSelf: 'center', minWidth: 300, maxWidth: 600, width: '100%' }}>
      <View style={{ flexDirection: 'row', paddingVertical: 6 }}>
        <View style={{ flex: 1.2 }} />
        {columns.map((c) => (
          <T key={c} size={14} weight="800" center style={{ flex: 1 }}>
            {c}
          </T>
        ))}
      </View>
      {rows.map(([label, values], i) => (
        <View key={label} style={{ flexDirection: 'row', paddingVertical: 8, borderTopWidth: 1, borderColor: colors.line }}>
          <T size={14} color={colors.muted} style={{ flex: 1.2 }}>
            {label}
          </T>
          {values.map((v, j) => (
            <T key={j} size={i === rows.length - 1 ? 20 : 16} weight={i === rows.length - 1 ? '900' : '600'} center style={{ flex: 1 }}>
              {v}
            </T>
          ))}
        </View>
      ))}
    </View>
  );
}
