import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { GAME_ART } from '../../ui/art';
import { router, useLocalSearchParams } from 'expo-router';
import { BOT_CHARACTERS, botByName, catalog, pickBots, playerCounts } from '@giochi/engine';
import { BotAvatar } from '../../ui/avatars';
import { setPendingMatch, type SeatConfig } from '../../session/local';
import { defaultName, loadNames, saveNames } from '../../session/names';
import { Button, Panel, Row, Screen, SeatDot, T, tap } from '../../ui/kit';
import { colors, radius } from '../../ui/theme';

export default function GameDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = catalog().find((e) => e.meta.id === id);
  const meta = entry?.meta;
  const [count, setCount] = useState(meta ? Math.max(meta.minPlayers, Math.min(2, meta.maxPlayers)) : 2);
  const [seats, setSeats] = useState<SeatConfig[]>([]);
  // Una maschera diversa per ogni posto, scelta a caso e cambiabile con un tocco.
  const [masks, setMasks] = useState(() => pickBots(10).map((b) => b.name));

  useEffect(() => {
    loadNames().then((saved) => {
      setSeats(Array.from({ length: 10 }, (_, i) => ({ name: saved[i] ?? (i === 0 ? 'Io' : defaultName(i)), bot: false })));
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
  const counts = playerCounts(meta);

  const update = (i: number, patch: Partial<SeatConfig>) => setSeats((s) => s.map((seat, j) => (j === i ? { ...seat, ...patch } : seat)));

  const startLocal = () => {
    const named = active.map((s, i) => ({ ...s, name: s.bot ? masks[i] : s.name.trim() || defaultName(i) }));
    saveNames(seats.map((s) => s.name));
    setPendingMatch({ gameId: meta.id, seats: named });
    router.push({ pathname: '/play/[id]', params: { id: meta.id } });
  };

  return (
    <Screen>
      <Button small kind="ghost" color={colors.muted} label="‹ Giochi" onPress={() => router.back()} style={{ alignSelf: 'flex-start' }} />
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
          {counts.length > 1 && (
            <Row gap={8} wrap>
              {counts.map((n) => (
                <Pressable
                  key={n}
                  onPress={() => {
                    tap();
                    setCount(n);
                  }}
                  style={[styles.count, count === n && { backgroundColor: colors.accent, borderColor: colors.line }]}
                >
                  <T size={18} weight="900" color={count === n ? colors.onAccent : colors.text}>
                    {n}
                  </T>
                </Pressable>
              ))}
            </Row>
          )}
          {active.map((seat, i) => (
            <Row key={i} gap={10}>
              <SeatDot seat={i} size={14} />
              {seat.bot ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${masks[i]}, computer. Tocca per cambiare maschera`}
                  onPress={() => {
                    tap();
                    // Passa alla prossima maschera non già seduta al tavolo.
                    const used = new Set(masks.filter((_, j) => j !== i && active[j]?.bot));
                    const all = BOT_CHARACTERS.map((b) => b.name);
                    let k = all.indexOf(masks[i]);
                    for (let n = 0; n < all.length; n++) {
                      k = (k + 1) % all.length;
                      if (!used.has(all[k])) break;
                    }
                    setMasks((m) => m.map((x, j) => (j === i ? all[k] : x)));
                  }}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 }}
                >
                  <BotAvatar name={masks[i]} size={56} seat={i} />
                  <View style={{ flex: 1 }}>
                    <T weight="900" size={17}>
                      {masks[i]}
                    </T>
                    <T size={13} color={colors.muted}>
                      {botByName(masks[i])?.trait} · tocca per cambiare
                    </T>
                  </View>
                </Pressable>
              ) : (
                <TextInput
                  value={seat.name}
                  onChangeText={(name) => update(i, { name })}
                  placeholder={defaultName(i)}
                  placeholderTextColor={colors.dim}
                  style={styles.input}
                  maxLength={16}
                />
              )}
              {i > 0 && (
                <Pressable
                  onPress={() => {
                    tap();
                    update(i, { bot: !seat.bot });
                  }}
                  style={[styles.toggle, seat.bot && { backgroundColor: colors.surface2 }]}
                >
                  <T size={13} weight="800" color={colors.muted}>
                    {seat.bot ? 'Metti persona' : 'Metti computer'}
                  </T>
                </Pressable>
              )}
            </Row>
          ))}
          {meta.hiddenInfo && active.filter((s) => !s.bot).length > 1 && (
            <T size={13} color={colors.muted}>
              Sullo stesso telefono vi passerete il dispositivo a ogni turno, così nessuno vede le carte degli altri. Con la stanza invece ognuno usa il suo telefono.
            </T>
          )}
        </Panel>
      )}

      {ready && (
        <View style={{ gap: 12 }}>
          <Button label="Gioca su questo dispositivo" icon="▶" onPress={startLocal} />
          <Button
            label="Gioca coi telefoni (stanza)"
            icon="📱"
            kind="ghost"
            color={colors.text}
            onPress={() => router.push({ pathname: '/room/host', params: { game: meta.id } })}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.l, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap', backgroundColor: colors.brand, borderWidth: 3, borderColor: colors.line, boxShadow: `0px 6px 0px ${colors.line}`, marginBottom: 6 },
  heroArt: { width: 140, height: 140, borderRadius: radius.m, borderWidth: 3, borderColor: colors.line },
  badge: { backgroundColor: '#0007', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  count: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 48, backgroundColor: colors.surface2, color: colors.text, borderRadius: radius.s, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, fontWeight: '600' },
  toggle: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.s, borderWidth: 1.5, borderColor: colors.line },
});
