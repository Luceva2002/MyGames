import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { CharacterAvatar } from '../ui/avatars';
import { focusRing, onColor, RoundButton, Screen, T, tap } from '../ui/kit';
import { FIRE, HARD, shellColors as colors } from '../ui/theme';

/** Una scelta come card colorata di Fireship: colore pieno, scritte scure o crema, ombra piena spostata. */
function Choice({ mode, label, children, text, color }: { mode: 'bots' | 'two' | 'many'; label: string; children: React.ReactNode; text: string; color: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${text}`}
      onPress={() => {
        tap();
        router.push({ pathname: '/giochi', params: { mode } });
      }}
      style={(state) => [styles.choice, { backgroundColor: color, transform: [{ translateX: state.pressed ? 4 : 0 }, { translateY: state.pressed ? 4 : 0 }], boxShadow: state.pressed ? 'none' : HARD }, focusRing((state as { focused?: boolean }).focused ?? false)]}
    >
      {children}
      <T size={21} weight="900" center color={onColor(color)}>
        {label}
      </T>
      <T size={15} weight="800" color={onColor(color)} center>
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
    <T size={size} weight="900" color={color} style={{ lineHeight: 60 }}>
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
      <Choice mode="bots" label="Contro i bot" text="Tu contro i mostrini" color={FIRE.sky}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <CharacterAvatar id="zap" size={62} />
          <View style={{ flexDirection: 'row' }}>
            <CharacterAvatar id="gnaf" size={62} />
            <View style={{ marginLeft: -14 }}>
              <CharacterAvatar id="fio" size={62} />
            </View>
          </View>
        </View>
      </Choice>
      <Choice mode="two" label="2 giocatori, un telefono" text="Stessa scacchiera, o telefono che passa" color={FIRE.green}>
        <Digits>
          <Digit value="1" color={colors.onAccent} />
          <Digit value="vs" color={colors.onAccent} size={26} />
          <Digit value="1" color={FIRE.cream} />
        </Digits>
      </Choice>
      <Choice mode="many" label="In tanti, un telefono" text="Il telefono gira, come in Mr. White" color={FIRE.purple}>
        <Digits>
          <Digit value="2" color={FIRE.cream} />
          <Digit value="+" color={FIRE.yellow} />
        </Digits>
      </Choice>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tag: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.accent },
  choice: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 170, padding: 12, borderRadius: 24, marginBottom: 7, marginRight: 6 },
});
