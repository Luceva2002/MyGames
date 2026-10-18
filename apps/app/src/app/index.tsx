import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { assignAvatars, catalog, playerCounts, type Category, type CatalogEntry } from '@giochi/engine';
import { createRoom, joinUrl, useOnline } from '../session/online';
import { CharacterAvatar } from '../ui/avatars';
import { QrCode } from '../ui/QrCode';
import { GAME_ART, HERO } from '../ui/art';
import { Chip, focusRing, Row, Screen, T, tap } from '../ui/kit';
import { CATEGORY_COLORS, colors, MIN_TOUCH, radius } from '../ui/theme';

const CATEGORIES: { id: Category | 'all'; label: string }[] = [
  { id: 'all', label: 'Tutti' },
  { id: 'carte', label: '🂡 Carte' },
  { id: 'tavolo', label: '♟ Tavolo' },
  { id: 'dadi', label: '🎲 Dadi' },
  { id: 'abilita', label: '🎯 Abilità' },
  { id: 'party', label: '🎉 Party' },
];

const PLAYER_FILTERS = [1, 2, 3, 4, 5];
const CATEGORY_LABEL: Record<Category, string> = { carte: 'carte', tavolo: 'tavolo', dadi: 'dadi', abilita: 'abilità', party: 'party' };

function playersLabel(e: CatalogEntry) {
  const counts = playerCounts(e.meta);
  const { minPlayers: a, maxPlayers: b } = e.meta;
  if (counts.length < b - a + 1) return counts.join(' o ');
  return a === b ? `${a}` : b >= 10 ? `${a}+` : `${a}–${b}`;
}

function GameTile({ entry, width }: { entry: CatalogEntry; width: number }) {
  const external = entry.status === 'external';
  const art = GAME_ART[entry.meta.id];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.meta.name}. ${entry.meta.tagline}. ${playersLabel(entry)} giocatori`}
      onPress={() => {
        tap();
        router.push({ pathname: '/game/[id]', params: { id: entry.meta.id } });
      }}
      style={(state) => {
        const st = state as { pressed: boolean; hovered?: boolean; focused?: boolean };
        // Su con il mouse o il telecomando: sale di 4 px e ruota appena (spec §3); premuta scende.
        const up = (st.hovered || st.focused) && !st.pressed;
        return [
          styles.tile,
          { width, transform: [{ translateY: st.pressed ? 4 : up ? -4 : 0 }, { rotate: up ? '-1deg' : '0deg' }], boxShadow: `0px ${st.pressed ? 2 : 6}px 0px ${colors.line}` },
          focusRing(st.focused ?? false),
        ];
      }}
    >
      <View style={{ width, height: width, backgroundColor: entry.meta.color }}>
        {art ? <Image source={art} style={{ width, height: width }} accessibilityIgnoresInvertColors /> : null}
        {external && (
          <View style={styles.ribbon}>
            <T size={11} weight="900" color={colors.onAccent}>
              APP A PARTE
            </T>
          </View>
        )}
        <View style={styles.players}>
          <T size={12} weight="900" color="#fff">
            👤 {playersLabel(entry)}
          </T>
        </View>
      </View>
      <View style={{ padding: 10, gap: 2 }}>
        <T size={17} weight="900" lines={1}>
          {entry.meta.name}
        </T>
        <T size={13} weight="800" color={colors.accent}>
          {playersLabel(entry)} · {CATEGORY_LABEL[entry.meta.category]}
        </T>
        <T size={13} color={colors.muted} lines={2} style={{ minHeight: 34 }}>
          {entry.meta.tagline}
        </T>
      </View>
    </Pressable>
  );
}

function BigAction({ icon, title, text, primary, onPress }: { icon: string; title: string; text: string; primary?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${text}`}
      onPress={() => {
        tap();
        onPress();
      }}
      style={(state) => [
        styles.bigAction,
        { backgroundColor: primary ? colors.accent : '#FFFFFF', transform: [{ translateY: state.pressed ? 4 : 0 }], boxShadow: `0px ${state.pressed ? 2 : 6}px 0px ${colors.line}` },
        focusRing((state as { focused?: boolean }).focused ?? false),
      ]}
    >
      <T size={30}>{icon}</T>
      <View style={{ flex: 1 }}>
        <T size={20} weight="900" color={colors.onAccent}>
          {title}
        </T>
        <T size={14} weight="800" color={colors.onAccent}>
          {text}
        </T>
      </View>
    </Pressable>
  );
}

export default function Home() {
  const { width } = useWindowDimensions();
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [players, setPlayers] = useState<number | null>(null);
  const online = useOnline();
  const contentWidth = Math.min(width, 1100) - 32;
  const columns = contentWidth > 900 ? 5 : contentWidth > 640 ? 4 : contentWidth > 420 ? 3 : 2;
  // L'hero tiene le proporzioni dell'illustrazione (1600×720), così si vedono tutte e 4 le maschere.
  const heroHeight = Math.min(420, Math.max(200, Math.round((contentWidth * 720) / 1600)));
  const wide = contentWidth > 640;
  const heroH = wide ? heroHeight : 230;
  const tileWidth = Math.floor((contentWidth - (columns - 1) * 12) / columns);

  const entries = useMemo(
    () =>
      catalog().filter(
        (e) =>
          (category === 'all' || e.meta.category === category) &&
          (players === null || (players >= 5 ? e.meta.maxPlayers >= 5 : playerCounts(e.meta).includes(players))),
      ),
    [category, players],
  );

  return (
    <Screen>
      <View style={[styles.hero, { height: heroH }]}>
        {/* Sul telefono l'illustrazione si appoggia a destra (dove stanno le maschere) e il titolo ha una fascia scura sotto. */}
        <Image source={HERO} style={wide ? { position: 'absolute', left: 0, top: 0, width: contentWidth, height: heroH - 6 } : { position: 'absolute', right: -heroH * 0.2, top: 0, width: heroH * 2.22, height: heroH - 6 }} resizeMode="cover" accessibilityIgnoresInvertColors />
        {!wide && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: heroH * 0.4, backgroundColor: '#12052BC0' }} />}
        {/* La metà sinistra dell'illustrazione è vuota apposta per il titolo, che resta leggibile (V-CON-2). */}
        <View style={[styles.heroScrim, { padding: wide ? 24 : 16 }]}>
          <Row style={{ flex: 1, justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {/* Desktop: titolo in alto e lobby in basso, allineati a sinistra; telefono: titolo in basso. */}
            <View style={{ flex: 1, maxWidth: wide ? '50%' : '100%', height: '100%', justifyContent: wide ? 'space-between' : 'flex-end', gap: 4 }}>
              <View style={{ gap: 4 }}>
              <T size={wide ? 52 : 34} weight="900" color={colors.accent} style={styles.wordmark}>
                Tavolata
              </T>
              <T size={wide ? 16 : 13} weight="800" color={colors.text}>
                La TV è il tavolo, il telefono è il tuo controller.
              </T>
              </View>
              {wide && <HomeLobby size={Math.round(Math.min(150, heroHeight * 0.38))} />}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Impostazioni"
              onPress={() => {
                tap();
                router.push('/settings');
              }}
              style={(state) => [styles.gear, focusRing((state as { focused?: boolean }).focused ?? false)]}
            >
              <T size={22}>⚙️</T>
            </Pressable>
          </Row>
        </View>
      </View>

      <Row gap={12} wrap>
        <BigAction
          primary
          icon="📺"
          title="Crea una stanza"
          text="Questo schermo fa da tavolo"
          onPress={() => (online.snapshot ? router.push({ pathname: '/room/[code]', params: { code: online.snapshot.code } }) : router.push('/room/host'))}
        />
        <BigAction icon="📱" title="Entra con un codice" text="Il telefono diventa il controller" onPress={() => router.push('/room/join')} />
      </Row>

      <View style={{ gap: 10 }}>
        <T size={14} weight="800" color={colors.muted}>
          QUANTI SIETE?
        </T>
        <Row gap={10}>
          {PLAYER_FILTERS.map((n) => {
            const active = players === n;
            return (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${n === 5 ? '5 o più' : n} giocatori`}
                onPress={() => {
                  tap();
                  setPlayers(active ? null : n);
                }}
                style={(state) => [styles.countButton, active && { backgroundColor: colors.accent, borderColor: colors.accent }, focusRing((state as { focused?: boolean }).focused ?? false)]}
              >
                <T size={24} weight="900" color={active ? colors.onAccent : colors.text}>
                  {n === 5 ? '5+' : n}
                </T>
                <T size={12} weight="700" color={active ? colors.onAccent : colors.dim}>
                  {'👤'.repeat(Math.min(n, 4))}
                </T>
              </Pressable>
            );
          })}
        </Row>
      </View>

      <Row gap={8} wrap>
        {CATEGORIES.map((c) => (
          <Chip key={c.id} label={c.label} active={category === c.id} color={c.id === 'all' ? colors.accent : CATEGORY_COLORS[c.id]} onPress={() => setCategory(c.id)} />
        ))}
      </Row>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {entries.map((e) => (
          <GameTile key={e.meta.id} entry={e} width={tileWidth} />
        ))}
        {entries.length === 0 && <T color={colors.muted}>Nessun gioco con questi filtri.</T>}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.l, overflow: 'hidden', borderWidth: 3, borderColor: colors.line, backgroundColor: colors.brand },
  heroScrim: { flex: 1, padding: 20, justifyContent: 'flex-start' },
  lobby: { flexDirection: 'row', alignItems: 'center', gap: 14, alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 18, backgroundColor: '#12052BCC' },
  lobbyOff: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#12052BB3' },
  wordmark: { textShadowColor: colors.line, textShadowOffset: { width: 0, height: 5 }, textShadowRadius: 0 },
  gear: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center' },
  tile: { backgroundColor: colors.surface, borderRadius: radius.l, overflow: 'hidden', borderWidth: 3, borderColor: colors.line, marginBottom: 6 },
  ribbon: { position: 'absolute', top: 10, right: 10, backgroundColor: colors.accent, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  players: { position: 'absolute', bottom: 8, left: 8, backgroundColor: colors.scrim, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  bigAction: { flexGrow: 1, flexBasis: 300, minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: radius.l, borderWidth: 3, borderColor: colors.line, boxShadow: `0px 6px 0px ${colors.line}`, marginBottom: 6 },
  countButton: { flex: 1, maxWidth: 90, minHeight: 64, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: radius.m, borderWidth: 3, borderColor: colors.line, backgroundColor: colors.surface, boxShadow: `0px 4px 0px ${colors.line}` },
});

/**
 * Lobby nella copertina: sugli schermi grandi la home apre da sola una stanza (questo schermo fa
 * da tavolo) e mostra QR, codice e chi è già entrato. I telefoni inquadrano e sono dentro.
 */
function HomeLobby({ size }: { size: number }) {
  const online = useOnline();
  const snap = online.snapshot;
  useEffect(() => {
    if (online.room || online.status === 'connecting') return;
    createRoom({ name: 'Schermo', role: 'screen' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!snap) {
    return online.error ? (
      <View style={styles.lobbyOff}>
        <T size={13} color={colors.muted}>
          📡 Stanze online non disponibili adesso
        </T>
      </View>
    ) : null;
  }
  const players = snap.members.filter((m) => m.role === 'player');
  const url = joinUrl(snap.code);
  const avatars = assignAvatars(players.map((m) => ({ name: m.name, bot: false, avatar: m.avatar })));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Stanza ${snap.code}, ${players.length} giocatori dentro. Apri il tavolo`}
      onPress={() => {
        tap();
        router.push({ pathname: '/room/[code]', params: { code: snap.code } });
      }}
      style={styles.lobby}
    >
      {url && <QrCode value={url} size={size} light />}
      <View style={{ gap: 4, justifyContent: 'center' }}>
        <T size={11} weight="800" color={colors.muted}>
          INQUADRA O USA IL CODICE
        </T>
        <T size={30} weight="900" color={colors.accent} style={{ letterSpacing: 4 }}>
          {snap.code}
        </T>
        <Row gap={4}>
          {players.slice(0, 6).map((m, i) => (
            <CharacterAvatar key={m.id} id={avatars[i]} size={24} />
          ))}
          <T size={13} weight="800">
            {players.length ? `${players.length} al tavolo` : 'Aspetto i telefoni…'}
          </T>
        </Row>
        <T size={12} weight="800" color={colors.accent}>
          Apri il tavolo ›
        </T>
      </View>
    </Pressable>
  );
}
