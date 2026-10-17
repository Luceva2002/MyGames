import { router } from 'expo-router';
import { Switch, View } from 'react-native';
import { CharacterPicker } from '../ui/CharacterPicker';
import { Button, Chip, Panel, Row, Screen, T } from '../ui/kit';
import { setSettings, useReducedMotion, useSettings, type Settings } from '../ui/settings';
import { colors } from '../ui/theme';

/** Impostazioni di accessibilità (V-A11Y-1). Valgono per l'app e per ogni gioco. */
export default function SettingsScreen() {
  const s = useSettings();
  const reduced = useReducedMotion();
  const patch = (p: Partial<Settings>) => setSettings({ ...s, ...p });

  const toggle = (label: string, hint: string, value: boolean, onChange: (v: boolean) => void) => (
    <Row gap={12} style={{ minHeight: 56 }}>
      <View style={{ flex: 1 }}>
        <T weight="800">{label}</T>
        <T size={14} color={colors.muted}>
          {hint}
        </T>
      </View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.line }} thumbColor="#fff" />
    </Row>
  );

  return (
    <Screen>
      <Button small kind="ghost" color={colors.muted} label="‹ Giochi" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={{ alignSelf: 'flex-start' }} />
      <T size={30} weight="900">
        Impostazioni
      </T>

      <Panel>
        <T size={18} weight="900">
          Il tuo personaggio
        </T>
        <T size={14} color={colors.muted}>
          Scegli la tua maschera: ti rappresenta al tavolo e nei punteggi, in ogni partita.
        </T>
        <CharacterPicker value={s.avatar} onChange={(avatar) => patch({ avatar })} />
      </Panel>

      <Panel>
        <T size={18} weight="900">
          Dimensione del testo
        </T>
        <Row gap={8} wrap>
          {(['Normale', 'Grande', 'Molto grande'] as const).map((label, i) => (
            <Chip key={label} label={label} active={s.textSize === i} onPress={() => patch({ textSize: i as Settings['textSize'] })} />
          ))}
        </Row>
        <T color={colors.muted}>Anteprima: così si leggono regole e messaggi.</T>
      </Panel>

      <Panel>
        <T size={18} weight="900">
          Vista e movimento
        </T>
        {toggle('Movimento ridotto', s.reduceMotion === null ? `Segue il sistema (ora ${reduced ? 'attivo' : 'spento'})` : 'Animazioni brevi, niente oscillazioni', reduced, (v) => patch({ reduceMotion: v }))}
        {toggle('Contrasto alto', 'Bordi più marcati su pulsanti e pannelli', s.highContrast, (v) => patch({ highContrast: v }))}
        <T size={14} color={colors.muted}>
          I giocatori hanno sempre colore, simbolo (● ▲ ■ ◆ ★) e nome, così si distinguono anche senza vedere i colori.
        </T>
      </Panel>

      <Panel>
        <T size={18} weight="900">
          Tatto e suoni
        </T>
        {toggle('Vibrazione', 'Un piccolo tocco quando premi un pulsante', s.haptics, (v) => patch({ haptics: v }))}
        {toggle('Suoni', 'Carte che scivolano, prese, scope e vittorie', s.sound, (v) => patch({ sound: v }))}
      </Panel>

      {s.reduceMotion !== null && <Button kind="ghost" color={colors.muted} small label="Movimento: torna a seguire il sistema" onPress={() => patch({ reduceMotion: null })} />}
    </Screen>
  );
}
