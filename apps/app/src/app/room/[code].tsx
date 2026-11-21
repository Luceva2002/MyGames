import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View, Platform, Share } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useStayAwake } from '../../ui/keepAwake';
import { assignAvatars, BOT_CHARACTERS, BOT_LEVELS, canControl, CODE_LENGTH, GAMES, getGame, normalizeCode, playerCounts, type GameMeta, type RoomSnapshot } from '@giochi/engine';
import { GameFrame } from '../../games/GameFrame';
import { clearOnlineError, joinUrl, leaveIfPlaying, leaveRoom, rejoin, send, sendMove, useOnline } from '../../session/online';
import { loadNames, saveNames } from '../../session/names';
import { GameArt } from '../../ui/GameArt';
import { CharacterAvatar } from '../../ui/avatars';
import { Copertina } from '../../ui/Copertina';
import { useIsTable } from '../../ui/device';
import { GameGrid, GameIcon, useIconSize } from '../../ui/GameIcon';
import { LevelPicker } from '../../ui/LevelPicker';
import { CharacterPickerModal } from '../../ui/CharacterPicker';
import { PopIn } from '../../ui/motion';
import { sfx } from '../../ui/sound';
import { getSettings, setSettings } from '../../ui/settings';
import { Button, Confirm, focusRing, RoundButton, Row, Screen, T, tap } from '../../ui/kit';
import { QrCode } from '../../ui/QrCode';
import { TvContext } from '../../ui/settings';
import { SOFT, shellColors as colors, shellFont as font, radius } from '../../ui/theme';

export default function RoomScreen() {
  useStayAwake();
  const online = useOnline();
  const { snapshot, seatView, room } = online;

  useEffect(() => {
    if (!online.error) return;
    const t = setTimeout(clearOnlineError, 3000);
    return () => clearTimeout(t);
  }, [online.error]);

  const exit = () => {
    leaveRoom();
    router.replace('/');
  };
  useEffect(() => leaveIfPlaying, []);

  // Ricaricando la pagina della stanza si rientra da soli, col codice dell'indirizzo.
  const { code: codeParam } = useLocalSearchParams<{ code?: string }>();
  const tried = useRef(false);
  useEffect(() => {
    const c = normalizeCode(codeParam ?? '');
    if (room || tried.current || c.length !== CODE_LENGTH) return;
    tried.current = true;
    rejoin(c);
  }, [room, codeParam]);

  if (!room && online.status === 'connecting') {
    return (
      <Screen>
        <T size={20} weight="800">
          ⏳ Entro nella stanza…
        </T>
        {online.waking && (
          <T size={15} color={colors.muted}>
            Il server delle stanze si sta svegliando: la prima volta ci vuole fino a un minuto.
          </T>
        )}
      </Screen>
    );
  }
  if (!room || online.status === 'closed') {
    return (
      <Screen>
        <T size={24} weight="900">
          {online.status === 'closed' ? 'La stanza è stata chiusa' : 'Non sei in nessuna stanza'}
        </T>
        <Button label="Entra con un codice" onPress={() => router.replace('/')} />
        <Button label="Torna ai giochi" kind="ghost" color={colors.text} onPress={exit} />
      </Screen>
    );
  }
  if (!snapshot) {
    return (
      <Screen>
        <T size={20} weight="800">
          ⏳ Collegamento alla stanza…
        </T>
      </Screen>
    );
  }

  const me = snapshot.members.find((m) => m.id === room.sessionId);
  const tv = me?.role === 'screen';
  const isHost = canControl(snapshot, room.sessionId);
  // Stato di riconnessione visibile su TV e telefono (V-PTY-3).
  const reconnecting = online.status === 'reconnecting' && (
    <View style={styles.reconnect} accessibilityLiveRegion="assertive">
      <T weight="800" color={colors.onAccent}>
        📡 Connessione persa, riprovo…
      </T>
    </View>
  );

  if (snapshot.phase === 'playing' && seatView) {
    const game = getGame(seatView.gameId)!;
    // Chi è caduto ha un minuto per tornare: intanto gli altri sanno chi stanno aspettando.
    const away = snapshot.seats.filter((s) => snapshot.members.some((m) => m.id === s.memberId && !m.connected)).map((s) => s.name);
    return (
      <Screen scroll={false}>
        <GameFrame
          meta={game.meta}
          view={seatView.view}
          me={seatView.me}
          names={seatView.names}
          avatars={seatView.avatars}
          myTurn={seatView.myTurn}
          active={seatView.active}
          onMove={sendMove}
          pending={online.pending}
          result={seatView.result}
          lastAction={seatView.lastAction}
          error={online.error}
          onExit={exit}
          onRestart={isHost ? () => send('restart') : undefined}
          tv={tv}
          roomCode={snapshot.code}
          onChangeGame={isHost ? () => send('toLobby') : undefined}
          overlay={
            reconnecting || (away.length > 0 && !seatView.result && (
              <View style={styles.reconnect} accessibilityLiveRegion="polite">
                <T weight="800" color={colors.onAccent}>
                  ⏳ Aspetto {away.join(' e ')}, si sta ricollegando…
                </T>
              </View>
            ))
          }
        />
      </Screen>
    );
  }

  return (
    <TvContext.Provider value={tv}>
      <Lobby snapshot={snapshot} myId={room.sessionId} isHost={isHost} tv={tv} error={online.error} onExit={exit} reconnecting={reconnecting} />
    </TvContext.Provider>
  );
}

function Lobby({ snapshot, myId, isHost, tv, error, onExit, reconnecting }: {
  snapshot: RoomSnapshot;
  myId: string;
  isHost: boolean;
  tv: boolean;
  error: string | null;
  onExit: () => void;
  reconnecting: React.ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const isTable = useIsTable();
  const [leaving, setLeaving] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const big = tv || isTable;
  const game = snapshot.gameId ? getGame(snapshot.gameId) : undefined;
  const players = snapshot.members.filter((m) => m.role === 'player');
  const total = players.length + snapshot.bots;
  const url = joinUrl(snapshot.code);
  const leader = snapshot.members.find((m) => m.id === snapshot.hostId && m.role === 'player') ?? players[0];
  const allowed = game ? playerCounts(game.meta) : [];
  const canStart = !!game && allowed.includes(total);
  const meIndex = players.findIndex((p) => p.id === myId);
  const [picking, setPicking] = useState(false);
  const [editingBot, setEditingBot] = useState<number | null>(null);
  const iconSize = useIconSize();
  // Chi entra si sente, come in Jackbox: un "ding" a ogni nuovo giocatore.
  const seen = useRef(players.length);
  useEffect(() => {
    if (players.length > seen.current) sfx('turn');
    seen.current = players.length;
  }, [players.length]);
  // Le maschere di tutti al tavolo: chi non ha scelto ne riceve una libera, come in partita.
  const avatars = assignAvatars([...players.map((m) => ({ name: m.name, bot: false, avatar: m.avatar })), ...snapshot.botNames.map((name) => ({ name, bot: true }))]);
  const canBots = isHost && !game?.meta.humansOnly;
  const addBot = () => send('setBots', { count: snapshot.bots + 1 });
  const canAddBot = !game || total < game.meta.maxPlayers;

  const modals = (
    <>
      <CharacterPickerModal
        visible={picking}
        title="Tu"
        value={meIndex >= 0 ? avatars[meIndex] : null}
        taken={avatars.filter((_, j) => j !== meIndex)}
        onPick={(avatar) => {
          send('avatar', { avatar });
          setSettings({ ...getSettings(), avatar });
        }}
        name={players.find((m) => m.id === myId)?.name}
        onRename={(name) => {
          send('rename', { name });
          loadNames().then((n) => saveNames([name, ...n.slice(1)]));
        }}
        onClose={() => setPicking(false)}
      />
      <CharacterPickerModal
        visible={editingBot !== null}
        title={editingBot === null ? '' : `Computer: ${snapshot.botNames[editingBot] ?? ''}`}
        value={editingBot === null ? null : avatars[players.length + editingBot]}
        taken={avatars.filter((_, j) => editingBot === null || j !== players.length + editingBot)}
        header={
          editingBot !== null ? (
            <LevelPicker value={snapshot.botLevels?.[editingBot] ?? 'normale'} onChange={(level) => send('setBot', { index: editingBot, level })} />
          ) : null
        }
        onPick={(avatar) => {
          const name = BOT_CHARACTERS.find((c) => c.id === avatar)?.name;
          if (editingBot !== null && name) send('setBot', { index: editingBot, name });
        }}
        onClose={() => setEditingBot(null)}
      />
      <Confirm visible={leaving} title="Uscire dalla stanza?" message="Potrai rientrare con lo stesso codice." confirmLabel="Esci" onCancel={() => setLeaving(false)} onConfirm={onExit} />
    </>
  );

  // Cambia gioco: prima quelli adatti a chi è al tavolo, sotto gli altri con quante persone servono.
  if (choosing) {
    const pick = (id: string) => {
      send('setGame', { gameId: id });
      setChoosing(false);
    };
    // Finché al tavolo non c'è ancora nessun altro, si può scegliere fra tutti i giochi.
    const fits = GAMES.filter((g) => total <= 1 || playerCounts(g.meta).includes(total));
    const others = GAMES.filter((g) => !fits.includes(g));
    return (
      <Screen>
        <Row gap={10}>
          <RoundButton icon="back" label="Torna alla stanza" onPress={() => setChoosing(false)} />
          <T size={24} weight="900">
            Scegli il gioco
          </T>
        </Row>
        <CodeStrip code={snapshot.code} total={total} />
        {total > 1 && (
          <T size={20} weight="900" color={colors.accent}>
            Adatti ai {total} al tavolo
          </T>
        )}
        <GameGrid>
          {fits.map((g) => (
            <GameIcon key={g.meta.id} meta={g.meta} size={iconSize} selected={g.meta.id === snapshot.gameId} onPress={() => pick(g.meta.id)} />
          ))}
        </GameGrid>
        {others.length > 0 && (
          <>
            <T size={15} weight="800" color={colors.muted}>
              Con più o meno persone
            </T>
            <GameGrid>
              {others.map((g) => (
                <GameIcon key={g.meta.id} meta={g.meta} size={iconSize} dim selected={g.meta.id === snapshot.gameId} caption={`${g.meta.name}: ${needed(g.meta, total)}`} onPress={() => pick(g.meta.id)} />
              ))}
            </GameGrid>
          </>
        )}
      </Screen>
    );
  }

  // Chi è entrato col QR o col codice: nessuna domanda, sa che è dentro e chi c'è con lui.
  if (!isHost && !tv) {
    const others = players.filter((p) => p.id !== myId);
    return (
      <Screen style={{ flexGrow: 1 }}>
        <View style={styles.guestTop}>
          <RoundButton icon="back" label="Esci dalla stanza" onPress={() => setLeaving(true)} />
          <CodeStrip code={snapshot.code} total={total} flat />
        </View>
        <View style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <T size={40} weight="900" color={colors.accent} center>
            Sei dentro!
          </T>
          {meIndex >= 0 && <CharacterAvatar id={avatars[meIndex]} size={170} seat={meIndex} />}
          <T size={28} weight="900" center>
            {players[meIndex]?.name}
          </T>
          <Button small kind="ghost" color={colors.text} label="Cambia nome e mostrino" onPress={() => setPicking(true)} />
          {others.length > 0 && (
            <>
              <Row gap={0}>
                {others.slice(0, 6).map((m, i) => (
                  <View key={m.id} style={{ marginLeft: i ? -12 : 0 }}>
                    <CharacterAvatar id={avatars[players.indexOf(m)]} size={54} />
                  </View>
                ))}
              </Row>
              <T size={15} weight="800" color={colors.muted} center>
                Con te: {others.map((m) => m.name).join(', ')}
              </T>
            </>
          )}
        </View>
        <GameRow game={game} text={game ? `Parte quando ${leader?.name ?? 'il capotavola'} è pronto` : `${leader?.name ?? 'Il capotavola'} sta scegliendo il gioco…`} />
        {reconnecting}
        {modals}
      </Screen>
    );
  }

  const seats = (
    <TableSeats
      big={big}
      total={total}
      maxPlayers={game?.meta.maxPlayers}
      players={players}
      botNames={snapshot.botNames}
      botLevels={snapshot.botLevels}
      avatars={avatars}
      myId={myId}
      leaderId={leader?.id}
      isHost={isHost}
      onMe={() => setPicking(true)}
      onBot={setEditingBot}
      onAddBot={canBots && canAddBot ? addBot : undefined}
      onRemoveBot={canBots && snapshot.bots > 0 ? () => send('setBots', { count: snapshot.bots - 1 }) : undefined}
    />
  );
  const gameRow = <GameRow fill={big} game={game} text={isHost ? (game ? 'Cambia gioco' : 'Scegli il gioco') : `${leader?.name ?? 'Il capotavola'} sta scegliendo il gioco…`} onPress={isHost ? () => setChoosing(true) : undefined} />;
  const start = isHost ? (
    <StartButton fill={big} game={game} total={total} allowed={allowed} canStart={canStart} onChoose={() => setChoosing(true)} />
  ) : (
    <T center color={colors.muted} size={16}>
      La partita parte quando {leader?.name ?? 'il capotavola'} è pronto.
    </T>
  );

  if (big) {
    // Sulla TV si usa tutto lo schermo, dentro il margine di sicurezza del 5%.
    const coverWidth = tv ? Math.round(width * 0.9) : Math.min(width, 1100) - 32;
    return (
      <Screen>
        <Copertina
          width={coverWidth}
          height={Math.max(360, Math.round(height * 0.5))}
          code={snapshot.code}
          url={url}
          count={total}
          top={
            <Row gap={10}>
              <RoundButton icon="back" label="Esci dalla stanza" onPress={() => setLeaving(true)} />
              <T size={34} weight="900" color={colors.accent}>
                Tavolata
              </T>
            </Row>
          }
        />
        {/* Due colonne uguali e alla stessa altezza: a sinistra chi c'è, a destra cosa si gioca e il via. */}
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'stretch' }}>
          <View style={{ flex: 1 }}>{seats}</View>
          <View style={{ flex: 1, gap: 12 }}>
            {gameRow}
            {start}
          </View>
        </View>
        {error && (
          <T color={colors.danger} weight="800">
            ⚠ {error}
          </T>
        )}
        {reconnecting}
        {modals}
      </Screen>
    );
  }

  // Dal telefono, tre blocchi: cosa si gioca, chi c'è, come si entra. Il via resta in fondo.
  return (
    <Screen style={{ flexGrow: 1 }}>
      <Row gap={10}>
        <RoundButton icon="back" label="Esci dalla stanza" onPress={() => setLeaving(true)} />
        <View style={{ flex: 1 }}>{gameRow}</View>
      </Row>
      {seats}
      <View style={styles.invite}>
        <T size={15} weight="800">
          Inquadra il QR per entrare
        </T>
        {url && <QrCode value={url} size={214} />}
        <Row style={{ alignSelf: 'stretch', justifyContent: 'space-between' }} gap={10}>
          <Text accessibilityLabel={`Codice stanza ${snapshot.code.split('').join(' ')}`} style={styles.code}>
            {snapshot.code}
          </Text>
          {url && <InviteButton url={url} code={snapshot.code} />}
        </Row>
      </View>
      {error && (
        <T color={colors.danger} weight="800">
          ⚠ {error}
        </T>
      )}
      <View style={{ flexGrow: 1 }} />
      {start}
      {reconnecting}
      {modals}
    </Screen>
  );
}

/** Quante persone servono per un gioco, rispetto a chi è al tavolo. */
function needed(meta: GameMeta, total: number) {
  const counts = playerCounts(meta);
  if (meta.minPlayers === meta.maxPlayers) return `in ${meta.minPlayers}`;
  if (total < meta.minPlayers) return `da ${meta.minPlayers}`;
  if (total > meta.maxPlayers) return `fino a ${meta.maxPlayers}`;
  return counts.join(' o ');
}

/** Il gioco scelto, in cima alla stanza: chi comanda lo cambia con un tocco. */
function GameRow({ game, text, onPress, fill }: { game?: { meta: GameMeta }; text: string; onPress?: () => void; fill?: boolean }) {
  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${game?.meta.name ?? 'Nessun gioco'}. ${text}`}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={(state) => [styles.gameRow, fill && styles.fill, { transform: [{ translateY: (state as { pressed: boolean }).pressed ? 3 : 0 }] }, focusRing((state as { focused?: boolean }).focused ?? false)]}
    >
      {game ? <GameArt id={game.meta.id} size={52} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={22} weight="900" lines={1}>
          {game?.meta.name ?? 'Nessun gioco'}
        </T>
        <T size={14} weight="800" color={colors.accent} lines={2}>
          {text}
        </T>
      </View>
    </Pressable>
  );
}

/** Il bottone del via: quando manca qualcosa dice cosa, così non serve spiegare altro. */
function StartButton({ game, total, allowed, canStart, onChoose, fill }: { game?: { meta: GameMeta }; total: number; allowed: number[]; canStart: boolean; onChoose: () => void; fill?: boolean }) {
  const size = fill ? styles.fill : undefined;
  if (!game) return <Button label="Scegli il gioco" style={size} onPress={onChoose} />;
  if (canStart)
    return (
      <Button
        label="Si gioca!"
        style={size}
        onPress={() => {
          setSettings({ ...getSettings(), lastGame: game.meta.id });
          send('start');
        }}
      />
    );
  const next = allowed.find((n) => n > total);
  const missing = next === undefined ? null : next - total;
  return (
    <View style={[styles.waiting, size]} accessibilityLiveRegion="polite">
      <T size={22} weight="900" center>
        {missing === null ? `Troppi: massimo ${allowed[allowed.length - 1]}` : `${missing === 1 ? 'Serve' : 'Servono'} ancora ${missing} giocator${missing === 1 ? 'e' : 'i'}`}
      </T>
    </View>
  );
}

/** Codice e conto in una striscia, dove il QR non c'è. */
function CodeStrip({ code, total, flat }: { code: string; total: number; flat?: boolean }) {
  return (
    <View style={[styles.strip, flat && { flex: 1 }]}>
      <Text accessibilityLabel={`Codice stanza ${code.split('').join(' ')}`} style={styles.stripCode}>
        {code}
      </Text>
      <T size={15} weight="800" style={{ flex: 1, textAlign: 'right' }}>
        {total} al tavolo
      </T>
    </View>
  );
}

/** Chi è al tavolo: persone e computer con la stessa icona tonda, più i posti ancora liberi. */
function TableSeats({ big, total, maxPlayers, players, botNames, botLevels, avatars, myId, leaderId, isHost, onMe, onBot, onAddBot, onRemoveBot }: {
  big: boolean;
  total: number;
  maxPlayers?: number;
  players: RoomSnapshot['members'];
  botNames: string[];
  botLevels?: RoomSnapshot['botLevels'];
  avatars: string[];
  myId: string;
  leaderId?: string;
  isHost: boolean;
  onMe: () => void;
  onBot: (i: number) => void;
  onAddBot?: () => void;
  onRemoveBot?: () => void;
}) {
  const { height } = useWindowDimensions();
  const size = big ? Math.max(84, Math.round(height * 0.12)) : 66;
  const row = 4;
  const tiles = (onAddBot ? 1 : 0) + (onRemoveBot ? 1 : 0);
  const free = Math.max(0, Math.min((maxPlayers ?? row) - total, row - total - tiles));
  return (
    <View style={[styles.seats, big && styles.seatsBig]}>
      {!big && (
        <T size={22} weight="900" color={colors.accent}>
          {total} al tavolo
        </T>
      )}
      <View style={styles.seatGrid}>
        {players.map((m, i) => (
          <PopIn key={m.id}>
            <SeatCard
              size={size}
              avatar={avatars[i]}
              seat={i}
              mine={m.id === myId}
              name={m.id === myId ? 'Tu' : m.name}
              note={!m.connected ? '📡 si ricollega' : leaderId === m.id && m.id !== myId && !big ? 'capotavola' : undefined}
              onPress={m.id === myId ? onMe : undefined}
              a11y={m.id === myId ? 'Cambia nome e personaggio' : undefined}
            />
          </PopIn>
        ))}
        {botNames.map((name, i) => (
          <PopIn key={name}>
            <SeatCard
              size={size}
              avatar={avatars[players.length + i]}
              seat={players.length + i}
              name={name}
              note={big ? undefined : BOT_LEVELS.find((l) => l.id === (botLevels?.[i] ?? 'normale'))?.label ?? 'Normale'}
              onPress={isHost ? () => onBot(i) : undefined}
              a11y={isHost ? `Cambia mostrino e bravura di ${name}` : undefined}
            />
          </PopIn>
        ))}
        {Array.from({ length: free }, (_, i) => (
          <EmptySeat key={i} size={size} label="Libero" />
        ))}
        {onAddBot && <EmptySeat size={size} label="Computer" sign="+" a11y="Aggiungi un computer" onPress={onAddBot} />}
        {onRemoveBot && <EmptySeat size={size} label="Togli" sign="−" a11y="Togli un computer" onPress={onRemoveBot} />}
      </View>
    </View>
  );
}

function EmptySeat({ size, label, sign, a11y, onPress }: { size: number; label: string; sign?: string; a11y?: string; onPress?: () => void }) {
  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={a11y ?? label}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={[styles.seatCard, { width: size + (size > 70 ? 36 : 12) }]}
    >
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.dim, alignItems: 'center', justifyContent: 'center' }}>
        {sign ? (
          <T size={26} weight="900" color={colors.muted}>
            {sign}
          </T>
        ) : null}
      </View>
      <T size={14} weight="800" color={colors.muted} lines={1} center>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  seats: { backgroundColor: colors.surface, borderRadius: radius.l, borderWidth: 1, borderColor: colors.line, boxShadow: SOFT, marginBottom: 6, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, gap: 10 },
  seatsBig: { flex: 1, justifyContent: 'center' },
  fill: { flex: 1, marginBottom: 6 },
  seatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'space-between' },
  seatCard: { alignItems: 'center', gap: 3 },
  invite: { alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, borderRadius: radius.l, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.cover, boxShadow: SOFT, marginBottom: 6 },
  code: { color: colors.accent, fontFamily: font.display, fontSize: 32, lineHeight: 40, letterSpacing: 2 },
  gameRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, boxShadow: SOFT, marginBottom: 5 },
  waiting: { minHeight: 66, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: radius.l, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.dim },
  strip: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.line },
  stripCode: { color: colors.accent, fontFamily: font.display, fontSize: 20, letterSpacing: 1 },
  guestTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reconnect: { position: 'absolute', top: 8, alignSelf: 'center', backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
});

/** Un posto al tavolo nella stanza: icona tonda, nome e, se serve, una riga (capotavola, bravura del computer). */
function SeatCard({ size, avatar, seat, mine, name, note, onPress, a11y }: { size: number; avatar: string; seat: number; mine?: boolean; name: string; note?: string; onPress?: () => void; a11y?: string }) {
  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={a11y ?? name}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={(state) => [styles.seatCard, { width: size + (size > 70 ? 36 : 12), transform: [{ translateY: (state as { pressed: boolean }).pressed ? 2 : 0 }] }]}
    >
      <View style={mine ? { borderRadius: size, borderWidth: 1, borderColor: colors.accent } : undefined}>
        <CharacterAvatar id={avatar} size={mine ? size - 6 : size} seat={seat} />
      </View>
      <T size={14} weight="800" lines={1} center>
        {name}
      </T>
      {note ? (
        <T size={11} weight="800" lines={1} center color={colors.muted}>
          {note}
        </T>
      ) : null}
    </Pressable>
  );
}

/** Invito come in Jackbox: il link porta dritto alla stanza col codice già scritto. */
function InviteButton({ url, code }: { url: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const message = `Vieni a giocare su Tavolata! Stanza ${code}: ${url}`;
  const share = () => {
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> }) : null;
    if (Platform.OS !== 'web') Share.share({ message }).catch(() => {});
    else if (nav?.share) nav.share({ title: 'Tavolata', text: `Stanza ${code}`, url }).catch(() => {});
    else if (nav?.clipboard) {
      nav.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }).catch(() => {});
    }
  };
  return <Button small label={copied ? '✓ Copiato' : 'Manda il link'} color="#FFFFFF" onPress={share} />;
}
