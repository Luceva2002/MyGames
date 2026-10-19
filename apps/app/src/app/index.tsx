import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { assignAvatars, catalog, playerCounts, type Category, type CatalogEntry } from '@giochi/engine';
import { createRoom, joinUrl, quickRoom, useOnline } from '../session/online';
import { canPassAndPlay } from '../session/local';
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

const CATEGORY_LABEL: Record<Category, string> = { carte: 'carte', tavolo: 'tavolo', dadi: 'dadi', abilita: 'abilità', party: 'party' };

type PlayMode = 'offline' | 'friends' | 'share' | 'online';

/** Filtri per modo di gioco: da soli o sullo stesso telefono, con la TV in salotto, o ognuno da casa. */
const MODES: { id: PlayMode; icon: string; label: string; hint: string; fits: (e: CatalogEntry) => boolean }[] = [
  { id: 'offline', icon: '🤖', label: 'Offline', hint: 'Su questo dispositivo contro il computer', fits: (e) => e.status === 'ready' && !e.meta.humansOnly },
  { id: 'friends', icon: '🫶', label: 'Offline con amici', hint: 'Tutti sullo stesso dispositivo', fits: (e) => e.status === 'ready' && canPassAndPlay(e.meta) },
  { id: 'share', icon: '📺', label: 'Stanza in share', hint: 'Uno schermo fa da tavolo, i telefoni da controller', fits: (e) => e.status === 'ready' && e.meta.maxPlayers >= 2 },
  { id: 'online', icon: '🌍', label: 'Online', hint: 'Ognuno dal suo telefono, anche a distanza', fits: (e) => e.status === 'ready' && e.meta.maxPlayers >= 2 },
];

function playersLabel(e: CatalogEntry) {
  const counts = playerCounts(e.meta);
  const { minPlayers: a, maxPlayers: b } = e.meta;
  if (counts.length < b - a + 1) return counts.join(' o ');
  return a === b ? `${a}` : b >= 10 ? `${a}+` : `${a}–${b}`;
}

function GameTile({ entry, width, onOpen }: { entry: CatalogEntry; width: number; onOpen: (e: CatalogEntry) => void }) {
  const external = entry.status === 'external';
  const art = GAME_ART[entry.meta.id];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.meta.name}. ${entry.meta.tagline}. ${playersLabel(entry)} giocatori`}
      onPress={() => {
        tap();
        onOpen(entry);
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

/** Si parte subito contro il computer, col numero di giocatori più comune per quel gioco. */
function startVsComputer(e: CatalogEntry) {
  const counts = playerCounts(e.meta);
  const n = counts.find((c) => c >= 2) ?? counts[0];
  router.push({ pathname: '/play/[id]', params: { id: e.meta.id, bots: String(Math.max(0, n - 1)) } });
}

/** Stanza col gioco già scelto: `screen` se questo schermo fa da tavolo per tutti. */
async function startRoom(e: CatalogEntry, screen: boolean) {
  const code = await quickRoom(e.meta.id, screen);
  if (code) router.push({ pathname: '/room/[code]', params: { code } });
}

/** La scelta rapida di come giocare, sopra la home: due tocchi in tutto e si è al tavolo. */
function QuickStart({ entry, onClose, wideScreen }: { entry: CatalogEntry | null; onClose: () => void; wideScreen: boolean }) {
  const online = useOnline();
  const e = entry;
  const art = e ? GAME_ART[e.meta.id] : null;
  const multi = !!e && e.meta.maxPlayers >= 2;
  const go = (fn: () => void) => () => {
    tap();
    onClose();
    fn();
  };
  return (
    <Modal visible={!!e} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetScrim} onPress={onClose} accessibilityLabel="Chiudi">
        {e && (
          <Pressable style={styles.sheet} onPress={() => {}} accessibilityViewIsModal>
            <Row gap={12}>
              {art ? <Image source={art} style={styles.sheetArt} accessibilityIgnoresInvertColors /> : null}
              <View style={{ flex: 1, gap: 2 }}>
                <T size={24} weight="900">
                  {e.meta.name}
                </T>
                <T size={13} color={colors.muted} lines={2}>
                  {e.meta.tagline}
                </T>
              </View>
            </Row>
            <T size={14} weight="900" color={colors.muted}>
              COME GIOCATE?
            </T>
            {!e.meta.humansOnly && <QuickOption icon="🤖" title={multi ? 'Contro il computer' : 'Gioca'} text={multi ? 'Parti subito, qui su questo dispositivo' : 'Parti subito'} primary onPress={go(() => startVsComputer(e))} />}
            {multi && (
              <QuickOption
                icon="📱"
                title={online.status === 'connecting' ? 'Creo la stanza…' : 'Con amici, ognuno col suo telefono'}
                text="Crei la stanza e mandi il link o il QR"
                onPress={go(() => startRoom(e, false))}
              />
            )}
            {multi && wideScreen && <QuickOption icon="📺" title="Questo schermo fa da tavolo" text="Gli altri giocano dal telefono" onPress={go(() => startRoom(e, true))} />}
            {multi && canPassAndPlay(e.meta) && <QuickOption icon="🫶" title="Tutti su questo dispositivo" text="Vi passate il telefono a turno" onPress={go(() => router.push({ pathname: '/game/[id]', params: { id: e.meta.id } }))} />}
            <Pressable accessibilityRole="button" onPress={go(() => router.push({ pathname: '/game/[id]', params: { id: e.meta.id } }))} style={{ alignSelf: 'center', padding: 8 }}>
              <T size={14} weight="800" color={colors.accent}>
                Regole e più opzioni ›
              </T>
            </Pressable>
          </Pressable>
        )}
      </Pressable>
    </Modal>
  );
}

function QuickOption({ icon, title, text, primary, onPress }: { icon: string; title: string; text: string; primary?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${text}`}
      onPress={onPress}
      style={(state) => [styles.quickOption, primary && { backgroundColor: colors.accent }, { transform: [{ translateY: (state as { pressed: boolean }).pressed ? 3 : 0 }] }, focusRing((state as { focused?: boolean }).focused ?? false)]}
    >
      <T size={26}>{icon}</T>
      <View style={{ flex: 1 }}>
        <T size={17} weight="900" color={primary ? colors.onAccent : colors.text}>
          {title}
        </T>
        <T size={13} weight="700" color={primary ? colors.onAccent : colors.muted}>
          {text}
        </T>
      </View>
      <T size={20} weight="900" color={primary ? colors.onAccent : colors.accent}>
        ›
      </T>
    </Pressable>
  );
}

export default function Home() {
  const { width } = useWindowDimensions();
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [mode, setMode] = useState<PlayMode | null>(null);
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
          (mode === null || MODES.find((m) => m.id === mode)!.fits(e)),
      ),
    [category, mode],
  );

  // Avvio rapido: un tocco sul gioco apre la scelta "come giochiamo"; col filtro del modo già
  // scelto si parte subito, senza passare dalla pagina delle impostazioni della partita.
  const [quick, setQuick] = useState<CatalogEntry | null>(null);
  const open = (e: CatalogEntry) => {
    if (e.status !== 'ready') return router.push({ pathname: '/game/[id]', params: { id: e.meta.id } });
    if (mode === 'offline') return startVsComputer(e);
    if (mode === 'friends') return router.push({ pathname: '/game/[id]', params: { id: e.meta.id } });
    if (mode === 'share' || mode === 'online') return startRoom(e, mode === 'share');
    setQuick(e);
  };

  const gear = (
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
  );

  return (
    <Screen>
      {wide ? (
      <View style={[styles.hero, { height: heroH }]}>
        <Image source={HERO} style={{ position: 'absolute', left: 0, top: 0, width: contentWidth, height: heroH - 6 }} resizeMode="cover" accessibilityIgnoresInvertColors />
        {/* La metà sinistra dell'illustrazione è vuota apposta per il titolo, che resta leggibile (V-CON-2). */}
        <View style={[styles.heroScrim, { padding: 24 }]}>
          <Row style={{ flex: 1, justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {/* Titolo in alto e lobby in basso, allineati a sinistra. */}
            <View style={{ flex: 1, maxWidth: '50%', height: '100%', justifyContent: 'space-between', gap: 4 }}>
              <View style={{ gap: 4 }}>
                <T size={52} weight="900" color={colors.accent} style={styles.wordmark}>
                  Tavolata
                </T>
                <T size={16} weight="800" color={colors.text}>
                  La TV è il tavolo, il telefono è il tuo controller.
                </T>
              </View>
              <HomeLobby size={Math.round(Math.min(150, heroHeight * 0.38))} />
            </View>
            {gear}
          </Row>
        </View>
      </View>
      ) : (
      // Telefono: in alto le maschere intere e centrate, sotto titolo e frase su fondo pieno.
      <View style={styles.hero}>
        <View style={{ height: Math.round((contentWidth / 0.6) / 2.22), overflow: 'hidden' }}>
          <Image source={HERO} style={{ position: 'absolute', right: 0, top: 0, width: contentWidth / 0.6, height: (contentWidth / 0.6) / 2.22 }} resizeMode="cover" accessibilityIgnoresInvertColors />
        </View>
        <Row style={{ padding: 16, paddingTop: 10, justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <T size={34} weight="900" color={colors.accent} style={styles.wordmark}>
              Tavolata
            </T>
            <T size={13} weight="800" color={colors.text}>
              La TV è il tavolo, il telefono è il tuo controller.
            </T>
          </View>
          {gear}
        </Row>
      </View>
      )}

      <Row gap={12} wrap>
        <BigAction
          primary
          icon="📺"
          title="Crea una stanza"
          text="Questo schermo fa da tavolo"
          onPress={async () => {
            const code = await quickRoom(undefined, width > 760);
            if (code) router.push({ pathname: '/room/[code]', params: { code } });
          }}
        />
        <BigAction icon="📱" title="Entra con un codice" text="Il telefono diventa il controller" onPress={() => router.push('/room/join')} />
      </Row>

      <View style={{ gap: 10 }}>
        <T size={14} weight="800" color={colors.muted}>
          COME GIOCATE?
        </T>
        <Row gap={10} wrap>
          {MODES.map((m) => {
            const active = mode === m.id;
            return (
              <Pressable
                key={m.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${m.label}: ${m.hint}`}
                onPress={() => {
                  tap();
                  setMode(active ? null : m.id);
                }}
                style={(state) => [styles.modeButton, active && { backgroundColor: colors.accent, borderColor: colors.accent }, focusRing((state as { focused?: boolean }).focused ?? false)]}
              >
                <T size={22}>{m.icon}</T>
                <View style={{ flexShrink: 1 }}>
                  <T size={15} weight="900" color={active ? colors.onAccent : colors.text}>
                    {m.label}
                  </T>
                  <T size={12} weight="700" color={active ? colors.onAccent : colors.dim}>
                    {m.hint}
                  </T>
                </View>
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
          <GameTile key={e.meta.id} entry={e} width={tileWidth} onOpen={open} />
        ))}
        {entries.length === 0 && <T color={colors.muted}>Nessun gioco con questi filtri.</T>}
      </View>
      <QuickStart entry={quick} onClose={() => setQuick(null)} wideScreen={width > 760} />
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
  sheetScrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 520, gap: 10, padding: 18, paddingBottom: 26, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.surface, borderWidth: 3, borderColor: colors.line },
  sheetArt: { width: 64, height: 64, borderRadius: 16, borderWidth: 3, borderColor: colors.line },
  quickOption: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderWidth: 3, borderColor: colors.line, backgroundColor: colors.surface2, boxShadow: `0px 4px 0px ${colors.line}` },
  modeButton: { flexDirection: 'row', alignItems: 'center', gap: 10, flexGrow: 1, flexBasis: 200, minHeight: 56, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 3, borderColor: colors.line, backgroundColor: colors.surface },
  players: { position: 'absolute', bottom: 8, left: 8, backgroundColor: colors.scrim, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  bigAction: { flexGrow: 1, flexBasis: 300, minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: radius.l, borderWidth: 3, borderColor: colors.line, boxShadow: `0px 6px 0px ${colors.line}`, marginBottom: 6 },
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
