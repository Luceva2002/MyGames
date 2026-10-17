import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CODE_LENGTH, normalizeCode } from '@giochi/engine';
import { joinRoom, useOnline } from '../../session/online';
import { loadNames, saveNames } from '../../session/names';
import { Button, Panel, Screen, T } from '../../ui/kit';
import { colors, radius } from '../../ui/theme';

export default function JoinRoom() {
  const params = useLocalSearchParams<{ code?: string }>();
  const online = useOnline();
  const [code, setCode] = useState(normalizeCode(params.code ?? ''));
  const [name, setName] = useState('');
  useEffect(() => {
    loadNames().then((n) => setName((v) => v || n[0] || ''));
  }, []);

  const join = async () => {
    const trimmed = name.trim();
    if (!trimmed || code.length !== CODE_LENGTH) return;
    loadNames().then((n) => saveNames([trimmed, ...n.slice(1)]));
    const joined = await joinRoom(code, { name: trimmed, role: 'player' });
    if (joined) router.replace({ pathname: '/room/[code]', params: { code: joined } });
  };

  return (
    <Screen>
      <Button small kind="ghost" color={colors.muted} label="‹ Indietro" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={{ alignSelf: 'flex-start' }} />
      <T size={30} weight="900">
        Entra in una stanza
      </T>
      <Panel>
        <T size={14} weight="800" color={colors.muted}>
          CODICE STANZA
        </T>
        <TextInput
          value={code}
          onChangeText={(t) => setCode(normalizeCode(t))}
          placeholder="ABCD"
          placeholderTextColor={colors.dim}
          autoCapitalize="characters"
          autoCorrect={false}
          style={[styles.input, styles.code]}
        />
        <T size={14} weight="800" color={colors.muted}>
          IL TUO NOME
        </T>
        <TextInput value={name} onChangeText={setName} placeholder="Come ti chiami?" placeholderTextColor={colors.dim} style={styles.input} maxLength={16} onSubmitEditing={join} />
      </Panel>
      {online.error && <T color={colors.danger}>{online.error}</T>}
      <Button
        label={online.status === 'connecting' ? 'Entro…' : 'Entra'}
        disabled={online.status === 'connecting' || code.length !== CODE_LENGTH || !name.trim()}
        onPress={join}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { backgroundColor: colors.surface2, color: colors.text, borderRadius: radius.s, padding: 14, fontSize: 18, fontWeight: '700' },
  code: { fontSize: 44, fontWeight: '900', letterSpacing: 16, textAlign: 'center' },
});
