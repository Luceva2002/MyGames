import { Pressable, View } from 'react-native';
import { BOT_LEVELS } from '@giochi/engine';
import { T, tap } from './kit';
import { getSettings, setSettings, useSettings } from './settings';
import { colors } from './theme';

/** Bravura del computer in tre tocchi; la scelta resta per le partite seguenti. */
export function LevelPicker() {
  const level = useSettings().botLevel;
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Bravura del computer" style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
      <T size={12} weight="800" color={colors.muted}>
        🤖
      </T>
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
              setSettings({ ...getSettings(), botLevel: l.id });
            }}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 999, borderWidth: 2.5, borderColor: on ? colors.line : '#FFFFFF33', backgroundColor: on ? colors.accent3 : 'transparent' }}
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
