import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { CharacterAvatar } from '../ui/avatars';
import { focusRing, RoundButton, Screen, T, tap } from '../ui/kit';
import { colors } from '../ui/theme';

function Choice({ mode, label, children, text }: { mode: 'bots' | 'two' | 'many'; label: string; children: React.ReactNode; text: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${text}`}
      onPress={() => {
        tap();
        router.push({ pathname: '/giochi', params: { mode } });
      }}
      style={(state) => [styles.choice, { transform: [{ translateY: state.pressed ? 4 : 0 }], boxShadow: `0px ${state.pressed ? 3 : 7}px 0px ${colors.line}` }, focusRing((state as { focused?: boolean }).focused ?? false)]}
    >
      {children}
      <T size={21} weight="900" center>
        {label}
      </T>
      <T size={15} weight="800" color={colors.muted} center>
        {text}
      </T>
    </Pressable>
  );
}

function Digits({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>{children}</View>;
}

function Digit({ value, color, size = 54 }: { value: string; color: string; size?: number }) {
  return (
    <T size={size} weight="900" color={color} style={{ lineHeight: 60, textShadowColor: colors.line, textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 0 }}>
      {value}
    </T>
  );
}

/** Offline dal telefono: contro i bot, in due sullo stesso telefono o in tanti che se lo passano. */
export default function Offline() {
  return (
    <Screen style={{ flexGrow: 1 }}>
      <View style={styles.top}>
        <RoundButton icon="back" label="Indietro" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={styles.tag}>
          <T size={14} weight="800" color={colors.onAccent}>
            Offline
          </T>
        </View>
      </View>
      <T size={30} weight="900" center>
        Con chi giochi?
      </T>
      <Choice mode="bots" label="Contro i bot" text="Tu contro le maschere">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <CharacterAvatar id="bobo" size={62} />
          <View style={{ flexDirection: 'row' }}>
            <CharacterAvatar id="trio" size={62} />
            <View style={{ marginLeft: -14 }}>
              <CharacterAvatar id="tic" size={62} />
            </View>
          </View>
        </View>
      </Choice>
      <Choice mode="two" label="2 giocatori, un telefono" text="Stessa scacchiera, o telefono che passa">
        <Digits>
          <Digit value="1" color={colors.accent} />
          <Digit value="vs" color={colors.text} size={26} />
          <Digit value="1" color={colors.accent2} />
        </Digits>
      </Choice>
      <Choice mode="many" label="In tanti, un telefono" text="Il telefono gira, come in Mr. White">
        <Digits>
          <Digit value="2" color={colors.accent3} />
          <Digit value="+" color={colors.accent2} />
        </Digits>
      </Choice>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tag: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.line },
  choice: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 170, padding: 12, borderRadius: 30, borderWidth: 3, borderColor: colors.line, backgroundColor: colors.surface, marginBottom: 7 },
});
