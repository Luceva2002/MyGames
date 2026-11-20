import { Pressable, View } from 'react-native';
import { BOT_LEVELS, type BotLevel } from '@giochi/engine';
import { T, tap } from './kit';
import { getSettings, setSettings, useSettings } from './settings';
import { shellColors as colors } from './theme';

/**
 * Bravura del computer in tre tocchi. Senza `value` vale per le partite su questo dispositivo e
 * resta per le seguenti; con `value`/`onChange` comanda un computer solo (nella stanza).
 */
export function LevelPicker({ value, onChange }: { value?: BotLevel; onChange?: (l: BotLevel) => void } = {}) {
  const saved = useSettings().botLevel;
  const level = value ?? saved;
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Bravura del computer" style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
      {BOT_LEVELS.map((l) => {
        const on = level === l.id;
        return (
          <Pressable
            key={l.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`Computer ${l.label}`}
            onPress={() => {
              tap();
              if (onChange) onChange(l.id);
              else setSettings({ ...getSettings(), botLevel: l.id });
            }}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 999, borderWidth: 2.5, borderColor: on ? colors.line : colors.dim, backgroundColor: on ? colors.accent3 : 'transparent' }}
          >
            <T size={13} weight="900" color={on ? colors.onAccent : colors.text}>
              {l.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}
