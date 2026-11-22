import { createContext, useContext, useState, type ReactNode } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import type { GameMeta } from '@giochi/engine';
import { GameArt } from './GameArt';
import { focusRing, T, tap, useTextSize } from './kit';
import { usePalette } from './theme';

const GAP = 10;

/** Griglia di icone: quattro per riga sul telefono, di più sugli schermi larghi. */
export function useIconSize() {
  const { width } = useWindowDimensions();
  const inner = Math.min(width, 1100) - 32;
  const columns = inner > 900 ? 8 : inner > 640 ? 6 : 4;
  return Math.floor((inner - (columns - 1) * GAP) / columns);
}

/** Il lato delle icone deciso dalla griglia che le contiene, misurata davvero (su PC e TV lo schermo è più largo di 1100). */
const GridSize = createContext<number | null>(null);

/** Quante colonne: almeno quattro, poi tante quante ne stanno con icone di circa 130 punti, così la riga è sempre piena. */
const sizeFor = (w: number) => {
  const columns = Math.max(4, Math.floor((w + GAP) / (130 + GAP)));
  return Math.floor((w - (columns - 1) * GAP) / columns);
};

export function GameGrid({ children }: { children: ReactNode }) {
  const [size, setSize] = useState<number | null>(null);
  return (
    <View onLayout={(e) => setSize(sizeFor(e.nativeEvent.layout.width))} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
      <GridSize.Provider value={size}>{children}</GridSize.Provider>
    </View>
  );
}

/** Un gioco come l'icona di un'app: copertina quadrata arrotondata e nome sotto, fuori dal bordo. */
export function GameIcon({ meta, size: fallback, onPress, selected, dim, caption }: { meta: GameMeta; size: number; onPress: () => void; selected?: boolean; dim?: boolean; caption?: string }) {
  const { colors } = usePalette();
  const size = useContext(GridSize) ?? fallback;
  // Il nome sta su due righe al massimo, con lo spazio sempre riservato: così le righe di icone non si toccano mai.
  const line = Math.round(useTextSize(12) * 1.2);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${meta.name}. ${meta.tagline}`}
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        tap();
        onPress();
      }}
      style={(state) => {
        const st = state as { pressed: boolean; focused?: boolean };
        return [{ width: size, alignItems: 'center', gap: 4, transform: [{ translateY: st.pressed ? 2 : 0 }] }, focusRing(st.focused ?? false)];
      }}
    >
      {/* Scelto: un anello giallo attorno all'icona, che resta sempre uguale. */}
      <View style={{ width: size, height: size, borderRadius: size * 0.27, padding: selected ? 3 : 0, backgroundColor: selected ? colors.accent : 'transparent', opacity: dim ? 0.45 : 1 }}>
        <GameArt id={meta.id} size={selected ? size - 6 : size} />
      </View>
      <T size={12} weight="800" center lines={2} color={dim ? colors.muted : colors.text} style={{ lineHeight: line, minHeight: line * 2 }}>
        {caption ?? meta.name}
      </T>
    </Pressable>
  );
}
