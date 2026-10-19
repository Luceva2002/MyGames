import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { GAME_ART } from '../../ui/art';
import { getSettings, setSettings } from '../../ui/settings';
import { router, useLocalSearchParams } from 'expo-router';
import { assignAvatars, BOT_CHARACTERS, botByName, catalog, pickBots, playerCounts } from '@giochi/engine';
import { BotAvatar, CharacterAvatar } from '../../ui/avatars';
import { CharacterPickerModal } from '../../ui/CharacterPicker';
import { canPassAndPlay, setPendingMatch, type SeatConfig } from '../../session/local';
import { quickRoom, useOnline } from '../../session/online';
import { defaultName, loadNames, saveNames } from '../../session/names';
import { Button, Panel, Row, Screen, SeatDot, T, tap } from '../../ui/kit';
import { colors, radius } from '../../ui/theme';

export default function GameDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = catalog().find((e) => e.meta.id === id);
  const meta = entry?.meta;
  const [count, setCount] = useState(meta ? Math.max(meta.minPlayers, Math.min(meta.humansOnly ? 4 : 2, meta.maxPlayers)) : 2);
  const [seats, setSeats] = useState<SeatConfig[]>([]);
  // Una maschera diversa per ogni posto, scelta a caso e cambiabile con un tocco.
  const [masks, setMasks] = useState(() => pickBots(10, Math.random, [getSettings().avatar]).map((b) => b.name));
  const [picking, setPicking] = useState<number | null>(null);
  const online = useOnline();
  const { width } = useWindowDimensions();

  useEffect(() => {
    loadNames().then((saved) => {
      // Di partenza: tu contro il computer; si aggiungono persone o computer con un tocco.
      setSeats(Array.from({ length: 10 }, (_, i) => ({ name: saved[i] ?? (i === 0 ? 'Io' : defaultName(i)), bot: i > 0 && !meta?.humansOnly })));
    });
  }, [meta]);

  if (!entry || !meta) {
    return (
      <Screen>
        <T>Gioco non trovato.</T>
        <Button label="Torna ai giochi" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  const ready = entry.status === 'ready';
  const active = seats.slice(0, count);
  // Ogni posto ha la sua maschera: i computer la loro, le persone quella scelta (il primo posto
  // parte da quella del profilo) o una libera assegnata in automatico.
  const avatars = assignAvatars(active.map((s, i) => (s.bot ? { name: masks[i], bot: true } : { ...s, avatar: s.avatar ?? (i === 0 ? getSettings().avatar : undefined) })));
  const counts = playerCounts(meta);

  const canAdd = counts.includes(count + 1);
  const canRemove = counts.includes(count - 1);
  // Aggiungere o togliere un posto cambia da solo il numero di giocatori.
  const addSeat = (bot: boolean) => {
    tap();
    if (!canAdd) return;
    update(count, { bot });
    setCount(count + 1);
  };
  const removeSeat = (i: number) => {
    setSeats((s) => [...s.slice(0, i), ...s.slice(i + 1), { name: defaultName(9), bot: false }]);
    setMasks((m) => [...m.slice(0, i), ...m.slice(i + 1), m[i]]);
    setCount(count - 1);
  };

  const update = (i: number, patch: Partial<SeatConfig>) => setSeats((s) => s.map((seat, j) => (j === i ? { ...seat, ...patch } : seat)));

  const startLocal = () => {
    const named = active.map((s, i) => ({ ...s, name: s.bot ? masks[i] : s.name.trim() || defaultName(i), avatar: s.bot ? undefined : avatars[i] }));
    saveNames(seats.map((s) => s.name));
    setPendingMatch({ gameId: meta.id, seats: named });
    router.push({ pathname: '/play/[id]', params: { id: meta.id } });
  };

  return (
    <Screen>
      <Button small kind="ghost" color={colors.muted} label="‹ Giochi" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={{ alignSelf: 'flex-start' }} />
      <View style={styles.hero}>
        {GAME_ART[meta.id] && <Image source={GAME_ART[meta.id]} style={styles.heroArt} accessibilityIgnoresInvertColors />}
        <View style={{ flex: 1, gap: 6, minWidth: 220 }}>
          <T size={34} weight="900" color="#fff">
            {meta.name}
          </T>
          <T size={17} color="#fff" weight="700">
            {meta.tagline}
          </T>
          <Row gap={8} wrap>
            <View style={styles.badge}>
              <T size={14} weight="800" color="#fff">
                👤 {counts.length === meta.maxPlayers - meta.minPlayers + 1 && counts.length > 1 ? `${meta.minPlayers}–${meta.maxPlayers}` : counts.join(' o ')}
              </T>
            </View>
            <View style={styles.badge}>
              <T size={14} weight="800" color="#fff">
                ⏱ {meta.minutes} min
              </T>
            </View>
            {meta.hiddenInfo && (
              <View style={styles.badge}>
                <T size={14} weight="800" color="#fff">
                  🤫 carte o ruoli segreti
                </T>
              </View>
            )}
          </Row>
        </View>
      </View>

      {entry.note && (
        <Panel>
          <T color={colors.muted}>{entry.note}</T>
        </Panel>
      )}

      <Panel>
        <T size={18} weight="900">
          Come si gioca
        </T>
        {meta.rules.map((r, i) => (
          <Row key={i} gap={10} style={{ alignItems: 'flex-start' }}>
            <T color={colors.accent2} weight="900">
              •
            </T>
            <T color={colors.text} style={{ flex: 1, lineHeight: 22 }}>
              {r}
            </T>
          </Row>
        ))}
      </Panel>

      {ready && (
        <Panel>
          <T size={18} weight="900">
            Chi gioca
          </T>
          <T size={14} color={colors.muted}>
            {counts.length > 1 ? `Da ${counts[0]} a ${counts[counts.length - 1]} giocatori. ` : ''}Tocca un'icona per cambiare personaggio.
          </T>
          <View style={styles.seatGrid}>
            {active.map((seat, i) => (
              <View key={i} style={[styles.seatCard, seat.bot && { backgroundColor: colors.surface }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Cambia il personaggio di ${seat.bot ? masks[i] : seat.name || defaultName(i)}`}
                  onPress={() => {
                    tap();
                    setPicking(i);
                  }}
                >
                  <CharacterAvatar id={avatars[i]} size={72} seat={i} />
                </Pressable>
                {seat.bot ? (
                  <View style={{ alignItems: 'center' }}>
                    <T weight="900" size={16} center lines={1}>
                      {masks[i]}
                    </T>
                    <T size={12} color={colors.muted} center lines={1}>
                      🤖 computer {botByName(masks[i])?.level}
                    </T>
                  </View>
                ) : (
                  <TextInput
                    value={seat.name}
                    onChangeText={(name) => update(i, { name })}
                    placeholder={defaultName(i)}
                    placeholderTextColor={colors.dim}
                    style={styles.input}
                    maxLength={16}
                    accessibilityLabel={`Nome del giocatore ${i + 1}`}
                  />
                )}
                {i > 0 && canRemove && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Togli ${seat.bot ? masks[i] : seat.name || defaultName(i)}`}
                    onPress={() => {
                      tap();
                      removeSeat(i);
                    }}
                    style={styles.remove}
                  >
                    <T size={14} weight="900" color={colors.onAccent}>
                      ✕
                    </T>
                  </Pressable>
                )}
              </View>
            ))}
            {canAdd && (
              <View style={{ gap: 8, justifyContent: 'center', width: '47%', maxWidth: 170, flexGrow: 1 }}>
                {canPassAndPlay(meta) && <Pressable accessibilityRole="button" onPress={() => addSeat(false)} style={styles.addTile}>
                  <T size={22} weight="900" color={colors.accent}>+</T>
                  <T size={14} weight="800">Persona</T>
                </Pressable>}
                {!meta.humansOnly && <Pressable accessibilityRole="button" onPress={() => addSeat(true)} style={styles.addTile}>
                  <T size={22} weight="900" color={colors.accent3}>+</T>
                  <T size={14} weight="800">Computer</T>
                </Pressable>}
              </View>
            )}
          </View>
          {!canPassAndPlay(meta) && meta.maxPlayers >= 2 && (
            <T size={13} color={colors.muted}>
              Qui ognuno ha carte o ruoli segreti: su questo dispositivo giochi contro il computer. Per giocare tra persone usa «Gioca con amici»: ognuno entra col suo telefono, anche solo dal browser.
            </T>
          )}
        </Panel>
      )}

      {ready && (
        <View style={{ gap: 12 }}>
          <Button label="Gioca su questo dispositivo" icon="▶" onPress={startLocal} />
          <Button
            label={online.status === 'connecting' ? 'Creo la stanza…' : 'Gioca con amici'}
            icon="📱"
            kind="ghost"
            color={colors.text}
            onPress={async () => {
              const code = await quickRoom(meta.id, width > 760);
              if (code) router.push({ pathname: '/room/[code]', params: { code } });
            }}
          />
          {online.error && (
            <T size={13} color={colors.danger} center>
              ⚠ {online.error}
            </T>
          )}
        </View>
      )}
      <CharacterPickerModal
        visible={picking !== null}
        title={picking === null ? '' : active[picking]?.bot ? 'Maschera del computer' : `Personaggio di ${active[picking]?.name.trim() || defaultName(picking)}`}
        value={picking === null ? null : avatars[picking]}
        taken={avatars.filter((_, j) => j !== picking)}
        onPick={(avatar) => {
          if (picking === null) return;
          if (active[picking]?.bot) {
            const name = BOT_CHARACTERS.find((b) => b.id === avatar)?.name;
            if (name) setMasks((m) => m.map((x, j) => (j === picking ? name : x)));
            return;
          }
          update(picking, { avatar });
          if (picking === 0) setSettings({ ...getSettings(), avatar });
        }}
        onClose={() => setPicking(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.l, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap', backgroundColor: colors.brand, borderWidth: 3, borderColor: colors.line, boxShadow: `0px 6px 0px ${colors.line}`, marginBottom: 6 },
  heroArt: { width: 140, height: 140, borderRadius: radius.m, borderWidth: 3, borderColor: colors.line },
  badge: { backgroundColor: '#0007', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  count: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  seatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  seatCard: { width: '47%', maxWidth: 170, flexGrow: 1, alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.m, backgroundColor: colors.surface2, borderWidth: 3, borderColor: colors.line },
  remove: { position: 'absolute', top: -8, right: -8, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accent2, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  addTile: { alignSelf: 'stretch', minHeight: 64, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: radius.m, borderWidth: 3, borderStyle: 'dashed', borderColor: colors.dim },
  input: { alignSelf: 'stretch', textAlign: 'center', minHeight: 44, backgroundColor: colors.surface2, color: colors.text, borderRadius: radius.s, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, fontWeight: '600' },
  toggle: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.s, borderWidth: 1.5, borderColor: colors.line },
});
