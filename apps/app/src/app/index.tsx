import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { assignAvatars, CODE_LENGTH, normalizeCode } from '@giochi/engine';
import { createRoom, joinUrl, quickJoin, quickRoom, useOnline } from '../session/online';
import { CharacterAvatar } from '../ui/avatars';
import { Copertina } from '../ui/Copertina';
import { useIsTable } from '../ui/device';
import { focusRing, onColor, RoundButton, Screen, T, tap } from '../ui/kit';
import { getSettings } from '../ui/settings';
import { shellColors as colors, MIN_TOUCH } from '../ui/theme';

/** Una delle grandi scelte: Offline o Multiplayer. */
function BigChoice({ title, text, color, wide, onPress, children }: { title: string; text: string; color: string; wide?: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${text}`}
      onPress={() => {
        tap();
        onPress();
      }}
      style={(state) => [
        styles.choice,
        wide && styles.choiceWide,
        { backgroundColor: color, transform: [{ translateY: state.pressed ? 4 : 0 }], boxShadow: `0px ${state.pressed ? 2 : 5}px 0px ${colors.line}` },
        focusRing((state as { focused?: boolean }).focused ?? false),
      ]}
    >
      <View style={{ flexDirection: 'row' }}>{children}</View>
      <View style={{ gap: 6, alignItems: wide ? 'flex-start' : 'center', flexShrink: 1 }}>
        <T size={wide ? 40 : 34} weight="900" color={onColor(color)} style={{ lineHeight: wide ? 44 : 38 }}>
          {title}
        </T>
        <T size={15} weight="800" color={onColor(color)} center={!wide}>
          {text}
        </T>
      </View>
    </Pressable>
  );
}

function Masks({ ids, size }: { ids: string[]; size: number }) {
  return (
    <>
      {ids.map((id, i) => (
        <View key={id} style={{ marginLeft: i ? -Math.round(size / 4) : 0 }}>
          <CharacterAvatar id={id} size={size} />
        </View>
      ))}
    </>
  );
}

function AllGames() {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap();
        router.push({ pathname: '/giochi', params: { mode: 'all' } });
      }}
      style={(state) => [styles.allGames, { transform: [{ translateY: state.pressed ? 3 : 0 }] }, focusRing((state as { focused?: boolean }).focused ?? false)]}
    >
      <T size={20} weight="900" color={colors.onAccent}>
        Tutti i giochi
      </T>
    </Pressable>
  );
}

/** Per chi ha un codice: si scrive e si entra appena è completo, o con «Entra». */
function CodeRow({ code, setCode, go }: { code: string; setCode: (c: string) => void; go: (c: string) => void }) {
  const online = useOnline();
  const busy = online.status === 'connecting';
  return (
    <View style={styles.codeRow}>
      <T size={15} weight="800" color={colors.onAccent} style={{ flex: 1, lineHeight: 17 }} lines={2}>
        {online.waking ? 'Sveglio le stanze…' : busy ? 'Entro…' : online.error ?? 'Hai un codice?'}
      </T>
      {busy ? (
        <ActivityIndicator color={colors.onAccent} />
      ) : (
        <>
          <TextInput
            value={code}
            onChangeText={(t) => {
              const c = normalizeCode(t);
              setCode(c);
              if (c.length === CODE_LENGTH) go(c);
            }}
            placeholder="ABCD"
            placeholderTextColor="#2A2D3466"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={CODE_LENGTH}
            accessibilityLabel="Codice della stanza"
            onSubmitEditing={() => go(code)}
            style={styles.codeInput}
          />
          <Pressable accessibilityRole="button" onPress={() => go(code)} style={styles.enter}>
            <T size={15} weight="800" color={colors.onAccent}>
              Entra
            </T>
          </Pressable>
        </>
      )}
    </View>
  );
}

/**
 * La prima schermata: come giochiamo? Offline o Multiplayer, con accanto tutti i giochi e il campo
 * per il codice. Su PC e TV sopra c'è la copertina con la stanza già aperta: si entra da qui.
 */
export default function Home() {
  const { width, height } = useWindowDimensions();
  const isTable = useIsTable();
  const online = useOnline();
  // Il link d'invito e il QR portano qui con ?code=ABCD: si entra subito, senza altre schermate.
  const { code: codeParam } = useLocalSearchParams<{ code?: string }>();
  const linkCode = normalizeCode(codeParam ?? '');
  const [code, setCode] = useState(linkCode);
  const go = async (c: string) => {
    if (c.length !== CODE_LENGTH || online.status === 'connecting') return;
    const joined = await quickJoin(c);
    if (joined) router.replace({ pathname: '/room/[code]', params: { code: joined } });
  };
  useEffect(() => {
    if (linkCode.length === CODE_LENGTH) go(linkCode);
  }, [linkCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const multiplayer = async () => {
    const room = await quickRoom(getSettings().lastGame ?? undefined, isTable);
    if (room) router.push({ pathname: '/room/[code]', params: { code: room } });
  };
  const roomBusy = online.waking ? 'Sveglio le stanze…' : null;
  const settings = <RoundButton icon="menu" label="Impostazioni" onPress={() => router.push('/settings')} />;

  if (isTable) {
    const contentWidth = Math.min(width, 1100) - 32;
    return (
      <Screen>
        <HomeCover width={contentWidth} height={Math.max(340, Math.min(430, Math.round(height * 0.56)))} settings={settings} skipRoom={linkCode.length === CODE_LENGTH} />
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <BigChoice wide title="Offline" text="Contro i bot, qui su questo schermo." color={colors.accent} onPress={() => router.push({ pathname: '/giochi', params: { mode: 'bots' } })}>
            <Masks ids={['bobo']} size={84} />
          </BigChoice>
          <BigChoice wide title="Multiplayer" text={roomBusy ?? 'Questo schermo è il tavolo.'} color={colors.accent2} onPress={multiplayer}>
            <Masks ids={['lulu', 'fio']} size={84} />
          </BigChoice>
        </View>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'stretch' }}>
          <View style={{ flex: 1 }}>
            <AllGames />
          </View>
          <View style={{ flex: 1 }}>
            <CodeRow code={code} setCode={setCode} go={go} />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={{ flexGrow: 1 }}>
      <View style={styles.phoneTop}>
        <T size={38} weight="900" color={colors.text} style={styles.wordmark}>
          Tavolata
        </T>
        {settings}
      </View>
      <T size={30} weight="900" center>
        Come giochiamo?
      </T>
      <BigChoice title="Offline" text="Contro i bot o con gli amici, su un telefono." color={colors.accent} onPress={() => router.push('/offline')}>
        <Masks ids={['bobo']} size={76} />
      </BigChoice>
      <BigChoice title="Multiplayer" text={roomBusy ?? 'Una stanza: ognuno entra dal suo telefono.'} color={colors.accent2} onPress={multiplayer}>
        <Masks ids={['lulu', 'pim', 'fio']} size={76} />
      </BigChoice>
      <AllGames />
      <CodeRow code={code} setCode={setCode} go={go} />
    </Screen>
  );
}

/**
 * La copertina della home: sugli schermi grandi apre da sola una stanza (questo schermo fa da
 * tavolo) e mostra QR, codice e chi è già entrato. I telefoni inquadrano e sono dentro.
 */
function HomeCover({ width, height, settings, skipRoom }: { width: number; height: number; settings: React.ReactNode; skipRoom: boolean }) {
  const online = useOnline();
  const snap = online.snapshot;
  useEffect(() => {
    if (skipRoom || online.room || online.status === 'connecting') return;
    createRoom({ name: 'Schermo', role: 'screen' });
  }, [online.room]); // eslint-disable-line react-hooks/exhaustive-deps
  const players = snap?.members.filter((m) => m.role === 'player') ?? [];
  const top = (
    <View style={{ gap: 2 }}>
      <T size={56} weight="900" color={colors.text} style={styles.wordmark}>
        Tavolata
      </T>
      <T size={16} weight="800">
        La TV è il tavolo, il telefono è il tuo controller.
      </T>
    </View>
  );
  return (
    <Copertina
      width={width}
      height={height}
      top={top}
      action={settings}
      code={snap?.code}
      url={snap ? joinUrl(snap.code) : null}
      count={players.length}
      avatars={assignAvatars(players.map((m) => ({ name: m.name, bot: false, avatar: m.avatar })))}
      notice={online.error ? 'Stanze online non disponibili adesso' : online.waking ? 'Sveglio le stanze online, ci vuole al massimo un minuto…' : undefined}
    />
  );
}

const styles = StyleSheet.create({
  phoneTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: {},
  choice: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 170, padding: 14, borderRadius: 30, borderWidth: 3, borderColor: colors.line, marginBottom: 7 },
  choiceWide: { flex: 1, flexDirection: 'row', gap: 20, minHeight: 130 },
  allGames: { minHeight: 68, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 3, borderColor: colors.line, backgroundColor: '#FFFFFF', boxShadow: `0px 5px 0px ${colors.line}`, marginBottom: 5 },
  codeRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 14, paddingRight: 8, borderRadius: 22, borderWidth: 3, borderColor: colors.line, backgroundColor: '#FFFFFF', boxShadow: `0px 5px 0px ${colors.line}`, marginBottom: 5 },
  codeInput: { width: 104, height: MIN_TOUCH, minWidth: 0, borderRadius: 14, borderWidth: 3, borderColor: colors.line, backgroundColor: '#F7F8F6', color: colors.onAccent, fontSize: 20, fontWeight: '900', letterSpacing: 3, textAlign: 'center' },
  enter: { width: 64, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 3, borderColor: colors.line, backgroundColor: colors.accent },
});
