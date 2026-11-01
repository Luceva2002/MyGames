import type { ReactNode } from 'react';
import { Image, Pressable, useWindowDimensions, View } from 'react-native';
import type { GameMeta } from '@giochi/engine';
import { GAME_ART } from './art';
import { focusRing, T, tap } from './kit';
import { colors, OUTLINE, radius } from './theme';

const GAP = 10;

/** Griglia di icone: quattro per riga sul telefono, di più sugli schermi larghi. */
export function useIconSize() {
  const { width } = useWindowDimensions();
  const inner = Math.min(width, 1100) - 32;
  const columns = inner > 900 ? 8 : inner > 640 ? 6 : 4;
  return Math.floor((inner - (columns - 1) * GAP) / columns);
}

export function GameGrid({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>{children}</View>;
}

/** Un gioco come l'icona di un'app: copertina quadrata arrotondata e nome sotto, fuori dal bordo. */
export function GameIcon({ meta, size, onPress, selected, dim, caption }: { meta: GameMeta; size: number; onPress: () => void; selected?: boolean; dim?: boolean; caption?: string }) {
  const art = GAME_ART[meta.id];
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
      <View style={{ width: size, height: size, borderRadius: radius.m, borderWidth: OUTLINE, borderColor: selected ? colors.accent : colors.line, overflow: 'hidden', backgroundColor: meta.color, opacity: dim ? 0.45 : 1 }}>
        {art ? <Image source={art} style={{ width: '100%', height: '100%' }} accessibilityIgnoresInvertColors /> : null}
      </View>
      <T size={12} weight="800" center color={dim ? colors.muted : colors.text} style={{ lineHeight: 14 }}>
        {caption ?? meta.name}
      </T>
    </Pressable>
  );
}
