import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { createRoom, useOnline } from '../../session/online';
import { loadNames, saveNames } from '../../session/names';
import { Button, Panel, Screen, T, tap } from '../../ui/kit';
import { colors, radius } from '../../ui/theme';

export default function HostRoom() {
  const { game } = useLocalSearchParams<{ game?: string }>();
  const online = useOnline();
  const [role, setRole] = useState<'screen' | 'player'>('screen');
  const [name, setName] = useState('');
  useEffect(() => {
    loadNames().then((n) => setName(n[0] ?? ''));
  }, []);

  const create = async () => {
    const trimmed = name.trim() || 'Io';
    if (role === 'player') loadNames().then((n) => saveNames([trimmed, ...n.slice(1)]));
    const code = await createRoom({ name: role === 'screen' ? 'Schermo' : trimmed, role, gameId: game });
    if (code) router.replace({ pathname: '/room/[code]', params: { code } });
  };

  return (
    <Screen>
      <Button small kind="ghost" color={colors.muted} label="‹ Indietro" onPress={() => router.back()} style={{ alignSelf: 'flex-start' }} />
      <T size={30} weight="900">
        Crea una stanza
      </T>
      <T color={colors.muted}>Gli altri entrano dal telefono con un codice di 4 lettere. Le carte di ognuno restano sul suo telefono.</T>

      <Panel>
        <T size={18} weight="900">
          Cosa fa questo dispositivo?
        </T>
        {(
          [
            ['screen', '📺', 'È il tavolo', 'TV, computer o tablet al centro: mostra la partita a tutti, senza carte segrete.'],
            ['player', '🙋', 'Gioco anche io', 'Questo dispositivo è il tuo controller, come quello degli altri.'],
          ] as const
        ).map(([id, icon, title, desc]) => (
          <Pressable
            key={id}
            onPress={() => {
              tap();
              setRole(id);
            }}
            style={[styles.option, role === id && { borderColor: colors.accent, backgroundColor: colors.surface2 }]}
          >
            <T size={28}>{icon}</T>
            <View style={{ flex: 1 }}>
              <T size={17} weight="800">
                {title}
              </T>
              <T size={13} color={colors.muted}>
                {desc}
              </T>
            </View>
          </Pressable>
        ))}
        {role === 'player' && (
          <TextInput value={name} onChangeText={setName} placeholder="Il tuo nome" placeholderTextColor={colors.dim} style={styles.input} maxLength={16} />
        )}
      </Panel>
      {online.error && <T color={colors.danger}>{online.error}</T>}
      <Button label={online.status === 'connecting' ? 'Creo la stanza…' : 'Crea la stanza'} disabled={online.status === 'connecting'} onPress={create} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', gap: 14, alignItems: 'center', padding: 14, borderRadius: radius.m, borderWidth: 2, borderColor: colors.line },
  input: { backgroundColor: colors.surface2, color: colors.text, borderRadius: radius.s, padding: 14, fontSize: 18, fontWeight: '700' },
});
