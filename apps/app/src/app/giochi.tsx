import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { catalog, getGame, playerCounts, type CatalogEntry, type GameMeta } from '@giochi/engine';
import { setPendingMatch } from '../session/local';
import { defaultName, loadNames } from '../session/names';
import { quickRoom, useOnline } from '../session/online';
import { GameArt } from '../ui/GameArt';
import { useIsTable } from '../ui/device';
import { GameGrid, GameIcon, useIconSize } from '../ui/GameIcon';
import { focusRing, onColor, RoundButton, Screen, Sheet, SheetOption, T, tap } from '../ui/kit';
import { getSettings } from '../ui/settings';
import { SOFT, shellColors as colors } from '../ui/theme';

type Mode = 'bots' | 'two' | 'many' | 'all';

const LABEL: Record<Mode, string> = { bots: 'Contro i bot', two: '2, un telefono', many: 'In tanti, un telefono', all: '' };

/** Si parte subito contro il computer, col numero di giocatori più comune per quel gioco. */
function startVsComputer(meta: GameMeta) {
  const counts = playerCounts(meta);
  const n = counts.find((c) => c >= 2) ?? counts[0];
  router.push({ pathname: '/play/[id]', params: { id: meta.id, bots: String(Math.max(0, n - 1)) } });
}

/** Si parte subito in due sullo stesso telefono. */
async function startTwo(meta: GameMeta) {
  const names = await loadNames();
  setPendingMatch({ gameId: meta.id, seats: [{ name: names[0]?.trim() || 'Io', bot: false, avatar: getSettings().avatar ?? undefined }, { name: names[1]?.trim() || defaultName(1), bot: false }] });
  router.push({ pathname: '/play/[id]', params: { id: meta.id } });
}

/** In tanti serve prima sapere chi gioca: la scheda del gioco parte con tutti i posti per le persone. */
const startMany = (meta: GameMeta) => router.push({ pathname: '/game/[id]', params: { id: meta.id, persone: '1' } });

/** Chi sceglie da «Tutti i giochi» decide qui come giocare, tra i modi che quel gioco permette. */
function HowToPlay({ entry, onClose, isTable }: { entry: CatalogEntry | null; onClose: () => void; isTable: boolean }) {
  const online = useOnline();
  const m = entry?.meta;
  const go = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <Sheet visible={!!m} onClose={onClose}>
      {m && (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {m ? <GameArt id={m.id} size={68} /> : null}
            <View style={{ flex: 1 }}>
              <T size={24} weight="900" style={{ lineHeight: 28 }}>
                {m.name}
              </T>
              <T size={16} weight="800" color={colors.muted}>
                Come giochi?
              </T>
            </View>
          </View>
          {!m.humansOnly && !m.onlineOnly && <SheetOption icon="🤖" title={m.maxPlayers >= 2 ? 'Contro i bot' : 'Gioca'} text="Parti subito, offline" primary onPress={go(() => startVsComputer(m))} />}
          {m.maxPlayers >= 2 && !isTable && !m.onlineOnly && (
            <SheetOption icon="📱" title="Con gli amici, un telefono" text={m.hiddenInfo ? 'Vi passate il telefono a ogni turno' : 'Sullo stesso schermo'} onPress={go(() => (playerCounts(m).includes(2) && !m.humansOnly ? startTwo(m) : startMany(m)))} />
          )}
          {m.maxPlayers >= 2 && (
            <SheetOption
              icon={isTable ? '📺' : '👥'}
              title={online.waking ? 'Sveglio le stanze…' : 'Multiplayer'}
              text={isTable ? 'Questo schermo è il tavolo: gli amici entrano col telefono' : 'Apri una stanza, ognuno dal suo telefono'}
              onPress={go(async () => {
                const code = await quickRoom(m.id, isTable);
                if (code) router.push({ pathname: '/room/[code]', params: { code } });
              })}
            />
          )}
          <Pressable accessibilityRole="button" onPress={go(() => router.push({ pathname: '/game/[id]', params: { id: m.id } }))} style={{ alignSelf: 'center', padding: 10 }}>
            <T size={14} weight="800" color={colors.accent}>
              Regole e bravura ›
            </T>
          </Pressable>
        </>
      )}
    </Sheet>
  );
}

function Tag({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Cambia: ${label}`}
      onPress={() => {
        tap();
        onPress();
      }}
      style={(state) => [styles.tag, { backgroundColor: color }, focusRing((state as { focused?: boolean }).focused ?? false)]}
    >
      <T size={14} weight="800" color={onColor(color)} lines={1}>
        {label}
      </T>
    </Pressable>
  );
}

/** Le griglie dei giochi: una per ogni modo di giocare offline, più quella con tutti i giochi. */
export default function Games() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode: Mode = params.mode === 'two' || params.mode === 'many' || params.mode === 'all' ? params.mode : 'bots';
  const isTable = useIsTable();
  const size = useIconSize();
  const [picked, setPicked] = useState<CatalogEntry | null>(null);
  const everything = useMemo(() => catalog(), []);
  // I giochi solo online non hanno una partita su un dispositivo solo: restano in «Tutti i giochi».
  const all = everything.filter((e) => !e.meta.onlineOnly);
  const lastGame = getSettings().lastGame;
  const lastMeta = lastGame ? getGame(lastGame)?.meta : undefined;
  const last = mode === 'bots' && !lastMeta?.onlineOnly ? lastMeta : undefined;

  const start = (e: CatalogEntry) => {
    // I giochi solo tra persone (Mr. White, Lupus) si giocano offline passandosi il telefono.
    if (mode === 'bots') (e.meta.humansOnly ? startMany(e.meta) : startVsComputer(e.meta));
    else if (mode === 'two') startTwo(e.meta);
    else if (mode === 'many') startMany(e.meta);
    else setPicked(e);
  };
  const grid = (list: CatalogEntry[]) => (
    <GameGrid>
      {list.map((e) => (
        <GameIcon key={e.meta.id} meta={e.meta} size={size} onPress={() => start(e)} />
      ))}
    </GameGrid>
  );
  const twoPlayers = all.filter((e) => playerCounts(e.meta).includes(2) && !e.meta.humansOnly);

  return (
    <Screen>
      <View style={styles.top}>
        <RoundButton icon="back" label="Indietro" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        {mode === 'all' ? (
          <T size={26} weight="900">
            Tutti i giochi
          </T>
        ) : (
          <>
            <Tag label="Offline" color={colors.accent} onPress={() => router.replace('/')} />
            {!isTable && <Tag label={LABEL[mode]} color={colors.surface2} onPress={() => router.replace('/offline')} />}
          </>
        )}
      </View>
      {last && last.id && !last.humansOnly && (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            tap();
            startVsComputer(last);
          }}
          style={(state) => [styles.again, { transform: [{ translateY: state.pressed ? 3 : 0 }] }]}
        >
          <GameArt id={last.id} size={46} />
          <T size={20} weight="900" color={colors.onAccent} style={{ flex: 1 }} lines={1}>
            Rigioca a {last.name}
          </T>
          <T size={22} weight="900" color={colors.onAccent}>
            ▶
          </T>
        </Pressable>
      )}
      {mode === 'bots' && grid(all)}
      {mode === 'two' && (
        <>
          <T size={20} weight="900">
            Sullo stesso schermo
          </T>
          {grid(twoPlayers.filter((e) => !e.meta.hiddenInfo))}
          <T size={20} weight="900">
            Vi passate il telefono
          </T>
          {grid(twoPlayers.filter((e) => e.meta.hiddenInfo))}
        </>
      )}
      {mode === 'many' && (
        <>
          <T size={20} weight="900">
            Il telefono gira tra tutti
          </T>
          {grid(all.filter((e) => e.meta.maxPlayers > 2))}
        </>
      )}
      {mode === 'all' && grid(everything)}
      <HowToPlay entry={picked} onClose={() => setPicked(null)} isTable={isTable} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tag: { minHeight: 44, flexShrink: 1, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: colors.line },
  again: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.accent, boxShadow: SOFT, marginBottom: 5 },
});
