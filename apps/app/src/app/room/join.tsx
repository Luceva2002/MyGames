import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BOT_CHARACTERS, CODE_LENGTH, normalizeCode } from '@giochi/engine';
import { joinRoom, useOnline } from '../../session/online';
import { loadNames, saveNames } from '../../session/names';
import { CharacterAvatar } from '../../ui/avatars';
import { CharacterPickerModal } from '../../ui/CharacterPicker';
import { Button, Panel, Row, Screen, T, tap } from '../../ui/kit';
import { getSettings, setSettings, useSettings } from '../../ui/settings';
import { colors, radius } from '../../ui/theme';

/**
 * Entrare come in Jackbox: il link porta qui col codice già scritto; si conferma il nome (già
 * compilato con quello dell'ultima volta) e la maschera, e si è dentro con un tocco.
 */
export default function JoinRoom() {
  const params = useLocalSearchParams<{ code?: string }>();
  const online = useOnline();
  const settings = useSettings();
  const fromLink = normalizeCode(params.code ?? '').length === CODE_LENGTH;
  const [code, setCode] = useState(normalizeCode(params.code ?? ''));
  const [editCode, setEditCode] = useState(!fromLink);
  const [name, setName] = useState('');
  const [picking, setPicking] = useState(false);
  useEffect(() => {
    loadNames().then((n) => setName((v) => v || n[0] || ''));
  }, []);
  // Chi non ha ancora una maschera ne riceve una a caso, che può cambiare con un tocco.
  useEffect(() => {
    if (!getSettings().avatar) setSettings({ ...getSettings(), avatar: BOT_CHARACTERS[Math.floor(Math.random() * BOT_CHARACTERS.length)].id });
  }, []);

  const trimmed = name.trim();
  const ready = trimmed.length > 0 && code.length === CODE_LENGTH && online.status !== 'connecting';
  const join = async () => {
    if (!ready) return;
    loadNames().then((n) => saveNames([trimmed, ...n.slice(1)]));
    const joined = await joinRoom(code, { name: trimmed, role: 'player' });
    if (joined) router.replace({ pathname: '/room/[code]', params: { code: joined } });
  };

  return (
    <Screen>
      <Button small kind="ghost" color={colors.muted} label="‹ Indietro" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={{ alignSelf: 'flex-start' }} />
      <T size={30} weight="900">
        {fromLink ? 'Ti hanno invitato!' : 'Entra in una stanza'}
      </T>

      <Panel>
        <T size={14} weight="800" color={colors.muted}>
          CODICE STANZA
        </T>
        {editCode ? (
          <TextInput
            value={code}
            onChangeText={(t) => setCode(normalizeCode(t))}
            placeholder="ABCD"
            placeholderTextColor={colors.dim}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus={!fromLink}
            style={[styles.input, styles.code]}
          />
        ) : (
          <Row style={{ justifyContent: 'space-between' }}>
            <T size={44} weight="900" color={colors.accent} style={{ letterSpacing: 10 }}>
              {code}
            </T>
            <Button small kind="ghost" color={colors.muted} label="Cambia" onPress={() => setEditCode(true)} />
          </Row>
        )}
      </Panel>

      <Panel>
        <T size={14} weight="800" color={colors.muted}>
          SEI TU?
        </T>
        <Row gap={14}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cambia la tua maschera"
            onPress={() => {
              tap();
              setPicking(true);
            }}
            style={{ alignItems: 'center', gap: 4 }}
          >
            {settings.avatar && <CharacterAvatar id={settings.avatar} size={72} />}
            <T size={12} weight="800" color={colors.accent}>
              Cambia
            </T>
          </Pressable>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Come ti chiami?"
            placeholderTextColor={colors.dim}
            style={[styles.input, { flex: 1 }]}
            maxLength={16}
            autoFocus={fromLink && !name}
            onSubmitEditing={join}
            accessibilityLabel="Il tuo nome"
          />
        </Row>
      </Panel>

      {online.error && <T color={colors.danger}>⚠ {online.error}</T>}
      <Button label={online.status === 'connecting' ? 'Entro…' : trimmed ? `Sono ${trimmed}, entra!` : 'Scrivi il tuo nome'} disabled={!ready} onPress={join} />

      <CharacterPickerModal visible={picking} title="La tua maschera" value={settings.avatar} onPick={(avatar) => setSettings({ ...getSettings(), avatar })} onClose={() => setPicking(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { backgroundColor: colors.surface2, color: colors.text, borderRadius: radius.s, padding: 14, fontSize: 18, fontWeight: '700' },
  code: { fontSize: 44, fontWeight: '900', letterSpacing: 16, textAlign: 'center' },
});
