import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { assignAvatars, catalog, CODE_LENGTH, normalizeCode, playerCounts, type Category, type CatalogEntry } from '@giochi/engine';
import { createRoom, joinUrl, quickJoin, quickRoom, useOnline } from '../session/online';
import { canPassAndPlay } from '../session/local';
import { CharacterAvatar } from '../ui/avatars';
import { PopIn } from '../ui/motion';
import { LevelPicker } from '../ui/LevelPicker';
import { useIsTable } from '../ui/device';
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

function playersLabel(e: CatalogEntry) {
  const counts = playerCounts(e.meta);
  const { minPlayers: a, maxPlayers: b } = e.meta;
  if (counts.length < b - a + 1) return counts.join(' o ');
  return a === b ? `${a}` : b >= 10 ? `${a}+` : `${a}–${b}`;
}

function GameTile({ entry, width, onOpen }: { entry: CatalogEntry; width: number; onOpen: (e: CatalogEntry) => void }) {
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

/**
 * La scelta rapida di come giocare, sopra la home: due tocchi in tutto e si è al tavolo.
 * Online decide il dispositivo, senza domande: dal computer (o tablet, TV) lo schermo diventa il
 * tavolo e gli amici giocano dal telefono; dal telefono ognuno siede al tavolo col suo telefono.
 * Senza internet si gioca sempre: contro il computer o passandosi il dispositivo.
 */
function QuickStart({ entry, onClose, isTable }: { entry: CatalogEntry | null; onClose: () => void; isTable: boolean }) {
  const online = useOnline();
  const e = entry;
  const art = e ? GAME_ART[e.meta.id] : null;
  const multi = !!e && e.meta.maxPlayers >= 2;
  const go = (fn: () => void) => () => {
    tap();
    onClose();
    fn();
  };
  const roomBusy = online.waking ? 'Sveglio le stanze…' : online.status === 'connecting' ? 'Creo la stanza…' : null;
  return (
    <Modal visible={!!e} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetScrim} onPress={onClose} accessibilityLabel="Chiudi">
        {e && (
          <PopIn style={{ width: '100%', alignItems: 'center' }}>
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
            {multi && (
              <>
                <T size={14} weight="900" color={colors.muted}>
                  CON GLI AMICI · ONLINE
                </T>
                <QuickOption
                  icon={isTable ? '📺' : '📱'}
                  title={roomBusy ?? (isTable ? 'Questo schermo è il tavolo' : 'Ognuno col suo telefono')}
                  text={isTable ? 'Gli amici inquadrano il QR e giocano dal telefono' : 'Tutti al tavolo dal proprio telefono, senza schermo comune'}
                  primary
                  onPress={go(() => startRoom(e, isTable))}
                />
              </>
            )}
            {(!e.meta.humansOnly || (multi && canPassAndPlay(e.meta))) && (
              <T size={14} weight="900" color={colors.muted}>
                {multi ? 'SENZA INTERNET' : 'GIOCA'}
              </T>
            )}
            {!e.meta.humansOnly && <QuickOption icon="🤖" title={multi ? 'Contro il computer' : 'Gioca'} text="Parti subito, qui" primary={!multi} onPress={go(() => startVsComputer(e))} />}
            {!e.meta.humansOnly && multi && <LevelPicker />}
            {multi && canPassAndPlay(e.meta) && (
              <QuickOption icon="🫶" title="Tutti su questo dispositivo" text={isTable ? 'Giocate a turno su questo schermo' : 'Vi passate il telefono a turno'} onPress={go(() => router.push({ pathname: '/game/[id]', params: { id: e.meta.id } }))} />
            )}
            <Pressable accessibilityRole="button" onPress={go(() => router.push({ pathname: '/game/[id]', params: { id: e.meta.id } }))} style={{ alignSelf: 'center', padding: 8 }}>
              <T size={14} weight="800" color={colors.accent}>
                Regole e più opzioni ›
              </T>
            </Pressable>
          </Pressable>
          </PopIn>
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

/**
 * Entrare in una stanza dalla home, in un passo: si scrivono le 4 lettere e si entra appena sono
 * complete (o si arriva col link/QR, che le ha già). Si entra col nome salvato o con quello di una
 * maschera; nome e personaggio si cambiano poi dentro la stanza.
 */
function JoinBar({ initialCode }: { initialCode: string }) {
  const online = useOnline();
  const [code, setCode] = useState(initialCode);
  const busy = online.status === 'connecting';
  const go = async (c: string) => {
    if (c.length !== CODE_LENGTH || busy) return;
    const joined = await quickJoin(c);
    if (joined) router.replace({ pathname: '/room/[code]', params: { code: joined } });
  };
  useEffect(() => {
    if (initialCode.length === CODE_LENGTH) go(initialCode);
  }, [initialCode]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={[styles.bigAction, styles.joinBar]}>
      <T size={30}>📱</T>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={20} weight="900" color={colors.onAccent}>
          {online.waking ? 'Sveglio le stanze…' : busy ? 'Entro…' : 'Entra'}
        </T>
        <T size={14} weight="800" color={colors.onAccent} lines={2}>
          {online.error && !busy ? online.error : 'Hai un codice?'}
        </T>
      </View>
      {busy ? (
        <ActivityIndicator color={colors.onAccent} />
      ) : (
        <TextInput
          value={code}
          onChangeText={(t) => {
            const c = normalizeCode(t);
            setCode(c);
            if (c.length === CODE_LENGTH) go(c);
          }}
          placeholder="ABCD"
          placeholderTextColor="#12052B55"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={CODE_LENGTH}
          accessibilityLabel="Codice della stanza"
          onSubmitEditing={() => go(code)}
          style={styles.codeInput}
        />
      )}
    </View>
  );
}

export default function Home() {
  const { width } = useWindowDimensions();
  const isTable = useIsTable();
  // Il link d'invito e il QR portano qui con ?code=ABCD: si entra subito, senza altre schermate.
  const { code: codeParam } = useLocalSearchParams<{ code?: string }>();
  const linkCode = normalizeCode(codeParam ?? '');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const contentWidth = Math.min(width, 1100) - 32;
  const columns = contentWidth > 900 ? 5 : contentWidth > 640 ? 4 : contentWidth > 420 ? 3 : 2;
  // L'hero tiene le proporzioni dell'illustrazione (1600×720), così si vedono tutte e 4 le maschere.
  const heroHeight = Math.min(420, Math.max(200, Math.round((contentWidth * 720) / 1600)));
  const wide = contentWidth > 640;
  const heroH = wide ? heroHeight : 230;
  const tileWidth = Math.floor((contentWidth - (columns - 1) * 12) / columns);

  const entries = useMemo(
    () =>
      catalog().filter((e) => category === 'all' || e.meta.category === category),
    [category],
  );

  // Avvio rapido: un tocco sul gioco apre la scelta "come giochiamo".
  const [quick, setQuick] = useState<CatalogEntry | null>(null);
  const open = (e: CatalogEntry) => {
    if (e.status !== 'ready') return router.push({ pathname: '/game/[id]', params: { id: e.meta.id } });
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
              {isTable && <HomeLobby size={Math.round(Math.min(150, heroHeight * 0.38))} />}
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
              Ognuno al tavolo col suo telefono, anche senza TV.
            </T>
          </View>
          {gear}
        </Row>
      </View>
      )}

      <Row gap={12} wrap>
        <BigAction
          primary
          icon={isTable ? '📺' : '📱'}
          title="Crea una stanza"
          text={isTable ? 'Questo schermo è il tavolo, gli amici giocano dal telefono' : 'Ognuno gioca dal suo telefono'}
          onPress={async () => {
            const code = await quickRoom(undefined, isTable);
            if (code) router.push({ pathname: '/room/[code]', params: { code } });
          }}
        />
        <JoinBar initialCode={linkCode} />
      </Row>


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
      <QuickStart entry={quick} onClose={() => setQuick(null)} isTable={isTable} />
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
  sheetScrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', alignItems: 'center', padding: 16 },
  sheet: { width: '100%', maxWidth: 460, gap: 10, padding: 18, borderRadius: 28, backgroundColor: colors.surface, borderWidth: 3, borderColor: colors.line, boxShadow: `0px 8px 0px ${colors.line}` },
  sheetArt: { width: 64, height: 64, borderRadius: 16, borderWidth: 3, borderColor: colors.line },
  quickOption: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderWidth: 3, borderColor: colors.line, backgroundColor: colors.surface2, boxShadow: `0px 4px 0px ${colors.line}` },
  joinBar: { backgroundColor: '#FFFFFF', boxShadow: `0px 6px 0px ${colors.line}` },
  codeInput: { width: 116, minHeight: 46, paddingHorizontal: 10, borderRadius: 12, borderWidth: 3, borderColor: colors.line, backgroundColor: '#F4F0FF', color: colors.onAccent, fontSize: 22, fontWeight: '900', letterSpacing: 5, textAlign: 'center' },
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
    ) : online.waking ? (
      <View style={styles.lobbyOff}>
        <T size={13} color={colors.muted}>
          ⏳ Sveglio le stanze online, ci vuole al massimo un minuto…
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
